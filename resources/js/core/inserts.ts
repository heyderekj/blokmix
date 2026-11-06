// Bloks you add to a section: a button, a link, a line of text, a heading, a badge, a picture or an icon, placed
// right after a block the section already has, or after that block in every item of a list. They're stored per clip
// (`slot.inserts[clipId]`, like `edits`), drawn into the section's tree after its blocks are stamped (so the clip's
// own ids never shift), and carry fixed ids (a1, a2…) and `data-mx-extra`, so frames can patch them in and take them
// out again. A new blok copies the nearest block of its kind in the section, so it gets the layout's own look and
// spacing; with none to copy it's drawn from the layout primitives with a little CSS of its own (INSERT_CSS).

import type { HEl, HNode } from './html/parse'
import { attr, mapTree, walk } from './html/parse'
import { FIELD_SCHEMA } from './content'
import type { BlockInfo, Insert, InsertKind, SectionType, Slot } from './types'

export const INSERT_KINDS: readonly InsertKind[] = ['button', 'link', 'text', 'heading', 'badge', 'image', 'icon']

export const INSERT_LABEL: Record<InsertKind, string> = {
  button: 'Button',
  link: 'Link',
  text: 'Text',
  heading: 'Heading',
  badge: 'Badge',
  image: 'Picture',
  icon: 'Icon',
}

/** The words a new blok starts with (your copy wins when the field is one of its own). */
export const INSERT_WORDS: Partial<Record<InsertKind, string>> = {
  button: 'Learn more',
  link: 'Read more',
  text: 'A sentence or two about this.',
  heading: 'A short heading',
  badge: 'New',
}

/** Field names a section type already knows, by kind, so your copy fills them and they follow you across layouts. */
const SCHEMA_PICKS: Partial<Record<InsertKind, string[]>> = {
  button: ['ctaSecondary', 'ctaPrimary', 'cta', 'submit'],
  link: ['cta', 'ctaSecondary'],
  text: ['note', 'lead', 'intro', 'subhead', 'body', 'caption', 'footnote'],
  heading: ['heading', 'title', 'subheading'],
  badge: ['eyebrow', 'badge', 'tag'],
}

/** In every item of a list, the field's end ("f3" + "Cta"), by kind. */
const ITEM_RESTS: Partial<Record<InsertKind, string[]>> = {
  button: ['Cta', 'Button', 'Action'],
  link: ['Link', 'Cta', 'More'],
  text: ['Body', 'Text', 'Note', 'Meta'],
  heading: ['Title', 'Heading', 'Subtitle'],
  badge: ['Tag', 'Badge', 'Label'],
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const isEl = (n: HNode): n is HEl => n.t === 'el'
const el = (tag: string, attrs: [string, string][], kids: HNode[] = [], ns: 'html' | 'svg' = 'html'): HEl => ({ t: 'el', tag, ns, attrs, kids })
const nl: HNode = { t: 'text', v: '\n' }
const setAttr = (e: HEl, k: string, v: string | null): HEl => ({ ...e, attrs: [...e.attrs.filter(([x]) => x !== k), ...(v == null ? [] : [[k, v] as [string, string]])] })
const classes = (e: HEl) => (attr(e, 'class') ?? '').split(/\s+/).filter(Boolean)

/**
 * A field name for a new blok outside any list: one the section type knows and this layout doesn't use yet, else
 * `addedButton`, `addedButtonB`… (letters, never a number, so nothing mistakes it for an item's numbered field).
 */
export function insertField(kind: InsertKind, type: SectionType, taken: Iterable<string>): string | undefined {
  if (kind === 'image' || kind === 'icon') return undefined
  const used = new Set(taken)
  const known = FIELD_SCHEMA[type] ?? []
  const pick = (SCHEMA_PICKS[kind] ?? []).find((f) => known.includes(f) && !used.has(f))
  if (pick) return pick
  for (let i = 0; i < 26; i++) {
    const f = `added${cap(kind)}${i ? String.fromCharCode(65 + i) : ''}`
    if (!used.has(f)) return f
  }
  return undefined
}

/** The end of an every-item field ("Cta"), one the list's items don't use yet. */
export function itemRest(kind: InsertKind, itemFields: Iterable<string>, key: string, n: number): string | undefined {
  if (kind === 'image' || kind === 'icon') return undefined
  const used = new Set(itemFields)
  for (const r of [...(ITEM_RESTS[kind] ?? []), `Added${cap(kind)}`]) if (!used.has(`${key}${n}${r}`)) return r
  return undefined
}

/** The next free insert id in a section (a1, a2…), across every clip it has added bloks to. */
export function nextInsertId(all: Record<string, Insert[]> | undefined): string {
  let max = 0
  for (const list of Object.values(all ?? {})) for (const i of list) max = Math.max(max, Number(i.id.slice(1)) || 0)
  return `a${max + 1}`
}

/** Whether a block id is (or is inside) a blok you added: a1, a1.f7 (a copied item's), a1f3 (in every item), a1-0. */
export const insertOf = (blockId: string): string | null => /^a\d+/.exec(blockId)?.[0] ?? null

/* ---------- drawing ---------- */

/** Grid placement belongs to the block it was copied from, not to the copy. */
const PLACEMENT = /^(t-|m-)?(col|start)-\d+$/

/** The block to copy for a kind: near the anchor first (its parent, then up), else anywhere in the section. */
function templateFor(kind: InsertKind, path: HEl[]): HEl | undefined {
  const isTemplate = (n: HNode): n is HEl =>
    isEl(n) && attr(n, 'data-mx-block') === kind && attr(n, 'data-mx-extra') === undefined && attr(n, 'data-mx-mirror') === undefined && attr(n, 'aria-hidden') !== 'true'
  for (let i = path.length - 1; i >= 0; i--) {
    let hit: HEl | undefined
    walk([path[i]], (n) => {
      if (!hit && isTemplate(n)) hit = n
    })
    if (hit) return hit
  }
  return undefined
}

/** A primitive blok, for a section with nothing of that kind to copy. */
function primitive(kind: InsertKind, media: string): HEl {
  const words = (k: InsertKind) => [{ t: 'text', v: INSERT_WORDS[k] ?? '' } as HNode]
  switch (kind) {
    case 'button':
      return el('a', [['href', '#'], ['class', 'btn secondary mx-add mx-add-btn'], ['data-mx-block', 'button']], words('button'))
    case 'link':
      return el('a', [['href', '#'], ['class', 'mx-add mx-add-link'], ['data-mx-block', 'link']], words('link'))
    case 'text':
      return el('p', [['class', 'mx-add mx-add-text'], ['data-mx-block', 'text']], words('text'))
    case 'heading':
      return el('h3', [['class', 'mx-add mx-add-heading'], ['data-mx-block', 'heading']], words('heading'))
    case 'badge':
      return el('span', [['class', 'mx-add mx-add-badge'], ['data-mx-block', 'badge']], words('badge'))
    case 'image':
      return el('div', [['class', 'media mx-add mx-add-media'], ['data-mx-block', 'image'], ['data-mx-media', media], ['data-mx-ratio', '16/9']], [
        el('svg', [['class', 'x'], ['viewBox', '0 0 100 100'], ['preserveAspectRatio', 'none'], ['aria-hidden', 'true']], [el('path', [['d', 'M0 0 100 100M100 0 0 100']], [], 'svg')], 'svg'),
      ])
    case 'icon':
      return el(
        'svg',
        [['class', 'mx-add mx-add-icon'], ['data-mx-block', 'icon'], ['data-mx-icon', 'star'], ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']],
        [el('path', [['d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z']], [], 'svg')],
        'svg',
      )
  }
}

/**
 * The markup for one blok: a copy of the nearest block of its kind (its field renamed, its words the blok's own, a
 * main button turned quieter), or a primitive. Every block inside gets an id under the blok's, so a frame's own
 * stamping never shifts.
 */
export function insertMarkup(kind: InsertKind, id: string, field: string | undefined, path: HEl[], media = `added${id.replace(/\W/g, '')}`): HEl {
  const tmpl = templateFor(kind, path)
  let root: HEl
  if (tmpl) {
    let fieldSet = false
    let k = 0
    root = mapTree([tmpl], (e) => {
      let x: HEl = { ...e, attrs: e.attrs.filter(([a]) => a !== 'data-mx-b' && a !== 'id' && a !== 'for') }
      if (attr(e, 'data-mx-mirror') !== undefined) return { ...x, attrs: x.attrs.filter(([a]) => a !== 'data-mx-mirror') }
      if (attr(e, 'data-mx-field') !== undefined) {
        if (!fieldSet && field) {
          x = setAttr(x, 'data-mx-field', field)
          x = { ...x, kids: [{ t: 'text', v: INSERT_WORDS[kind] ?? '' }] }
          fieldSet = true
        } else x = setAttr(x, 'data-mx-field', null)
      }
      if (attr(e, 'data-mx-media') !== undefined) x = setAttr(x, 'data-mx-media', media)
      if (e !== tmpl && attr(e, 'data-mx-block') !== undefined) x = setAttr(x, 'data-mx-b', `${id}-${k++}`)
      return x
    })[0] as HEl
    // Where the copy came from placed it; the copy goes where it's put.
    const cls = classes(root).filter((c) => !PLACEMENT.test(c))
    // One main action per section: a copied main button is the quieter kind.
    if (kind === 'button' && cls.includes('primary')) cls.splice(cls.indexOf('primary'), 1, 'secondary')
    root = setAttr(root, 'class', cls.join(' ') || null)
  } else {
    root = primitive(kind, media)
    if (field) root = setAttr(root, 'data-mx-field', field)
  }
  root = setAttr(setAttr(root, 'data-mx-b', id), 'data-mx-extra', 'add')
  return setAttr(root, 'data-mx-label', INSERT_LABEL[kind] === 'Picture' ? 'Picture' : INSERT_LABEL[kind])
}

/** A button needs a row to sit in when it lands after something that isn't one. */
function wrapIfNeeded(kind: InsertKind, node: HEl, anchor: HEl): HEl {
  if (kind !== 'button' || attr(anchor, 'data-mx-block') === 'button') return node
  return el('div', [['class', 'mx-add mx-add-actions'], ['data-mx-extra', 'add']], [node])
}

/** Every insert drawn into a stamped tree. Bloks whose anchor is gone, or sits inside a list item, are left out. */
export function applyInserts(tree: HNode[], inserts: Insert[], type: SectionType): HNode[] {
  if (!inserts.length) return tree
  const single = new Map<string, Insert[]>()
  const every = new Map<string, Insert[]>()
  for (const ins of inserts) (ins.every ? every : single).set(ins.after, [...((ins.every ? every : single).get(ins.after) ?? []), ins])

  // The path from the root to each element, to find copies near the anchor and check it isn't inside an item.
  const go = (nodes: HNode[], path: HEl[], inItem: boolean): HNode[] => {
    const out: HNode[] = []
    for (const n of nodes) {
      if (!isEl(n)) {
        out.push(n)
        continue
      }
      const item = inItem || attr(n, 'data-mx-block') === 'item'
      const here = [...path, n]
      let next: HEl = { ...n, kids: go(n.kids, here, item) }
      // In every item of this list: after the anchor's counterpart in each item.
      if (attr(n, 'data-mx-block') === 'list') next = everyItem(next, every, type, here)
      out.push(next)
      const b = attr(n, 'data-mx-b')
      const mine = b && !item ? single.get(b) : undefined
      if (mine) for (const ins of mine) out.push(nl, wrapIfNeeded(ins.kind, insertMarkup(ins.kind, ins.id, ins.field, here, ins.media), n))
    }
    return out
  }
  return go(tree, [], false)
}

/** Child-element indexes from an item down to a block in it. */
function pathTo(item: HEl, id: string): number[] | null {
  const kids = item.kids.filter(isEl)
  for (let i = 0; i < kids.length; i++) {
    if (attr(kids[i], 'data-mx-b') === id) return [i]
    const deeper = pathTo(kids[i], id)
    if (deeper) return [i, ...deeper]
  }
  return null
}

/** A list with every-item bloks put into each of its items, after the anchor's counterpart. */
function everyItem(list: HEl, every: Map<string, Insert[]>, type: SectionType, path: HEl[]): HEl {
  if (!every.size) return list
  const items = list.kids.filter((k): k is HEl => isEl(k) && attr(k, 'data-mx-block') === 'item')
  const mine = [...every.values()].flat().filter((ins) => ins.every!.list === attr(list, 'data-mx-b'))
  if (!mine.length || !items.length) return list
  void type
  let kids = list.kids
  for (const ins of mine) {
    const home = items.find((it) => pathTo(it, ins.after))
    const route = home && pathTo(home, ins.after)
    if (!route) continue
    kids = kids.map((k) => {
      if (!isEl(k) || attr(k, 'data-mx-block') !== 'item') return k
      const n = itemNumber(k, ins.every!.key)
      if (n == null) return k
      const field = ins.every!.rest ? `${ins.every!.key}${n}${ins.every!.rest}` : undefined
      return insertAt(k, route, (anchor, trail) =>
        wrapIfNeeded(ins.kind, insertMarkup(ins.kind, `${ins.id}${ins.every!.key}${n}`, field, [...path, ...trail], `${ins.media ?? `added${ins.id}`}${ins.every!.key}${n}`), anchor),
      )
    })
  }
  return { ...list, kids }
}

/** The number an item's own fields carry for a key ("f3Title" → 3). */
function itemNumber(item: HEl, key: string): number | undefined {
  let n: number | undefined
  walk([item], (x) => {
    if (n != null || !isEl(x)) return
    const f = attr(x, 'data-mx-field')
    const m = f && new RegExp(`^${key}(\\d+)(?=[A-Z]|$)`).exec(f)
    if (m) n = Number(m[1])
  })
  return n
}

/** An element with a node put in after the element at a child-index route. */
function insertAt(root: HEl, route: number[], make: (anchor: HEl, trail: HEl[]) => HEl, trail: HEl[] = []): HEl {
  const kids = root.kids
  let seen = -1
  const out: HNode[] = []
  for (const k of kids) {
    out.push(k)
    if (!isEl(k)) continue
    seen++
    if (seen !== route[0]) continue
    if (route.length === 1) out.push(nl, make(k, [...trail, root, k]))
    else out[out.length - 1] = insertAt(k, route.slice(1), make, [...trail, root])
  }
  return { ...root, kids: out }
}

/**
 * The CSS for bloks drawn from primitives (a copied blok has the layout's own): spacing in a flow with no gap, and a
 * plain look in tokens. Themes and block looks go over it like any block.
 */
export const INSERT_CSS = `@layer clip {
  [data-mx-section] .mx-add { margin-block-start: var(--mx-space-4); }
  [data-mx-section] .mx-add-actions { display: flex; flex-wrap: wrap; gap: var(--mx-space-3); }
  [data-mx-section] .mx-add-actions > * { margin-block-start: 0; }
  [data-mx-section] .mx-add-btn {
    display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
    padding: var(--mx-space-3) var(--mx-space-5); border: var(--mx-stroke) solid color-mix(in oklab, var(--mx-color-text) 30%, transparent);
    border-radius: var(--mx-radius); color: var(--mx-color-text); font-weight: 600; text-decoration: none; cursor: pointer;
  }
  [data-mx-section] .mx-add-link { color: var(--mx-color-primary); font-weight: 600; text-underline-offset: 3px; cursor: pointer; }
  [data-mx-section] .mx-add-text { color: var(--mx-color-muted); max-width: 65ch; margin-inline: 0; }
  [data-mx-section] .mx-add-heading { font-family: var(--mx-font-display); font-size: var(--mx-text-xl); font-weight: var(--mx-type-display-weight); color: var(--mx-color-text); margin-inline: 0; }
  [data-mx-section] .mx-add-badge {
    display: inline-flex; width: fit-content; padding: var(--mx-space-1) var(--mx-space-3); border-radius: var(--mx-radius-pill);
    background: color-mix(in oklab, var(--mx-color-primary) 14%, transparent); color: var(--mx-color-text); font-size: var(--mx-text-sm); font-weight: 600;
  }
  [data-mx-section] .mx-add-media {
    position: relative; overflow: hidden; width: 100%; aspect-ratio: 16 / 9; background: var(--mx-color-surface);
    border: var(--mx-stroke) solid var(--mx-color-border); border-radius: var(--mx-radius-lg);
  }
  [data-mx-section] .mx-add-media .x { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: var(--mx-color-border); stroke-width: var(--mx-stroke); }
  [data-mx-section] .mx-add-media .x path { vector-effect: non-scaling-stroke; }
  [data-mx-section] .mx-add-icon { width: 24px; height: 24px; color: var(--mx-color-primary); }
}`

/* ---------- adding and removing ---------- */

export class InsertError extends Error {}

/** The item a block sits in (its nearest item ancestor), if any. */
function itemAround(blocks: BlockInfo[], b: BlockInfo): BlockInfo | undefined {
  for (let up: BlockInfo | undefined = b; up; up = up.parent ? blocks.find((x) => x.id === up!.parent) : undefined) if (up.kind === 'item') return up
  return undefined
}

/**
 * A section with a blok added after `afterId` (in the clip it shows). Inside a list item it goes in every item of
 * that list, so the list stays even (and exports as one template); elsewhere just there. Returns the new block's id
 * (in a list, the one in the item you were on).
 */
export function addInsert(
  slot: Slot,
  clip: { type: SectionType; fields: Record<string, string>; blocks: BlockInfo[] },
  kind: InsertKind,
  afterId: string,
): { slot: Slot; blockId: string } {
  const at = clip.blocks.find((b) => b.id === afterId)
  if (!at) throw new InsertError('Pick a block to add after.')
  const mine = slot.inserts?.[slot.clipId] ?? []
  const id = nextInsertId(slot.inserts)
  // After a blok you added: after the same anchor, so it lands next to it.
  const own = insertOf(afterId)
  const anchorOwn = own ? mine.find((i) => i.id === own) : undefined
  const item = itemAround(clip.blocks, at)
  const taken = [...Object.keys(clip.fields), ...mine.flatMap((i) => (i.field ? [i.field] : []))]
  let ins: Insert
  let blockId = id
  if (anchorOwn?.every || (item && !anchorOwn)) {
    const list = clip.blocks.find((b) => b.id === (anchorOwn?.every?.list ?? item?.parent))
    const key = list?.listKey ?? anchorOwn?.every?.key
    if (!list || !key || item?.n == null) throw new InsertError('This list’s items are set by the layout, so a blok can’t go in each of them.')
    // The anchor as the layout has it (a copied item's blocks are ids like b12.f7).
    const after = anchorOwn ? anchorOwn.after : afterId.split('.')[0]
    const rest = itemRest(kind, Object.keys(clip.fields).filter((f) => f.startsWith(`${key}${item.n}`)), key, item.n)
    const usedRests = mine.filter((i) => i.every?.list === list.id).map((i) => i.every?.rest)
    const free = rest && !usedRests.includes(rest) ? rest : rest ? `${rest}${'B'}` : undefined
    ins = { id, kind, after, every: { list: list.id, key, ...(free ? { rest: free } : {}) }, ...(kind === 'image' ? { media: `added${id}` } : {}) }
    blockId = `${id}${key}${item.n}`
  } else {
    const after = anchorOwn ? anchorOwn.after : afterId
    const field = insertField(kind, clip.type, taken)
    ins = { id, kind, after, ...(field ? { field } : {}), ...(kind === 'image' ? { media: `added${id}` } : {}) }
  }
  return { slot: { ...slot, inserts: { ...slot.inserts, [slot.clipId]: [...mine, ins] } }, blockId }
}

/** A section without one of the bloks it added (in any clip). */
export function removeInsert(slot: Slot, insertId: string): Slot {
  if (!slot.inserts) return slot
  const inserts = Object.fromEntries(Object.entries(slot.inserts).map(([c, list]) => [c, list.filter((i) => i.id !== insertId)]).filter(([, list]) => list.length))
  return { ...slot, inserts: Object.keys(inserts).length ? inserts : undefined }
}


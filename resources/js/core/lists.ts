// Lists: the repeating items in a section (features, questions, plans, the
// features inside each plan). Clips number their items' fields (f1Title,
// f2Title…), so a list's key is what its fields are numbered by ("f"), and an
// item is its number. A section can add, duplicate, remove and reorder items;
// new items copy an existing item's structure with their fields renumbered.
//
// Block ids stay stable through all of this: blocks are stamped b0… in the
// clip's own order first, and a copied block's id is its template's plus the
// item it belongs to ("b5.f4"), so edits, notes and selection follow items
// wherever they move.

import type { BlockInfo, Clip, ListItemRef, ProjectContent, Slot } from './types'
import { DEFAULT_CONTENT, resolveFields } from './content'
import { bannerTree } from './banner'
import { attr, extractFields, mapTree, parseHtml, walk, type HEl, type HNode } from './html/parse'
import { serialize } from './html/serialize'
import { indexBlocks } from './blocks'

/** A change for a live frame: replace the element matching `sel` with `html`. */
export interface ListPatch {
  sel: string
  html: string
  /** Insert the html just before `sel` instead of replacing it (an added banner). */
  before?: boolean
}

/** Things a section adds to its clip (a banner above a nav). */
export interface SectionExtras {
  banner?: boolean
}

/** A clip as one section shows it: its lists applied, blocks stamped and indexed. */
export interface SectionClip extends Clip {
  /** For frames, which keep the clip's own markup and patch lists in place. */
  patches: ListPatch[]
  /** The clip in the library. */
  source: Clip
  extras?: SectionExtras
}

const isEl = (n: HNode): n is HEl => n.t === 'el'
const isKind = (n: HNode, kind: string): n is HEl => isEl(n) && attr(n, 'data-mx-block') === kind
const fieldOf = (el: HEl) => attr(el, 'data-mx-field') ?? attr(el, 'data-mx-mirror')

/** Every way a field name splits into key + number + rest: "t1F2" → t/1/F2 and t1F/2/"". */
function splits(f: string): { key: string; n: number; rest: string }[] {
  const out: { key: string; n: number; rest: string }[] = []
  for (const m of f.matchAll(/\d+/g)) {
    const i = m.index!
    const j = i + m[0].length
    if (i === 0 || (j < f.length && !/[A-Z]/.test(f[j]))) continue
    out.push({ key: f.slice(0, i), n: Number(m[0]), rest: f.slice(j) })
  }
  return out
}

/** Fields in an element, not counting those inside lists nested in it. */
export function ownFields(el: HEl): string[] {
  const out: string[] = []
  const visit = (n: HEl) => {
    const f = fieldOf(n)
    if (f) out.push(f)
    for (const k of n.kids) if (isEl(k) && !isKind(k, 'list')) visit(k)
  }
  visit(el)
  return out
}

export const itemsOf = (list: HEl): HEl[] => list.kids.filter((k): k is HEl => isKind(k, 'item'))

/**
 * What a list's items are numbered by: a key every item uses with one number,
 * a different number per item. Null when the items aren't numbered (contact
 * details), so the list keeps the layout's own length.
 */
export function listKeyOf(list: HEl): string | null {
  const items = itemsOf(list)
  if (!items.length) return null
  const per = items.map((it) => {
    const m = new Map<string, { ns: Set<number>; count: number }>()
    for (const f of ownFields(it))
      for (const s of splits(f)) {
        const e = m.get(s.key) ?? { ns: new Set<number>(), count: 0 }
        e.ns.add(s.n)
        e.count++
        m.set(s.key, e)
      }
    return m
  })
  const keys = [...per[0].keys()].filter((k) => per.every((m) => m.get(k)?.ns.size === 1) && new Set(per.map((m) => [...m.get(k)!.ns][0])).size === items.length)
  keys.sort((a, b) => per[0].get(b)!.count - per[0].get(a)!.count || a.length - b.length)
  return keys[0] ?? null
}

/** An item's number in its list's key. */
export function numberOf(el: HEl, key: string): number | undefined {
  for (const f of ownFields(el)) for (const s of splits(f)) if (s.key === key) return s.n
  return undefined
}

const renumberRe = (key: string, from: number) => new RegExp(`^${key}${from}(?=[A-Z]|$)`)

const isRadio = (e: HEl) => e.tag === 'input' && attr(e, 'type') === 'radio'

/** Whether an item's own radio (a tab's, not one inside a nested list) is checked. */
function ownRadioChecked(el: HEl): boolean {
  let hit = false
  const visit = (n: HEl) => {
    if (isRadio(n) && attr(n, 'checked') !== undefined) hit = true
    for (const k of n.kids) if (isEl(k) && !isKind(k, 'list')) visit(k)
  }
  visit(el)
  return hit
}

/** An item with its own radio checked or not. */
function setOwnRadio(el: HEl, on: boolean): HEl {
  const visit = (n: HEl): HEl => {
    if (isRadio(n)) {
      const attrs = n.attrs.filter(([k]) => k !== 'checked')
      return { ...n, attrs: on ? [...attrs, ['checked', '']] : attrs }
    }
    return { ...n, kids: n.kids.map((k) => (isEl(k) && !isKind(k, 'list') ? visit(k) : k)) }
  }
  return visit(el)
}

/**
 * A copy of an item as item `to`: fields renumbered, block ids suffixed, ids kept unique, its picture names numbered
 * for the new item ("feature1" → "feature7"). `placed` are the item's own class names that only it has (a bento's
 * `c1`): they put it in one spot of the grid, so a copy leaves them behind and flows into the next free place.
 */
function cloneItem(el: HEl, key: string, from: number, to: number, placed: Set<string> = new Set()): HEl {
  const re = renumberRe(key, from)
  const tag = `${key}${to}`
  const media = (v: string) => (/\d+$/.test(v) ? v.replace(/\d+$/, (d) => (Number(d) === from ? String(to) : `${d}-${tag}`)) : `${v}-${tag}`)
  const out = mapTree([el], (e) => ({
    ...e,
    // A copy never opens itself: which tab is open belongs to the first position.
    attrs: (isRadio(e) ? e.attrs.filter(([k]) => k !== 'checked') : e.attrs).map(([k, v]): [string, string] => {
      if (k === 'data-mx-field' || k === 'data-mx-mirror') return [k, v.replace(re, tag)]
      if (k === 'data-mx-b') return [k, `${v}.${tag}`]
      if (k === 'data-mx-media') return [k, media(v)]
      if (k === 'id' || k === 'for') return [k, `${v}-${tag}`]
      return [k, v]
    }),
  }))[0] as HEl
  if (!placed.size) return out
  const cls = (attr(out, 'class') ?? '').split(/\s+/).filter((c) => c && !placed.has(c)).join(' ')
  return { ...out, attrs: out.attrs.map(([k, v]): [string, string] => (k === 'class' ? [k, cls] : [k, v])) }
}

/** Class names only one item has (a bento's c1…c6): they place that item, they aren't its look. */
function placementClasses(items: HEl[]): Set<string> {
  if (items.length < 3) return new Set()
  const count = new Map<string, number>()
  for (const it of items) for (const c of new Set((attr(it, 'class') ?? '').split(/\s+/).filter(Boolean))) count.set(c, (count.get(c) ?? 0) + 1)
  const once = [...count].filter(([, n]) => n === 1).map(([c]) => c)
  // Only when every item has one of its own (a pattern), not one odd item.
  return items.every((it) => (attr(it, 'class') ?? '').split(/\s+/).some((c) => once.includes(c))) ? new Set(once) : new Set()
}

/** An item with its words, ids and number taken out: items that match are built the same way. */
export function itemShape(el: HEl, key: string): string {
  const re = new RegExp(`^${key}\\d+(?=[A-Z]|$)`)
  const strip = (n: HNode): HNode => {
    if (!isEl(n)) return n
    const attrs = n.attrs
      .filter(([k]) => k !== 'data-mx-b')
      .map(([k, v]): [string, string] => (k === 'data-mx-field' || k === 'data-mx-mirror' ? [k, v.replace(re, `${key}#`)] : [k, v]))
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    return { ...n, attrs, kids: attr(n, 'data-mx-field') !== undefined || attr(n, 'data-mx-mirror') !== undefined ? [] : n.kids.map(strip) }
  }
  return serialize([strip(el)], 'html')
}

const ownAttrs = (el: HEl) => el.attrs.filter(([k]) => !k.startsWith('data-mx-'))

/**
 * Attributes only the first item has (an accordion's first answer open, a
 * bento's first tile wide) when the rest are built alike: they belong to the
 * first position, not to that item. Null when there's no such pattern. Strict, for
 * exports, which write such a list as one mapped template.
 */
export function firstOnly(items: HEl[], key: string): { first: [string, string][]; rest: [string, string][] } | null {
  if (items.length < 3) return null
  const rest = items.slice(1).map((it) => itemShape(it, key))
  if (rest.some((x) => x !== rest[0])) return null
  const a = ownAttrs(items[0])
  const b = ownAttrs(items[1])
  if (JSON.stringify(a) === JSON.stringify(b)) return null
  const swapped = { ...items[0], attrs: [...items[0].attrs.filter(([k]) => k.startsWith('data-mx-')), ...b] }
  return itemShape(swapped, key) === rest[0] ? { first: a, rest: b } : null
}

/**
 * The same for moving items: only the items' own attributes count, so the first
 * position keeps its open answer or wide tile even when each item's art or lines
 * differ (what's inside an item travels with it).
 */
export function firstPosition(items: HEl[]): { first: [string, string][]; rest: [string, string][] } | null {
  if (items.length < 3) return null
  const own = items.map((it) => JSON.stringify(ownAttrs(it)))
  if (own.slice(2).some((x) => x !== own[1]) || own[0] === own[1]) return null
  return { first: ownAttrs(items[0]), rest: ownAttrs(items[1]) }
}

/** Give an item the root attributes of a position (see firstOnly). */
const withRoot = (el: HEl, root: [string, string][]): HEl => ({ ...el, attrs: [...el.attrs.filter(([k]) => k.startsWith('data-mx-')), ...root] })

/** Rebuild an element's items in a new order, keeping its other children where they were. */
function reorder(el: HEl, isItem: (n: HNode) => n is HEl, num: (e: HEl) => number | undefined, key: string, refs: ListItemRef[]): HEl {
  const items = el.kids.filter(isItem)
  if (!items.length) return el
  const byN = new Map<number, HEl>()
  for (const it of items) {
    const n = num(it)
    if (n != null && !byN.has(n)) byN.set(n, it)
  }
  const firstN = num(items[0])
  if (firstN == null) return el
  // New items copy the most common item, not a first item that's special.
  const special = isItem(items[0]) && attr(items[0], 'data-mx-block') === 'item' ? firstPosition(items) : null
  const plainN = special ? num(items[1])! : firstN
  const placed = isItem(items[0]) && attr(items[0], 'data-mx-block') === 'item' ? placementClasses(items) : new Set<string>()
  const seen = new Set<number>()
  const next: HEl[] = []
  for (const r of refs) {
    if (seen.has(r.n)) continue
    seen.add(r.n)
    const own = byN.get(r.n)
    if (own) next.push(own)
    else {
      const from = r.from != null && byN.has(r.from) ? r.from : plainN
      next.push(cloneItem(byN.get(from)!, key, from, r.n, placed))
    }
  }
  // What only the first item had goes to whichever item is first now.
  if (special) next.forEach((it, i) => (next[i] = withRoot(it, i === 0 ? special.first : special.rest)))
  // The open tab is the first position's too: whichever item is first is checked, no other.
  if (isItem(items[0]) && attr(items[0], 'data-mx-block') === 'item' && items.some(ownRadioChecked))
    next.forEach((it, i) => (next[i] = setOwnRadio(it, i === 0)))
  // Numbers that count the items (01, 02…) stay in order wherever the items go.
  const width = counterWidth(items)
  if (width != null)
    next.forEach((it, i) => {
      next[i] = setCounter(it, (v) => ({ t: 'text', v: v.replace(COUNTER, (_, a: string, _n: string, b: string) => `${a}${formatCounter(i + 1, width)}${b}`) }))
    })
  const first = el.kids.indexOf(items[0])
  const last = el.kids.indexOf(items[items.length - 1])
  const between = el.kids.slice(first, last + 1).filter((k) => isEl(k) && !isItem(k))
  const kids: HNode[] = [...el.kids.slice(0, first), ...next.flatMap((it, i) => (i ? [{ t: 'text' as const, v: '\n' }, it] : [it])), ...between, ...el.kids.slice(last + 1)]
  return { ...el, kids }
}

const isMirror = (n: HNode): n is HEl => isEl(n) && attr(n, 'data-mx-mirror') !== undefined

/* ---------- counters: an item's position written into it ("01", "2.") ---------- */

const COUNTER = /^(\s*)(\d{1,2})([.)]?\s*)$/

/** The first piece of static text in an item that looks like a number (not inside a field). */
function counterText(el: HEl): { node: { t: 'text'; v: string }; n: number; width: number } | null {
  for (const k of el.kids) {
    if (k.t === 'text') {
      const m = COUNTER.exec(k.v)
      if (m && k.v.trim()) return { node: k, n: Number(m[2]), width: m[2].length }
    } else if (isEl(k) && attr(k, 'data-mx-field') === undefined && attr(k, 'data-mx-mirror') === undefined && !isKind(k, 'list')) {
      const c = counterText(k)
      if (c) return c
    }
  }
  return null
}

/**
 * Whether a list's items number themselves by position (01, 02, 03…), and the
 * zero-padding they use. Such numbers follow position when items move.
 */
export function counterWidth(items: HEl[]): number | null {
  if (items.length < 2) return null
  const cs = items.map(counterText)
  if (cs.some((c) => !c)) return null
  return cs.every((c, i) => c!.n === i + 1) ? cs[0]!.width : null
}

export const formatCounter = (pos: number, width: number) => String(pos).padStart(width, '0')

/** An item with its counter text set to a position (or replaced by `node`). */
export function setCounter(el: HEl, replace: (v: string) => HNode): HEl {
  const c = counterText(el)
  if (!c) return el
  const swap = (e: HEl): HEl => ({ ...e, kids: e.kids.map((k) => (k === c.node ? replace(k.v) : isEl(k) ? swap(k) : k)) })
  return swap(el)
}

/**
 * Stamp blocks with their ids in document order (as the frame does), and mark
 * mirror sets: the second half of a seamless marquee, which repeats a list's
 * items and must follow it.
 */
export function stamp(tree: HNode[]): HNode[] {
  let i = 0
  const stamped = mapTree(tree, (el) => {
    if (attr(el, 'data-mx-block') === undefined) return el
    const id = `b${i++}`
    return attr(el, 'data-mx-b') !== undefined ? el : { ...el, attrs: [...el.attrs, ['data-mx-b', id]] }
  })
  // Mirror sets: an element whose children all mirror a list's items.
  const lists: { id: string; key: string; ns: Set<number> }[] = []
  walk(stamped, (n) => {
    if (!isKind(n, 'list')) return
    const key = listKeyOf(n)
    if (key) lists.push({ id: attr(n, 'data-mx-b')!, key, ns: new Set(itemsOf(n).map((it) => numberOf(it, key)!)) })
  })
  if (!lists.length) return stamped
  return mapTree(stamped, (el) => {
    const kids = el.kids.filter(isEl)
    if (kids.length < 2 || !kids.every(isMirror) || attr(el, 'data-mx-block') !== undefined) return el
    const f = attr(kids[0], 'data-mx-mirror')!
    const owner = lists.find((l) => splits(f).some((s) => s.key === l.key && l.ns.has(s.n)))
    return owner ? { ...el, attrs: [...el.attrs, ['data-mx-set', owner.id]] } : el
  })
}

/** Keys used by more than one list in a clip (a nav split in two): those lists keep their length. */
function sharedKeys(tree: HNode[]): Set<string> {
  const seen = new Set<string>()
  const shared = new Set<string>()
  walk(tree, (n) => {
    if (!isKind(n, 'list')) return
    const k = listKeyOf(n)
    if (k && seen.has(k)) shared.add(k)
    if (k) seen.add(k)
  })
  return shared
}

/** Apply a section's list changes to a stamped tree. */
export function applyLists(tree: HNode[], lists: Record<string, ListItemRef[]> | undefined): HNode[] {
  if (!lists || !Object.keys(lists).length) return tree
  const shared = sharedKeys(tree)
  const changed = new Map<string, { key: string; refs: ListItemRef[] }>()
  const go = (nodes: HNode[]): HNode[] =>
    nodes.map((n) => {
      if (!isEl(n)) return n
      let el = n
      if (isKind(el, 'list')) {
        const key = listKeyOf(el)
        const refs = key && !shared.has(key) ? lists[key] : undefined
        if (key && refs?.length) {
          const was = itemsOf(el).length
          el = reorder(el, (k): k is HEl => isKind(k, 'item'), (it) => numberOf(it, key), key, refs)
          if (itemsOf(el).length !== was) el = rebalance(el)
          changed.set(attr(el, 'data-mx-b')!, { key, refs })
        }
      }
      return { ...el, kids: go(el.kids) }
    })
  const out = go(tree)
  if (!changed.size) return out
  return mapTree(out, (el) => {
    const set = attr(el, 'data-mx-set')
    const c = set ? changed.get(set) : undefined
    if (!c) return el
    return reorder(el, isMirror, (m) => splits(attr(m, 'data-mx-mirror')!).find((s) => s.key === c.key)?.n, c.key, c.refs)
  })
}

/**
 * A grid list whose count changed, so its rows stay full: items that all span the same N of 12 get another per-row
 * count when that fills every row (3-up with 4 items becomes 4-up), or keep theirs with the last row centred. Written
 * as `data-mx-span` / `data-mx-start`, which the base CSS (GRID_SPAN_CSS) applies on wide screens only. Lists that
 * aren't on the 12-column grid, or that place items themselves, are left alone.
 */
export function rebalance(list: HEl): HEl {
  const items = itemsOf(list)
  const classes = (el: HEl) => (attr(el, 'class') ?? '').split(/\s+/).filter(Boolean)
  if (!classes(list).includes('grid') || items.length < 2) return list
  const spans = items.map((it) => classes(it).find((c) => /^col-\d+$/.test(c)))
  if (spans.some((s) => s !== spans[0]) || !spans[0] || items.some((it) => classes(it).some((c) => c.startsWith('start-')))) return list
  const span = Number(spans[0].slice(4))
  if (12 % span) return list
  const perRow = 12 / span
  const count = items.length
  const clean = (it: HEl) => ({ ...it, attrs: it.attrs.filter(([k]) => k !== 'data-mx-span' && k !== 'data-mx-start') })
  const set = (it: HEl, extra: [string, string][]) => ({ ...clean(it), attrs: [...clean(it).attrs, ...extra] })
  let layout: (it: HEl, i: number) => HEl = clean
  if (count % perRow) {
    const other = [perRow + 1, perRow - 1].find((c) => c >= 2 && c <= 6 && 12 % c === 0 && count % c === 0)
    if (other) layout = (it) => set(it, [['data-mx-span', String(12 / other)]])
    else {
      const rest = count % perRow
      const first = count - rest
      const start = (12 - rest * span) / 2 + 1
      layout = (it, i) => (i === first && Number.isInteger(start) && start > 1 ? set(it, [['data-mx-span', String(span)], ['data-mx-start', String(start)]]) : clean(it))
    }
  }
  let i = 0
  return { ...list, kids: list.kids.map((k) => (isKind(k, 'item') ? layout(k, i++) : k)) }
}

/** Elements a frame can swap in place: list blocks and mirror sets. */
function targetSel(el: HEl): string | null {
  if (isKind(el, 'list')) return `[data-mx-b="${attr(el, 'data-mx-b')}"]`
  const set = attr(el, 'data-mx-set')
  return set ? `[data-mx-set="${set}"]` : null
}

/** The outermost lists (and mirror sets) that differ, as patches for a live frame. */
function patchesFor(before: HNode[], after: HNode[]): ListPatch[] {
  const orig = new Map<string, string>()
  walk(before, (n) => {
    const sel = isEl(n) && targetSel(n)
    if (sel) orig.set(sel, serialize([n], 'html'))
  })
  const out: ListPatch[] = []
  const visit = (nodes: HNode[]) => {
    for (const n of nodes) {
      if (!isEl(n)) continue
      const sel = targetSel(n)
      if (sel && orig.has(sel)) {
        const html = serialize([n], 'html')
        if (html !== orig.get(sel)) {
          out.push({ sel, html })
          continue
        }
      }
      visit(n.kids)
    }
  }
  visit(after)
  return out
}

/** Mark list blocks with the key you can edit them by, and items with their number. */
function annotate(blocks: BlockInfo[], tree: HNode[]): BlockInfo[] {
  const shared = sharedKeys(tree)
  const byId = new Map(blocks.map((b) => [b.id, b]))
  walk(tree, (n) => {
    if (!isKind(n, 'list')) return
    const key = listKeyOf(n)
    const b = byId.get(attr(n, 'data-mx-b') ?? '')
    if (!key || !b || shared.has(key)) return
    b.listKey = key
    for (const it of itemsOf(n)) {
      const ib = byId.get(attr(it, 'data-mx-b') ?? '')
      if (ib) ib.n = numberOf(it, key)
    }
  })
  return blocks
}

const cache = new Map<string, SectionClip>()

/**
 * The clip as a section shows it: blocks stamped, lists in the section's order,
 * fields and blocks re-read from the result. Cached by clip and list changes.
 */
export function sectionClip(clip: Clip, lists?: Record<string, ListItemRef[]>, extras?: SectionExtras): SectionClip {
  const relevant = lists && Object.keys(lists).length ? lists : undefined
  const base = stamp(parseHtml(clip.html))
  // An added banner goes just before a nav that doesn't have one of its own.
  const banner = !!extras?.banner && clip.type === 'nav' && !base.some(function has(n): boolean {
    return n.t === 'el' && (attr(n, 'data-mx-block') === 'banner' || n.kids.some(has))
  })
  const k = `${clip.id}@${clip.hash}:${relevant ? JSON.stringify(relevant) : ''}:${banner ? 'b' : ''}`
  let hit = cache.get(k)
  if (hit) return hit
  const withExtras: HNode[] = banner ? [bannerTree((f) => DEFAULT_CONTENT.fields.nav?.[f] ?? ''), { t: 'text', v: '\n' }, ...base] : base
  const tree = applyLists(withExtras, relevant)
  const patches = relevant ? patchesFor(base, tree) : []
  if (banner) patches.unshift({ sel: '[data-mx-section]', html: serialize([tree[0]], 'html'), before: true })
  hit = {
    ...clip,
    html: serialize(tree, 'html'),
    fields: extractFields(tree),
    blocks: annotate(indexBlocks(tree, clip.type), tree),
    patches,
    source: clip,
    extras: banner ? { banner } : undefined,
  }
  if (cache.size > 400) cache.clear()
  cache.set(k, hit)
  return hit
}

/** The numbers of a list's items, in order, as the section shows them. */
export function listOrder(clip: SectionClip, listId: string): number[] {
  const list = clip.blocks.find((b) => b.id === listId)
  if (!list?.listKey) return []
  return list.children.map((id) => clip.blocks.find((b) => b.id === id)).flatMap((b) => (b?.kind === 'item' && b.n != null ? [b.n] : []))
}

/** A number no item of this list uses yet (anywhere in the section's fields). */
export function nextNumber(clip: SectionClip, key: string, taken: number[] = []): number {
  let max = 0
  for (const f of Object.keys(clip.fields)) for (const s of splits(f)) if (s.key === key) max = Math.max(max, s.n)
  for (const n of taken) max = Math.max(max, n)
  return max + 1
}

/** Fields belonging to item n of a list key (f4Title, f4Body…), from any field map. */
export function itemFields(fields: Iterable<string>, key: string, n: number): string[] {
  const re = renumberRe(key, n)
  return [...fields].filter((f) => re.test(f))
}

/** Rename an item's field to another item's number: ("f4Title", "f", 4, 7) → "f7Title". */
export function renumberField(field: string, key: string, from: number, to: number): string {
  return field.replace(renumberRe(key, from), `${key}${to}`)
}

/** How many items a list handles well: the layout's own count, or more for lists that wrap. */
const MAX_BY_NAME: Record<string, number> = { notices: 6, features: 9, questions: 12, plans: 4, quotes: 6, logos: 12, stats: 6, members: 12, posts: 9, links: 8, columns: 5, images: 12 }
export function listMax(name: string | undefined, key: string, layoutCount: number): number {
  const nested = /[A-Z]$/.test(key)
  return Math.max(layoutCount, nested ? 8 : (MAX_BY_NAME[name ?? ''] ?? 8))
}

/* ---------- editing a section's lists ---------- */

export type ListOp =
  /** A new item, at the end or right after `after` (an item of the list). */
  | { op: 'add'; listId: string; after?: string }
  | { op: 'duplicate'; itemId: string }
  | { op: 'remove'; itemId: string }
  | { op: 'move'; itemId: string; to: number }
  /** Trade places with another item of the same list (a sliding-tile swap: the two change places, nothing else moves). */
  | { op: 'swap'; itemId: string; withId: string }
  | { op: 'reset'; listId: string }

export class ListError extends Error {}

/** A list's items as the layout has them, before this section changed that list. */
export function layoutOrder(clip: SectionClip, slot: Pick<Slot, 'lists'>, listId: string, key: string): number[] {
  const others = { ...slot.lists }
  delete others[key]
  return listOrder(sectionClip(clip.source, others, clip.extras), listId)
}

/**
 * Apply a list change to a section. New items take the next free number and
 * copy the first item's structure; duplicates copy the item's structure, its
 * words (into the section's own words) and its own nested lists.
 */
export function editList(slot: Slot, clip: SectionClip, content: ProjectContent, change: ListOp): Slot {
  const id = 'listId' in change ? change.listId : clip.blocks.find((b) => b.id === change.itemId)?.parent
  const list = clip.blocks.find((b) => b.id === id && b.kind === 'list')
  if (!list) throw new ListError('That isn’t a list, or an item in one.')
  const key = list.listKey
  if (!key) throw new ListError('This list’s items are set by the layout, so it keeps its length.')
  let lists: Record<string, ListItemRef[]> = { ...slot.lists }
  const done = (words = slot.words) => ({ ...slot, words, lists: Object.keys(lists).length ? lists : undefined })
  if (change.op === 'reset') {
    delete lists[key]
    return done()
  }
  const order = listOrder(clip, list.id)
  const refs: ListItemRef[] = order.map((n) => slot.lists?.[key]?.find((r) => r.n === n) ?? { n })
  const own = layoutOrder(clip, slot, list.id, key)
  const max = listMax(list.list, key, own.length)
  const item = 'itemId' in change ? clip.blocks.find((b) => b.id === change.itemId) : undefined
  const at = item?.n != null && item.parent === list.id ? order.indexOf(item.n) : -1
  let words = slot.words

  if (change.op === 'add' || change.op === 'duplicate') {
    if (refs.length >= max) throw new ListError(`This list holds up to ${max} items in this layout.`)
    const wordNumbers = Object.keys(slot.words ?? {}).flatMap((f) => splits(f).filter((s) => s.key === key).map((s) => s.n))
    const n = nextNumber(clip, key, [...order, ...own, ...wordNumbers])
    if (change.op === 'add') {
      // Right after the item you're on, when there is one; else at the end.
      const prev = change.after ? clip.blocks.find((b) => b.id === change.after) : undefined
      const i = prev?.n != null && prev.parent === list.id ? order.indexOf(prev.n) : -1
      if (i >= 0) refs.splice(i + 1, 0, { n })
      else refs.push({ n })
      // It says it's new rather than repeating the item it was built from: its title reads "New feature" until you
      // write one (your copy's words for that number win, when you have them).
      const tmpl = order[0]
      const itemBlock = clip.blocks.find((b) => b.parent === list.id && b.kind === 'item')
      const noun = (itemBlock?.label.split(' · ').at(-1) ?? 'item').replace(/\s*\d+$/, '').toLowerCase() || 'item'
      const title = tmpl != null ? itemFields(Object.keys(clip.fields), key, tmpl).find((f) => /^(title|name|q|heading|label|question)$/i.test(f.replace(renumberRe(key, tmpl), ''))) : undefined
      const field = title && renumberField(title, key, tmpl!, n)
      if (field && !content.fields[clip.type]?.[field] && !slot.words?.[field]) words = { ...slot.words, [field]: `New ${noun}` }
    } else {
      if (at < 0) throw new ListError('Pick an item in the list to duplicate.')
      const src = refs[at]
      refs.splice(at + 1, 0, { n, from: src.from ?? src.n })
      // The copy says the same thing, nested lists included.
      const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
      words = { ...slot.words }
      for (const f of itemFields(Object.keys(fields), key, src.n)) words[renumberField(f, key, src.n, n)] = fields[f]
      for (const [k, v] of Object.entries(slot.lists ?? {})) {
        const m = renumberRe(key, src.n).exec(k)
        if (m && k.length > m[0].length) lists[`${key}${n}${k.slice(m[0].length)}`] = v
      }
    }
  } else if (change.op === 'remove') {
    if (at < 0) throw new ListError('Pick an item in the list to remove.')
    if (refs.length <= 1) throw new ListError('A list keeps at least one item. Hide the list instead.')
    refs.splice(at, 1)
  } else if (change.op === 'swap') {
    const other = clip.blocks.find((b) => b.id === change.withId)
    const to = other?.n != null && other.parent === list.id ? order.indexOf(other.n) : -1
    if (at < 0 || to < 0) throw new ListError('Pick two items of the same list to swap.')
    ;[refs[at], refs[to]] = [refs[to], refs[at]]
  } else {
    if (at < 0) throw new ListError('Pick an item in the list to move.')
    const [r] = refs.splice(at, 1)
    refs.splice(Math.max(0, Math.min(refs.length, change.to)), 0, r)
  }
  // Back to the layout's own items in their own order: nothing to remember.
  if (refs.length === own.length && refs.every((r, i) => r.from == null && r.n === own[i])) delete lists[key]
  else lists[key] = refs
  return done(words)
}

/**
 * The editable list a block is (or is an item of): where the item sits and how many fit. With `within`, a block
 * inside an item (its title, its picture) counts as that item, so the item's controls show wherever you click in it.
 */
export function listContext(clip: SectionClip, slot: Pick<Slot, 'lists'>, blockId: string, opts: { within?: boolean } = {}) {
  let b = clip.blocks.find((x) => x.id === blockId)
  if (!b) return null
  if (opts.within) {
    let up: BlockInfo | undefined = b
    while (up && up.kind !== 'item' && up.kind !== 'list') up = up.parent ? clip.blocks.find((x) => x.id === up!.parent) : undefined
    if (up?.kind === 'item') b = up
  }
  const list = b.kind === 'list' ? b : b.kind === 'item' ? clip.blocks.find((x) => x.id === b!.parent) : undefined
  if (!list?.listKey) return null
  const order = listOrder(clip, list.id)
  const max = listMax(list.list, list.listKey, layoutOrder(clip, slot, list.id, list.listKey).length)
  const item = b.kind === 'item' ? b : undefined
  return { list, item, index: item?.n != null ? order.indexOf(item.n) : -1, count: order.length, max, changed: !!slot.lists?.[list.listKey] }
}

export type TileDir = 'up' | 'down' | 'left' | 'right'
interface TileRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The item next to another in a direction, by where they sit on the page (a sliding-tile neighbour): left and right
 * look along the same row (items overlapping it vertically), up and down along the same column. A grid's item below
 * is three places on in the list, but one tile away on screen.
 */
export function tileNeighbor(rects: Record<string, TileRect>, ids: string[], from: string, dir: TileDir): string | null {
  const a = rects[from]
  if (!a) return null
  const horizontal = dir === 'left' || dir === 'right'
  const overlap = (b: TileRect) =>
    horizontal ? Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > Math.min(a.h, b.h) * 0.3 : Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > Math.min(a.w, b.w) * 0.3
  let best: string | null = null
  let gap = Infinity
  for (const id of ids) {
    const b = rects[id]
    if (id === from || !b || !overlap(b)) continue
    const d =
      dir === 'left' ? a.x - (b.x + b.w / 2) : dir === 'right' ? b.x + b.w / 2 - (a.x + a.w) : dir === 'up' ? a.y - (b.y + b.h / 2) : b.y + b.h / 2 - (a.y + a.h)
    if (d > -Math.min(a.w, a.h) * 0.25 && d < gap && (dir === 'left' ? b.x < a.x : dir === 'right' ? b.x > a.x : dir === 'up' ? b.y < a.y : b.y > a.y)) [best, gap] = [id, d]
  }
  return best
}

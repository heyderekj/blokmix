import type { BlockInfo, BlockKind, GroupRole, SectionType } from './types'
import { BLOCK_KINDS } from './types'
import { TYPE_LABEL } from './content'
import { attr, walk, type HEl, type HNode } from './html/parse'
import { linkElementOf } from './links'

export const BLOCK_LABEL: Record<BlockKind, string> = {
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  link: 'Link',
  badge: 'Badge',
  icon: 'Icon',
  image: 'Image',
  input: 'Field',
  banner: 'Banner',
  card: 'Card',
  item: 'Item',
  list: 'List',
  group: 'Group',
}

/** Small blocks hold words or a single element; composite ones hold other blocks. */
export const COMPOSITE: ReadonlySet<BlockKind> = new Set(['banner', 'card', 'item', 'list'])

const isKind = (k: string | undefined): k is BlockKind => !!k && (BLOCK_KINDS as readonly string[]).includes(k)

function firstField(el: HEl): string | undefined {
  let f = attr(el, 'data-mx-field')
  if (f) return f
  walk(el.kids, (n) => {
    if (!f && n.t === 'el' && !attr(n, 'data-mx-block')) f = attr(n, 'data-mx-field')
  })
  return f
}

/**
 * Groups: what the layout primitives already name (a section's header, a row of buttons, a panel, a card) when it isn't
 * a block itself and holds two or more. Read off class names, so every built-in layout and every normalised capture
 * has them without re-marking. Once stamped (`core/lists.ts` `stamp`), `data-mx-group` carries the name.
 */
const GROUP_CLASSES: [string, string, GroupRole][] = [
  ['head', 'Header', 'header'],
  ['actions', 'Buttons', 'buttons'],
  ['band', 'Panel', 'panel'],
  ['card', 'Card', 'card'],
  ['about', 'About', 'about'],
]
const ROLE_OF: Record<string, GroupRole> = Object.fromEntries(GROUP_CLASSES.map(([, name, role]) => [name, role]))

const classesOf = (el: HEl) => (attr(el, 'class') ?? '').split(/\s+/)

function blocksIn(el: HEl, max: number): number {
  let n = 0
  walk(el.kids, (k) => {
    if (n < max && k.t === 'el' && attr(k, 'data-mx-block') !== undefined) n++
  })
  return n
}

/** The group's name ("Header", "Buttons"), or undefined when the element isn't one. */
export function groupName(el: HEl): string | undefined {
  if (attr(el, 'data-mx-block') !== undefined || attr(el, 'data-mx-section') !== undefined) return undefined
  const stamped = attr(el, 'data-mx-group')
  if (stamped !== undefined) return stamped || 'Group'
  const cls = classesOf(el)
  const name = GROUP_CLASSES.find(([c]) => cls.includes(c))?.[1] ?? (attr(el, 'data-nav-group') !== undefined ? 'Buttons' : undefined)
  return name && blocksIn(el, 2) >= 2 ? name : undefined
}

/** What's around it, one step up: its group, else its parent block; null at the section. */
export const upOf = (b: Pick<BlockInfo, 'group' | 'parent'>): string | null => b.group ?? b.parent

/**
 * Index a clip's blocks in document order, the same order the in-frame script
 * sees with querySelectorAll('[data-mx-block]'), so ids line up on both sides.
 * Groups join the list with ids of their own (g0, g1…), so a block's id never depends on them.
 */
export function indexBlocks(tree: HNode[], type: SectionType): BlockInfo[] {
  const out: BlockInfo[] = []
  const names = new Map<string, string>() // data-mx-label, e.g. "Plan"
  let nb = 0
  let ng = 0
  const visit = (nodes: HNode[], parent: BlockInfo | null, around: BlockInfo | null) => {
    for (const n of nodes) {
      if (n.t !== 'el') continue
      const kind = attr(n, 'data-mx-block')
      const group = isKind(kind) ? undefined : groupName(n)
      if (group) {
        const own = attr(n, 'data-mx-b')
        const g: BlockInfo = { id: own ?? `g${ng}`, kind: 'group', parent: parent?.id ?? null, children: [], label: '' }
        if (!own) ng++
        if (around?.kind === 'group') g.group = around.id
        const role = ROLE_OF[group]
        if (role) g.role = role
        out.push(g)
        names.set(g.id, group)
        visit(n.kids, parent, g)
      } else if (isKind(kind)) {
        // A block a layout gave its own id (data-mx-b="l1", added after people had changed it) takes no number, so the
        // blocks after it keep theirs.
        const own = attr(n, 'data-mx-b')
        const b: BlockInfo = { id: own ?? `b${nb}`, kind, parent: parent?.id ?? null, children: [], label: '' }
        if (!own) nb++
        if (around?.kind === 'group') b.group = around.id
        const field = COMPOSITE.has(kind) ? undefined : firstField(n)
        if (field) b.field = field
        if (kind === 'button' && /(^|\s)(secondary|ghost)(\s|$)/.test(attr(n, 'class') ?? '')) b.secondary = true
        const media = attr(n, 'data-mx-media')
        if (media) b.media = media
        const ratio = attr(n, 'data-mx-ratio')
        if (ratio) b.ratio = ratio
        // A picture meant for moving media (a video hero, a reel): its art draws a play button and the media menu opens on Video.
        if (attr(n, 'data-mx-media-kind') === 'video') b.mediaKind = 'video'
        const list = attr(n, 'data-mx-list')
        if (list) b.list = list
        if (kind === 'list' && classesOf(n).includes('grid')) b.grid = true
        if (linkElementOf(n)) b.linkable = true
        out.push(b)
        parent?.children.push(b.id)
        const name = attr(n, 'data-mx-label')
        if (name) names.set(b.id, name)
        visit(n.kids, b, b)
      } else visit(n.kids, parent, around)
    }
  }
  visit(tree, null, null)

  // Labels: the section, then each item ancestor ("Plan 2"), then the block. Repeats of a kind
  // within the same parent are numbered ("Button", "Button 2") so labels tell them apart.
  const byId = new Map(out.map((b) => [b.id, b]))
  const own = (b: BlockInfo) => {
    const name = names.get(b.id) ?? (b.kind === 'list' && b.list ? humanize(b.list) : BLOCK_LABEL[b.kind])
    const peers = out.filter((o) => o.parent === b.parent && o.kind === b.kind && (names.get(o.id) ?? '') === (names.get(b.id) ?? ''))
    const n = peers.indexOf(b) + 1
    if (b.kind === 'item') return `${name} ${n}`
    return n > 1 ? `${name} ${n}` : name
  }
  for (const b of out) {
    const parts = [own(b)]
    for (let p = b.parent ? byId.get(b.parent) : undefined; p; p = p.parent ? byId.get(p.parent) : undefined) {
      if (p.kind === 'item') parts.unshift(own(p))
    }
    b.label = [TYPE_LABEL[type], ...parts].join(' · ')
  }
  return out
}

function humanize(s: string) {
  const t = s.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Rule 13: block annotations. Returns messages; the caller decides their level. */
export function lintBlocks(tree: HNode[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const media = new Set<string>()
  let count = 0
  const visit = (nodes: HNode[], parentKind: BlockKind | null) => {
    for (const n of nodes) {
      if (n.t !== 'el') continue
      const raw = attr(n, 'data-mx-block')
      let next = parentKind
      if (raw !== undefined) {
        count++
        if (!isKind(raw)) errors.push(`Unknown block kind "${raw}" on <${n.tag}>`)
        else {
          next = raw
          if (raw === 'item' && parentKind !== 'list') errors.push('An item block must sit directly inside a list block')
          if (raw === 'list' && !attr(n, 'data-mx-list')) errors.push('A list block needs data-mx-list="<name>"')
          if (raw === 'image') {
            const m = attr(n, 'data-mx-media')
            if (!m) errors.push('An image block needs data-mx-media="<name>"')
            else if (media.has(m)) errors.push(`Media slot "${m}" is used twice`)
            else media.add(m)
          }
          if ((raw === 'heading' || raw === 'text' || raw === 'button' || raw === 'link' || raw === 'badge') && !firstField(n))
            warnings.push(`The ${raw} block on <${n.tag}> has no copy field`)
          if (!COMPOSITE.has(raw) && n.kids.some((k) => k.t === 'el' && isKind(attr(k, 'data-mx-block')))) {
            if (raw !== 'button' && raw !== 'link') errors.push(`A ${raw} block can’t hold other blocks; use card or item`)
          }
        }
      }
      if (attr(n, 'data-mx-list') && raw !== 'list') errors.push('data-mx-list belongs on a list block')
      if (attr(n, 'data-mx-media') && raw !== 'image') errors.push('data-mx-media belongs on an image block')
      visit(n.kids, next)
    }
  }
  visit(tree, null)
  if (!count) warnings.push('No blocks marked; add data-mx-block to headings, buttons, cards and images')
  return { errors, warnings }
}

/** What sits beside it, in page order: the blocks and groups that share what's around it (itself included). */
export function siblingsOf(blocks: BlockInfo[], b: BlockInfo): BlockInfo[] {
  const at = upOf(b)
  return blocks.filter((x) => upOf(x) === at)
}

/** What's directly inside it (blocks and groups), in page order; the section's own when id is null. */
export const insideOf = (blocks: BlockInfo[], id: string | null): BlockInfo[] => blocks.filter((x) => upOf(x) === id)

/** One step through what's beside it (Tab, Shift+Tab), going round at the ends. */
export function stepSibling(blocks: BlockInfo[], id: string, d: 1 | -1): string | null {
  const b = blocks.find((x) => x.id === id)
  if (!b) return null
  const sibs = siblingsOf(blocks, b)
  if (sibs.length < 2) return null
  return sibs[(sibs.indexOf(b) + d + sibs.length) % sibs.length].id
}

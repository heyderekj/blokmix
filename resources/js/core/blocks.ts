import type { BlockInfo, BlockKind, SectionType } from './types'
import { BLOCK_KINDS } from './types'
import { TYPE_LABEL } from './content'
import { attr, walk, type HEl, type HNode } from './html/parse'

export const BLOCK_LABEL: Record<BlockKind, string> = {
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  link: 'Link',
  badge: 'Badge',
  icon: 'Icon',
  image: 'Image',
  input: 'Field',
  card: 'Card',
  item: 'Item',
  list: 'List',
}

/** Small blocks hold words or a single element; composite ones hold other blocks. */
export const COMPOSITE: ReadonlySet<BlockKind> = new Set(['card', 'item', 'list'])

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
 * Index a clip's blocks in document order, the same order the in-frame script
 * sees with querySelectorAll('[data-mx-block]'), so ids line up on both sides.
 */
export function indexBlocks(tree: HNode[], type: SectionType): BlockInfo[] {
  const out: BlockInfo[] = []
  const names = new Map<string, string>() // data-mx-label, e.g. "Plan"
  const visit = (nodes: HNode[], parent: BlockInfo | null) => {
    for (const n of nodes) {
      if (n.t !== 'el') continue
      const kind = attr(n, 'data-mx-block')
      if (isKind(kind)) {
        const b: BlockInfo = { id: `b${out.length}`, kind, parent: parent?.id ?? null, children: [], label: '' }
        const field = COMPOSITE.has(kind) ? undefined : firstField(n)
        if (field) b.field = field
        const media = attr(n, 'data-mx-media')
        if (media) b.media = media
        const ratio = attr(n, 'data-mx-ratio')
        if (ratio) b.ratio = ratio
        const list = attr(n, 'data-mx-list')
        if (list) b.list = list
        out.push(b)
        parent?.children.push(b.id)
        const name = attr(n, 'data-mx-label')
        if (name) names.set(b.id, name)
        visit(n.kids, b)
      } else visit(n.kids, parent)
    }
  }
  visit(tree, null)

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

import type { Clip, Library, SectionType } from './types'
import { parseHtml, attr, type HEl, type HNode } from './html/parse'

/**
 * Matching a section to Blokmix's built-in layouts. A section captured from a real site and a built-in layout are
 * described the same way (their structural signature: what they hold and how it's arranged), and the closest layout
 * of the same type wins. Below the threshold, the section needs a new layout (the draft queue).
 */

export interface Signature {
  type: SectionType
  rhythm: string
  /** The section's main repeating list: how many items and how many across. */
  items: number
  columns: number
  /** Items drawn as cards (filled or bordered) rather than plain text. */
  cards: boolean
  /** Pictures: how many, and where the first sits relative to the copy. */
  media: number
  mediaAt: 'none' | 'left' | 'right' | 'top' | 'bottom' | 'back' | 'inline'
  video: boolean
  headCenter: boolean
  band: boolean
  form: boolean
  /** Interactive structure without JS: accordions (<details>), radio tabs or slides, scroll-snap rows. */
  details: boolean
  radios: boolean
  scroller: boolean
  nested: boolean
  /** Copy and media laid over each other (an `overlap` class: layouts name it, capture's normalize will too) rather than side by side. */
  overlap: boolean
  buttons: number
}

const els = (nodes: HNode[], out: HEl[] = []): HEl[] => {
  for (const n of nodes) if (n.t === 'el') (out.push(n), els(n.kids, out))
  return out
}
const cls = (el: HEl) => (attr(el, 'class') ?? '').split(/\s+/)

export function signatureOf(clip: Pick<Clip, 'type' | 'rhythm' | 'html' | 'css' | 'blocks'>): Signature {
  const tree = parseHtml(clip.html)
  const all = els(tree)
  const blocks = clip.blocks
  const lists = blocks.filter((b) => b.kind === 'list')
  const itemsOf = (id: string) => blocks.filter((b) => b.parent === id && b.kind === 'item')
  // The main list: the one with the most items (nav links and footer columns count too).
  const main = lists.map((l) => ({ l, n: itemsOf(l.id).length })).sort((a, b) => b.n - a.n)[0]
  const items = main?.n ?? 0
  const nested = lists.some((l) => blocks.some((b) => b.id === l.parent || isUnder(blocks, l.id, 'item')))

  // Columns: from grid spans on the items (.col-4 → 3 across), else repeat(N, …) in the CSS, else the item count.
  let columns = 0
  if (main) {
    const itemEls = all.filter((e) => attr(e, 'data-mx-block') === 'item' && itemsOf(main.l.id).some((b) => b.id === attr(e, 'data-mx-b')))
    const span = itemEls.map((e) => cls(e).map((c) => /^col-(\d+)$/.exec(c)?.[1]).find(Boolean)).find(Boolean)
    if (span) columns = Math.max(1, Math.round(12 / Number(span)))
  }
  if (!columns) {
    // Desktop rules only: media queries (phones, hover) are dropped, nested braces and all.
    const desktop = withoutMedia(clip.css)
    const rep = [...desktop.matchAll(/repeat\(\s*(\d+)\s*,/g)].map((m) => Number(m[1])).filter((n) => n > 1 && n <= 6)
    columns = rep[rep.length - 1] ?? Math.min(items, 4)
  }

  const media = all.filter((e) => attr(e, 'data-mx-block') === 'image' && !/^logo\d/.test(attr(e, 'data-mx-media') ?? ''))
  const video = all.some((e) => attr(e, 'data-mx-media-kind') === 'video')
  const heading = all.find((e) => ['heading'].includes(attr(e, 'data-mx-block') ?? '') || /^h[12]$/.test(e.tag))
  const order = (e: HEl | undefined) => (e ? all.indexOf(e) : -1)
  let mediaAt: Signature['mediaAt'] = 'none'
  if (media.length) {
    const first = media[0]
    const big = /full|backdrop|bleed|bg|cover|scene/.test(cls(first).join(' ') + (attr(first, 'data-mx-media') ?? ''))
    if (big && order(first) < order(heading)) mediaAt = 'back'
    else if (clip.rhythm === 'split') mediaAt = order(first) < order(heading) || /reverse/.test(clip.html) ? 'left' : 'right'
    else if (media.length > 2 || (main && media.some((m) => isInsideItem(all, m)))) mediaAt = 'inline'
    else mediaAt = order(first) < order(heading) ? 'top' : 'bottom'
  }
  const css = clip.css
  return {
    type: clip.type,
    rhythm: clip.rhythm ?? 'stack',
    items,
    columns,
    cards: blocks.some((b) => b.kind === 'card') || /\bcard\b/.test(clip.html),
    media: media.length,
    mediaAt,
    video,
    headCenter: /\bhead center\b|class="head center|text-align:\s*center/.test(clip.html + css),
    band: /\bband\b|\binverse\b/.test(clip.html),
    form: blocks.some((b) => b.kind === 'input') || all.some((e) => e.tag === 'form' || e.tag === 'input' && attr(e, 'type') !== 'radio'),
    details: all.some((e) => e.tag === 'details'),
    radios: all.some((e) => e.tag === 'input' && attr(e, 'type') === 'radio'),
    scroller: /scroll-snap-type/.test(css) || /@keyframes[^{]*marquee|translateX\(-50%\)/.test(css),
    nested,
    overlap: /class="[^"]*\boverlap\b/.test(clip.html),
    buttons: blocks.filter((b) => b.kind === 'button').length,
  }
}

function withoutMedia(css: string): string {
  let out = ''
  for (let i = 0; i < css.length; ) {
    const at = css.indexOf('@media', i)
    if (at < 0) return out + css.slice(i)
    out += css.slice(i, at)
    let j = css.indexOf('{', at)
    if (j < 0) return out
    let depth = 0
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}' && --depth === 0) break
    }
    i = j + 1
  }
  return out
}

function isUnder(blocks: Clip['blocks'], id: string, kind: string): boolean {
  for (let b = blocks.find((x) => x.id === id); b?.parent; ) {
    const p = blocks.find((x) => x.id === b!.parent)
    if (!p) return false
    if (p.kind === kind) return true
    b = p
  }
  return false
}

function isInsideItem(all: HEl[], el: HEl): boolean {
  // Pictures inside repeated items (a card's cover) rather than one for the section.
  const i = all.indexOf(el)
  return all.slice(0, i).some((e) => attr(e, 'data-mx-block') === 'item' && els(e.kids).includes(el))
}

/** How alike two signatures are, 0–1, with the reasons that cost the most (for the review screen and the report). */
export function similarity(a: Signature, b: Signature): { score: number; misses: string[] } {
  const checks: [string, number, number][] = [
    // [what, weight, 0–1 agreement]
    ['rhythm', 3, a.rhythm === b.rhythm ? 1 : 0],
    ['picture placement', 3, a.mediaAt === b.mediaAt ? 1 : a.mediaAt === 'none' || b.mediaAt === 'none' ? 0 : 0.3],
    ['columns', 2.5, a.columns === b.columns ? 1 : Math.abs(a.columns - b.columns) === 1 ? 0.5 : 0],
    ['item count', 1.5, a.items === b.items ? 1 : 1 - Math.min(1, Math.abs(a.items - b.items) / Math.max(a.items, b.items, 1))],
    ['cards', 1.5, a.cards === b.cards ? 1 : 0],
    ['pictures', 1.5, a.media === b.media ? 1 : 1 - Math.min(1, Math.abs(a.media - b.media) / Math.max(a.media, b.media, 1))],
    ['video', 2, a.video === b.video ? 1 : 0],
    ['centered head', 1, a.headCenter === b.headCenter ? 1 : 0],
    ['band', 1.5, a.band === b.band ? 1 : 0],
    ['form', 2, a.form === b.form ? 1 : 0],
    ['accordion', 2, a.details === b.details ? 1 : 0],
    ['tabs or slides', 2, a.radios === b.radios ? 1 : 0],
    ['scrolling row', 2, a.scroller === b.scroller ? 1 : 0],
    ['nested lists', 1, a.nested === b.nested ? 1 : 0],
    ['overlap', 2, !!a.overlap === !!b.overlap ? 1 : 0],
    ['buttons', 0.75, a.buttons === b.buttons ? 1 : Math.abs(a.buttons - b.buttons) === 1 ? 0.5 : 0],
  ]
  const total = checks.reduce((n, [, w]) => n + w, 0)
  let score = checks.reduce((n, [, w, v]) => n + w * v, 0) / total
  // Pictures on one side and none on the other is a different section, whatever else agrees.
  if (!a.media !== !b.media) score *= 0.85
  const misses = checks
    .filter(([, , v]) => v < 1)
    .sort((x, y) => y[1] * (1 - y[2]) - x[1] * (1 - x[2]))
    .slice(0, 3)
    .map(([what]) => what)
  return { score: Math.round(score * 1000) / 1000, misses }
}

/** At or above this, a section is shown as its matched layout; below, it goes to the draft queue. */
export const MATCH_THRESHOLD = 0.78

export interface LayoutMatch {
  layoutId: string
  score: number
  misses: string[]
}

/** The built-in layouts of the section's type, closest first (drafts included only when asked). */
export function matchLayouts(sig: Signature, lib: Library, opts: { includeDrafts?: boolean; limit?: number } = {}): LayoutMatch[] {
  return (lib.layoutsByType[sig.type] ?? [])
    .filter((id) => opts.includeDrafts || !lib.clips[id].status)
    .map((id) => ({ layoutId: id, ...similarity(sig, signatureOf(lib.clips[id])) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5)
}

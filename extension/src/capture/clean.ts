// Separate what a section is from how its page happened to build it, before fields
// and blocks are read. Pages wrap every image and button in layers of empty boxes,
// stack a blurred copy of a screenshot behind it for a glow, darken photos with a
// scrim, hide alternate icons at opacity 0 and keep closed accordion answers at zero
// height. A clip keeps the content (copy, buttons, cards, lists, images) and the
// layout that holds it; this pass folds or drops the rest.

import { parseColor } from './color'
import { allEls, clean, els, hint, isEl, px, textOf, type WEl } from './tree'
import type { Decls } from './types'

export interface Cleaned {
  notes: string[]
}

/** Everything that decides how an element looks, as opposed to where it sits. */
const PAINT = ['background-color', 'background-image', 'box-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode', 'transform'] as const
/** Where an element sits among its siblings: these come from the outer box when two fold together. */
const OUTER = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-self',
  'justify-self',
  'order',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
] as const
/** Tags that mean something on their own: two of them never fold into one. */
const STRONG = new Set(['li', 'ul', 'ol', 'dl', 'dt', 'dd', 'a', 'button', 'label', 'details', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'form', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'figcaption', 'input', 'select', 'textarea', 'svg', 'img', 'video', 'picture', 'canvas', 'iframe'])
const LANDMARK = new Set(['section', 'header', 'footer', 'nav', 'article', 'aside', 'main', 'figure'])

const visible = (c: string | undefined) => (parseColor(c ?? '')?.a ?? 0) > 0.01
const hasPaint = (el: WEl, p: (typeof PAINT)[number]) => {
  const v = el.s[p] ?? ''
  if (p === 'background-color') return visible(v)
  if (p === 'transform') return v !== '' && v !== 'none' && v !== 'matrix(1, 0, 0, 1, 0, 0)'
  if (p === 'mix-blend-mode') return v !== '' && v !== 'normal'
  return v !== '' && v !== 'none'
}
const radius = (el: WEl) => ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => el.s[`border-${c}-radius`] ?? '0px').join(' ')
const rounded = (el: WEl) => radius(el).split(' ').some((r) => px(r) > 0 || /%/.test(r))
const bordered = (el: WEl) => ['top', 'right', 'bottom', 'left'].some((d) => px(el.s[`border-${d}-width`]) > 0 && el.s[`border-${d}-style`] !== 'none')
const padded = (el: WEl) => ['top', 'right', 'bottom', 'left'].some((d) => px(el.s[`padding-${d}`]) > 0.5)
const outOfFlow = (el: WEl) => el.s.position === 'absolute' || el.s.position === 'fixed'
const ownText = (el: WEl) => el.kids.some((k) => !isEl(k) && k.v.trim())
const hasCopy = (el: WEl) => clean(textOf(el)).length > 0
const sameRect = (a: WEl, b: WEl, tol = 1.5) => a.rect.every((v, i) => Math.abs(v - b.rect[i]) <= tol)
const area = (r: WEl['rect']) => Math.max(0, r[2]) * Math.max(0, r[3])
function overlap(a: WEl['rect'], b: WEl['rect']): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.max(1, Math.min(area(a), area(b)))
}
const blurOf = (el: WEl) => {
  const m = /blur\(([\d.]+)px\)/.exec(el.s.filter ?? '')
  return m ? parseFloat(m[1]) : 0
}

export function cleanTree(root: WEl): Cleaned {
  const notes: string[] = []
  const alias = new Map<number, number>()
  const count: Record<string, number> = {}
  const tally = (k: string) => (count[k] = (count[k] ?? 0) + 1)
  const remove = (el: WEl) => {
    if (el.parent) el.parent.kids = el.parent.kids.filter((k) => k !== el)
  }

  // 1. `display: contents` boxes are scaffolding by definition: their children take their place.
  const unwrap = (el: WEl) => {
    el.kids = el.kids.flatMap((k) => {
      if (isEl(k) && k.s.display === 'contents' && !STRONG.has(k.tag)) {
        for (const g of k.kids) if (isEl(g)) g.parent = el
        alias.set(k.id, el.id)
        return k.kids
      }
      return [k]
    })
    for (const k of els(el)) unwrap(k)
  }
  unwrap(root)

  // 2. Artifacts.
  for (const el of allEls(root)) {
    if (el === root) continue
    // Invisible controls laid over something (a comparison slider's range input, a styled file picker).
    if (/^(input|select|textarea)$/.test(el.tag) && parseFloat(el.s.opacity ?? '1') < 0.05 && !/^(radio|checkbox)$/.test(hint(el, 'type') ?? '')) {
      remove(el)
      tally('control')
      continue
    }
    // Faded-out layers with nothing to read: the other icons of a carousel, a glow waiting for hover.
    if (parseFloat(el.s.opacity ?? '1') < 0.02 && !hasCopy(el) && !el.media) {
      remove(el)
      tally('hidden')
    }
  }
  // Copies of one picture stacked in the same place (a blurred glow behind a screenshot, a
  // before/after pair): keep the sharp one that sits in the flow.
  const media = allEls(root).filter((e) => e.media && e.rect[2] >= 24 && e.rect[3] >= 24)
  const blurred = (e: WEl) => {
    let b = 0
    for (let p: WEl | null = e; p && p !== root; p = p.parent) b = Math.max(b, blurOf(p))
    return b
  }
  const inFlow = (e: WEl) => {
    for (let p: WEl | null = e; p && p !== root; p = p.parent) if (outOfFlow(p)) return false
    return true
  }
  const score = (e: WEl) => (blurred(e) >= 3 ? -10 : 0) + (inFlow(e) ? 2 : 0) + (e.media?.alt ? 1 : 0)
  const gone = new Set<WEl>()
  for (const a of media) {
    if (gone.has(a)) continue
    const twins = media.filter((b) => b !== a && !gone.has(b) && overlap(a.rect, b.rect) >= 0.85 && Math.abs(area(a.rect) / Math.max(1, area(b.rect)) - 1) < 0.2)
    if (!twins.length) continue
    const group = [a, ...twins].sort((x, y) => score(y) - score(x))
    for (const d of group.slice(1)) gone.add(d)
  }
  for (const d of gone) {
    // Take the empty wrappers it leaves behind with it.
    let top: WEl = d
    while (top.parent && top.parent !== root && els(top.parent).length === 1 && !hasCopy(top.parent) && !top.parent.media) top = top.parent
    remove(top)
    tally('copy')
  }
  // Scrims: a see-through wash laid over a picture, there to darken it for the copy on top.
  for (const el of allEls(root)) {
    if (!outOfFlow(el) || hasCopy(el) || els(el).length || el.media || el.svg) continue
    const bg = parseColor(el.s['background-color'] ?? '')
    const washy = (bg && bg.a > 0.01 && bg.a < 0.8) || (/gradient/.test(el.s['background-image'] ?? '') && !/url\(/.test(el.s['background-image'] ?? ''))
    if (!washy) continue
    const pics = allEls(el.parent ?? root).filter((m) => m.media)
    if (pics.some((m) => overlap(el.rect, m.rect) >= 0.85)) {
      remove(el)
      tally('scrim')
    }
  }

  // 3. Fold wrappers: a box around exactly one box, the same size, with nothing of its own to show.
  const fold = (el: WEl) => {
    for (const k of els(el)) fold(k)
    for (;;) {
      const kids = els(el)
      if (kids.length !== 1 || ownText(el) || el.svg || el.media) return
      const k = kids[0]
      if (!foldable(el, k)) return
      merge(el, k)
      tally('wrapper')
    }
  }
  const foldable = (w: WEl, c: WEl): boolean => {
    if (STRONG.has(w.tag) && STRONG.has(c.tag)) return false
    if (w === root && (c.svg || c.media || STRONG.has(c.tag))) return false
    if (!sameRect(w, c)) return false
    if (padded(w) || bordered(w)) return false
    if (w.before && c.before) return false
    if (w.after && c.after) return false
    for (const p of PAINT) if (hasPaint(w, p) && hasPaint(c, p)) return false
    if (rounded(w) && rounded(c) && radius(w) !== radius(c)) return false
    // A box that clips a rounded child into shape, or scrolls, keeps doing so on the merged box.
    return true
  }
  const merge = (w: WEl, c: WEl) => {
    const s: Decls = { ...c.s }
    for (const p of OUTER) if (w.s[p] !== undefined) s[p] = w.s[p]
    // A positioned inner box is what its own positioned children are placed against: the merged box stays positioned.
    const cp = c.s.position ?? 'static'
    if ((w.s.position ?? 'static') === 'static' && cp !== 'static') {
      const inFlowOffsets = cp === 'relative' || cp === 'sticky'
      s.position = cp === 'sticky' ? 'sticky' : 'relative'
      for (const side of ['top', 'right', 'bottom', 'left']) s[side] = inFlowOffsets ? c.s[side] : 'auto'
      s['z-index'] = c.s['z-index']
    }
    // The outer box's position wins; an inner box filling it absolutely was only filling it.
    for (const p of PAINT) if (hasPaint(w, p)) s[p] = w.s[p]
    if (rounded(w) && !rounded(c)) for (const corner of ['top-left', 'top-right', 'bottom-right', 'bottom-left']) s[`border-${corner}-radius`] = w.s[`border-${corner}-radius`]
    for (const axis of ['overflow-x', 'overflow-y']) if ((c.s[axis] ?? 'visible') === 'visible' && (w.s[axis] ?? 'visible') !== 'visible') s[axis] = w.s[axis]
    const op = parseFloat(w.s.opacity ?? '1') * parseFloat(c.s.opacity ?? '1')
    s.opacity = String(Math.round(op * 1000) / 1000)
    // Display: the inner box's, unless it was inline inside a block-level wrapper.
    const wd = w.s.display ?? 'block'
    const cd = c.s.display ?? 'block'
    if (/^inline/.test(cd) && !/^inline/.test(wd)) s.display = cd === 'inline-flex' ? 'flex' : cd === 'inline-grid' ? 'grid' : /flex|grid/.test(wd) && !els(c).length ? 'block' : wd
    if (cd === 'contents') s.display = wd
    const tag = STRONG.has(c.tag) || c.svg || c.media ? c.tag : STRONG.has(w.tag) ? w.tag : LANDMARK.has(w.tag) ? w.tag : LANDMARK.has(c.tag) ? c.tag : c.tag
    if (w !== root) {
      w.def = tag === c.tag ? c.def : w.def
      w.tag = tag
      w.ns = c.ns
    }
    w.s = s
    const cls = [hint(w, 'class'), hint(c, 'class')].filter(Boolean).join(' ')
    w.hints = [...w.hints.filter(([k]) => k !== 'class' && !c.hints.some(([ck]) => ck === k)), ...c.hints.filter(([k]) => k !== 'class'), ...(cls ? ([['class', cls]] as [string, string][]) : [])]
    w.before ??= c.before
    w.after ??= c.after
    if (c.hover) w.hover = { ...w.hover, ...c.hover }
    if (c.groupHover) w.groupHover = [...(w.groupHover ?? []), ...c.groupHover]
    w.svg = c.svg
    w.media = c.media
    w.kids = c.kids
    for (const g of els(w)) g.parent = w
    alias.set(c.id, w.id)
  }
  fold(root)

  // Hover rules that restyled a box that folded away now restyle the box it folded into.
  const resolve = (id: number): number => (alias.has(id) ? resolve(alias.get(id)!) : id)
  for (const el of allEls(root)) for (const g of el.groupHover ?? []) g.target = resolve(g.target)

  // 4. Rows of cards: a stack of row boxes that each hold a few alike cards is one grid, laid out by
  // the page in rows. The cards become siblings on a 12-column grid, each spanning its share of the
  // row, so they read (and add, duplicate and reorder) as one list.
  let regridded = 0
  for (const el of allEls(root)) {
    const rows = els(el)
    if (rows.length < 2 || ownText(el)) continue
    const rowish = (r: WEl) =>
      /flex|grid/.test(r.s.display ?? '') && !/column/.test(r.s['flex-direction'] ?? '') && els(r).length >= 2 && els(r).length <= 4 && !hasPaint(r, 'background-color') && !bordered(r) && !padded(r) && els(r).every((c) => hasCopy(c) && Math.abs(c.rect[1] - els(r)[0].rect[1]) < 8)
    if (!rows.every(rowish)) continue
    const cards = rows.flatMap((r) => els(r))
    const leaves = cards.map((c) => allEls(c).length)
    if (Math.max(...leaves) > Math.min(...leaves) * 3) continue
    const colGap = px(rows[0].s['column-gap'])
    const rowGap = Math.max(0, rows[1].rect[1] - (rows[0].rect[1] + rows[0].rect[3]))
    const W = el.rect[2] - px(el.s['padding-left']) - px(el.s['padding-right'])
    const track = (W - 11 * colGap) / 12
    for (const c of cards) {
      c.parent = el
      const span = Math.max(1, Math.min(12, Math.round((c.rect[2] + colGap) / (track + colGap))))
      c.s['grid-column-start'] = `span ${span}`
      c.s['grid-column-end'] = 'auto'
      c.s['flex-grow'] = '0'
      c.s['flex-shrink'] = '1'
      c.s['flex-basis'] = 'auto'
    }
    for (const r of rows) alias.set(r.id, el.id)
    el.kids = cards
    el.s.display = 'grid'
    el.s['grid-template-columns'] = Array(12).fill(`${Math.round(track)}px`).join(' ')
    el.s['column-gap'] = `${colGap}px`
    el.s['row-gap'] = `${rowGap}px`
    el.s['flex-direction'] = 'row'
    regridded++
  }
  for (const el of allEls(root)) for (const g of el.groupHover ?? []) g.target = resolve(g.target)

  // 5. Accordions built from a button and a panel become <details> (rule 7: no JS).
  const rows: { row: WEl; icon?: WEl; shut: boolean }[] = []
  for (const el of allEls(root)) {
    const kids = els(el)
    if (el === root || kids.length !== 2 || el.tag === 'details' || ownText(el)) continue
    const [trigger, panel] = kids
    const pressy = trigger.tag === 'button' || hint(trigger, 'role') === 'button' || hint(trigger, 'aria-expanded') !== undefined
    if (!pressy || !hasCopy(trigger) || !hasCopy(panel) || panel.tag === 'button') continue
    const shut = panel.rect[3] < 2 && /hidden|clip/.test(panel.s['overflow-y'] ?? '')
    const named = /faq|accordion|toggle|collaps|disclos|expand/i.test(`${hint(trigger, 'class') ?? ''} ${hint(el, 'class') ?? ''}`)
    if (!shut && hint(trigger, 'aria-expanded') === undefined && !named) continue
    const gap = /flex|grid/.test(el.s.display ?? '') ? px(el.s['row-gap']) : 0
    el.tag = 'details'
    if (!shut) el.hints = [...el.hints, ['open', '']]
    el.s.display = 'block'
    trigger.tag = 'summary'
    trigger.s.display = 'block'
    trigger.s['list-style-type'] = 'none'
    if (gap) panel.s['margin-top'] = `${gap}px`
    // Closed answers measure nothing: give the panel its natural size and look back.
    if (shut) {
      panel.rect = [panel.rect[0], panel.rect[1], panel.rect[2], Math.max(0, ...els(panel).map((k) => k.rect[3]))]
      for (const k of allEls(panel))
        if (parseFloat(k.s.opacity ?? '1') < 0.05) {
          k.s.opacity = '1'
          k.s.transform = 'none'
        }
    }
    // The chevron at the end of the question.
    const icons = allEls(trigger).filter((e) => (e.svg || /url\("?data:image\/svg/.test(e.s['background-image'] ?? '')) && e.rect[2] <= 40)
    rows.push({ row: el, icon: icons[icons.length - 1], shut })
  }
  // Closed rows draw their chevron one way, the open row the other: closed is the resting look,
  // the open one's turn (or half a turn, when every row was closed) goes on [open].
  const iconT = (r: { icon?: WEl }) => r.icon?.s.transform ?? 'none'
  const shutT = rows.find((r) => r.shut && r.icon)
  const openT = rows.find((r) => !r.shut && r.icon)
  for (const r of rows) {
    if (!r.icon) continue
    r.icon.s.transform = shutT ? iconT(shutT) : 'none'
    r.row.openTurn = r.icon
    r.row.openStyle = openT && shutT ? { transform: iconT(openT) === 'none' ? 'none' : iconT(openT) } : { rotate: '180deg' }
  }
  const disclosures = rows.length

  const parts: string[] = []
  if (count.wrapper) parts.push(`folded ${count.wrapper} wrapper box${count.wrapper > 1 ? 'es' : ''}`)
  if (count.copy) parts.push(`dropped ${count.copy} stacked cop${count.copy > 1 ? 'ies' : 'y'} of a picture`)
  if (count.scrim) parts.push(`${count.scrim} scrim${count.scrim > 1 ? 's' : ''} over photos`)
  if (count.hidden) parts.push(`${count.hidden} invisible layer${count.hidden > 1 ? 's' : ''}`)
  if (count.control) parts.push(`${count.control} hidden control${count.control > 1 ? 's' : ''}`)
  if (parts.length) notes.push(`Kept the content and its layout: ${parts.join(', ')}`)
  if (regridded) notes.push(`${regridded} stack${regridded > 1 ? 's' : ''} of card rows became one grid, so the cards are one list`)
  if (disclosures) notes.push(`${disclosures} accordion row${disclosures > 1 ? 's' : ''} became <details>, so ${disclosures > 1 ? 'they open' : 'it opens'} without script`)
  return { notes }
}

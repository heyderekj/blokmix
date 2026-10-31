// Write clip.css: each element's computed look, minus what Blokmix's base CSS
// and the browser already give it, in --mx-* tokens, nested under the root
// class, with hover states and a 390px layout.

import type { TokenSet } from '@/core/types'
import { ColorMapper, COLOR_RE, parseColor } from './color'
import { allEls, els, leavesOf, px, sel, type WEl } from './tree'
import { firstFamily, type Families } from './tokens'
import { HEADING_TAGS, isPressable } from './roles'
import type { Decls } from './types'

const SCALE = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
const STEPS: [string, number][] = [
  ['xs', -2],
  ['sm', -1],
  ['base', 0],
  ['lg', 1],
  ['xl', 2],
  ['2xl', 3],
  ['3xl', 4],
  ['4xl', 5],
  ['5xl', 6],
  ['6xl', 7],
]
const r2 = (n: number) => Math.round(n * 100) / 100

/** A column as wide as the guide's content or reading column becomes that width token, so the Width dial moves it. */
const columnWidth = (w: number) => (w === 1200 ? 'var(--mx-width-content)' : w === 760 ? 'var(--mx-width-text)' : `${w}px`)

/** Turns computed values into token expressions for one capture. */
export class TokenWriter {
  readonly colors: ColorMapper
  private base: number
  private ratio: number
  private unit: number
  private radius: number
  private stroke: number
  private section: number
  private duration: number

  constructor(
    readonly tokens: TokenSet,
    palette: ConstructorParameters<typeof ColorMapper>[0],
    readonly families: Families,
    readonly viewport: { width: number; height: number },
  ) {
    this.colors = new ColorMapper(palette)
    this.base = px(tokens['type.base']) || 16
    this.ratio = parseFloat(tokens['type.ratio']) || 1.25
    this.unit = px(tokens['space.base']) || 4
    this.radius = px(tokens['radius.base'])
    this.stroke = px(tokens['stroke.width']) || 1
    this.section = px(tokens['space.section'])
    this.duration = px(tokens['motion.duration']) || 240
  }

  color = (v: string) => this.colors.map(v)
  colorsIn = (v: string) => this.colors.mapIn(v)

  space(v: number): string {
    const a = Math.abs(v)
    if (a < 0.5) return '0'
    if (a <= 2) return `${Math.round(v)}px`
    const max = SCALE[SCALE.length - 1] * this.unit
    let expr: string
    if (a > max * 1.12) expr = `calc(var(--mx-space-10) * ${r2(a / max)})`
    else {
      let best = 1
      for (let i = 1; i < SCALE.length; i++) if (Math.abs(Math.log(a / (SCALE[i] * this.unit))) < Math.abs(Math.log(a / (SCALE[best] * this.unit)))) best = i
      expr = `var(--mx-space-${best})`
    }
    return v < 0 ? `calc(${expr} * -1)` : expr
  }

  sectionSpace(v: number): string {
    if (this.section && Math.abs(v - this.section) <= this.section * 0.15) return 'var(--mx-space-section)'
    if (this.section && v > this.section) return `calc(var(--mx-space-section) * ${r2(v / this.section)})`
    return this.space(v)
  }

  /** A font size on the type scale; display sizes shrink with the viewport. */
  fontSize(v: number): string {
    const step = Math.round(Math.log(v / this.base) / Math.log(this.ratio))
    if (step > 7) {
      const top = this.base * Math.pow(this.ratio, 7)
      return `clamp(var(--mx-text-4xl), ${r2((v / this.viewport.width) * 100)}vw, calc(var(--mx-text-6xl) * ${r2(v / top)}))`
    }
    const s = Math.max(-2, step)
    const name = STEPS.find(([, n]) => n === s)![0]
    if (s >= 4) {
      const lo = STEPS.find(([, n]) => n === s - 2)![0]
      return `clamp(var(--mx-text-${lo}), ${r2((v / this.viewport.width) * 100)}vw, var(--mx-text-${name}))`
    }
    return `var(--mx-text-${name})`
  }

  corner(v: string, el: WEl): string {
    if (/%/.test(v)) return v.trim()
    const r = px(v)
    if (r < 0.5) return '0'
    const [, , w, h] = el.rect
    if (r >= 999 || (h > 0 && r >= Math.min(w, h) / 2 - 1)) return w > 0 && Math.abs(w - h) < 2 ? '50%' : 'var(--mx-radius-pill)'
    if (!this.radius) return r <= 3 ? 'var(--mx-radius-sm)' : 'var(--mx-radius)'
    const opts: [string, number][] = [
      ['var(--mx-radius-sm)', this.radius / 2],
      ['var(--mx-radius)', this.radius],
      ['var(--mx-radius-lg)', this.radius * 1.75],
    ]
    if (r > this.radius * 2.6) return `calc(var(--mx-radius-lg) * ${r2(r / (this.radius * 1.75))})`
    return opts.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0]
  }

  strokeOf(w: number): string {
    const n = Math.round((w / this.stroke) * 2) / 2
    return n <= 1 ? 'var(--mx-stroke)' : `calc(var(--mx-stroke) * ${n})`
  }

  family(stack: string, headingish: boolean): string {
    const f = firstFamily(stack).toLowerCase()
    const { display, body, mono } = this.families
    if (mono && f === mono.toLowerCase()) return 'var(--mx-font-mono)'
    if (/monospace/.test(stack) && !/sans|serif/.test(f)) return 'var(--mx-font-mono)'
    if (f === display.toLowerCase() && (headingish || f !== body.toLowerCase())) return 'var(--mx-font-display)'
    return 'var(--mx-font-body)'
  }

  shadow(v: string): string {
    if (!v || v === 'none') return 'none'
    const layers = v.split(/,(?![^(]*\))/).map((l) => l.trim())
    // Rings drawn with a spread-only shadow are line weight, not elevation.
    const rings = layers.map((l) => {
      const color = (l.match(COLOR_RE) ?? [])[0]
      const nums = l.replace(COLOR_RE, '').replace('inset', '').trim().split(/\s+/).map(px)
      return color && nums.length >= 4 && nums[0] === 0 && nums[1] === 0 && nums[2] === 0 && nums[3] > 0 ? `${/inset/.test(l) ? 'inset ' : ''}0 0 0 ${this.strokeOf(nums[3])} ${this.color(color)}` : null
    })
    if (rings.every(Boolean)) return rings.join(', ')
    // A hairline ring plus a soft drop (a window, a card): the ring stays a line, the drop becomes the card shadow.
    const kept = rings.filter(Boolean)
    return kept.length ? `${kept.join(', ')}, var(--mx-shadow-card)` : 'var(--mx-shadow-card)'
  }

  ms(v: string): number {
    const n = parseFloat(v)
    return /ms/.test(v) ? n : n * 1000
  }

  duration_(v: string): string {
    const ms = this.ms(v)
    if (!ms) return '0s'
    const k = r2(ms / this.duration)
    return k === 1 ? 'var(--mx-motion-duration)' : `calc(var(--mx-motion-duration) * ${k})`
  }

  ease(v: string): string {
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
    if (norm(v) === norm(this.tokens['motion.ease'])) return 'var(--mx-motion-ease)'
    if (v === 'ease' || v === 'ease-out') return 'var(--mx-motion-ease)'
    return v
  }

  vh(v: number): string {
    return `calc(var(--mx-vh) * ${Math.round((v / this.viewport.height) * 100)})`
  }

  /** Any value: colors to tokens, vh to --mx-vh, borders to stroke. */
  value(prop: string, v: string, el?: WEl): string {
    if (/^(box-shadow)$/.test(prop)) return this.shadow(v)
    if (prop === 'font-family') return this.family(v, !!el && HEADING_TAGS.has(el.tag))
    if (/^border(-(top|right|bottom|left))?(-width)?$/.test(prop)) {
      return v.replace(/(-?\d*\.?\d+)px/g, (_, n) => (parseFloat(n) ? this.strokeOf(parseFloat(n)) : '0')).replace(COLOR_RE, (c) => this.color(c))
    }
    let out = v.replace(COLOR_RE, (c) => this.color(c))
    out = out.replace(/(-?\d*\.?\d+)(?:s|d|l)?vh\b/g, (_, n) => `calc(var(--mx-vh) * ${r2(parseFloat(n))})`)
    return out
  }
}

// ---------- per-element declarations ----------

const BASE_ZERO_MARGIN = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'figure', 'blockquote', 'ul', 'ol', 'dl', 'dd'])
const SIDES = ['top', 'right', 'bottom', 'left'] as const
const BLOCKISH = /^(block|flex|grid|flow-root|list-item|table)$/

/** What the element looks like in Blokmix before the clip's CSS: browser defaults + the base reset. */
function baseline(el: WEl, prop: string): string {
  const t = el.tag
  if (/^margin-/.test(prop) && BASE_ZERO_MARGIN.has(t)) return '0px'
  if (/^padding-/.test(prop) && (t === 'ul' || t === 'ol' || t === 'button')) return '0px'
  if (t === 'button' && (/^border-.*-width$/.test(prop))) return '0px'
  if (t === 'button' && prop === 'background-color') return 'rgba(0, 0, 0, 0)'
  if (t === 'a' && prop === 'text-decoration-line') return 'none'
  if ((t === 'img' || t === 'svg') && prop === 'display') return 'block'
  return el.def[prop] ?? ''
}

/** Text properties the base CSS hands down from the parent for this tag (a, button and inputs inherit). */
const neutralized = (el: WEl, prop: string) =>
  (prop === 'color' && /^(a|button|input|select|textarea)$/.test(el.tag)) || (/^font-/.test(prop) && /^(button|input|select|textarea)$/.test(el.tag)) || prop === 'cursor' || prop === 'visibility'

export interface ElementCss {
  decls: Decls
  /** A multi-color illustration's shapes, by class: `.pf1 { fill: … }`. */
  paints?: Record<string, Decls>
  hover?: Decls
  active?: Decls
  before?: Decls
  after?: Decls
  mobile?: Decls
}

export function elementCss(el: WEl, w: TokenWriter, ctx: { root: WEl; type: string; notes: Set<string> }): ElementCss {
  const out: Decls = {}
  const s = el.s
  const isRoot = el === ctx.root
  const parent = el.parent
  const put = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== '') out[k] = v
  }
  const differs = (prop: string) => (s[prop] ?? '') !== baseline(el, prop)

  if (el.synthetic === 'contents') return { decls: { display: 'contents' } }
  if (el.synthetic === 'wrap') return { decls: { ...(el.extra ?? {}) } }

  const skip = el.skip ?? new Set<string>()
  const textRevealed = parseFloat(s.opacity ?? '1') < 0.05 && leavesOf(el).length + (el.text ? 1 : 0) > 0
  if (textRevealed) ctx.notes.add('Some copy was still invisible (waiting for a scroll reveal); it’s captured visible')

  // ---- box ----
  const display = s.display ?? 'block'
  if (!skip.has('display') && display !== baseline(el, 'display') && !(el.synthetic === 'art' && display === 'block')) put('display', display === 'list-item' && el.tag !== 'li' ? 'block' : display)
  let pos = s.position ?? 'static'
  if (pos === 'fixed') pos = isRoot ? 'relative' : 'absolute'
  if (pos === 'sticky' && !isRoot) pos = 'relative'
  if (pos !== 'static') put('position', pos)
  const abs = pos === 'absolute'
  // A section's own offsets placed it on its page (a fixed bar, a pulled-up hero): in a clip it starts the flow.
  if (pos !== 'static' && pos !== 'sticky' && !isRoot) for (const side of SIDES) if ((s[side] ?? 'auto') !== 'auto' && (abs || px(s[side]) !== 0)) put(side, s[side])
  if (pos === 'sticky') put('top', s.top && s.top !== 'auto' ? s.top : '0')
  if (pos !== 'static' && (s['z-index'] ?? 'auto') !== 'auto') put('z-index', s['z-index'])

  const flex = /flex/.test(display)
  const grid = /grid/.test(display)
  if (flex) {
    if ((s['flex-direction'] ?? 'row') !== 'row') put('flex-direction', s['flex-direction'])
    if ((s['flex-wrap'] ?? 'nowrap') !== 'nowrap') put('flex-wrap', s['flex-wrap'])
  }
  if (flex || grid) {
    for (const p of ['justify-content', 'align-items', 'align-content', 'justify-items']) if (s[p] && s[p] !== 'normal' && s[p] !== 'legacy' && !(p === 'justify-content' && s[p] === 'flex-start') && !(p === 'align-items' && s[p] === 'stretch' && flex)) put(p, s[p])
    const rg = s['row-gap'] ?? 'normal'
    const cg = s['column-gap'] ?? 'normal'
    const gap = (v: string) => (v === 'normal' ? '0' : w.space(px(v)))
    if (rg !== 'normal' || cg !== 'normal') {
      if (gap(rg) === gap(cg)) put('gap', gap(rg))
      else {
        if (rg !== 'normal' && px(rg)) put('row-gap', gap(rg))
        if (cg !== 'normal' && px(cg)) put('column-gap', gap(cg))
      }
    }
  }
  if (grid) {
    const cols = gridColumns(s['grid-template-columns'] ?? 'none')
    if (cols) put('grid-template-columns', cols)
    if ((s['grid-auto-flow'] ?? 'row') !== 'row') put('grid-auto-flow', s['grid-auto-flow'])
  }
  for (const p of ['align-self', 'justify-self']) if (s[p] && s[p] !== 'auto' && s[p] !== 'normal') put(p, s[p])
  const span = (a: string | undefined, b: string | undefined) => (a && a !== 'auto') || (b && b !== 'auto') ? `${a ?? 'auto'} / ${b ?? 'auto'}` : undefined
  put('grid-column', span(s['grid-column-start'], s['grid-column-end']))
  put('grid-row', span(s['grid-row-start'], s['grid-row-end']))
  if ((s.order ?? '0') !== '0') put('order', s.order)

  // ---- size ----
  // Blokmix sizes border-box; a content-box page's widths grow by their padding and border.
  const contentBox = (s['box-sizing'] ?? 'content-box') === 'content-box'
  const padX = contentBox ? px(s['padding-left']) + px(s['padding-right']) + px(s['border-left-width']) + px(s['border-right-width']) : 0
  const [, , W, H] = el.rect
  const pw = parent ? parent.rect[2] - px(parent.s['padding-left']) - px(parent.s['padding-right']) - px(parent.s['border-left-width']) - px(parent.s['border-right-width']) : w.viewport.width
  const pdisp = parent?.s.display ?? 'block'
  const inFlexRow = /flex/.test(pdisp) && !/column/.test(parent?.s['flex-direction'] ?? 'row')
  const inGrid = /grid/.test(pdisp)
  const hasCopy = el.text !== undefined || leavesOf(el).length > 0
  const empty = !hasCopy && !els(el).length && !el.svgNode
  const grow = s['flex-grow'] ?? '0'
  const shrink = s['flex-shrink'] ?? '1'
  const basis = s['flex-basis'] ?? 'auto'
  if (parent && /flex/.test(pdisp) && (grow !== '0' || shrink !== '1' || basis !== 'auto')) put('flex', `${grow} ${shrink} ${basis === 'auto' ? 'auto' : /px$/.test(basis) ? `${Math.round(px(basis))}px` : basis}`)

  if (abs) {
    put('width', Math.abs(W - (parent?.rect[2] ?? W)) < 2 ? '100%' : `${Math.round(W)}px`)
    put('height', Math.abs(H - (parent?.rect[3] ?? H)) < 2 ? '100%' : `${Math.round(H)}px`)
  } else if (el.synthetic === 'art') {
    put('width', W >= pw * 0.92 || inGrid ? '100%' : `${Math.round(W)}px`)
    if (W < pw * 0.92 && !inGrid) put('max-width', '100%')
    put('aspect-ratio', (el.ratio ?? '4/3').replace('/', ' / '))
  } else if (!hasCopy && !el.svgNode && els(el).length && allEls(el).every((e) => e === el || e.svgNode || !!e.parent?.svgNode) && W <= 160) {
    // An icon tile: a fixed box around an icon.
    put('width', `${Math.round(W)}px`)
    put('height', `${Math.round(H)}px`)
  } else if (empty && !el.svgNode) {
    if (W > 0 && W < pw - 1 && !(inGrid || inFlexRow && grow !== '0')) put('width', `${Math.round(W)}px`)
    if (H > 0 && !(inFlexRow && (s['align-self'] === 'stretch' || s['align-items'] === 'stretch') && false)) put('height', `${Math.round(H * 10) / 10}px`)
  } else if (!el.svgNode && el.synthetic !== 'wordmark') {
    if ((s['max-width'] ?? 'none') !== 'none') put('max-width', /px$/.test(s['max-width']) ? columnWidth(Math.round(px(s['max-width']) + padX)) : s['max-width'])
    else if (!inFlexRow && !inGrid && BLOCKISH.test(display) && parent && W < pw - 2 && W > 0 && !abs && el !== ctx.root) put('max-width', columnWidth(Math.round(W)))
    if (inFlexRow && grow === '0' && basis === 'auto' && parent) {
      const sibs = els(parent).filter((k) => (k.s.position ?? 'static') === 'static')
      const total = sibs.reduce((n, k) => n + k.rect[2], 0)
      const equal = sibs.length >= 2 && sibs.every((k) => Math.abs(k.rect[2] - sibs[0].rect[2]) < 4)
      // Only a row its children fill was laid out by proportion; otherwise they're sized by their content.
      const gaps = px(parent.s['column-gap']) * (sibs.length - 1)
      const fills = total + gaps >= pw * 0.95
      if (equal && fills) put('flex', '1 1 0')
      else if (fills && W / pw > 0.3 && hasCopy && (parent.s['flex-wrap'] ?? 'nowrap') === 'nowrap' && sibs.length >= 2) put('flex', `0 1 ${Math.round((W / pw) * 100)}%`)
    }
  }
  // In a column that centers its children, a box only keeps the width the page gave it if we say so.
  const inFlexCol = /flex/.test(pdisp) && /column/.test(parent?.s['flex-direction'] ?? '')
  const alignment = s['align-self'] && s['align-self'] !== 'auto' ? s['align-self'] : parent?.s['align-items'] ?? 'normal'
  if (inFlexCol && !/stretch|normal/.test(alignment) && els(el).length && el.text === undefined && !isPressable(el) && !abs) {
    if (W >= pw - 2) put('align-self', 'stretch')
    else {
      put('width', `${Math.round(W)}px`)
      put('max-width', '100%')
    }
  }
  // A box its in-flow content doesn't fill: a picture frame whose layers are all positioned, a hero
  // with a set height, a panel taller than its copy. Its size was set on the page, so it's kept.
  if (!abs && !el.svgNode && el.synthetic !== 'art' && el.text === undefined && els(el).length) {
    const flow = els(el).filter((k) => !/^(absolute|fixed)$/.test(k.s.position ?? 'static'))
    const big = H >= w.viewport.height * 0.4
    const stretched = !!parent && (inGrid || (inFlexRow && /stretch|normal/.test(s['align-self'] === 'auto' ? parent.s['align-items'] ?? 'normal' : s['align-self'] ?? 'auto')))
    if (!flow.length && !hasCopy) {
      // Nothing in the flow at all: it keeps its shape, and scales with its width.
      if (W >= 160 && !(inFlexRow && !/px$/.test(out.flex ?? 'px'))) {
        if (!(inGrid || inFlexRow && grow !== '0')) put('width', W >= pw * 0.92 ? '100%' : `${Math.round(W)}px`)
        put('max-width', '100%')
        put('aspect-ratio', `${Math.round(W)} / ${Math.round(H)}`)
      } else {
        put('width', `${Math.round(W)}px`)
        put('height', `${Math.round(H)}px`)
      }
    } else {
      const padB = px(s['padding-bottom']) + px(s['border-bottom-width'])
      const bottom = flow.length ? Math.max(...flow.map((k) => k.rect[1] + k.rect[3] + Math.max(0, px(k.s['margin-bottom'])))) - el.rect[1] + padB : 0
      const clipped = /hidden|clip/.test(s['overflow-y'] ?? '')
      if (clipped && bottom > H + 4) put('height', big ? w.vh(H) : `${Math.round(H)}px`)
      else if (H > bottom + 24 && !stretched && (s['min-height'] ?? 'auto') === 'auto') put('min-height', big ? w.vh(H) : `${Math.round(H)}px`)
    }
  }
  // A bar with a set height (a 72px nav row): its children sit centered in more room than they need.
  const contentH = H - px(s['padding-top']) - px(s['padding-bottom']) - px(s['border-top-width']) - px(s['border-bottom-width'])
  const tallest = Math.max(0, ...els(el).filter((k) => (k.s.position ?? 'static') === 'static').map((k) => k.rect[3] + px(k.s['margin-top']) + px(k.s['margin-bottom'])))
  if (flex && !/column/.test(s['flex-direction'] ?? '') && /center/.test(s['align-items'] ?? '') && tallest > 0 && contentH > tallest + 6 && (s['min-height'] ?? 'auto') === 'auto') put('min-height', `${Math.round(H)}px`)
  if ((s['min-height'] ?? 'auto') !== 'auto' && px(s['min-height']) > 0) {
    const mh = px(s['min-height'])
    put('min-height', mh >= w.viewport.height * 0.4 ? w.vh(mh) : `${Math.round(mh)}px`)
  }
  if ((s['max-height'] ?? 'none') !== 'none' && /px$/.test(s['max-height'])) put('max-height', `${Math.round(px(s['max-height']))}px`)
  if ((s['min-width'] ?? 'auto') !== 'auto' && px(s['min-width']) > 0) put('min-width', `${Math.round(px(s['min-width']))}px`)
  if ((s['aspect-ratio'] ?? 'auto') !== 'auto' && !out['aspect-ratio']) put('aspect-ratio', s['aspect-ratio'].replace(/^auto\s+/, ''))

  // ---- margin & padding ----
  const m = SIDES.map((d) => px(s[`margin-${d}`]))
  const autoX = !inFlexRow && !inGrid && parent && BLOCKISH.test(display) && m[1] > 1 && Math.abs(m[1] - m[3]) < 2 && Math.abs(m[3] - (pw - W) / 2) < 3
  const pushRight = inFlexRow && parent && m[3] > 16 && Math.abs(el.rect[0] + W - (parent.rect[2] - px(parent.s['padding-right']))) < 3 && els(parent).indexOf(el) === els(parent).length - 1
  const mv = SIDES.map((d, i) => {
    if ((d === 'left' || d === 'right') && autoX) return 'auto'
    if (d === 'left' && pushRight) return 'auto'
    return differs(`margin-${d}`) || px(baseline(el, `margin-${d}`)) !== m[i] ? w.space(m[i]) : null
  })
  if (!isRoot) writeSides(put, 'margin', mv, el, baseline)
  const p = SIDES.map((d) => px(s[`padding-${d}`]))
  const pv = SIDES.map((d, i) => {
    if (!differs(`padding-${d}`) && px(baseline(el, `padding-${d}`)) === p[i]) return null
    return isRoot && (d === 'top' || d === 'bottom') && p[i] >= 40 ? w.sectionSpace(p[i]) : w.space(p[i])
  })
  writeSides(put, 'padding', pv, el, baseline)

  // ---- border, corners ----
  const bw = SIDES.map((d) => (s[`border-${d}-style`] === 'none' ? 0 : px(s[`border-${d}-width`])))
  const bdef = SIDES.map((d) => px(baseline(el, `border-${d}-width`)) && baseline(el, `border-${d}-style`) !== 'none')
  const borderOf = (i: number) => (bw[i] > 0 ? `${w.strokeOf(bw[i])} ${s[`border-${SIDES[i]}-style`]} ${w.color(s[`border-${SIDES[i]}-color`] ?? 'currentColor')}` : '0')
  const bs = SIDES.map((_, i) => (bw[i] > 0 || bdef[i] ? borderOf(i) : null))
  if (bs.every((b) => b !== null) && new Set(bs).size === 1) put('border', bs[0]!)
  else bs.forEach((b, i) => b !== null && put(`border-${SIDES[i]}`, b))
  const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => s[`border-${c}-radius`] ?? '0px')
  if (corners.some((c) => px(c) > 0 || /%/.test(c))) {
    const cv = corners.map((c) => w.corner(c, el))
    put('border-radius', new Set(cv).size === 1 ? cv[0] : cv.join(' '))
  }

  // ---- paint ----
  const bg = parseColor(s['background-color'])
  if (bg && bg.a > 0.01) put('background-color', w.color(s['background-color']))
  else if (isRoot) put('background', 'var(--mx-color-bg)')
  else if (differs('background-color') && el.tag === 'button') put('background', 'none')
  const img = el.extra?.['background-image'] ?? s['background-image'] ?? 'none'
  if (img !== 'none' && !skip.has('background-image')) {
    put('background-image', w.colorsIn(img))
    for (const k of ['background-size', 'background-position', 'background-repeat']) if (differs(k) && !skip.has(k)) put(k, s[k])
  }
  if (/text/.test(s['background-clip'] ?? '')) {
    put('-webkit-background-clip', 'text')
    put('background-clip', 'text')
    put('-webkit-text-fill-color', 'transparent')
  }
  if ((s['box-shadow'] ?? 'none') !== 'none') put('box-shadow', w.shadow(s['box-shadow']))
  if ((s['text-shadow'] ?? 'none') !== 'none') put('text-shadow', w.colorsIn(s['text-shadow']))
  const op = parseFloat(s.opacity ?? '1')
  if (op < 0.99 && !textRevealed) put('opacity', String(r2(op)))
  const ox = s['overflow-x'] ?? 'visible'
  const oy = s['overflow-y'] ?? 'visible'
  if ((ox !== 'visible' || oy !== 'visible') && (differs('overflow-x') || differs('overflow-y'))) put('overflow', ox === oy ? ox : `${ox} ${oy}`)
  const tf = s.transform ?? 'none'
  if (tf !== 'none' && tf !== 'matrix(1, 0, 0, 1, 0, 0)' && !textRevealed) put('transform', tf)
  for (const k of ['filter', 'backdrop-filter']) if ((s[k] ?? 'none') !== 'none') put(k, w.colorsIn(s[k]))
  if ((s['mix-blend-mode'] ?? 'normal') !== 'normal') put('mix-blend-mode', s['mix-blend-mode'])
  if ((s.isolation ?? 'auto') !== 'auto') put('isolation', s.isolation)
  if ((s['pointer-events'] ?? 'auto') !== 'auto' && !isRoot) put('pointer-events', s['pointer-events'])
  const deco = s['text-decoration-line'] ?? 'none'
  if (deco !== baseline(el, 'text-decoration-line') && el.text !== undefined) {
    put('text-decoration-line', deco)
    if (deco !== 'none') {
      if (s['text-decoration-color'] && s['text-decoration-color'] !== s.color) put('text-decoration-color', w.color(s['text-decoration-color']))
      if ((s['text-underline-offset'] ?? 'auto') !== 'auto') put('text-underline-offset', s['text-underline-offset'])
      if (/px$/.test(s['text-decoration-thickness'] ?? '')) put('text-decoration-thickness', w.strokeOf(px(s['text-decoration-thickness'])))
    }
  }

  // ---- text (inherited: only where it changes) ----
  const textProps = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'font-variant-numeric', 'list-style-type']
  const headingish = HEADING_TAGS.has(el.tag) || (el.block === 'heading' && px(s['font-size']) >= w.viewport.width / 60)
  const ratioOf = (e: WEl) => (e.s['line-height'] === 'normal' ? 'normal' : String(r2(px(e.s['line-height']) / (px(e.s['font-size']) || 16))))
  for (const prop of textProps) {
    if (neutralized(el, prop) && !isRoot) {
      if (!parent || s[prop] === parent.s[prop]) continue
    }
    const pv = isRoot ? undefined : parent?.s[prop]
    const uaSpecial = !isRoot && el.def[prop] !== undefined && el.def[prop] !== (ROOT_DEFAULTS.div[prop] ?? el.def[prop]) && !neutralized(el, prop)
    let changed = isRoot || s[prop] !== pv || uaSpecial
    if (prop === 'line-height' && !isRoot && parent) changed = ratioOf(el) !== ratioOf(parent) || uaSpecial
    if (prop === 'text-align' && pv && norm(s[prop]) === norm(pv) && !uaSpecial) changed = false
    if (prop === 'list-style-type') {
      changed = (el.tag === 'ul' || el.tag === 'ol') ? s[prop] !== 'none' : el.tag === 'li' ? false : changed
      if (el.tag === 'summary' && s[prop] === 'none') changed = true
    }
    if (!changed) continue
    const v = s[prop] ?? ''
    // The root inherits Blokmix's body: only what differs from it.
    if (isRoot && (prop === 'list-style-type' || (prop === 'font-weight' && v === '400') || (prop === 'letter-spacing' && v === 'normal'))) continue
    switch (prop) {
      case 'color': {
        const c = w.color(v)
        if (!(isRoot && c === 'var(--mx-color-text)')) put('color', c)
        else put('color', c)
        break
      }
      case 'font-family': {
        const f = el.synthetic === 'wordmark' ? 'var(--mx-font-display)' : w.family(v, headingish)
        if (!(isRoot && f === 'var(--mx-font-body)') && (!parent || f !== w.family(parent.s['font-family'] ?? '', headingish) || uaSpecial)) put('font-family', f)
        break
      }
      case 'font-size': {
        const fs = w.fontSize(px(v))
        if (!(isRoot && fs === 'var(--mx-text-base)')) put('font-size', fs)
        break
      }
      case 'font-weight': {
        const fam = w.family(s['font-family'] ?? '', headingish)
        put('font-weight', fam === 'var(--mx-font-display)' && v === w.tokens['type.displayWeight'] && headingish ? 'var(--mx-type-display-weight)' : v)
        break
      }
      case 'line-height': {
        const r = ratioOf(el)
        if (!(isRoot && r === '1.55')) put('line-height', r)
        break
      }
      case 'letter-spacing':
        put('letter-spacing', v === 'normal' ? 'normal' : `${r2(px(v) / (px(s['font-size']) || 16) * 100) / 100}em`)
        break
      case 'text-align':
        if (!(isRoot && norm(v) === 'start')) put('text-align', norm(v))
        break
      case 'font-style':
      case 'text-transform':
      case 'white-space':
      case 'font-variant-numeric':
        if (!(isRoot && /^(normal|none)$/.test(v))) put(prop, v)
        break
      case 'list-style-type':
        put('list-style', v)
        break
    }
  }
  if ((isPressable(el) && el.tag !== 'button') || el.tag === 'summary') put('cursor', 'pointer')

  // Capture's own additions win.
  for (const [k, v] of Object.entries(el.extra ?? {})) {
    if (k === 'background-image') continue
    if (k === 'column-gap' || k === 'row-gap') out[k] = w.space(px(v))
    else out[k] = v
  }
  if (out['column-gap'] && out['column-gap'] === out['row-gap']) {
    out.gap = out['column-gap']
    delete out['column-gap']
    delete out['row-gap']
  }
  if (el.synthetic === 'art' && el.backdrop) {
    // A backdrop is filled, not illustrated: its own color, or a quiet wash of the primary.
    // Light copy laid over a photo needs a dark wash in its place, and dark copy a light one.
    // Weighed by how much of the copy there is, so a big headline outvotes a small print line.
    const over = leavesOf(ctx.root).filter((l) => overlaps(l.rect, el.rect))
    const weight = (ls: WEl[]) => ls.reduce((n, l) => n + l.rect[2] * l.rect[3], 0)
    const light = weight(over.filter((l) => lum(parseColor(l.s.color)) > 0.55))
    const wash = light > weight(over) / 2 ? 'color-mix(in oklab, var(--mx-color-text) 86%, var(--mx-color-primary))' : 'color-mix(in oklab, var(--mx-color-primary) 14%, var(--mx-color-bg))'
    out.background = bg && bg.a > 0.01 ? w.color(s['background-color']) : wash
    // Behind everything in the section, whatever order the page stacked it in.
    out['z-index'] = '-1'
    delete out['min-height']
    out.overflow = 'hidden'
    delete out['background-color']
  } else if (el.synthetic === 'art') {
    out.background ??= 'color-mix(in oklab, var(--mx-color-primary) 8%, var(--mx-color-surface))'
    out.color = 'color-mix(in oklab, var(--mx-color-primary) 24%, var(--mx-color-surface))'
    out.overflow = 'hidden'
    delete out['background-color']
    if (bg && bg.a > 0.01) out.background = w.color(s['background-color'])
  }

  if (isRoot && allEls(el).some((e) => e.backdrop)) out.isolation = 'isolate'
  const res: ElementCss = { decls: out }
  if (el.svgPaints?.length) res.paints = Object.fromEntries(el.svgPaints.map((p) => [p.cls, { [p.prop]: w.color(p.color) }]))
  if (el.hover) res.hover = mapState(el.hover, w, el, out)
  if (el.block === 'button') res.active = { scale: '0.97' }
  if (el.before) res.before = pseudoCss(el.before, w, el)
  if (el.after) res.after = pseudoCss(el.after, w, el)
  if (res.before === null) delete res.before
  if (res.after === null) delete res.after
  return res
}

const overlaps = (a: WEl['rect'], b: WEl['rect']) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]
/** Relative luminance, 0 (black) to 1 (white). */
const lum = (c: ReturnType<typeof parseColor>) => {
  if (!c) return 0
  const ch = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
}

const norm = (v: string) => (v === 'left' ? 'start' : v === 'right' ? 'end' : v === '-webkit-center' ? 'center' : v)

/** Defaults of a plain div, the reference for "this tag restyles text" (h2, strong…). Filled by buildCss. */
const ROOT_DEFAULTS: { div: Decls } = { div: {} }

function writeSides(put: (k: string, v: string) => void, prop: string, v: (string | null)[], el: WEl, base: (el: WEl, p: string) => string) {
  if (v.every((x) => x === null)) return
  const baseZero = SIDES.map((d) => !px(base(el, `${prop}-${d}`)))
  // A side we didn't change keeps its baseline: zero can join a shorthand, anything else can't.
  const full = v.map((x, i) => x ?? (baseZero[i] ? '0' : null))
  if (full.some((x) => x === null)) {
    v.forEach((x, i) => x !== null && put(`${prop}-${SIDES[i]}`, x))
    return
  }
  const [t, r, b, l] = full as string[]
  put(prop, t === b && r === l ? (t === r ? t : `${t} ${r}`) : r === l ? `${t} ${r} ${b}` : `${t} ${r} ${b} ${l}`)
}

function gridColumns(v: string): string | null {
  if (!v || v === 'none') return null
  const tracks = v.split(/\s+(?![^(]*\))/).filter((t) => !/^\[/.test(t))
  const sizes = tracks.map(px)
  if (!sizes.length || sizes.some((n) => !n)) return v.includes('repeat') || v.includes('fr') ? v : null
  if (sizes.length === 1) return null
  const total = sizes.reduce((a, b) => a + b, 0)
  if (sizes.every((n) => Math.abs(n - sizes[0]) < 2)) return `repeat(${sizes.length}, minmax(0, 1fr))`
  // Narrow fixed tracks (an icon column) stay fixed; the rest share the space by their proportions.
  const small = Math.min(...sizes)
  return sizes.map((n) => (n <= 120 && n < total * 0.15 ? `${Math.round(n)}px` : `minmax(0, ${r2(n / small > 6 ? n / total * 10 : n / small)}fr)`)).join(' ')
}

const STATE_SKIP = /^(transition|animation|will-change|cursor|outline)/

function mapState(decls: Decls, w: TokenWriter, el: WEl, rest: Decls): Decls | undefined {
  const out: Decls = {}
  for (const [k, raw] of Object.entries(decls)) {
    if (STATE_SKIP.test(k)) continue
    const v = raw.replace(/\s*!important/, '')
    let mapped: string
    if (/^border-.*-radius$/.test(k)) mapped = w.corner(v, el)
    else if (/^(margin|padding|gap|row-gap|column-gap)/.test(k) && /^-?[\d.]+px$/.test(v)) mapped = w.space(px(v))
    else mapped = w.value(k, v, el)
    if (rest[k] === mapped) continue
    out[k] = mapped
  }
  // Longhands from shorthands come in as four equal sides: fold them back.
  for (const p of ['border-color', 'border-width', 'border-style']) {
    const [pre, post] = p.split('-')
    const sides = SIDES.map((s) => out[`${pre}-${s}-${post}`])
    if (sides.every((x) => x !== undefined) && new Set(sides).size === 1) {
      SIDES.forEach((s) => delete out[`${pre}-${s}-${post}`])
      out[p] = sides[0]!
    }
  }
  return Object.keys(out).length ? out : undefined
}

function pseudoCss(decls: Decls, w: TokenWriter, el: WEl): Decls | undefined {
  if (/url\(/.test(decls.content ?? '')) return undefined
  const fake: WEl = { ...el, s: { ...el.s, ...decls }, def: ROOT_DEFAULTS.div, rect: el.rect }
  const out: Decls = { content: decls.content }
  for (const [k, v] of Object.entries(decls)) {
    if (k === 'content' || /^(transition|animation)/.test(k)) continue
    if (/^(width|height|top|right|bottom|left|margin-.*|padding-.*)$/.test(k)) out[k] = /^(margin|padding)/.test(k) && /px$/.test(v) ? w.space(px(v)) : v
    else if (/^border-.*-radius$/.test(k)) out[k] = w.corner(v, fake)
    else if (/^border-.*-width$/.test(k)) out[k] = px(v) ? w.strokeOf(px(v)) : '0'
    else if (k === 'font-size') out[k] = w.fontSize(px(v))
    else if (k === 'line-height' || k === 'letter-spacing') continue
    else if (k === 'font-family') out[k] = w.family(v, false)
    else if (k === 'background-color' && (parseColor(v)?.a ?? 1) < 0.01) continue
    else if (/^(-webkit-text-fill-color|text-decoration-color|border-.*-color)$/.test(k) && v === el.s.color) continue
    else if (/-color$|^color$|^fill$|^stroke$/.test(k)) out[k] = w.color(v)
    else out[k] = w.value(k, v, fake)
  }
  return out
}

// ---------- the whole stylesheet ----------

export interface CssResult {
  css: string
  notes: string[]
}

const CLASS_BASE: Record<string, string> = {
  heading: 'heading',
  text: 'text',
  button: 'button',
  link: 'link',
  badge: 'eyebrow',
  icon: 'icon',
  image: 'media',
  input: 'input',
  card: 'card',
  item: 'item',
  list: 'list',
}
const TAG_BASE: Record<string, string> = {
  div: 'box',
  span: 'span',
  ul: 'list',
  ol: 'list',
  li: 'item',
  a: 'link',
  p: 'text',
  section: 'block',
  article: 'block',
  header: 'head',
  footer: 'foot',
  nav: 'menu',
  aside: 'aside',
  main: 'main',
  figure: 'figure',
  figcaption: 'caption',
  blockquote: 'quote',
  svg: 'svg',
  form: 'form',
  button: 'button',
  label: 'label',
  input: 'input',
  textarea: 'input',
  select: 'input',
  details: 'details',
  summary: 'summary',
  h1: 'heading',
  h2: 'heading',
  h3: 'title',
  h4: 'title',
  h5: 'title',
  h6: 'title',
  hr: 'rule',
  dl: 'list',
  dt: 'term',
  dd: 'detail',
  strong: 'strong',
  em: 'em',
  small: 'small',
  time: 'time',
  address: 'address',
  table: 'table',
}

function baseName(el: WEl): string {
  if (el.role) return el.role
  if (el.synthetic === 'wordmark') return 'wordmark'
  if (el.synthetic === 'art') return 'media'
  if (el.block) return el.block === 'heading' && el.parent && closestItem(el) ? 'title' : CLASS_BASE[el.block]
  return TAG_BASE[el.tag] ?? 'box'
}

const closestItem = (el: WEl) => {
  for (let p = el.parent; p; p = p.parent) if (p.block === 'item') return p
  return null
}

const body = (d: Decls | undefined, indent: string) =>
  Object.entries(d ?? {})
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n')

export function buildCss(root: WEl, rootClass: string, w: TokenWriter, defaults: Record<string, Decls>, type: string, force: Set<WEl> = new Set()): CssResult {
  ROOT_DEFAULTS.div = defaults.div ?? {}
  const notes = new Set<string>()
  const all = allEls(root)
  const css = new Map<WEl, ElementCss>()
  for (const el of all) css.set(el, elementCss(el, w, { root, type, notes }))
  mobile(root, css, type)

  // Group hovers need their targets to have classes.
  const byId = new Map(all.map((e) => [e.id, e]))
  // Motion targets elements by class too.
  const needsClass = new Set<WEl>(force)
  for (const e of all) for (const g of e.groupHover ?? []) {
    const t = byId.get(g.target)
    if (t) needsClass.add(t)
  }
  for (const e of all) if (e.openTurn) needsClass.add(e).add(e.openTurn)

  // Classes: elements styled alike share one.
  const names = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const el of all) {
    if (el === root) continue
    const c = css.get(el)!
    const hasRules = Object.keys(c.decls).length || c.hover || c.before || c.after || c.mobile || c.active || c.paints
    if (!hasRules && !needsClass.has(el)) continue
    const base = baseName(el)
    const key = base + '\u0000' + JSON.stringify(c) + (needsClass.has(el) && !hasRules ? `#${el.id}` : '')
    let name = names.get(key)
    if (!name) {
      // Numbered by the first word, so no class's words are a subset of another's (`.head` never matches `head-2 center`).
      const [first, ...mods] = base.split(' ')
      const n = (counts.get(first) ?? 0) + 1
      counts.set(first, n)
      name = [n === 1 ? first : `${first}-${n}`, ...mods].join(' ')
      names.set(key, name)
    }
    el.cls = name
  }

  const lines: string[] = [`.${rootClass} {`]
  const rootCss = css.get(root)!
  if (Object.keys(rootCss.decls).length) lines.push(body(rootCss.decls, '  '))
  const written = new Set<string>()
  const groupRules = new Map<string, string[]>()
  for (const e of all) for (const g of e.groupHover ?? []) {
    const t = byId.get(g.target)
    if (!t?.cls || !e.cls && e !== root) continue
    const mapped = mapState(g.decls, w, t, css.get(t)!.decls)
    if (!mapped) continue
    const sel_ = `&:hover ${sel(t.cls)}`
    const owner = e === root ? '' : e.cls!
    const list = groupRules.get(owner) ?? []
    list.push(`      ${sel_} {\n${body(mapped, '        ')}\n      }`)
    groupRules.set(owner, list)
  }
  const hoverBlock = (inner: string[]) => [`    @media (hover: hover) and (pointer: fine) {`, ...inner, `    }`]
  for (const el of all) {
    if (el === root || !el.cls || written.has(el.cls)) continue
    written.add(el.cls)
    const c = css.get(el)!
    const parts: string[] = []
    if (Object.keys(c.decls).length) parts.push(body(c.decls, '    '))
    const hovers: string[] = []
    if (c.hover) hovers.push(`      &:hover {\n${body(c.hover, '        ')}\n      }`)
    hovers.push(...(groupRules.get(el.cls) ?? []))
    if (hovers.length) parts.push(hoverBlock(hovers).join('\n'))
    if (c.active) parts.push(`    &:active {\n${body(c.active, '      ')}\n    }`)
    if (c.before) parts.push(`    &::before {\n${body(c.before, '      ')}\n    }`)
    if (c.after) parts.push(`    &::after {\n${body(c.after, '      ')}\n    }`)
    for (const [cls, d] of Object.entries(c.paints ?? {})) parts.push(`    & .${cls} {\n${body(d, '      ')}\n    }`)
    if (el.tag === 'summary') parts.push(`    &::-webkit-details-marker {\n      display: none;\n    }`, `    &::marker {\n      content: '';\n    }`)
    if (el.openTurn?.cls && el.openStyle) parts.push(`    &[open] ${sel(el.openTurn.cls)} {\n${body(el.openStyle, '      ')}\n    }`)
    lines.push('', `  & ${sel(el.cls)} {`, parts.join('\n'), '  }')
  }
  if (rootCss.hover || groupRules.get('')) {
    lines.push('', `  @media (hover: hover) and (pointer: fine) {`)
    if (rootCss.hover) lines.push(`    &:hover {\n${body(rootCss.hover, '      ')}\n    }`)
    for (const r of groupRules.get('') ?? []) lines.push(r.replace(/^ {6}/gm, '    '))
    lines.push('  }')
  }
  if (rootCss.before) lines.push('', `  &::before {\n${body(rootCss.before, '    ')}\n  }`)
  if (rootCss.after) lines.push('', `  &::after {\n${body(rootCss.after, '    ')}\n  }`)

  // The 390px layout.
  const mob: string[] = []
  if (rootCss.mobile) mob.push(body(rootCss.mobile, '    '))
  const mobWritten = new Set<string>()
  for (const el of all) {
    const c = css.get(el)!
    if (el === root || !c.mobile || !el.cls || mobWritten.has(el.cls)) continue
    mobWritten.add(el.cls)
    mob.push(`    & ${sel(el.cls)} {\n${body(c.mobile, '      ')}\n    }`)
  }
  if (mob.length) lines.push('', '  @media (max-width: 760px) {', mob.join('\n'), '  }')
  lines.push('}')

  let out = lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
  out = lintSafe(out, w)
  if (w.colors.approximated) notes.add(`${w.colors.approximated} color${w.colors.approximated > 1 ? 's' : ''} had no close token match and use the nearest token`)
  return { css: out + '\n', notes: [...notes] }
}

/** Last pass: anything that slipped through gets written in tokens (rules 3 and 4). */
export function lintSafe(css: string, w: TokenWriter): string {
  return css
    .replace(/#[0-9a-f]{3,8}\b/gi, (c) => w.color(c))
    .replace(/\b(?:rgba?|hsla?|hwb|oklch)\((?:[^()]|\([^()]*\))*\)/gi, (c) => w.color(c))
    .replace(/(-?\d*\.?\d+)(?:s|d|l)?vh\b/g, (_, n) => `calc(var(--mx-vh) * ${r2(parseFloat(n))})`)
    .replace(/font-family:\s*(?!\s|var\(--mx-font-|inherit)[^;}]+/g, 'font-family: var(--mx-font-body)')
    .replace(/((?<![\w-])border(?:-(?:top|bottom|left|right|block|inline)(?:-(?:start|end))?)?(?:-width)?\s*:\s*)([^;{}]*)/g, (_, k: string, v: string) => k + v.replace(/(-?\d*\.?\d+)px/g, (_m: string, n: string) => (parseFloat(n) ? w.strokeOf(parseFloat(n)) : '0')))
}

// ---------- 390px ----------

/** Something inside already keeps copy off the edges (an inner wrapper with side padding). */
function hasGutter(root: WEl): boolean {
  let el: WEl | undefined = root
  for (let i = 0; i < 3 && el; i++) {
    if (px(el.s['padding-left']) >= 16 || /padding-inline|padding/.test(Object.keys(el.extra ?? {}).join(' '))) return true
    const kids: WEl[] = els(el)
    el = kids.length === 1 ? kids[0] : undefined
  }
  return false
}

function mobile(root: WEl, css: Map<WEl, ElementCss>, type: string) {
  const add = (el: WEl, d: Decls) => {
    const c = css.get(el)!
    c.mobile = { ...c.mobile, ...d }
  }
  const rd = css.get(root)!.decls
  if (rd.padding || rd['padding-left'] || rd['padding-right'] || rd['padding-top']) {
    const px_ = (side: string) => px(root.s[`padding-${side}`])
    const inline = Math.max(px_('left'), px_('right'))
    const block = Math.max(px_('top'), px_('bottom'))
    const d: Decls = {}
    if (inline > 24) d['padding-inline'] = 'var(--mx-space-5)'
    if (block >= 40) d['padding-block'] = 'calc(var(--mx-space-section) * 0.6)'
    if (inline < 16 && !hasGutter(root)) d['padding-inline'] = 'var(--mx-space-5)'
    if (Object.keys(d).length) add(root, d)
  }
  if (!(rd.padding || rd['padding-left'] || rd['padding-right'] || rd['padding-top']) && !hasGutter(root)) add(root, { 'padding-inline': 'var(--mx-space-5)' })
  // A marquee keeps its single row (it slides; it doesn't wrap).
  const looping = (el: WEl) => {
    for (let p: WEl | null = el; p; p = p.parent) if (/infinite/.test(p.s['animation-iteration-count'] ?? '')) return true
    return false
  }
  for (const el of allEls(root)) {
    const c = css.get(el)!
    const d = c.decls
    if (looping(el)) continue
    if (d['grid-template-columns']) {
      // Small tiles (logos, people) pair up; anything bigger stacks.
      const small = els(el).every((k) => k.rect[2] <= 280)
      add(el, { 'grid-template-columns': small && els(el).length >= 3 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' })
    }
    if (d['grid-column'] && /span|\/\s*-?\d/.test(d['grid-column'])) add(el, { 'grid-column': 'auto' })
    if (d['grid-row'] && /span/.test(d['grid-row'])) add(el, { 'grid-row': 'auto' })
    const disp = el.s.display ?? ''
    const kids = els(el).filter((k) => (k.s.position ?? 'static') === 'static')
    if (/flex/.test(disp) && !/column/.test(el.s['flex-direction'] ?? '') && kids.length >= 2 && !el.extra?.display) {
      const wide = kids.reduce((n, k) => n + k.rect[2], 0) > 390 || kids.some((k) => k.rect[2] > 240)
      const pressables = kids.every((k) => isPressable(k) || k.block === 'button' || k.block === 'link' || k.block === 'item' || !!k.svgNode || k.block === 'icon' || k.block === 'image')
      if (type === 'nav' && el.block === 'list' && kids.length >= 3) add(el, { display: 'none' })
      else if (type === 'nav') continue
      else if (pressables || !wide) {
        if ((el.s['flex-wrap'] ?? 'nowrap') === 'nowrap') add(el, { 'flex-wrap': 'wrap' })
      } else add(el, { 'flex-direction': 'column', ...(norm(el.s['text-align'] ?? 'start') === 'center' ? {} : { 'align-items': 'stretch' }) })
      for (const k of kids) {
        const kd = css.get(k)!.decls
        if (kd.flex && /%|1 1 0/.test(kd.flex) && !(pressables || !wide)) add(k, { flex: '1 1 auto' })
      }
    }
    if (d.width && /px$/.test(d.width) && px(d.width) > 360) add(el, { width: '100%' })
    if (d['min-width'] && px(d['min-width']) > 360) add(el, { 'min-width': '0' })
    if (d.flex && /\d+px$/.test(d.flex) && px(d.flex.split(' ')[2]) > 300) add(el, { flex: '1 1 auto' })
  }
}


// Shape the captured DOM into clip markup, before fields and blocks: drop what
// isn't seen, replace raster media with placeholders, turn text into leaves,
// space inline siblings with gap (rule 9), and sanitize SVGs.

import { attr, parseHtml, type HEl, type HNode } from '@/core/html/parse'
import { parseColor } from './color'
import { nameIcon } from './icons'
import { clean, els, hint, isEl, px, synth, textOf, type WEl, type WNode } from './tree'
import { isButtonish } from './roles'

export interface Shaped {
  notes: string[]
  /** Media placeholders, in document order. */
  media: WEl[]
  icons: { named: number; unnamed: number }
}

const INLINE = new Set(['span', 'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'sup', 'sub', 'abbr', 'code', 'time', 'q', 's', 'del', 'ins', 'cite', 'kbd', 'var', 'dfn', 'br', 'wbr', 'font', 'a', 'bdi', 'bdo', 'data'])
const NEVER_LEAF = new Set(['ul', 'ol', 'dl', 'table', 'tbody', 'thead', 'tr', 'form', 'select', 'svg', 'nav'])

const isInlineish = (n: WNode): boolean => {
  if (!isEl(n)) return true
  if (n.svg || n.media || n.synthetic) return false
  if (!INLINE.has(n.tag)) return false
  const d = n.s.display ?? 'inline'
  if (d !== 'inline' && d !== 'contents') return false
  if (n.tag === 'a' && isButtonish(n)) return false
  return n.kids.every(isInlineish)
}

const visibleText = (n: WNode) => clean(textOf(n)).length > 0

export function shape(root: WEl): Shaped {
  const out: Shaped = { notes: [], media: [], icons: { named: 0, unnamed: 0 } }
  let flattened = 0
  let dropped = 0
  let svgColours = 0
  let bgPhotos = 0

  // 1. Drop what isn't seen: screen-reader-only copy, invisible empties.
  const prune = (el: WEl) => {
    el.kids = el.kids.filter((k) => {
      if (!isEl(k)) return true
      const [, , w, h] = k.rect
      const abs = k.s.position === 'absolute' || k.s.position === 'fixed'
      if (abs && w <= 2 && h <= 2) return (dropped++, false) // sr-only
      if ((k.s.clip ?? '').startsWith('rect(0') || (k.s['clip-path'] ?? '') === 'inset(50%)') return (dropped++, false)
      if (parseFloat(k.s.opacity ?? '1') < 0.02 && !visibleText(k) && !k.media) return false
      return true
    })
    for (const k of els(el)) prune(k)
  }
  prune(root)
  if (dropped) out.notes.push(`Dropped ${dropped} screen-reader-only element${dropped > 1 ? 's' : ''}`)

  // 2. Media becomes placeholder art (rule 5: no raster images). Background photos are dropped.
  const visit = (el: WEl) => {
    for (const k of els(el)) {
      if (k.media) toPlaceholder(k, out)
      else if (/url\(/.test(k.s['background-image'] ?? '')) {
        const layers = (k.s['background-image'] ?? '').split(/,(?![^(]*\))/).filter((l) => !/url\(/.test(l))
        k.extra = { ...k.extra, 'background-image': layers.join(', ') || 'none' }
        if (!visibleText(k) && k.rect[2] * k.rect[3] > 1600 && !els(k).length) toPlaceholder(k, out)
        else bgPhotos++
        if (!k.synthetic) visit(k)
      } else visit(k)
    }
  }
  visit(root)
  if (bgPhotos) out.notes.push(`Removed ${bgPhotos} background photo${bgPhotos > 1 ? 's' : ''} (clips use CSS/SVG art only); their colour layer stays`)

  // 3. Text: whole runs of inline content become leaves; mixed content gets span leaves.
  const leafify = (el: WEl) => {
    if (el.svg || el.synthetic === 'art' || el.text !== undefined) return
    const pre = /^pre/.test(el.s['white-space'] ?? '')
    // A link only melts into its parent's copy when it sits in running text.
    const inl = (k: WNode) => isInlineish(k) && !(isEl(k) && k.tag === 'a' && !el.kids.some((o) => o !== k && visibleText(o)))
    if (!NEVER_LEAF.has(el.tag) && visibleText(el) && el.kids.every(inl)) {
      if (el.kids.some(isEl)) flattened++
      el.text = pre ? textOf(el).replace(/^\n|\n\s*$/g, '') : typographic(clean(brText(el)))
      el.kids = []
      return
    }
    const kids: WNode[] = []
    let run: WNode[] = []
    const flush = () => {
      if (run.some(visibleText)) {
        const span = synth('span', el, 'wrap')
        span.text = typographic(clean(run.map(brText).join('')))
        if (run.some(isEl)) flattened++
        kids.push(span)
      }
      run = []
    }
    for (const k of el.kids) {
      if (inl(k) && !NEVER_LEAF.has(el.tag)) run.push(k)
      else {
        flush()
        kids.push(k)
      }
    }
    flush()
    el.kids = kids.filter(isEl)
    for (const k of els(el)) leafify(k)
  }
  leafify(root)
  if (flattened) out.notes.push(`Flattened inline styling (bold, links, spans) inside ${flattened} piece${flattened > 1 ? 's' : ''} of copy so each is one field`)

  // 4. Rule 9: inline siblings spaced by whitespace get flex + gap instead.
  const regap = (el: WEl) => {
    const kids = els(el)
    const disp = el.s.display ?? 'block'
    const inlineKids = kids.length >= 2 && kids.every((k) => /^inline/.test(k.s.display ?? 'inline') || k.synthetic === 'wrap')
    if (inlineKids && (disp === 'block' || disp === 'list-item' || disp === 'inline-block') && el.text === undefined) {
      let gap = Infinity
      for (let i = 1; i < kids.length; i++) {
        const [a, b] = [kids[i - 1].rect, kids[i].rect]
        if (Math.abs(a[1] - b[1]) < Math.max(a[3], b[3])) gap = Math.min(gap, b[0] - (a[0] + a[2]))
      }
      const align = el.s['text-align'] ?? 'start'
      el.extra = {
        ...el.extra,
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        ...(Number.isFinite(gap) && gap > 1 ? { 'column-gap': `${Math.round(gap)}px`, 'row-gap': `${Math.round(gap)}px` } : {}),
        ...(align === 'center' ? { 'justify-content': 'center' } : /right|end/.test(align) ? { 'justify-content': 'flex-end' } : {}),
      }
    }
    for (const k of kids) regap(k)
  }
  regap(root)

  // 5. SVGs: no styles or scripts, colours follow currentColor, icons get names.
  const svgs = (el: WEl) => {
    for (const k of els(el)) {
      if (k.svg) {
        const node = parseHtml(k.svg).find((n): n is HEl => n.t === 'el' && n.tag === 'svg')
        if (!node) {
          el.kids = el.kids.filter((x) => x !== k)
          continue
        }
        const res = sanitizeSvg(node)
        svgColours += res.colours > 1 ? 1 : 0
        k.svgNode = res.node
        const [, , w, h] = k.rect
        const iconish = w <= 64 && h <= 64 && w > 0
        if (iconish) {
          const hints = [hint(k, 'class'), hint(k, 'data-icon'), hint(k, 'data-lucide'), hint(k, 'data-feather'), hint(k, 'aria-label'), attr(node, 'aria-label'), hint(el, 'class'), hint(el, 'aria-label'), titleOf(node)].filter((x): x is string => !!x)
          const named = nameIcon(res.node, hints)
          if (named) {
            k.icon = named.name
            out.icons.named++
          } else out.icons.unnamed++
        }
      } else svgs(k)
    }
  }
  svgs(root)
  if (svgColours) out.notes.push(`${svgColours} multi-colour SVG${svgColours > 1 ? 's were' : ' was'} drawn in one colour (currentColor) so ${svgColours > 1 ? 'they re-theme' : 'it re-themes'}`)
  return out
}

/** Straight quotes to typographic ones (rule 10). */
export function typographic(s: string): string {
  return s
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/(^|[\s([{—–-])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s([{—–-])"/g, '$1“')
    .replace(/"/g, '”')
}

const brText = (n: WNode): string => (isEl(n) ? (n.tag === 'br' ? ' ' : n.kids.map(brText).join('')) : n.v)

function titleOf(svg: HEl): string | undefined {
  const t = svg.kids.find((k): k is HEl => k.t === 'el' && k.tag === 'title')
  const txt = t?.kids.find((k) => k.t === 'text')
  return txt && txt.t === 'text' ? txt.v : undefined
}

function toPlaceholder(el: WEl, out: Shaped) {
  const [, , w, h] = el.rect
  const mw = el.media?.w || w
  const mh = el.media?.h || h
  el.ratio = ratioOf(w > 0 && h > 0 ? w : mw, w > 0 && h > 0 ? h : mh)
  el.tag = el.tag === 'img' || el.media ? 'div' : el.tag
  el.block = 'image'
  el.synthetic = el.synthetic ?? 'art'
  el.svg = undefined
  el.kids = []
  el.text = undefined
  el.skip = new Set([...(el.skip ?? []), 'object-fit', 'background-size', 'background-position', 'background-repeat'])
  out.media.push(el)
}

const COMMON: [number, number][] = [
  [1, 1],
  [4, 3],
  [3, 2],
  [16, 9],
  [2, 1],
  [21, 9],
  [3, 4],
  [2, 3],
  [9, 16],
  [5, 4],
  [4, 5],
  [3, 1],
  [4, 1],
]

/** A tidy aspect ratio ("16/9") for a box. */
export function ratioOf(w: number, h: number): string {
  if (!(w > 0 && h > 0)) return '4/3'
  const r = w / h
  let best = COMMON[0]
  for (const c of COMMON) if (Math.abs(Math.log(c[0] / c[1] / r)) < Math.abs(Math.log(best[0] / best[1] / r))) best = c
  if (Math.abs(Math.log(best[0] / best[1] / r)) < 0.06) return `${best[0]}/${best[1]}`
  return `${Math.round(r * 100)}/100`
}

const SVG_KEEP = /^(viewbox|width|height|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stroke-dashoffset|fill-rule|clip-rule|opacity|fill-opacity|stroke-opacity|d|cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|points|transform|offset|stop-opacity|gradientunits|gradienttransform|patternunits|preserveaspectratio|aria-hidden|aria-label|role|id|href|xlink:href|clip-path|mask|font-size|font-weight|text-anchor|dominant-baseline|vector-effect|pathlength)$/i

/** Strip an <svg> to drawing only, every colour becoming currentColor. */
export function sanitizeSvg(svg: HEl): { node: HEl; colours: number } {
  const colours = new Set<string>()
  const refs = new Set<string>()
  const scan = (n: HEl) => {
    for (const [, v] of n.attrs) for (const m of v.matchAll(/url\(#([\w-]+)\)|^#([\w-]+)$/g)) refs.add(m[1] ?? m[2])
    for (const k of n.kids) if (k.t === 'el') scan(k)
  }
  scan(svg)
  const clean = (n: HEl, isRoot: boolean): HEl => {
    const attrs: [string, string][] = []
    for (const [k, v] of n.attrs) {
      const key = k.toLowerCase()
      if (!SVG_KEEP.test(key)) continue
      if (key === 'id' && !refs.has(v)) continue
      if ((key === 'href' || key === 'xlink:href') && !v.startsWith('#')) continue
      if (key === 'fill' || key === 'stroke') {
        if (v === 'none' || v.startsWith('url(') || /^currentcolor$/i.test(v)) attrs.push([key, v === 'currentcolor' ? 'currentColor' : v])
        else {
          const c = parseColor(v)
          if (c && c.a < 0.02) attrs.push([key, 'none'])
          else {
            colours.add(v)
            attrs.push([key, 'currentColor'])
          }
        }
        continue
      }
      if (key === 'stroke-width' && px(v) === 1 && !n.attrs.some(([a, b]) => a === 'stroke' && b !== 'none')) continue
      attrs.push([k, v])
    }
    // Gradient stops carry their colour in stop-color.
    if (n.tag === 'stop') attrs.push(['stop-color', 'currentColor'])
    if (isRoot && !attrs.some(([k]) => k === 'aria-hidden' || k === 'aria-label' || k === 'role')) attrs.push(['aria-hidden', 'true'])
    const kids: HNode[] = n.kids.filter((k): k is HEl => k.t === 'el' && !/^(script|style|foreignobject|image|title|desc|metadata)$/i.test(k.tag)).map((k) => clean(k, false))
    // Text inside an SVG (a wordmark) stays.
    if (n.tag === 'text' || n.tag === 'tspan') return { ...n, attrs, kids: n.kids.filter((k) => k.t === 'text') }
    return { ...n, attrs, kids }
  }
  return { node: clean(svg, true), colours: colours.size }
}

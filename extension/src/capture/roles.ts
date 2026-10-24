// Small judgements about elements that several capture steps share: what a
// button looks like, what's behind an element, what counts as a heading.

import { over, parseColor, dist, type Rgba } from './color'
import { hint, px, type WEl } from './tree'

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }

let contextBg: Rgba = WHITE
export function setContextBg(c: Rgba) {
  contextBg = c
}

/** The opaque color showing behind an element (its ancestors' backgrounds over the page's). */
export function behind(el: WEl): Rgba {
  const stack: Rgba[] = []
  for (let p: WEl | null = el.parent; p; p = p.parent) {
    const c = parseColor(p.s['background-color'])
    if (c && c.a > 0) {
      stack.push(c)
      if (c.a >= 0.99) break
    }
  }
  return stack.reverse().reduce((acc, c) => over(c, acc), contextBg)
}

/** The element's own fill, composited over what's behind it (null when see-through). */
export function ownBg(el: WEl): Rgba | null {
  const c = parseColor(el.s['background-color'])
  if (!c || c.a < 0.02) return null
  return over(c, behind(el))
}

export const textColor = (el: WEl): Rgba => {
  const c = parseColor(el.s.color) ?? { r: 0, g: 0, b: 0, a: 1 }
  return over(c, ownBg(el) ?? behind(el))
}

const hasBorder = (el: WEl) => ['top', 'right', 'bottom', 'left'].some((s) => px(el.s[`border-${s}-width`]) > 0 && el.s[`border-${s}-style`] !== 'none')

export const isPressable = (el: WEl) =>
  el.tag === 'a' || el.tag === 'button' || hint(el, 'role') === 'button' || (el.tag === 'input' && /^(submit|button)$/.test(hint(el, 'type') ?? ''))

/** A link or button drawn as a button: filled, outlined, or padded like one. */
export function isButtonish(el: WEl): boolean {
  if (!isPressable(el)) return false
  if (el.tag === 'button' || el.tag === 'input') return true
  const bg = ownBg(el)
  if (bg && dist(bg, behind(el)) > 0.04) return true
  const padX = px(el.s['padding-left'])
  const padY = px(el.s['padding-top'])
  if (hasBorder(el) && padX >= 8) return true
  return padX >= 14 && padY >= 6 && px(el.s['border-top-left-radius']) > 0
}

export function isSolid(el: WEl): boolean {
  const c = parseColor(el.s['background-color'])
  return !!c && c.a >= 0.85 && dist(over(c, behind(el)), behind(el)) > 0.08
}

export const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

export const fontSize = (el: WEl) => px(el.s['font-size']) || 16
export const fontWeight = (el: WEl) => parseInt(el.s['font-weight'] ?? '400', 10) || 400

/** How loud a piece of text is: size first, weight second. */
export const loudness = (el: WEl) => fontSize(el) * (1 + (fontWeight(el) - 400) / 1000) + (HEADING_TAGS.has(el.tag) ? 2 : 0)

export function hasVisibleBox(el: WEl): boolean {
  return !!ownBg(el) || hasBorder(el) || (el.s['box-shadow'] ?? 'none') !== 'none' || /gradient/.test(el.s['background-image'] ?? '')
}

export { hasBorder }

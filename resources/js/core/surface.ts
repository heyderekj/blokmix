import type { Slot, TokenSet } from './types'
import { mixHex } from './tokens'
import { setTone, toneOfGuide } from './dials'

/**
 * A section's surface: the band it sits on, from the style guide's own colors. Alternating bands is the quickest way
 * to give a page rhythm (Landbook pages do it constantly), so it's one toggle on the section, not a token edit.
 * - page: the guide as it is
 * - soft: the surface color as the band (cards inside take the page color, so they still lift)
 * - inverse: the guide turned the other way, light ↔ dark (`setTone`)
 * - brand: the primary color as the band, its label color as the text
 */
export type Surface = NonNullable<Slot['surface']>
export const SURFACES: readonly Surface[] = ['page', 'soft', 'inverse', 'brand']

export const SURFACE_LABEL: Record<Surface, string> = { page: 'Page', soft: 'Soft', inverse: 'Inverse', brand: 'Brand' }

export function surfaceTokens(t: TokenSet, surface: Surface | undefined): TokenSet {
  if (!surface || surface === 'page') return t
  if (surface === 'soft') return { ...t, 'color.bg': t['color.surface'], 'color.surface': t['color.bg'] }
  if (surface === 'inverse') return { ...t, ...setTone(t, toneOfGuide(t) === 'light' ? 'dark' : 'light') } as TokenSet
  const bg = t['color.primary']
  const text = t['color.onPrimary']
  return {
    ...t,
    'color.bg': bg,
    'color.text': text,
    'color.surface': mixHex(bg, text, 0.1),
    'color.border': mixHex(bg, text, 0.28),
    'color.muted': mixHex(bg, text, 0.72),
    'color.primary': text,
    'color.onPrimary': bg,
  }
}

/**
 * A section's width: how far its content runs, against the guide's content width. Narrow pulls a section in (a quote,
 * a single plan), wide lets a gallery or a product shot breathe, full runs edge to edge inside the gutter.
 */
export type SectionWidth = 'standard' | NonNullable<Slot['width']>
export const SECTION_WIDTHS: readonly SectionWidth[] = ['narrow', 'standard', 'wide', 'full']
export const SECTION_WIDTH_LABEL: Record<SectionWidth, string> = { narrow: 'Narrow', standard: 'Standard', wide: 'Wide', full: 'Full width' }

export function widthTokens(t: TokenSet, width: SectionWidth | undefined): TokenSet {
  if (!width || width === 'standard') return t
  const content = parseFloat(t['space.content']) || 1200
  const text = parseFloat(t['space.text']) || 760
  if (width === 'full') return { ...t, 'space.content': '100%' }
  if (width === 'narrow') return { ...t, 'space.content': `${Math.round(Math.max(text, content * 0.75) / 10) * 10}px`, 'space.text': `${Math.round(Math.min(text, content * 0.6) / 10) * 10}px` }
  return { ...t, 'space.content': `${Math.round((content * 1.2) / 10) * 10}px` }
}

/** The tokens a section renders with: its surface's colors, then its width. */
export const sectionTokens = (t: TokenSet, slot: Pick<Slot, 'surface' | 'width'>): TokenSet => widthTokens(surfaceTokens(t, slot.surface), slot.width)


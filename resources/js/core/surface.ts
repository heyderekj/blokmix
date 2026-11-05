import type { Slot, TokenSet } from './types'
import { mixHex } from './tokens'
import { contrastRatio } from './tokens'
import { setTone, toneOfGuide } from './dials'
import { isBackdropId, readBackdrop } from './treatments'

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

export const SURFACE_LABEL: Record<Surface, string> = { page: 'Page', soft: 'Soft', inverse: 'Flipped', brand: 'Brand' }

/** Muted text a step closer to the text color until it reads on everything behind it, and a button label that reads. */
function keepReadable(t: TokenSet, behind: string[] = [t['color.bg']]): TokenSet {
  const reads = (c: string) => behind.every((b) => (contrastRatio(c, b) ?? 0) >= 4.5)
  let muted = t['color.muted']
  for (let i = 0; i < 12 && !reads(muted); i++) muted = mixHex(muted, t['color.text'], 0.2)
  // Text that only just reads leaves no room for a quieter shade.
  if (!reads(muted)) muted = t['color.text']
  const label = (contrastRatio(t['color.onPrimary'], t['color.primary']) ?? 0) >= 4.5 ? t['color.onPrimary'] : (contrastRatio(t['color.bg'], t['color.primary']) ?? 0) >= (contrastRatio(t['color.text'], t['color.primary']) ?? 0) ? t['color.bg'] : t['color.text']
  return muted === t['color.muted'] && label === t['color.onPrimary'] ? t : { ...t, 'color.muted': muted, 'color.onPrimary': label }
}

export function surfaceTokens(t: TokenSet, surface: Surface | undefined): TokenSet {
  if (!surface || surface === 'page') return t
  if (surface === 'soft') return keepReadable({ ...t, 'color.bg': t['color.surface'], 'color.surface': t['color.bg'] })
  if (surface === 'inverse') return keepReadable({ ...t, ...setTone(t, toneOfGuide(t) === 'light' ? 'dark' : 'light') } as TokenSet)
  const bg = t['color.primary']
  const text = t['color.onPrimary']
  return keepReadable({
    ...t,
    'color.bg': bg,
    'color.text': text,
    'color.surface': mixHex(bg, text, 0.1),
    'color.border': mixHex(bg, text, 0.28),
    'color.muted': mixHex(bg, text, 0.85),
    'color.primary': text,
    'color.onPrimary': bg,
  })
}

/**
 * A section's width: how far its content runs, against the guide's content width. Narrow pulls a section in (a quote,
 * a single plan), wide lets a gallery or a product shot breathe, full runs edge to edge inside the gutter.
 */
export type SectionWidth = 'standard' | NonNullable<Slot['width']>
export const SECTION_WIDTHS: readonly SectionWidth[] = ['narrow', 'standard', 'wide', 'full']
export const SECTION_WIDTH_LABEL: Record<SectionWidth, string> = { narrow: 'Narrow', standard: 'Standard', wide: 'Wide', full: 'Full' }

export function widthTokens(t: TokenSet, width: SectionWidth | undefined): TokenSet {
  if (!width || width === 'standard') return t
  const content = parseFloat(t['space.content']) || 1200
  const text = parseFloat(t['space.text']) || 760
  if (width === 'full') return { ...t, 'space.content': '100%' }
  if (width === 'narrow') return { ...t, 'space.content': `${Math.round(Math.max(text, content * 0.75) / 10) * 10}px`, 'space.text': `${Math.round(Math.min(text, content * 0.6) / 10) * 10}px` }
  return { ...t, 'space.content': `${Math.round((content * 1.2) / 10) * 10}px` }
}

/** The tokens a section renders with: its surface's colors, then its width. */
/** The guide's tokens on a section's band and width: what its backdrop draws in. */
export const bandTokens = (t: TokenSet, slot: Pick<Slot, 'surface' | 'width'>): TokenSet => widthTokens(surfaceTokens(t, slot.surface), slot.width)

/** A section's tokens: its band and width, then whatever its words need to read over its backdrop. */
export function sectionTokens(t: TokenSet, slot: Pick<Slot, 'surface' | 'width' | 'backdrop'>): TokenSet {
  const band = bandTokens(t, slot)
  if (!slot.backdrop || !isBackdropId(slot.backdrop.id)) return band
  const { ink, base, behind } = readBackdrop(slot.backdrop, band)
  if (!ink) return keepReadable(band, behind)
  return keepReadable(
    {
      ...band,
      'color.bg': base,
      'color.text': ink,
      'color.surface': mixHex(base, ink, 0.1),
      'color.border': mixHex(base, ink, 0.28),
      'color.muted': mixHex(base, ink, 0.85),
      'color.primary': ink,
      'color.onPrimary': base,
    },
    behind,
  )
}


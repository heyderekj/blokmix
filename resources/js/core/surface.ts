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

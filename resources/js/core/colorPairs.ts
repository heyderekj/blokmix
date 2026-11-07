// A brand color's pairings and how readable it is, for the color picker. Every pairing is a whole palette made by
// `paletteFrom`, so its text, muted text and button label already read (AA); only the accent and how much the greys
// carry the hue change. Pure.

import { paletteFrom, type Mode, type Palette, type PaletteVariant } from './palette'
import { contrastRatio } from './tokens'

export interface Pairing {
  id: string
  name: string
  words: string
  variant: PaletteVariant
}

/** Six ways a brand color can go, in plain words. */
export const PAIRINGS: Pairing[] = [
  { id: 'triad', name: 'Triad', words: 'An accent a third of the way round: lively, balanced', variant: {} },
  { id: 'opposite', name: 'Opposite', words: 'Its opposite as the accent: the most pop', variant: { accentTurn: 180 } },
  { id: 'split', name: 'Split', words: 'Just off its opposite: bold, a little softer', variant: { accentTurn: 150 } },
  { id: 'neighbor', name: 'Neighbor', words: 'A near neighbor as the accent: calm, all of a piece', variant: { accentTurn: 30 } },
  { id: 'quiet', name: 'Quiet', words: 'Near-neutral greys so the brand color does the talking', variant: { tint: 0.3 } },
  { id: 'rich', name: 'Rich', words: 'Greys warmed (or cooled) by the brand color throughout', variant: { tint: 1.8 } },
]

/** The pairing a variant is (the default is Triad). */
export const pairingOf = (v?: PaletteVariant): Pairing =>
  PAIRINGS.find((p) => (p.variant.accentTurn ?? 120) === (v?.accentTurn ?? 120) && (p.variant.tint ?? 1) === (v?.tint ?? 1)) ?? PAIRINGS[0]

export const pairingPalettes = (brand: string, mode: Mode): (Pairing & { palette: Palette })[] => PAIRINGS.map((p) => ({ ...p, palette: paletteFrom(brand, mode, p.variant) }))

export interface Readability {
  ink: 'light' | 'dark'
  ratio: number
  verdict: string
}

/** How words read on a color: in white and in near-black, best first, each with WCAG's verdict in plain words. */
export function readability(hex: string): Readability[] {
  const out: Readability[] = [
    { ink: 'light', ratio: contrastRatio('#ffffff', hex) ?? 1, verdict: '' },
    { ink: 'dark', ratio: contrastRatio('#17121a', hex) ?? 1, verdict: '' },
  ]
  for (const r of out) r.verdict = r.ratio >= 7 ? 'Reads anywhere' : r.ratio >= 4.5 ? 'Reads well' : r.ratio >= 3 ? 'Big words only' : 'Hard to read'
  return out.sort((a, b) => b.ratio - a.ratio)
}

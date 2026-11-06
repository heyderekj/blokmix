import type { TokenKey, TokenSet } from './types'
import { contrastRatio, mixHex } from './tokens'
import { toneOf, type Tone } from './browse'

/**
 * Dials: tune a style guide by feel instead of token by token. Each dial reads where the tokens sit on it (0–100)
 * and writes the few tokens it moves together, inside the same ranges the per-token knobs use.
 */

export const TYPE_RATIOS = ['1.125', '1.2', '1.25', '1.333', '1.414', '1.5', '1.618']
/** The ratios the Type dial moves through: past 1.333, display headings outgrow a phone. The knob still has them all. */
const DIAL_RATIOS = TYPE_RATIOS.slice(0, 4)

export const DIAL_NAMES = ['spacing', 'type', 'roundness', 'weight', 'width'] as const
export type DialName = (typeof DIAL_NAMES)[number]

interface Dial {
  label: string
  /** What the two ends feel like. */
  ends: [string, string]
  read: (t: TokenSet) => number
  write: (v: number) => Partial<TokenSet>
}

const px = (v: string) => parseFloat(v) || 0
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
/** Where `n` sits between lo and hi, as 0–100. */
const at = (n: number, lo: number, hi: number) => clamp(((n - lo) / (hi - lo)) * 100)
/** The value v (0–100) points to between lo and hi, on steps of `step`. */
const to = (v: number, lo: number, hi: number, step: number) => Math.round((lo + (clamp(v) / 100) * (hi - lo)) / step) * step
const nearestRatio = (r: number) => DIAL_RATIOS.reduce((best, x, i) => (Math.abs(parseFloat(x) - r) < Math.abs(parseFloat(DIAL_RATIOS[best]) - r) ? i : best), 0)

export const DIALS: Record<DialName, Dial> = {
  spacing: {
    label: 'Spacing',
    ends: ['Tight', 'Airy'],
    read: (t) => Math.round((at(px(t['space.base']), 3, 6) + at(px(t['space.section']), 56, 160)) / 2),
    write: (v) => ({ 'space.base': `${to(v, 3, 6, 0.5)}px`, 'space.section': `${to(v, 56, 160, 4)}px` }),
  },
  type: {
    label: 'Type size',
    ends: ['Small', 'Large'],
    read: (t) => Math.round((at(px(t['type.base']), 14, 20) + at(nearestRatio(parseFloat(t['type.ratio'])), 0, DIAL_RATIOS.length - 1)) / 2),
    write: (v) => ({ 'type.base': `${to(v, 14, 20, 1)}px`, 'type.ratio': DIAL_RATIOS[to(v, 0, DIAL_RATIOS.length - 1, 1)] }),
  },
  roundness: {
    label: 'Corners',
    ends: ['Square', 'Round'],
    read: (t) => Math.round(at(px(t['radius.base']), 0, 24)),
    write: (v) => ({ 'radius.base': `${to(v, 0, 24, 1)}px` }),
  },
  weight: {
    label: 'Weight',
    ends: ['Light', 'Heavy'],
    read: (t) => Math.round(at(parseFloat(t['type.displayWeight']) || 700, 300, 800)),
    write: (v) => ({ 'type.displayWeight': String(to(v, 300, 800, 100)), 'stroke.width': `${to(v, 1, 2.5, 0.5)}px` }),
  },
  width: {
    label: 'Width',
    ends: ['Narrow', 'Wide'],
    // The content column, with the reading column moving along inside the 45–75 characters a line should hold.
    read: (t) => Math.round(at(px(t['space.content'] ?? '1200px'), 1040, 1440)),
    write: (v) => ({ 'space.content': `${to(v, 1040, 1440, 40)}px`, 'space.text': `${to(v, 680, 840, 20)}px` }),
  },
}

export function readDials(t: TokenSet): Record<DialName, number> {
  return Object.fromEntries(DIAL_NAMES.map((d) => [d, DIALS[d].read(t)])) as Record<DialName, number>
}

export function toneOfGuide(t: TokenSet): Tone {
  return toneOf(t['color.bg'])
}

/**
 * Turn a palette light or dark: background and text trade places, surface, border and muted are mixed again from the
 * new pair, a primary that was the text color follows it (one that would vanish is lifted until it stands out), and
 * the label on primary is whichever reads better.
 * Accent stays. Nothing changes when the palette is already that tone.
 */
export function setTone(t: TokenSet, tone: Tone): Partial<Record<TokenKey, string>> {
  if (toneOfGuide(t) === tone) return {}
  const bg = t['color.text']
  const text = t['color.bg']
  const followsText = (contrastRatio(t['color.primary'], t['color.text']) ?? 99) < 1.6
  // A brand primary that would vanish on the new background is lifted toward the text color until it stands out.
  let primary = followsText ? text : t['color.primary']
  for (let i = 0; i < 8 && (contrastRatio(primary, bg) ?? 99) < 3; i++) primary = mixHex(primary, text, 0.15)
  const onPrimary = (contrastRatio(bg, primary) ?? 0) >= (contrastRatio(text, primary) ?? 0) ? bg : text
  return {
    'color.bg': bg,
    'color.text': text,
    'color.surface': mixHex(bg, text, 0.06),
    'color.border': mixHex(bg, text, 0.16),
    'color.muted': mixHex(bg, text, 0.6),
    'color.primary': primary,
    'color.onPrimary': onPrimary,
  }
}

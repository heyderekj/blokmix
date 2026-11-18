// The Look panel's plain words: how a site should feel (warm, calm, bold…), which themes fit those words, and nudges
// ("Bolder", "Rounder") that each move a few dials at once. Pure, so the panel and the agent commands answer alike.

import type { Kind, TokenKey, TokenSet } from './types'
import { DIALS, readDials, setTone, toneOfGuide, type DialName } from './dials'

export const FEEL_WORDS = ['warm', 'calm', 'bold', 'playful', 'serious', 'classic', 'modern', 'dark'] as const
export type FeelWord = (typeof FEEL_WORDS)[number]
export const isFeelWord = (w: string): w is FeelWord => (FEEL_WORDS as readonly string[]).includes(w)

/** Where a new site starts before you say: the words that suit its kind, so the first theme on offer fits. */
export const KIND_FEEL: Record<Kind, FeelWord[]> = {
  product: ['modern', 'calm'],
  studio: ['modern', 'classic'],
  local: ['warm', 'playful'],
  event: ['bold', 'playful'],
  personal: ['calm', 'warm'],
  writing: ['classic', 'serious'],
}

export const NUDGES = ['bolder', 'quieter', 'rounder', 'sharper', 'roomier', 'tighter', 'darker', 'lighter'] as const
export type Nudge = (typeof NUDGES)[number]

export const NUDGE_LABEL: Record<Nudge, string> = {
  bolder: 'Bolder',
  quieter: 'Quieter',
  rounder: 'Rounder',
  sharper: 'Sharper',
  roomier: 'Roomier',
  tighter: 'Tighter',
  darker: 'Darker',
  lighter: 'Lighter',
}

/** One step on a dial, in the dial's 0–100. */
export const NUDGE_STEP = 20

/** The dials each nudge turns, and which way. */
const MOVES: Partial<Record<Nudge, [DialName, 1 | -1][]>> = {
  bolder: [['type', 1], ['weight', 1]],
  quieter: [['type', -1], ['weight', -1], ['spacing', 1]],
  rounder: [['roundness', 1]],
  sharper: [['roundness', -1]],
  roomier: [['spacing', 1]],
  tighter: [['spacing', -1]],
}

/** Which style areas a nudge writes to, so the contract can keep them. */
export const NUDGE_AREAS: Record<Nudge, ('type' | 'shape' | 'space' | 'color')[]> = {
  bolder: ['type', 'shape'],
  quieter: ['type', 'shape', 'space'],
  rounder: ['shape'],
  sharper: ['shape'],
  roomier: ['space'],
  tighter: ['space'],
  darker: ['color'],
  lighter: ['color'],
}

/**
 * The token values a nudge sets from where the guide is now, or null when it's already as far as it goes (or already
 * that tone). Weight also moves the line weight, so it reads as shape too; that's the dial's own rule.
 */
export function nudgeTokens(t: TokenSet, nudge: Nudge): Partial<Record<TokenKey, string>> | null {
  if (nudge === 'darker' || nudge === 'lighter') {
    const tone = nudge === 'darker' ? 'dark' : 'light'
    return toneOfGuide(t) === tone ? null : setTone(t, tone)
  }
  const now = readDials(t)
  const out: Partial<Record<TokenKey, string>> = {}
  for (const [dial, way] of MOVES[nudge] ?? []) {
    const to = Math.max(0, Math.min(100, now[dial] + way * NUDGE_STEP))
    if (to !== now[dial]) Object.assign(out, DIALS[dial].write(to))
  }
  const changed = (Object.entries(out) as [TokenKey, string][]).some(([k, v]) => t[k] !== v)
  return changed ? out : null
}

/** The nudges worth offering now: Darker or Lighter, whichever the page isn't. */
export function nudgesFor(t: TokenSet): Nudge[] {
  const tone = toneOfGuide(t)
  return NUDGES.filter((n) => (n === 'darker' ? tone !== 'dark' : n === 'lighter' ? tone !== 'light' : true))
}

/** The sentence's feels as the Look panel's feel words. */
export const SENTENCE_FEEL: Record<string, FeelWord> = {
  cozy: 'warm', warm: 'warm', earthy: 'warm', soft: 'calm',
  friendly: 'playful', playful: 'playful', fun: 'playful', dreamy: 'playful',
  calm: 'calm', clean: 'calm', minimal: 'calm', simple: 'calm', trustworthy: 'serious',
  bold: 'bold', loud: 'bold', confident: 'bold', industrial: 'bold', raw: 'bold', retro: 'classic',
  premium: 'classic', elegant: 'classic', classic: 'classic', editorial: 'classic', bookish: 'classic',
  techy: 'modern', precise: 'serious', nerdy: 'modern',
  dark: 'dark',
}

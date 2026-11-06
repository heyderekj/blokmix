// Colors by feel. Code makes the palettes, and every one passes AA by construction
// (core/palette.ts paletteFrom); Jev only looks at them, each drawn as a little page,
// and rates how well it suits the brief ("a cozy bakery", "late-night jazz") and
// whether its colors belong together, one question per palette so order can't sway it.
// Two rounds: hues first, then variations on the best ones.

import { oklchToHex, paletteFrom, type Mode, type Palette, type PaletteVariant } from '../palette'
import { score, noul, at } from './ask'
import { clip } from './state'
import { levelP, scoreOf, scoreShare, yes } from './read'
import { colorName, describePalette } from './colors'
import type { JevAsset, JevRequest, JevResponse } from './types'

export const PALETTE_WEIGHTS = { fit: 0.6, harmony: 0.25, goesWith: 0.15 }

export const PALETTE_FIT = [
  'Wrong for it: the opposite feel',
  'A stretch',
  'Fits',
  'Fits well',
  'Exactly this feel',
]

export interface Candidate {
  id: string
  palette: Palette
  /** What it's made from, in words: "terracotta, accent a third round". */
  from: string
  brand: string
  variant: PaletteVariant
}

/** Round one, with no brand color: one palette per hue, vivid and muted, light or dark. */
export function hueCandidates(mode: Mode, count = 18): Candidate[] {
  const out: Candidate[] = []
  const hues = 12
  for (let i = 0; i < hues; i++) {
    const h = i * (360 / hues) + 10
    for (const [l, c, name] of [
      [0.56, 0.16, 'vivid'],
      [0.48, 0.08, 'muted'],
    ] as const) {
      const brand = oklchToHex(l, c, h)
      out.push({ id: `h${i}${name[0]}`, palette: paletteFrom(brand, mode), from: `${name} ${colorName(brand)}`, brand, variant: {} })
    }
  }
  // Interleave vivid and muted, then keep an even spread of hues within the count.
  const vivid = out.filter((x) => x.id.endsWith('v'))
  const muted = out.filter((x) => x.id.endsWith('m'))
  const mixed = vivid.flatMap((v, i) => [v, muted[i]])
  return mixed.slice(0, count)
}

const VARIANTS: { variant: PaletteVariant; words: string }[] = [
  { variant: {}, words: 'accent a third of the way round' },
  { variant: { accentTurn: 30 }, words: 'accent a near neighbour' },
  { variant: { accentTurn: 180 }, words: 'accent its opposite' },
  { variant: { tint: 0.3 }, words: 'near-neutral greys' },
  { variant: { tint: 1.8 }, words: 'richly tinted greys' },
  { variant: { accentTurn: 60, tint: 1.8 }, words: 'warm neighbours, tinted greys' },
]

/** Round two: variations on a brand color (yours, or round one's best). */
export function variantCandidates(brand: string, mode: Mode, prefix = 'v'): Candidate[] {
  return VARIANTS.map(({ variant, words }, i) => ({ id: `${prefix}${i}`, palette: paletteFrom(brand, mode, variant), from: `${colorName(brand)}, ${words}`, brand, variant }))
}

export interface PaletteBrief {
  /** In your words: "a cozy bakery", "late-night jazz bar". */
  feel?: string
  /** What the site is: its name and kind. */
  site?: string
  /** The page's main headline, for the mood of its words. */
  headline?: string
}

/** One request: per palette, how well it suits the brief and whether its colors belong together (and go with the photo). */
export function paletteRequest(brief: PaletteBrief, cands: Candidate[], refs: string[], assets: Record<string, JevAsset>, photoRef?: string): JevRequest {
  const questions: JevRequest['questions'] = {}
  cands.forEach((_c, i) => {
    questions[`fit_${i}`] = score(`How well do the colors of ${at(`palettes[${i}].picture`)} suit ${at('brief')}?`, PALETTE_FIT)
    questions[`harmony_${i}`] = noul(`Do the colors of ${at(`palettes[${i}].picture`)} look good together?`)
    if (photoRef) questions[`goes_${i}`] = noul(`Would the colors of ${at(`palettes[${i}].picture`)} look right beside ${at('photo')}?`)
  })
  return {
    state: {
      brief: { feel: brief.feel ? clip(brief.feel, 200) : null, site: brief.site ?? null, headline: brief.headline ? clip(brief.headline, 160) : null },
      palettes: cands.map((c, i) => ({ picture: refs[i], colors: describePalette(c.palette) })),
      ...(photoRef ? { photo: photoRef } : {}),
    },
    questions,
    assets,
  }
}

export interface Ranked extends Candidate {
  score: number
  words: string
}

/** Palettes best first: fit to the brief most, then harmony, then (with a photo) whether they go with it. */
export function rankPalettes(res: JevResponse | null, cands: Candidate[], photo: boolean): Ranked[] {
  const W = PALETTE_WEIGHTS
  return cands
    .map((c, i) => {
      const fit = scoreOf(res, `fit_${i}`)
      const f = fit ? scoreShare(fit, PALETTE_FIT.length) + 0.1 * levelP(fit, PALETTE_FIT.length - 1) : 0
      const hm = yes(res, `harmony_${i}`) ?? 0.5
      const gw = photo ? (yes(res, `goes_${i}`) ?? 0.5) : 0
      const total = photo ? W.fit * f + W.harmony * hm + W.goesWith * gw : (W.fit * f + W.harmony * hm) / (W.fit + W.harmony)
      return { ...c, score: Math.round(total * 1000) / 1000, words: describePalette(c.palette) }
    })
    .sort((a, b) => b.score - a.score)
}

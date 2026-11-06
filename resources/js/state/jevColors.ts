// Colors by feel, on the board: draw each candidate palette, show them to Jev with your
// brief (and a picture, when you give one), and keep the three it rates best.

import type { Mode } from '@/core/palette'
import { toneOfGuide } from '@/core/dials'
import { resolveGuide } from '@/core/guide'
import { imageRef, type JevAsset } from '@/core/jev'
import { distinct, hueCandidates, paletteRequest, rankPalettes, variantCandidates, type Candidate, type PaletteBrief, type Ranked } from '@/core/jev/palettes'
import { yes } from '@/core/jev'
import { swatchSvg, SWATCH } from '@/core/jev/swatch'
import { KIND_WORDS } from '@/core/jev/vocab'
import { askJev } from '@/lib/jev'
import { svgToJpeg, toJevJpeg } from '@/lib/jevImage'
import { colorsFrom } from '@/lib/colorsFrom'
import { currentSlots, useStore } from './store'
import { wordsFor } from './commands/refs'

export interface ColorAsk {
  feel?: string
  brand?: string
  /** A logo or photo to match: a Blob (a file you picked) or a picture URL. */
  picture?: Blob | string
  mode?: Mode
}

function brief(feel?: string): PaletteBrief {
  const st = useStore.getState()
  const hero = currentSlots(st).find((s) => s.type === 'hero')
  return {
    feel,
    site: st.content.kind ? `${st.content.brand}, ${KIND_WORDS[st.content.kind]}` : st.content.brand,
    headline: hero ? wordsFor(hero).headline : undefined,
  }
}

async function round(b: PaletteBrief, cands: Candidate[], photo?: JevAsset, askTone = false): Promise<{ ranked: Ranked[]; dark: number | null } | null> {
  const drawn = await Promise.all(cands.map((c) => svgToJpeg(swatchSvg(c.palette), SWATCH.w, SWATCH.h)))
  const keep = cands.filter((_, i) => drawn[i])
  const refs = keep.map((_, i) => imageRef(`pal${i}`))
  const assets: Record<string, JevAsset> = Object.fromEntries(refs.map((r, i) => [r, drawn[cands.indexOf(keep[i])]!.asset]))
  const photoRef = photo ? imageRef('photo') : undefined
  if (photo && photoRef) assets[photoRef] = photo
  if (!keep.length) return null
  const res = await askJev(paletteRequest(b, keep, refs, assets, photoRef, askTone), { timeoutMs: 10000 })
  return res ? { ranked: rankPalettes(res, keep, !!photo), dark: yes(res, 'dark') } : null
}


/** Three palettes for a feel, a brand color or a picture, best first; null when Jev is off or didn't answer. */
export async function suggestPalettes(ask: ColorAsk): Promise<Ranked[] | null> {
  const st = useStore.getState()
  const mode: Mode = ask.mode ?? (toneOfGuide(resolveGuide(st.guide).tokens) === 'dark' ? 'dark' : 'light')
  const b = brief(ask.feel)
  let photo: JevAsset | undefined
  let seeds: string[] = ask.brand ? [ask.brand] : []
  if (ask.picture) {
    const img = await toJevJpeg(ask.picture, 768)
    photo = img?.asset
    if (!seeds.length) seeds = await colorsFrom(ask.picture, 3)
  }
  let ranked: Ranked[] | null
  if (seeds.length) {
    // Variations on the colors you have.
    const cands = seeds.flatMap((s, i) => variantCandidates(s, mode, `v${i}`).slice(0, seeds.length > 1 ? 4 : 6))
    ranked = (await round(b, cands.slice(0, 18), photo))?.ranked ?? null
  } else {
    // Hues first (and whether the feel wants a dark page), then variations on the three best hues in that tone.
    const first = await round(b, hueCandidates(mode, 18), photo, !ask.mode && !!ask.feel)
    if (!first) return null
    const tone: Mode = !ask.mode && first.dark !== null ? (first.dark >= 0.6 ? 'dark' : first.dark <= 0.4 ? 'light' : mode) : mode
    const best = distinct(first.ranked, 3)
    const cands = best.flatMap((x, k) => variantCandidates(x.brand, tone, `r${k}`).slice(0, 4))
    ranked = (await round(b, cands.slice(0, 14), photo))?.ranked ?? first.ranked
  }
  if (!ranked) return null
  return distinct(ranked, 3)
}

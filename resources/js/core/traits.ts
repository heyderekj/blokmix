// What a page looks like, in a few closed words: read off any style guide and list of layouts, never hand-tagged, so
// a curated direction, a theme on its own and a layout you swapped in are all described the same way. Taste
// (core/taste.ts) leans toward or away from these; directions (core/directions.ts) are ranked by them. Pure.

import { toneOfGuide } from './dials'
import { FEEL_WORDS, type FeelWord } from './feel'
import { findLibraryFont } from './fonts'
import { resolveGuide } from './guide'
import { heroFamily } from './heroLayouts'
import { hexToOklch } from './palette'
import { primaryFamily } from './tokens'
import type { GuideState, Library } from './types'

export const OPENERS = ['centered', 'split', 'editorial', 'collage', 'backdrop', 'bento'] as const
export type Opener = (typeof OPENERS)[number]

/** Each group is one question about a page; a page has at most one answer per group (feel can have several). */
export const TRAIT_GROUPS = {
  feel: FEEL_WORDS.filter((w) => w !== 'dark'),
  tone: ['dark', 'light'],
  heading: ['serif', 'sans', 'mono', 'script'],
  corners: ['square', 'soft', 'round'],
  color: ['vivid', 'muted'],
  room: ['airy', 'dense'],
  opener: OPENERS.map((o) => `opener:${o}` as const),
  pictures: ['picture-led', 'type-led'],
  motion: ['still', 'lively'],
  odd: ['plain', 'odd'],
} as const

type Values<T> = T[keyof T]
export type Trait = Values<{ [K in keyof typeof TRAIT_GROUPS]: (typeof TRAIT_GROUPS)[K][number] }>
export type TraitGroup = keyof typeof TRAIT_GROUPS

export const TRAITS: Trait[] = Object.values(TRAIT_GROUPS).flat() as Trait[]
export const isTrait = (t: string): t is Trait => (TRAITS as string[]).includes(t)
export const groupOf = (t: Trait): TraitGroup => (Object.keys(TRAIT_GROUPS) as TraitGroup[]).find((g) => (TRAIT_GROUPS[g] as readonly string[]).includes(t))!

/** How a trait reads in a sentence: "Leaning warm, serif headings, big pictures." */
export const TRAIT_WORD: Record<Trait, string> = {
  warm: 'warm',
  calm: 'calm',
  bold: 'bold',
  playful: 'playful',
  serious: 'serious',
  classic: 'classic',
  modern: 'modern',
  dark: 'dark',
  light: 'light',
  serif: 'serif headings',
  sans: 'plain headings',
  mono: 'code-like type',
  script: 'handwritten type',
  square: 'square corners',
  soft: 'soft corners',
  round: 'round corners',
  vivid: 'bright color',
  muted: 'quiet color',
  airy: 'roomy',
  dense: 'compact',
  'opener:centered': 'a centered opener',
  'opener:split': 'a side-by-side opener',
  'opener:editorial': 'a magazine opener',
  'opener:collage': 'a collage opener',
  'opener:backdrop': 'a full photo opener',
  'opener:bento': 'a tiled opener',
  'picture-led': 'big pictures',
  'type-led': 'big type',
  still: 'still',
  lively: 'moving',
  plain: 'safe',
  odd: 'unusual',
}

/** Pictures that stand in for a photo or illustration (not logos) in a layout's markup. */
export function picturesIn(html: string): number {
  return (html.match(/<[^>]*data-mx-block="image"[^>]*>/g) ?? []).filter((tag) => !/data-mx-media="logo/.test(tag)).length
}

export interface TraitContext {
  /** The theme's own feel words (a skin's `feel`); the tone is read from the colors either way. */
  feel?: readonly FeelWord[]
  /** 0 safe … 2 strange (a direction's `odd`). */
  odd?: number
}

/** The traits of a page: its style guide and its sections' layouts, top to bottom. */
export function traitsOf(guide: GuideState, clipIds: readonly string[], lib: Library, ctx: TraitContext = {}): Trait[] {
  const t = resolveGuide(guide).tokens
  const out = new Set<Trait>()
  for (const w of ctx.feel ?? []) if (w !== 'dark') out.add(w as Trait)
  out.add(toneOfGuide(t))

  const font = findLibraryFont(primaryFamily(t['font.display']))
  const vibes = font?.vibes ?? []
  out.add(vibes.includes('mono') ? 'mono' : vibes.includes('script') || vibes.includes('hand') ? 'script' : vibes.includes('serif') ? 'serif' : 'sans')

  const r = parseFloat(t['radius.base']) || 0
  out.add(r <= 3 ? 'square' : r >= 12 ? 'round' : 'soft')

  const c = hexToOklch(t['color.primary'])?.[1] ?? 0
  if (c >= 0.12) out.add('vivid')
  else if (c <= 0.07) out.add('muted')

  const clips = clipIds.map((id) => lib.clips[id]).filter(Boolean)
  const room = clips.reduce((n, c) => n + (c.density === 'airy' ? 1 : c.density === 'dense' ? -1 : 0), 0) + (parseFloat(t['space.section']) >= 120 ? 1 : parseFloat(t['space.section']) <= 72 ? -1 : 0)
  if (room >= 2) out.add('airy')
  else if (room <= -2) out.add('dense')

  const hero = clipIds.find((id) => lib.clips[id]?.type === 'hero')
  if (hero) {
    const fam = heroFamily(hero, lib)
    if ((OPENERS as readonly string[]).includes(fam)) out.add(`opener:${fam}` as Trait)
  }
  const top = clips.filter((c) => c.type !== 'nav').slice(0, 2)
  out.add(top.some((c) => picturesIn(c.html) > 0) ? 'picture-led' : 'type-led')

  const moving = Object.values(guide.sections ?? {}).some((s) => s.motion && s.motion.mode !== 'none' && s.motion.enter)
  out.add(moving && parseFloat(t['motion.duration']) > 0 ? 'lively' : 'still')

  out.add((ctx.odd ?? 0) >= 1 ? 'odd' : 'plain')
  return [...out]
}

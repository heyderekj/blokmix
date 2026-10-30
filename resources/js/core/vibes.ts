// The guided start's feels, in plain words. Each is a style guide's worth of
// choices (fonts, type, corners, spacing, motion, colors) a non-designer can pick
// by eye, plus which sections suit it. Values come from Blokmix's sample sources,
// adjusted to the craft rules (ease-out motion, AA contrast).

import type { Feel, TokenSet } from './types'
import { BASE_TOKENS } from './tokens'
import { greyPalette, paletteFrom, type Mode } from './palette'

export interface Vibe {
  id: string
  name: string
  /** One line a non-designer can picture. */
  words: string
  /** The library tag sections need to suit it; Sketch suits anything. */
  feel: Feel | null
  mode: Mode
  /** The brand color it starts from when you don't give one (null: greys). */
  brand: string | null
  tokens: Partial<TokenSet>
  /** Heroes that suit it, best first (clip ids). */
  heroes: string[]
}

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

export const VIBES: Vibe[] = [
  {
    id: 'calm',
    name: 'Calm',
    words: 'Clean and quiet. Lots of room, one soft accent.',
    feel: 'calm',
    mode: 'light',
    brand: '#18181b',
    tokens: {
      'font.display': "'Inter', system-ui, sans-serif",
      'font.body': "'Inter', system-ui, sans-serif",
      'type.ratio': '1.25',
      'type.displayWeight': '650',
      'radius.base': '10px',
      'space.section': '104px',
      'shadow.card': '0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px rgb(0 0 0 / 0.05)',
      'motion.duration': '320ms',
      'motion.ease': EASE_OUT,
    },
    heroes: ['hero.layout-centered', 'hero.layout-media-below', 'hero.layout-split'],
  },
  {
    id: 'friendly',
    name: 'Friendly',
    words: 'Round, warm and a little playful.',
    feel: 'friendly',
    mode: 'light',
    brand: '#7c5cff',
    tokens: {
      'font.display': "'Plus Jakarta Sans', system-ui, sans-serif",
      'font.body': "'Plus Jakarta Sans', system-ui, sans-serif",
      'type.ratio': '1.25',
      'type.displayWeight': '800',
      'radius.base': '20px',
      'space.section': '104px',
      'shadow.card': '0 2px 4px rgb(30 27 58 / 0.05), 0 12px 32px rgb(30 27 58 / 0.08)',
      'motion.duration': '360ms',
      'motion.ease': EASE_OUT,
    },
    heroes: ['hero.layout-portrait', 'hero.layout-product', 'hero.layout-media-below'],
  },
  {
    id: 'editorial',
    name: 'Editorial',
    words: 'Like a good magazine. Big serif headlines, fine lines.',
    feel: 'editorial',
    mode: 'light',
    brand: '#7a1f1f',
    tokens: {
      'font.display': "'Fraunces', Georgia, serif",
      'font.body': "'Newsreader', Georgia, serif",
      'type.base': '18px',
      'type.ratio': '1.333',
      'type.displayWeight': '400',
      'radius.base': '2px',
      'space.section': '112px',
      'shadow.card': 'none',
      'motion.duration': '500ms',
      'motion.ease': EASE_OUT,
    },
    heroes: ['hero.layout-editorial', 'hero.layout-split', 'hero.layout-backdrop'],
  },
  {
    id: 'technical',
    name: 'Technical',
    words: 'Dark, precise and calm under pressure, like a good dev tool.',
    feel: 'technical',
    mode: 'dark',
    brand: '#3dff8f',
    tokens: {
      'font.display': "'Geist', system-ui, sans-serif",
      'font.body': "'Geist', system-ui, sans-serif",
      'font.mono': "'Geist Mono', ui-monospace, monospace",
      'type.base': '15px',
      'type.ratio': '1.25',
      'type.displayWeight': '600',
      'radius.base': '8px',
      'space.section': '96px',
      'shadow.card': '0 0 0 1px rgb(255 255 255 / 0.06), 0 20px 40px rgb(0 0 0 / 0.4)',
      'motion.duration': '240ms',
      'motion.ease': EASE_OUT,
    },
    heroes: ['hero.layout-product', 'hero.layout-centered', 'hero.layout-logos'],
  },
  {
    id: 'bold',
    name: 'Bold',
    words: 'Loud and confident. Heavy type, hard edges, one bright color.',
    feel: 'bold',
    mode: 'light',
    brand: '#ffe600',
    tokens: {
      'font.display': "'Archivo Black', 'Arial Black', sans-serif",
      'font.body': "'Space Mono', ui-monospace, monospace",
      'font.mono': "'Space Mono', ui-monospace, monospace",
      'type.base': '15px',
      'type.ratio': '1.5',
      'type.displayWeight': '400',
      'radius.base': '0px',
      'stroke.width': '2px',
      'space.section': '88px',
      'shadow.card': '6px 6px 0 rgb(0 0 0)',
      'motion.duration': '160ms',
      'motion.ease': EASE_OUT,
    },
    heroes: ['hero.layout-editorial', 'hero.layout-backdrop', 'hero.layout-centered'],
  },
  {
    id: 'sketch',
    name: 'Sketch',
    words: 'Plain grey blocks, to decide the layout before the look.',
    feel: null,
    mode: 'light',
    brand: null,
    tokens: {
      'font.display': "'Inter', system-ui, sans-serif",
      'font.body': "'Inter', system-ui, sans-serif",
      'type.ratio': '1.2',
      'type.displayWeight': '600',
      'radius.base': '4px',
      'space.section': '88px',
      'shadow.card': 'none',
      'motion.duration': '200ms',
      'motion.ease': EASE_OUT,
    },
    heroes: ['hero.layout-centered', 'hero.layout-split', 'hero.layout-media-below'],
  },
]

export const vibeById = (id: string): Vibe => VIBES.find((v) => v.id === id) ?? VIBES[0]

/** A vibe's whole token set: the neutral base, the vibe's choices, and its palette (from your brand color if given). */
export function vibeTokens(vibe: Vibe, opts: { brand?: string | null; mode?: Mode } = {}): TokenSet {
  const mode = opts.mode ?? vibe.mode
  const brand = opts.brand ?? vibe.brand
  const palette = brand ? paletteFrom(brand, mode) : greyPalette(mode)
  return { ...BASE_TOKENS, ...vibe.tokens, ...palette }
}


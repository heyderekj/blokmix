// The start's row of versions: whole pages that differ in layout and look, each a direction (core/directions.ts) with
// its one plain line on what it is and why it works. Mix re-rolls the row; a pin holds one half (the look or the
// layout) while the other varies, and the kept version stays first. Pure, so the screen and suggest_starts share it.

import { directionStart, rankDirections } from './directions'
import { startCandidates, type StartCandidate, type StartInput } from './start'
import { groupOf, isTrait, TRAIT_WORD, type Trait } from './traits'
import { noteTaste, traitsFromWords, type Taste } from './taste'
import type { Library } from './types'

export const VARY = ['layout', 'look', 'both'] as const
export type Vary = (typeof VARY)[number]

export interface StartVersion {
  start: StartCandidate
  /** One plain line: what it is and why it works. */
  why: string
  /** The theme it's in (a theme id, maybe with its variant). */
  theme: string
  /** The direction it came from; the plain layouts-only row has none. */
  direction?: string
  /** What it is, in the taste's words (core/traits.ts), for "More like this" and "Not this". */
  traits: Trait[]
  /** The one that tries something not said either way yet. */
  stretch?: boolean
}

export interface VersionOptions {
  count?: number
  /** What differs between versions: only the layouts (in the input's skin), only the look, or both (the default). */
  vary?: Vary
  taste?: Taste
  /** How odd a version may be: 0 safe, 1 a little unexpected, 2 strange. */
  odd?: number
  exclude?: string[]
  /** Hold a look (theme id) or a layout (direction id) and vary the other half. */
  pin?: { look?: string; layout?: string }
  /** A version to keep first in the row (the one a pin came from). */
  keep?: StartVersion
}

/** A direction id without what a pin added to it (`cafe~acoustic` → `cafe`). */
export const baseDirection = (id: string) => id.split('~')[0]

/**
 * The brief's feelings as a lean: its own feel words read a clause at a time, and what it said to steer away from, so a
 * row made before anyone reacts already leans their way. Added to the taste for this row only.
 */
export function briefTaste(input: Pick<StartInput, 'brief'>, taste?: Taste): Taste | undefined {
  const b = input.brief ?? {}
  const words = (b.feelWords ?? []).join(', ')
  const read = words ? traitsFromWords(words) : { more: [] as Trait[], less: [] as Trait[] }
  const less = [...new Set([...read.less, ...(b.avoid ?? []).filter(isTrait)])]
  if (!read.more.length && !less.length) return taste
  return noteTaste(taste, { kind: 'note', traits: read.more, source: 'you', sign: 1 }, { kind: 'note', traits: less, source: 'you', sign: -1 })
}

/** A row of versions for the start, best first, never two alike. */
export function startVersions(input: StartInput, lib: Library, o: VersionOptions = {}): StartVersion[] {
  const count = Math.max(1, Math.min(6, o.count ?? 4))
  const vary = o.vary ?? 'both'
  const keep = o.keep ? [o.keep] : []
  const want = count - keep.length
  if (vary === 'layout' && !o.pin) return startCandidates(input, lib, count).map((start) => ({ start, why: start.label, theme: input.skin ?? '', traits: [] }))
  const taste = briefTaste(input, o.taste)
  let pin = o.pin
  // Only the look varies: hold the best direction's layouts.
  if (vary === 'look' && !pin) {
    const first = rankDirections({ input, lib, count: 1, taste, odd: o.odd })[0]
    if (first) pin = { layout: first.direction.id }
  }
  // Leave out the kept one in every form a pin gives it.
  const kept = o.keep?.direction
  const exclude = [...(o.exclude ?? []), ...(kept ? [kept, baseDirection(kept), `${baseDirection(kept)}~${o.keep!.theme.replace('/', '~')}`] : [])]
  const ranked = want > 0 ? rankDirections({ input, lib, count: want, taste, odd: o.odd, exclude, pin }) : []
  const fresh = ranked
    .filter((r) => !o.keep || r.direction.theme !== o.keep.theme || baseDirection(r.direction.id) !== baseDirection(kept ?? ''))
    .map((r) => ({ start: directionStart(r.direction, input, lib), why: pin?.look ? layoutWords(r.traits) : r.why, theme: r.direction.theme, direction: r.direction.id, traits: r.traits, ...(r.stretch ? { stretch: true } : {}) }))
  return [...keep, ...fresh].map((v, i) => ({ ...v, start: { ...v.start, id: v.direction ? `dir-${v.direction}` : `start${i}` } }))
}

/** With the look held, what's left to tell versions apart is the arrangement: "A side-by-side opener, big pictures, roomy." */
export function layoutWords(traits: Trait[]): string {
  const said = traits.filter((t) => ['opener', 'pictures', 'room'].includes(groupOf(t))).map((t) => TRAIT_WORD[t])
  return said.length ? `${said.join(', ').replace(/^./, (c) => c.toUpperCase())}, in the look you kept.` : 'Another arrangement, in the look you kept.'
}

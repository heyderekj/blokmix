// Dress it up: backgrounds, textures, glows and UI mockups that suit a section. Every
// candidate is one of Blokmix's own treatments and presets (core/treatments); Jev reads
// each one's name and description against the section's words, the skin's mood and the
// feel you asked for, one Score each, and picks a screen for an empty picture from the
// product's words. Code keeps the craft rules: one expressive treatment per section, one
// live shader per page, mockups only where a picture is empty.

import type { SectionType } from '../types'
import { TYPE_LABEL } from '../content'
import type { TreatmentInfo, Look } from '../treatments'
import { choice, score, at } from './ask'
import { clip } from './state'
import { choiceOf, levelP, ranked, scoreOf, scoreShare } from './read'
import type { Criterion, JevRequest, JevResponse } from './types'

export const DRESS_THRESHOLDS = {
  /** Show a backdrop pick at this share of the fit scale or better. */
  show: 0.45,
  /** Fill an empty picture with a mockup when this sure of the screen. */
  mock: 0.5,
  picks: 3,
}

export const DRESS_FIT = ['Wrong: clashes with it', 'Out of place', 'Fine', 'Suits it', 'Exactly right for it']

export interface DressCandidate {
  key: string
  treatment: string
  preset: string
  live: boolean
  label: string
  /** The words Jev reads: what it looks like. */
  what: string
}

/** Backdrops with each preset, minus live shaders when the page already runs one elsewhere. */
export function backdropCandidates(list: TreatmentInfo[], liveElsewhere: boolean): DressCandidate[] {
  return list
    .filter((t) => t.surface === 'backdrop' && !(t.live && liveElsewhere))
    .flatMap((t) =>
      t.presets.slice(0, 3).map((p) => ({
        key: `b_${t.id}_${p.id}`.replace(/[^a-z0-9_]/gi, '_'),
        treatment: t.id,
        preset: p.id,
        live: !!t.live,
        label: t.presets.length > 1 ? `${t.label} · ${p.label}` : t.label,
        what: `${t.label}${t.presets.length > 1 ? ` (${p.label})` : ''}: ${t.hint}${t.live ? ' It moves.' : ''}`,
      })),
    )
    .slice(0, 60)
}

export interface DressBrief {
  type: SectionType
  /** The section's own words: heading, intro. */
  words: string
  site?: string
  look?: string
  tone: 'light' | 'dark'
  feel?: string
  /** Mockup screens on offer when the section has an empty picture. */
  mocks?: { id: string; label: string; hint: string }[]
  looks?: Look[]
}

export function dressRequest(b: DressBrief, cands: DressCandidate[]): JevRequest {
  const questions: JevRequest['questions'] = {}
  cands.forEach((_c, i) => {
    questions[`fit_${i}`] = score(`As the background of ${at('section')}, how well does ${at(`backgrounds[${i}]`)} suit it and the feel asked for?`, DRESS_FIT)
  })
  if (b.mocks?.length) {
    const opts: Record<string, Criterion> = Object.fromEntries(b.mocks.map((m) => [m.id, { what: `${m.label}: ${m.hint}` }]))
    opts.none = { what: 'None: not a software product, or a photo would suit it better' }
    questions.mock = choice(`${at('section')} has an empty picture. Which product screen would it show?`, opts)
  }
  if (b.looks?.length) {
    questions.look = choice(`Which set of effects suits ${at('site')} and ${at('feel')}?`, Object.fromEntries(b.looks.map((l) => [l.id, { what: `${l.label}: ${l.hint}` }])))
  }
  return {
    state: {
      section: { kind: TYPE_LABEL[b.type], words: clip(b.words, 300), tone: b.tone },
      site: b.site ?? null,
      look: b.look ?? null,
      feel: b.feel ? clip(b.feel, 160) : null,
      backgrounds: cands.map((c) => c.what),
    },
    questions,
  }
}

export interface DressPick extends DressCandidate {
  fit: number
}

export interface Dressed {
  backdrops: DressPick[]
  mock: { id: string; p: number } | null
  look: { id: string; p: number } | null
}

export function readDress(res: JevResponse | null, cands: DressCandidate[]): Dressed {
  const N = DRESS_FIT.length
  const picks = cands
    .map((c, i) => {
      const a = scoreOf(res, `fit_${i}`)
      return { ...c, fit: a ? scoreShare(a, N) + 0.1 * levelP(a, N - 1) : 0 }
    })
    .filter((x) => x.fit >= DRESS_THRESHOLDS.show)
    .sort((a, b) => b.fit - a.fit)
  // One pick per treatment: three different ideas beat three presets of one.
  const seen = new Set<string>()
  const backdrops = picks.filter((p) => (seen.has(p.treatment) ? false : (seen.add(p.treatment), true))).slice(0, DRESS_THRESHOLDS.picks)
  const m = choiceOf(res, 'mock')
  const mt = m ? ranked(m)[0] : null
  const l = choiceOf(res, 'look')
  const lt = l ? ranked(l)[0] : null
  return {
    backdrops,
    mock: mt && mt.option !== 'none' && mt.p >= DRESS_THRESHOLDS.mock ? { id: mt.option, p: mt.p } : null,
    look: lt ? { id: lt.option, p: lt.p } : null,
  }
}

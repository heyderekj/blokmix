// The guided start as a short run of plain questions, one at a time. Code decides which comes next and which can fold
// away because the first sentence already answered it; Jev only ranks the answers on offer (it never writes a word).
// Pure, so the screen, the agent commands and the tests walk it alike.

import { actionChoices, briefFeel, briefFromKind, FORMAT_LABEL, goalsOf, guessBrief, INDUSTRY_LABEL, kindOf, patchBrief, type Brief, type Format, type Goal, type Industry } from './brief'
import type { Picks, StartFill } from './jev/sentence'
import { KIND_FEEL, type FeelWord } from './feel'
import { recipeFor, RECIPES } from './start'
import type { Kind, SectionType } from './types'

export const QUESTIONS = ['name', 'what', 'confirm', 'goals', 'action', 'sections', 'look', 'drafts'] as const
export type Question = (typeof QUESTIONS)[number]

/** What was read from the second answer: Jev's read when suggestions are on, else a guess from keywords. */
export interface HeardBrief {
  mode: 'describe' | 'paste'
  /** Read by Jev (false: keywords only). */
  jev: boolean
  format: Format | null
  formats: Format[]
  industry: Industry | null
  industries: Industry[]
  /** Goals sure enough to tick for you. */
  goals: Goal[]
  /** The kind of site, when sure. */
  kind: Kind | null
  /** Home's sections: the kind's page as the description changes it, or the page your words make. */
  sections: SectionType[]
  /** How likely each optional section is wanted (descriptions). */
  want: Partial<Record<SectionType, number>>
  /** Looks (skin ids) that fit, best first. */
  looks: string[]
}

export interface Answers {
  name: string
  text: string
  brief: Brief
  /** Home's sections after your ✕ and +; null keeps the suggested ones. */
  sections: SectionType[] | null
  feel: FeelWord[]
  /** Questions answered or skipped. */
  done: Question[]
  /** Started from a saved style guide: there's no look to pick. */
  fixedGuide?: boolean
  /** Questions you opened again: they're asked even when the first sentence answered them. */
  opened?: Question[]
}

export const emptyAnswers = (): Answers => ({ name: '', text: '', brief: {}, sections: null, feel: [], done: [] })

/** What the brief reads as so far: yours where you said, else what was heard. */
export function briefFrom(a: Answers, heard: HeardBrief | null): Brief {
  const fromHeard: Brief = heard
    ? { ...(heard.format ? { format: heard.format } : {}), ...(heard.industry ? { industry: heard.industry } : {}), ...(heard.goals.length ? { goals: heard.goals } : {}) }
    : a.text.trim()
      ? (({ sure: _, what: __, ...g }) => g)(guessBrief(a.text))
      : {}
  // A description is context worth keeping; pasted copy is already on the page.
  const what = heard?.mode !== 'paste' && a.text.trim() && a.text.trim().length <= 600 ? { what: a.text.trim() } : {}
  return patchBrief({ ...fromHeard, ...what }, a.brief)
}

/** The kind of site the answers add up to. */
export const kindFrom = (a: Answers, heard: HeardBrief | null): Kind => kindOf(briefFrom(a, heard), heard?.kind ?? 'studio')

/** Home's sections the answers add up to: yours, else your words' page, else the recipe for the brief. */
export function sectionsFrom(a: Answers, heard: HeardBrief | null): SectionType[] {
  if (a.sections) return a.sections
  if (heard?.mode === 'paste') return heard.sections
  return recipeFor(briefFrom(a, heard), kindFrom(a, heard), heard?.want)
}

/** How it should feel to start with: yours, else what the industry and kind suggest. */
export function feelFrom(a: Answers, heard: HeardBrief | null): FeelWord[] {
  if (a.feel.length) return a.feel
  const b = briefFrom(a, heard)
  return [...new Set([...briefFeel(b), ...KIND_FEEL[kindFrom(a, heard)]])].slice(0, 2)
}

/** Questions that need no asking, with the line that says what was taken as the answer. */
export function folded(a: Answers, heard: HeardBrief | null): Partial<Record<Question, string>> {
  const out: Partial<Record<Question, string>> = {}
  const b = briefFrom(a, heard)
  const asked = (q: Question) => a.opened?.includes(q) || a.done.includes(q)
  // Sure of both from the first sentence: say so, and move on (a click opens it again).
  if (heard?.format && heard.industry && !asked('confirm')) out.confirm = `${FORMAT_LABEL[heard.format]} · ${INDUSTRY_LABEL[heard.industry]}`
  const actions = actionChoices(b)
  if (!b.mainAction && actions.length === 1 && !asked('action')) out.action = actions[0]
  if (heard?.mode === 'paste' && !a.sections && !asked('sections')) out.sections = 'Your words decide the sections'
  if (a.fixedGuide) out.look = 'Your saved style guide'
  return out
}

/** The next question to ask: the first not yet answered that didn't fold away. */
export function nextQuestion(a: Answers, heard: HeardBrief | null): Question {
  const skip = folded(a, heard)
  for (const q of QUESTIONS) {
    if (a.done.includes(q)) continue
    if (q === 'name' && a.name.trim()) continue
    if (skip[q]) continue
    return q
  }
  return 'drafts'
}

/** Every remaining question answered with what's suggested, straight to the pages. */
export function skipToPages(a: Answers, heard: HeardBrief | null): Answers {
  const b = briefFrom(a, heard)
  const mainAction = b.mainAction ?? actionChoices(b)[0]
  return {
    ...a,
    name: a.name.trim() || 'Your site',
    brief: patchBrief(a.brief, { ...(b.goals ? {} : { goals: goalsOf(b) }), mainAction }),
    done: QUESTIONS.filter((q) => q !== 'drafts'),
  }
}

/** Mark a question answered. */
export const answer = (a: Answers, q: Question, patch: Partial<Answers> = {}): Answers => ({ ...a, ...patch, done: [...new Set([...a.done.filter((x) => x !== q), q])] })

/** Open an answered question again: it and everything after it is asked again (your answers stay as they were). */
export const reopen = (a: Answers, q: Question): Answers => ({
  ...a,
  done: a.done.filter((x) => QUESTIONS.indexOf(x) < QUESTIONS.indexOf(q)),
  opened: [...new Set([...(a.opened ?? []), q])],
})

// ---- The start sentence ("I'm making a site for [a bakery] called [Fern & Co]…") as answers ----

/** The sentence's goals (core/jev/sentence.ts) as the brief's. */
export const SENTENCE_GOAL: Record<string, Goal> = {
  order: 'orders',
  'book-table': 'bookings',
  book: 'bookings',
  visit: 'visit',
  call: 'calls',
  touch: 'calls',
  quote: 'calls',
  hire: 'hire',
  work: 'showWork',
  'sign-up': 'signups',
  try: 'signups',
  buy: 'sell',
  download: 'signups',
  waitlist: 'waitlist',
  tickets: 'tickets',
  rsvp: 'tickets',
  subscribe: 'subscribers',
  read: 'subscribers',
  donate: 'donate',
  listen: 'subscribers',
}

/** The sentence's feels as the Look panel's feel words. */
export const SENTENCE_FEEL: Record<string, FeelWord> = {
  cozy: 'warm', warm: 'warm', earthy: 'warm', soft: 'warm',
  friendly: 'playful', playful: 'playful', fun: 'playful', dreamy: 'playful',
  calm: 'calm', clean: 'calm', minimal: 'calm', simple: 'calm', trustworthy: 'calm',
  bold: 'bold', loud: 'bold', confident: 'bold', industrial: 'bold', raw: 'bold', retro: 'bold',
  premium: 'classic', elegant: 'classic', classic: 'classic', editorial: 'classic', bookish: 'classic',
  techy: 'modern', precise: 'modern', nerdy: 'modern',
  dark: 'dark',
}

/** What the sentence says, read like a description: certain where a blank came from Blokmix's own lists. */
export function heardFromSentence(fill: StartFill, picks: Picks): HeardBrief | null {
  if (!fill.kind && !fill.text.trim()) return null
  const guess = guessBrief(fill.text)
  const byKind = briefFromKind(fill.kind ?? undefined)
  const goalId = picks.goal?.[0]?.id
  const goals = goalId && SENTENCE_GOAL[goalId] ? [SENTENCE_GOAL[goalId]] : (guess.goals ?? [])
  const format = guess.format ?? byKind.format ?? null
  const industry = guess.industry ?? byKind.industry ?? null
  return {
    mode: 'describe',
    jev: true,
    kind: fill.kind,
    format,
    formats: format ? [format] : [],
    industry,
    industries: industry ? [industry] : [],
    goals,
    sections: fill.sections ?? (fill.kind ? RECIPES[fill.kind].home : []),
    want: {},
    looks: fill.looks,
  }
}

/**
 * The answers the sentence gives: its name, what it is, the main button, how it should feel and what to show. The
 * questions it answered fold away (the look and the three layouts are still yours to pick).
 */
export function answersFromSentence(a: Answers, fill: StartFill, picks: Picks): Answers {
  const goal = picks.goal?.[0]
  const typed = !!goal && !goal.id && !!goal.words.trim()
  const feel = (picks.feel ?? []).flatMap((p) => (p.id && SENTENCE_FEEL[p.id] ? [SENTENCE_FEEL[p.id]] : []))
  const shows = (picks.show ?? []).some((p) => p.words.trim())
  const done: Question[] = ['name', 'what', ...(goal?.id && SENTENCE_GOAL[goal.id] ? (['goals'] as const) : []), ...(fill.button ? (['action'] as const) : []), ...(shows && fill.sections ? (['sections'] as const) : [])]
  return {
    ...a,
    name: fill.name.trim() || a.name.trim() || 'Your site',
    text: fill.text,
    brief: patchBrief(a.brief, { ...(fill.button ? { mainAction: fill.button, mainActionTyped: typed } : {}), ...(goal?.id && SENTENCE_GOAL[goal.id] ? { goals: [SENTENCE_GOAL[goal.id]] } : {}) }),
    feel: feel.length ? [...new Set(feel)] : a.feel,
    sections: shows && fill.sections ? fill.sections : a.sections,
    done: [...new Set([...a.done, ...done])],
  }
}

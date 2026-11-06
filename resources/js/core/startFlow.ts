// The guided start as a short run of plain questions, one at a time. Code decides which comes next and which can fold
// away because the first sentence already answered it; Jev only ranks the answers on offer (it never writes a word).
// Pure, so the screen, the agent commands and the tests walk it alike.

import { actionChoices, briefFeel, FORMAT_LABEL, goalsOf, guessBrief, INDUSTRY_LABEL, kindOf, patchBrief, type Brief, type Format, type Goal, type Industry } from './brief'
import { KIND_FEEL, type FeelWord } from './feel'
import { recipeFor } from './start'
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

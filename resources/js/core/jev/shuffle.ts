// Jev leans toward a Choice's first option. For a choice we act on, ask it twice in
// one request, the options in order and reversed, and act only when both agree.
// Questions run in parallel, so the second asking costs no time.

import type { ChoiceAnswer, ChoiceQuestion, JevResponse } from './types'
import { choiceOf, ranked } from './read'

const REVERSED = '__r'

/** The question as asked, plus its reversed twin. Spread both into a request's questions. */
export function shuffled(name: string, q: ChoiceQuestion): Record<string, ChoiceQuestion> {
  const reversed = Object.fromEntries(Object.entries(q.criteria).reverse())
  return { [name]: q, [name + REVERSED]: { ...q, criteria: reversed } }
}

export interface Merged extends ChoiceAnswer {
  /** Both orders picked the same option. */
  agree: boolean
}

/** Both askings averaged. Null when neither came back; one alone counts as not agreeing. */
export function merged(res: JevResponse | null, name: string): Merged | null {
  const a = choiceOf(res, name)
  const b = choiceOf(res, name + REVERSED)
  if (!a && !b) return null
  if (!a || !b) return { ...(a ?? b)!, agree: false }
  const probabilities: Record<string, number> = {}
  for (const k of new Set([...Object.keys(a.probabilities), ...Object.keys(b.probabilities)])) probabilities[k] = ((a.probabilities[k] ?? 0) + (b.probabilities[k] ?? 0)) / 2
  const best = ranked({ probabilities })[0]
  return { type: 'choice', choice: best?.option ?? a.choice, confidence: Math.min(a.confidence, b.confidence), probabilities, agree: a.choice === b.choice }
}

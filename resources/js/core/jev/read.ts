// Reading answers. Act on the probability of the option you'll act on, not on
// `confidence` (for a Choice it's derived from the same top probability).

import type { Answer, BoxAnswer, ChoiceAnswer, JevResponse, NoulAnswer, ScoreAnswer } from './types'

export type Route = 'act' | 'offer' | 'none'

/** Act at or above `act`, offer options from `offer`, else leave it. */
export function route(p: number, t: { act: number; offer: number }): Route {
  return p >= t.act ? 'act' : p >= t.offer ? 'offer' : 'none'
}

const is = <T extends Answer['type']>(a: Answer | undefined, type: T): a is Extract<Answer, { type: T }> => !!a && a.type === type

export const choiceOf = (res: JevResponse | null, name: string): ChoiceAnswer | null => (is(res?.answers[name], 'choice') ? (res!.answers[name] as ChoiceAnswer) : null)
export const scoreOf = (res: JevResponse | null, name: string): ScoreAnswer | null => (is(res?.answers[name], 'score') ? (res!.answers[name] as ScoreAnswer) : null)
export const boxOf = (res: JevResponse | null, name: string): BoxAnswer | null => (is(res?.answers[name], 'box') ? (res!.answers[name] as BoxAnswer) : null)

/** A Noul's probability of yes, or null when it wasn't answered. */
export function yes(res: JevResponse | null, name: string): number | null {
  const a = res?.answers[name]
  return is(a, 'noul') ? (a as NoulAnswer).noul : null
}

/** Options by probability, most likely first. */
export function ranked(a: Pick<ChoiceAnswer, 'probabilities'>): { option: string; p: number }[] {
  return Object.entries(a.probabilities)
    .map(([option, p]) => ({ option, p }))
    .sort((x, y) => y.p - x.p)
}

export const top = (a: Pick<ChoiceAnswer, 'probabilities'>) => ranked(a)[0] ?? { option: '', p: 0 }

export const topTwo = (a: Pick<ChoiceAnswer, 'probabilities'>) => ranked(a).slice(0, 2)

/** A Score as 0–1 across its levels (0 = the lowest level, 1 = the highest). */
export function scoreShare(a: ScoreAnswer, levels: number): number {
  return levels > 1 ? Math.max(0, Math.min(1, a.score / (levels - 1))) : 0
}

/** The probability on one Score level. */
export const levelP = (a: ScoreAnswer, level: number) => a.probabilities[String(level)] ?? 0

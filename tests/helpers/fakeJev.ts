// A stand-in for Jev in tests: answers come from a rule per question, so a test says
// what Jev "thinks" and checks what Blokmix does with it. No network, ever.

import type { Answer, ChoiceQuestion, JevRequest, JevResponse, Question, ScoreQuestion } from '@/core/jev'
import { setJevTransport } from '@/lib/jev'

/** What a rule returns: an option name (taken at `p`), a probability (Noul), a level (Score), or a full answer. */
export type Said = string | number | { option: string; p: number } | { level: number; p?: number } | { box: { top: number; bottom: number; left: number; right: number } } | Answer | undefined

export type Rule = (name: string, q: Question, req: JevRequest) => Said

function choiceAnswer(q: ChoiceQuestion, option: string, p: number): Answer {
  const names = Object.keys(q.criteria)
  const rest = names.filter((n) => n !== option)
  const probabilities = Object.fromEntries(names.map((n) => [n, n === option ? p : rest.length ? (1 - p) / rest.length : 0]))
  return { type: 'choice', choice: option, confidence: p, probabilities }
}

function scoreAnswer(q: ScoreQuestion, level: number, p = 0.9): Answer {
  const n = q.criteria.length
  const probabilities = Object.fromEntries(q.criteria.map((_, i) => [String(i), i === level ? p : (1 - p) / Math.max(1, n - 1)]))
  const score = Object.entries(probabilities).reduce((s, [i, pr]) => s + Number(i) * pr, 0)
  return { type: 'score', score, confidence: p, legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])), probabilities }
}

/** The answer a rule's word means for a question; anything unsaid is a shrug (even odds, middle level). */
export function answerFor(q: Question, said: Said): Answer {
  if (said && typeof said === 'object' && 'type' in said) return said
  switch (q.type) {
    case 'choice': {
      const names = Object.keys(q.criteria)
      if (typeof said === 'string') return choiceAnswer(q, said, 0.9)
      if (said && typeof said === 'object' && 'option' in said) return choiceAnswer(q, said.option, said.p)
      return choiceAnswer(q, names[0], 1 / names.length)
    }
    case 'score':
      if (said && typeof said === 'object' && 'level' in said) return scoreAnswer(q, said.level, said.p)
      if (typeof said === 'number') return scoreAnswer(q, said)
      return scoreAnswer(q, Math.floor((q.criteria.length - 1) / 2), 1 / q.criteria.length)
    case 'noul':
      return { type: 'noul', noul: typeof said === 'number' ? said : 0.5 }
    case 'box':
      return { type: 'box', box: said && typeof said === 'object' && 'box' in said ? said.box : { top: 0.25, bottom: 0.75, left: 0.25, right: 0.75 }, confidence: null }
  }
}

export interface FakeJev {
  requests: JevRequest[]
  /** Change what Jev "thinks" mid-test. */
  rule: Rule
}

/** Install the fake (on by default) and get back what it was asked. `off` makes Jev unavailable. */
export function fakeJev(rule: Rule = () => undefined, opts: { off?: boolean; delayMs?: number } = {}): FakeJev {
  const fake: FakeJev = { requests: [], rule }
  setJevTransport(
    async (req, signal) => {
      fake.requests.push(req)
      if (opts.delayMs) await new Promise((r, j) => {
        const t = setTimeout(r, opts.delayMs)
        signal.addEventListener('abort', () => (clearTimeout(t), j(new Error('aborted'))))
      })
      if (signal.aborted) throw new Error('aborted')
      const answers = Object.fromEntries(Object.entries(req.questions).map(([name, q]) => [name, answerFor(q, fake.rule(name, q, req))]))
      return { model: 'jev-fake', answers, usage: { input_tokens: JSON.stringify(req).length / 4, output_tokens: 0 } } satisfies JevResponse
    },
    async () => !opts.off,
  )
  return fake
}

/** Put the real transport back. */
export const realJev = () => setJevTransport(null)

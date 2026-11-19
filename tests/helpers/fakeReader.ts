// A stand-in for the reader in tests: a rule says what it "read" for a text, so a test checks what Blokmix does with
// it (including a reply that isn't the schema, or a string that isn't your words). No network, ever.

import type { ReadNeed, ReadStart, ReadTask } from '@/core/reader'
import { setReaderTransport, type ReadRequest } from '@/lib/reader'

/** A read that says nothing: every field null or empty. */
export const emptyStart = (): ReadStart => ({
  business: { id: null, words: null },
  kind: null,
  format: null,
  industry: null,
  name: null,
  feel: { ids: [], words: [], avoid: [], avoid_words: [] },
  goals: [],
  action: { id: null, words: null },
  who: null,
  show: [],
  hide: [],
  pages: [],
  tone: null,
  unsure: [],
})

export const emptyNeed = (): ReadNeed => ({ what: null, template: null, sections: [], purpose: null, unsure: [] })

type Deep<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : Deep<T[K]>) : T[K] }

/** An empty start read with some fields said. */
export function startRead(said: Deep<ReadStart>): ReadStart {
  const base = emptyStart()
  return {
    ...base,
    ...said,
    business: { ...base.business, ...said.business },
    feel: { ...base.feel, ...said.feel },
    action: { ...base.action, ...said.action },
  } as ReadStart
}

/** What a rule returns: the reply's `read` as the server would send it (anything, to test the checks), or undefined to fail. */
export type ReaderRule = (task: ReadTask, text: string, context: Record<string, unknown> | undefined) => unknown

export interface FakeReader {
  requests: ReadRequest[]
  rule: ReaderRule
}

/** Install the fake (on by default) and get back what it was asked. `off` makes the reader unavailable. */
export function fakeReader(rule: ReaderRule = () => undefined, opts: { off?: boolean; delayMs?: number } = {}): FakeReader {
  const fake: FakeReader = { requests: [], rule }
  setReaderTransport(
    async (req, signal) => {
      fake.requests.push(req)
      if (opts.delayMs)
        await new Promise((r, j) => {
          const t = setTimeout(r, opts.delayMs)
          signal.addEventListener('abort', () => (clearTimeout(t), j(new Error('aborted'))))
        })
      if (signal.aborted) throw new Error('aborted')
      const read = fake.rule(req.task, req.text, req.context)
      if (read === undefined) throw new Error('Reading answered 502')
      return { read, usage: { input_tokens: 2800, output_tokens: 300 }, ms: 1 }
    },
    async () => !opts.off,
  )
  return fake
}

/** Put the real transport back. */
export const realReader = () => setReaderTransport(null)

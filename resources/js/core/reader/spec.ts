// One task as the server runs it: instructions, the user turn, the schema the reply must match, the context it may
// be given, and which strings must be spans. scripts/read/build.ts writes these to resources/reader/<task>.json (a
// test checks they match), and app/Http/Controllers/Api/ReadController.php reads them. Change them here.

import { READ_CONTEXTS, READ_SCHEMAS, SPANS, jsonSchemaFor, type ReadOf, type ReadTask } from './schema'
import { READ_PROMPTS, USER_TEMPLATE } from './prompt'
import { verbatim } from './verbatim'

export const READ_LIMITS = {
  /** The most text one read takes (a pasted page of words). */
  maxChars: 12_000,
  /** Room for the answer (and a little thinking at low effort). */
  maxTokens: 4_000,
  effort: 'low',
} as const

export interface ReaderSpec {
  task: ReadTask
  max_chars: number
  max_tokens: number
  effort: string
  system: string
  /** The user turn, with {context} and {text} for the server to fill. */
  user: string
  schema: Record<string, unknown>
  context: Record<string, unknown>
  spans: readonly string[]
}

export function readerSpec(task: ReadTask): ReaderSpec {
  return {
    task,
    max_chars: READ_LIMITS.maxChars,
    max_tokens: READ_LIMITS.maxTokens,
    effort: READ_LIMITS.effort,
    system: READ_PROMPTS[task],
    user: USER_TEMPLATE,
    schema: jsonSchemaFor(READ_SCHEMAS[task]),
    context: jsonSchemaFor(READ_CONTEXTS[task]),
    spans: SPANS[task],
  }
}

/** A reply checked the way the browser does: the schema, then every span (exact words back), else null. */
export function checkRead<T extends ReadTask>(task: T, reply: unknown, text: string): ReadOf<T> | null {
  const parsed = READ_SCHEMAS[task].safeParse(reply)
  if (!parsed.success) return null
  return verbatim(parsed.data as ReadOf<T>, text, SPANS[task])
}

/** The committed file's text for a task (resources/reader/<task>.json). */
export const specJson = (task: ReadTask) => JSON.stringify(readerSpec(task), null, 2) + '\n'

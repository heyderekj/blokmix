// One read the way the server does it (app/Services/AnthropicReader.php and ReadController.php), for the Vite-only
// dev proxy and the bench: the committed spec, Anthropic's TypeScript SDK with structured output, a short timeout and
// at most one retry, then the schema and the spans. Imports only the built JSON and verbatim.ts, so vite.config can
// load it.

import Anthropic from '@anthropic-ai/sdk'
import { Ajv } from 'ajv'
import startSpec from '../../resources/reader/start.json' with { type: 'json' }
import needSpec from '../../resources/reader/need.json' with { type: 'json' }
import { verbatim } from '../../resources/js/core/reader/verbatim.ts'

export const SPECS = { start: startSpec, need: needSpec } as const
export type Task = keyof typeof SPECS

const ajv = new Ajv({ strict: false })
const validators = Object.fromEntries(Object.entries(SPECS).map(([t, s]) => [t, { read: ajv.compile(s.schema), context: ajv.compile(s.context) }])) as Record<Task, { read: ReturnType<Ajv['compile']>; context: ReturnType<Ajv['compile']> }>

export const isTask = (t: unknown): t is Task => t === 'start' || t === 'need'

/** What's wrong with a request, in a sentence, or null (the same checks as ReadController). */
export function requestProblem(body: { task?: unknown; text?: unknown; context?: unknown }): string | null {
  if (!isTask(body.task)) return 'Ask for start or need.'
  if (typeof body.text !== 'string' || !body.text.trim()) return 'Send the text to read.'
  if ([...body.text].length > SPECS[body.task].max_chars) return 'That’s too much to read at once.'
  if (!validators[body.task].context(body.context ?? {})) return 'The context is Blokmix’s own ids only.'
  return null
}

export interface Reply {
  read: unknown | null
  /** Why there's no read (never the words). */
  why?: string
  /** Every input token (cached or not), as the server reports it. */
  input_tokens: number
  output_tokens: number
  /** Of those, read from and written to the prompt cache (for the bench's cost). */
  cache_read: number
  cache_write: number
  ms: number
}

/** Ask Claude for one read and check it. `read` is null when there's no usable answer. */
export async function readOnce(client: Anthropic, model: string, task: Task, text: string, context: object = {}): Promise<Reply> {
  const spec = SPECS[task]
  const user = spec.user.replace('{context}', () => JSON.stringify(context)).replace('{text}', () => text)
  const t0 = performance.now()
  const done = (r: Omit<Reply, 'ms'>): Reply => ({ ...r, ms: Math.round(performance.now() - t0) })
  let message: Anthropic.Message
  try {
    message = await client.messages.create({
      model,
      max_tokens: spec.max_tokens,
      system: [{ type: 'text', text: spec.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
      output_config: { effort: spec.effort as 'low', format: { type: 'json_schema', schema: spec.schema } },
    })
  } catch (e) {
    const why = e instanceof Anthropic.RateLimitError ? 'rate_limited' : e instanceof Anthropic.APIConnectionError ? 'connection' : e instanceof Anthropic.APIError ? `status_${e.status}` : 'error'
    return done({ read: null, why, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0 })
  }
  const u = message.usage
  const cache_read = u.cache_read_input_tokens ?? 0
  const cache_write = u.cache_creation_input_tokens ?? 0
  const tokens = { input_tokens: u.input_tokens + cache_read + cache_write, output_tokens: u.output_tokens, cache_read, cache_write }
  // A refusal or a reply cut off at max_tokens may not match the schema: no read.
  if (message.stop_reason !== 'end_turn') return done({ read: null, why: `stop_${message.stop_reason}`, ...tokens })
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!block) return done({ read: null, why: 'no_text', ...tokens })
  let data: unknown
  try {
    data = JSON.parse(block.text)
  } catch {
    return done({ read: null, why: 'not_json', ...tokens })
  }
  if (!validators[task].read(data)) return done({ read: null, why: 'schema', ...tokens })
  const read = verbatim(data, text, spec.spans)
  return done(read ? { read, ...tokens } : { read: null, why: 'not_a_span', ...tokens })
}

export const clientFor = (apiKey: string, timeoutMs = 12_000) => new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 })

/** Dollars for a reply at Claude Haiku 5.5's rates (prompts under 100K tokens): $0.10 / $0.50 per million in / out,
 * cache reads 0.1x and 5-minute cache writes 1.25x the input rate. */
export function dollars(r: Pick<Reply, 'input_tokens' | 'output_tokens' | 'cache_read' | 'cache_write'>): number {
  const plain = r.input_tokens - r.cache_read - r.cache_write
  return (plain * 0.1 + r.cache_read * 0.01 + r.cache_write * 0.125 + r.output_tokens * 0.5) / 1e6
}

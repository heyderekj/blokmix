// Asking the reader from the board: Claude (Anthropic), through our own server at /api/read, which holds the key, the
// instructions and the schema. The browser sends only {task, text, context}. Every answer is optional: when the reader
// is off, slow or wrong, `askReader` returns null and the caller keeps what keywords and Jev said. A reply is checked
// again here (schema, then every span must be your own words) before anyone uses it.

import { checkRead, READ_CONTEXTS, READ_LIMITS, type ReadContext, type ReadOf, type ReadTask } from '@/core/reader'
import { xsrf } from './http'

export interface ReadRequest {
  task: ReadTask
  text: string
  context?: Record<string, unknown>
}
/** What the server answers: the read, and what it took. */
export interface ReadResponse {
  read: unknown
  usage?: { input_tokens: number; output_tokens: number }
  ms?: number
}

export type ReaderTransport = (req: ReadRequest, signal: AbortSignal) => Promise<ReadResponse>
export type ReaderStatus = () => Promise<boolean>

const httpTransport: ReaderTransport = async (req, signal) => {
  const res = await fetch('/api/read', {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...xsrf() },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`Reading answered ${res.status}`)
  return (await res.json()) as ReadResponse
}

const httpStatus: ReaderStatus = async () => {
  if (typeof fetch === 'undefined' || typeof document === 'undefined') return false
  try {
    const res = await fetch('/api/read/status', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    return res.ok && ((await res.json()) as { on?: boolean }).on === true
  } catch {
    return false
  }
}

let transport: ReaderTransport = httpTransport
let status: ReaderStatus = httpStatus
let available: Promise<boolean> | null = null
/** This device's Suggestions switch (the same one Jev follows), read through a getter so lib/ doesn't import the store. */
let allowed: () => boolean = () => true

/** Tests (and the bench) swap in their own transport; `null` puts the real one back. */
export function setReaderTransport(t: ReaderTransport | null, s?: ReaderStatus | null): void {
  transport = t ?? httpTransport
  status = s ?? (t ? async () => true : httpStatus)
  available = null
  cache.clear()
}

export function setReaderAllowed(get: () => boolean): void {
  allowed = get
}

/** Whether the server has a key, asked once per page load. */
export function readerAvailable(): Promise<boolean> {
  available ??= status()
  return available
}

/** Whether the reader may help right now: the server has a key and this device hasn't turned suggestions off. */
export async function readerOn(): Promise<boolean> {
  return allowed() && (await readerAvailable())
}

const CACHE_SIZE = 50
const cache = new Map<string, unknown>()
function remember(key: string, v: unknown) {
  cache.delete(key)
  cache.set(key, v)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
}

export interface ReadOptions {
  signal?: AbortSignal
  /** Give up after this long and let the caller keep what it has (default 10s). */
  timeoutMs?: number
}

/** What every read took and cost, for the bench and the console (never the words). */
export const readerLog: { task: ReadTask; ms: number; inputTokens: number; outputTokens: number; cached: boolean; ok: boolean }[] = []
const log = (e: (typeof readerLog)[number]) => {
  readerLog.push(e)
  if (readerLog.length > 200) readerLog.shift()
}

/**
 * Read `text` for a task. Null when the reader is off, the text is empty or too long, the context isn't one the board
 * sends, the call is slow or fails, or the reply isn't the schema with every string a span of `text`.
 */
export async function askReader<T extends ReadTask>(task: T, text: string, context?: ReadContext<T>, opts: ReadOptions = {}): Promise<ReadOf<T> | null> {
  if (!text.trim() || text.length > READ_LIMITS.maxChars || opts.signal?.aborted) return null
  if (context && !READ_CONTEXTS[task].safeParse(context).success) return null
  if (!(await readerOn())) return null
  const key = JSON.stringify([task, text, context ?? {}])
  if (cache.has(key)) {
    log({ task, ms: 0, inputTokens: 0, outputTokens: 0, cached: true, ok: true })
    return cache.get(key) as ReadOf<T>
  }
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000)
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    const res = await transport({ task, text, ...(context ? { context } : {}) }, ctrl.signal)
    if (ctrl.signal.aborted) return null
    const read = checkRead(task, res.read, text)
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    log({ task, ms, inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, cached: false, ok: !!read })
    if (read) remember(key, read)
    return read
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/** Thrown by commands that need the reader when the server has no key. */
export const READER_MISSING = 'Reading isn’t available here.'

/** The message for why the reader can't help right now (the Suggestions switch first). */
export async function readerOffMessage(): Promise<string> {
  return !allowed() ? 'Suggestions are off on this device. Turn them on in Blokmix’s menu.' : READER_MISSING
}

// Asking Jev from the board. Every call goes to /api/jev on our own server (Laravel
// when hosted, a dev-only proxy in the Vite app), which holds TypeSafe's key: it never
// reaches the browser. Every answer is optional: when Jev is off, slow or wrong-footed,
// `askJev` returns null and the caller does what Blokmix did before Jev.

import { create } from 'zustand'
import { cacheKey, needsImages, type JevRequest, type JevResponse } from '@/core/jev'
import { xsrf } from './http'

export type JevTransport = (req: JevRequest, signal: AbortSignal) => Promise<JevResponse>
export type JevStatus = () => Promise<boolean>

const httpTransport: JevTransport = async (req, signal) => {
  const res = await fetch('/api/jev', {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...xsrf() },
    body: JSON.stringify({ ...req, model: req.model ?? (needsImages(req) ? 'jev-preview' : 'jev-latest') }),
  })
  if (!res.ok) throw new Error(`/api/jev answered ${res.status}`)
  return (await res.json()) as JevResponse
}

const httpStatus: JevStatus = async () => {
  if (typeof fetch === 'undefined' || typeof document === 'undefined') return false
  try {
    const res = await fetch('/api/jev/status', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    return res.ok && ((await res.json()) as { on?: boolean }).on === true
  } catch {
    return false
  }
}

let transport: JevTransport = httpTransport
let status: JevStatus = httpStatus
let available: Promise<boolean> | null = null
/** This device's switch ("Let Jev help"), read through a getter so lib/ doesn't import the store. */
let allowed: () => boolean = () => true

/** Tests (and the bench) swap in their own transport; `null` puts the real one back. */
export function setJevTransport(t: JevTransport | null, s?: JevStatus | null): void {
  transport = t ?? httpTransport
  status = s ?? (t ? async () => true : httpStatus)
  available = null
  asked = false
  useJevServer.setState({ ready: null })
  cache.clear()
}

export function setJevAllowed(get: () => boolean): void {
  allowed = get
}

/** Whether the server has a key, asked once per page load. */
export function jevAvailable(): Promise<boolean> {
  available ??= status()
  return available
}

/** Whether Jev may help right now: the server has a key and this device hasn't turned it off. */
export async function jevOn(): Promise<boolean> {
  return allowed() && (await jevAvailable())
}

// A small cache: the same question about the same words is answered once.
const CACHE_SIZE = 100
const cache = new Map<string, JevResponse>()

function remember(key: string, res: JevResponse) {
  cache.delete(key)
  cache.set(key, res)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
}

export interface AskOptions {
  signal?: AbortSignal
  /** Give up after this long and let the caller fall back (default 4s; Box and pictures take longer). */
  timeoutMs?: number
}

/** What every call took and cost, for the bench and the console. */
export const jevLog: { ms: number; inputTokens: number; questions: number; cached: boolean }[] = []

/** Ask Jev. Null when it's off, timed out, aborted or failed: the caller falls back. */
export async function askJev(req: JevRequest, opts: AskOptions = {}): Promise<JevResponse | null> {
  if (!(await jevOn())) return null
  const key = cacheKey(req)
  const hit = cache.get(key)
  if (hit) {
    jevLog.push({ ms: 0, inputTokens: 0, questions: Object.keys(req.questions).length, cached: true })
    return hit
  }
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? (needsImages(req) ? 8000 : 4000))
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    const res = await transport(req, ctrl.signal)
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    jevLog.push({ ms, inputTokens: res.usage?.input_tokens ?? 0, questions: Object.keys(req.questions).length, cached: false })
    if (jevLog.length > 200) jevLog.shift()
    remember(key, res)
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * For questions asked as you type: each new call for the same `lane` aborts the last,
 * so only the latest words are ever answered.
 */
const lanes = new Map<string, AbortController>()
export function askLatest(lane: string, req: JevRequest, opts: Omit<AskOptions, 'signal'> = {}): Promise<JevResponse | null> {
  lanes.get(lane)?.abort()
  const ctrl = new AbortController()
  lanes.set(lane, ctrl)
  return askJev(req, { ...opts, signal: ctrl.signal }).then((res) => (ctrl.signal.aborted ? null : res))
}

/** Thrown by commands that need Jev when this device turned suggestions off. */
export const JEV_OFF = 'Suggestions are off on this device. Turn them on in Blokmix’s menu.'
/** Thrown by commands that need Jev when the server has no key. */
export const JEV_MISSING = 'Suggestions aren’t available here.'

/** The message for why Jev can't help right now. */
export async function jevOffMessage(): Promise<string> {
  return (await jevAvailable()) ? JEV_OFF : JEV_MISSING
}

/** Whether the server has a key, for components: null until asked. */
export const useJevServer = create<{ ready: boolean | null }>(() => ({ ready: null }))
let asked = false
/** Ask once and keep the answer in `useJevServer`. */
export function checkJevServer(): void {
  if (asked) return
  asked = true
  void jevAvailable().then((ready) => useJevServer.setState({ ready }))
}

// Jev from Node scripts (the bench, the gap finder): plain HTTP to TypeSafe with the key
// from the shell or .env.local / .env, a few requests at a time, and backoff on 429/529.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { needsImages, type JevRequest, type JevResponse } from '../../resources/js/core/jev'
import { requestProblem } from '../../resources/js/core/jev/limits'

const API = 'https://api.typesafe.ai/v1/systemone'

function keyFromFiles(root: string): string {
  for (const f of ['.env.local', '.env']) {
    const p = join(root, f)
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/^TYPESAFE_API_KEY\s*=\s*"?([^"\n]+)"?\s*$/m)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return ''
}

export function jevKey(root = process.cwd()): string {
  return process.env.TYPESAFE_API_KEY?.trim() || keyFromFiles(root)
}

export interface Timed {
  res: JevResponse | null
  ms: number
  error?: string
}

/** One request, retried with backoff when TypeSafe is busy. */
export async function ask(req: JevRequest, key = jevKey()): Promise<Timed> {
  if (!key) return { res: null, ms: 0, error: 'No TYPESAFE_API_KEY (shell, .env.local or .env)' }
  const body = JSON.stringify({ ...req, model: req.model ?? 'jev-latest' })
  const problem = requestProblem(JSON.parse(body), Buffer.byteLength(body))
  if (problem) return { res: null, ms: 0, error: problem }
  const images = needsImages(req)
  for (let attempt = 0; attempt < 5; attempt++) {
    const t0 = performance.now()
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(images ? { 'TypeSafe-Danger-Zone-Images': 'true' } : {}) },
        body,
        signal: AbortSignal.timeout(images ? 30_000 : 15_000),
      })
      const ms = performance.now() - t0
      if (r.status === 429 || r.status === 529) {
        await new Promise((ok) => setTimeout(ok, 500 * 2 ** attempt))
        continue
      }
      if (!r.ok) return { res: null, ms, error: `${r.status} ${(await r.text()).slice(0, 300)}` }
      return { res: (await r.json()) as JevResponse, ms }
    } catch (e) {
      if (attempt === 4) return { res: null, ms: performance.now() - t0, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { res: null, ms: 0, error: 'TypeSafe stayed busy' }
}

/** Run `fn` over `items`, `n` at a time, keeping their order. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

/** Dollars for some input tokens at Jev's price ($0.042 per million in; output is free). */
export const dollars = (inputTokens: number) => (inputTokens / 1e6) * 0.042

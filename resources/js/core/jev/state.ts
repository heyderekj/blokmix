// Keeping state small and relevant: Jev loses accuracy to unrelated detail, so each
// feature sends only what its questions need, with long words trimmed.

import { hash, stableStringify } from '../hash'
import type { JevRequest } from './types'

/** Words trimmed to `n` characters at a word boundary, with an ellipsis when cut. */
export function clip(s: string, n = 300): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > n * 0.5 ? cut.slice(0, sp) : cut).trimEnd()}…`
}

/** The same request, the same key: what the client caches answers by. Images count by their bytes' hash. */
export function cacheKey(req: JevRequest): string {
  const assets = req.assets ? Object.fromEntries(Object.entries(req.assets).map(([k, a]) => [k, hash(a.data_base64)])) : undefined
  return hash(stableStringify({ ...req, assets }))
}

/** A short, unique, never-in-text reference for an image (per request). */
export const imageRef = (name: string) => `<img:${name}>`

// Counting what people asked for that Blokmix couldn't do: Jev names it from a closed
// list, and only the name goes to the server (never the words), at most once per ask.

import type { SectionType } from '@/core/types'
import { readWants, wantRequest, type WantFeature } from '@/core/jev/wants'
import { askJev } from './jev'
import { xsrf } from './http'

const sent = new Set<string>()

/** Name what these asks wanted and count it. Fire and forget: nothing waits on it, and failures are silent. */
export async function noteWants(texts: string[], feature: WantFeature, sectionType?: SectionType, kind?: string): Promise<string[]> {
  const fresh = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length > 2 && !sent.has(`${feature}:${t}`)))].slice(0, 5)
  if (!fresh.length) return []
  fresh.forEach((t) => sent.add(`${feature}:${t}`))
  const res = await askJev(wantRequest(fresh))
  const wants = readWants(res, fresh.length)
  for (const want of new Set(wants)) {
    void fetch('/api/jev/wants', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...xsrf() },
      body: JSON.stringify({ want, feature, section_type: sectionType ?? null, kind: kind ?? null }),
    }).catch(() => {})
  }
  return wants
}

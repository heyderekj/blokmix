// Words first, on the board: for each section of the open page, what its words hold and the layouts that fit them;
// and (one Jev request per page, cached by its words) which sections read like another kind. Shared by the Words
// panel and the agent commands.

import type { SectionType, Slot } from '@/core/types'
import { itemsOf, layoutsThatFit, readReadsAs, readsAsRequest, type Fit } from '@/core/wordsFit'
import { library, slotClip } from '@/data/library'
import { askJev } from '@/lib/jev'
import { mixClipIds, useStore } from './store'
import { outlineOf, wordsFor } from './commands/refs'
import { capacity } from './jevPage'
import { bestLayoutFor, sectionLines } from './retype'

export interface SectionFit {
  slot: Slot
  items: { count: number; lead: string | null }
  fits: Fit[]
}

/** The layouts that fit each section's words (nav and footer left out: they're the site's). */
export function fitsFor(view: Slot[], only?: string): SectionFit[] {
  const st = useStore.getState()
  const mine = mixClipIds(st)
  return view.flatMap((slot, at) => {
    if (slot.type === 'nav' || slot.type === 'footer' || (only && slot.id !== only)) return []
    const items = itemsOf(slot.type, outlineOf(slot))
    return [{ slot, items, fits: layoutsThatFit(slot, view, at, library, mine, items, capacity) }]
  })
}

const cache = new Map<string, Record<string, { type: SectionType; p: number }>>()

/** Which sections' words read like another kind of section. Null when suggestions are off or didn't answer. */
export async function readsAs(view: Slot[]): Promise<Record<string, { type: SectionType; p: number; clipId: string | null }> | null> {
  const sections = view.filter((s) => s.type !== 'nav' && s.type !== 'footer' && !s.locked).map((s) => ({ id: s.id, type: s.type, lines: sectionLines(s).lines.map((l) => l.text) }))
  const key = JSON.stringify(sections.map((s) => [s.id, s.type, s.lines]))
  let read = cache.get(key)
  if (!read) {
    const req = readsAsRequest(sections)
    if (!Object.keys(req.questions).length) return {}
    const res = await askJev(req, { timeoutMs: 6000 })
    if (!res) return null
    read = readReadsAs(res, sections)
    cache.set(key, read)
  }
  return Object.fromEntries(
    Object.entries(read).map(([id, r]) => {
      const at = view.findIndex((s) => s.id === id)
      return [id, { ...r, clipId: at >= 0 ? bestLayoutFor(r.type, view[at], view, at) : null }]
    }),
  )
}

/** A layout's name, for people. */
export const layoutTitle = (clipId: string) => slotClip({ clipId } as Slot)?.title ?? library.clips[clipId]?.title ?? clipId
export { wordsFor }

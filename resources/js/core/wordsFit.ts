// Words first: what a section's words hold (how many items, of what), which layouts hold that many, and whether the
// words read like another kind of section altogether ("this reads like a menu of 4"). Code counts and orders; Jev only
// says, once per page, what each section's words read as. Pure, so the Words panel and agent commands agree.

import type { Library, SectionType, Slot } from './types'
import { SECTION_TYPES } from './types'
import { cycleIds } from './library'
import { suggestClip } from './suggest'
import type { OutlineNode } from './outline'
import { roleOfField, type Role } from './jev/pour'
import { choice } from './jev/ask'
import { clip as clipText } from './jev/state'
import { merged, shuffled } from './jev/shuffle'
import { TYPE_OPTIONS } from './jev/pageFromWords'
import type { JevRequest, JevResponse } from './jev/types'

export const READS_AS = {
  /** Shown when the words read as another type at this (both orders agreeing). */
  type: 0.55,
}

/** The roles that open an item: a list of these is a list of things (plans, questions, people). */
const OPENS: Role[] = ['title', 'question', 'quote', 'name', 'stat', 'price']

/** How many items a section's main list holds (its longest), and what each item leads with. */
export function itemsOf(type: SectionType, nodes: OutlineNode[]): { count: number; lead: Role | null } {
  let best: { count: number; lead: Role | null } = { count: 0, lead: null }
  const walk = (ns: OutlineNode[]) => {
    for (const n of ns) {
      if (n.t !== 'list') continue
      const first = n.items[0]?.nodes.find((x) => x.t === 'field')
      const lead = first && first.t === 'field' ? roleOfField(type, first.field, first.key) : null
      if (n.items.length > best.count) best = { count: n.items.length, lead: lead && OPENS.includes(lead) ? lead : lead }
      for (const it of n.items) walk(it.nodes)
    }
  }
  walk(nodes)
  return best
}

export interface Fit {
  clipId: string
  /** How many of the main items it holds. */
  holds: number
  current: boolean
  builtIn: boolean
}

/**
 * Layouts of this section's type that hold its items, best first: the order suggestions use (contrast with the
 * neighbours), built-in layouts first, the current one always in. `n` at most.
 */
export function layoutsThatFit(
  slot: Pick<Slot, 'type' | 'clipId'>,
  view: Slot[],
  at: number,
  lib: Library,
  mixClips: Iterable<string>,
  items: { count: number; lead: Role | null },
  capacity: (clipId: string, lead: Role | null) => number,
  n = 4,
): Fit[] {
  const pool = cycleIds(lib, slot.type, mixClips, slot.clipId)
  const ranked = suggestClip(slot.type, view, at, lib, true, pool).map((x) => x.clipId)
  const order = [...ranked, ...pool.filter((id) => !ranked.includes(id))]
  const builtInFirst = [...order.filter((id) => lib.clips[id]?.origin === 'layout'), ...order.filter((id) => lib.clips[id]?.origin !== 'layout')]
  const fits = builtInFirst
    .map((clipId) => ({ clipId, holds: capacity(clipId, items.lead), current: clipId === slot.clipId, builtIn: lib.clips[clipId]?.origin === 'layout' }))
    .filter((f) => f.current || !items.count || f.holds >= items.count)
  const current = fits.find((f) => f.current)
  const others = fits.filter((f) => !f.current).slice(0, current ? n - 1 : n)
  return current ? [current, ...others] : others
}

/** The section types a run of words can read as (no nav or footer: those are the site's). */
const PLACEABLE = SECTION_TYPES.filter((t) => t !== 'nav' && t !== 'footer')

/** One request for a page: what each section's words read as (both orders, to cancel the first option's lean). */
export function readsAsRequest(sections: { id: string; lines: string[] }[]): JevRequest {
  const questions: JevRequest['questions'] = {}
  const options = Object.fromEntries(Object.entries(TYPE_OPTIONS).filter(([k]) => k !== 'skip'))
  for (const s of sections) {
    const lines = s.lines.filter((l) => l.trim()).slice(0, 24).map((l) => clipText(l, 200))
    if (lines.length < 2) continue
    Object.assign(questions, shuffled(`as_${s.id}`, choice({ question: 'What kind of website section should these lines become?', lines }, options)))
  }
  return { state: { sections: sections.length }, questions }
}

/** Sections whose words read as another type, sure enough to say so. */
export function readReadsAs(res: JevResponse | null, sections: { id: string; type: SectionType }[]): Record<string, { type: SectionType; p: number }> {
  const out: Record<string, { type: SectionType; p: number }> = {}
  for (const s of sections) {
    const m = merged(res, `as_${s.id}`)
    if (!m || !m.agree) continue
    const p = m.probabilities[m.choice] ?? 0
    if (p >= READS_AS.type && m.choice !== s.type && (PLACEABLE as readonly string[]).includes(m.choice) && !(s.type === 'hero' && m.choice === 'header')) out[s.id] = { type: m.choice as SectionType, p }
  }
  return out
}

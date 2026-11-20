// A read of the start, folded into what the start already knows. The order of trust: keywords show at once, Jev
// refines them, the reader lands last and wins over both, and whatever you picked yourself wins over everything. Where
// the reader said nothing, what was there stays. Pure: the start screen, `read_start` and the tests share it.

import { BUSINESSES, FEELS, GOALS as ACTIONS, SHOWS, fillStart, type Pick, type Picks } from '../jev/sentence'
import { SENTENCE_FEEL, type FeelWord } from '../feel'
import { kindOf, type Brief } from '../brief'
import type { Kind, SectionType } from '../types'
import type { PageTemplate } from '../site'
import type { ReadStart } from './schema'

/** The start's blanks the reader can fill (START_BLANKS ids). */
export const READ_BLANKS = ['business', 'name', 'feel', 'goal', 'show'] as const
export type ReadBlank = (typeof READ_BLANKS)[number]

export interface ExtraPage {
  template: PageTemplate
  /** What it's for, in your words. */
  purpose: string | null
}

export interface MergedRead {
  picks: Picks
  /** The brief as the read says it (only what it said). */
  brief: Partial<Brief>
  kind: Kind | null
  /** Home's sections: the kind's page plus what you said to show and the goal needs, less what you said to leave out. */
  sections: SectionType[] | null
  /** Feel words to steer away from, and your own words for them. */
  avoid: FeelWord[]
  avoidWords: string[]
  pages: ExtraPage[]
  tone: 'light' | 'dark' | null
  /** Your words it couldn't place anywhere. */
  unsure: string[]
  /** Blanks the read filled, for "From what you wrote". */
  from: ReadBlank[]
}

/**
 * A name as a name: "We're Fern" is Fern. Drops the words people say before a name ("we're", "this is", "welcome to")
 * and quotes or a trailing stop, so what's left is still a span of what you wrote.
 */
export function bareName(name: string): string {
  const lead = /^(?:(?:hi|hello|hey)[,!]?\s+)?(?:we['’]re|we\s+are|i['’]m|i\s+am|this\s+is|it['’]s|it\s+is|meet|welcome\s+to|introducing|my\s+name\s+is|our\s+name\s+is)\s+/i
  const bare = name.trim().replace(lead, '').replace(/^[“"'‘]+|[”"'’.,;:!?]+$/g, '').trim()
  return bare || name.trim()
}

const label = <T extends { id: string; label: string }>(list: T[], id: string) => list.find((x) => x.id === id)?.label ?? id

/** The read as the sentence's picks, blank by blank (a blank it said nothing about is left out). */
export function readPicks(read: ReadStart): Partial<Record<ReadBlank, Pick[]>> {
  const out: Partial<Record<ReadBlank, Pick[]>> = {}
  const b = read.business
  if (b.id) out.business = [{ id: b.id, words: b.words ?? label(BUSINESSES, b.id) }]
  else if (b.words) out.business = [{ words: b.words }]
  const name = read.name ? bareName(read.name) : ''
  if (name) out.name = [{ words: name }]
  const f = read.feel.ids[0]
  if (f) out.feel = [{ id: f, words: read.feel.words[0] ?? label(FEELS, f) }]
  else if (read.feel.words[0]) out.feel = [{ words: read.feel.words[0] }]
  const a = read.action
  if (a.id) out.goal = [{ id: a.id, words: a.words ?? label(ACTIONS, a.id) }]
  else if (a.words) out.goal = [{ words: a.words }]
  const show = [...new Set(read.show)].filter((id) => !read.hide.includes(id))
  if (show.length) out.show = show.map((id) => ({ id, words: label(SHOWS, id) }))
  return out
}

/** The brief as the read says it: only the parts it said. */
export function readBrief(read: ReadStart): Partial<Brief> {
  const feel = [...new Set(read.feel.ids.flatMap((id) => (SENTENCE_FEEL[id] ? [SENTENCE_FEEL[id]] : [])))]
  const button = read.action.words ?? (read.action.id ? ACTIONS.find((x) => x.id === read.action.id)?.button : undefined)
  return {
    ...(read.format ? { format: read.format } : {}),
    ...(read.industry ? { industry: read.industry } : {}),
    ...(read.goals.length ? { goals: [...new Set(read.goals)].slice(0, 3) } : {}),
    ...(read.who ? { who: read.who } : {}),
    ...(read.business.words ? { what: read.business.words } : {}),
    ...(button ? { mainAction: button, mainActionTyped: !!read.action.words } : {}),
    ...(feel.length ? { feel } : {}),
  }
}

/**
 * The start after a read: the reader's blanks over `picks` (keywords' and Jev's), except the blanks in `mine`, which
 * you picked yourself and stay as they are. A null read changes nothing.
 */
export function mergeRead(picks: Picks, read: ReadStart | null, mine: readonly string[] = []): MergedRead {
  const merged: Picks = { ...picks }
  const from: ReadBlank[] = []
  const said = read ? readPicks(read) : {}
  for (const id of READ_BLANKS) {
    const p = said[id]
    if (!p || mine.includes(id)) continue
    merged[id] = p
    from.push(id)
  }
  const fill = fillStart(merged)
  const brief = read ? readBrief(read) : {}
  const hidden = new Set(read ? SHOWS.filter((s) => read.hide.includes(s.id) && s.section).map((s) => s.section!) : [])
  const kept = new Set((merged.show ?? []).flatMap((p) => SHOWS.find((s) => s.id === p.id)?.section ?? []))
  const kind = fill.kind ?? read?.kind ?? (brief.format ? kindOf(brief as Brief) : null)
  const avoid = read ? [...new Set(read.feel.avoid.flatMap((id) => (SENTENCE_FEEL[id] ? [SENTENCE_FEEL[id]] : [])))] : []
  return {
    picks: merged,
    brief,
    kind,
    sections: fill.sections?.filter((t) => !hidden.has(t) || kept.has(t)) ?? null,
    avoid,
    avoidWords: read?.feel.avoid_words ?? [],
    pages: read ? dedupePages(read.pages) : [],
    tone: read?.tone ?? null,
    unsure: read?.unsure ?? [],
    from,
  }
}

/** One of each page (blank pages stay apart when their purposes differ). */
function dedupePages(pages: ReadStart['pages']): ExtraPage[] {
  const seen = new Set<string>()
  const out: ExtraPage[] = []
  for (const p of pages) {
    const key = p.template === 'blank' ? `blank:${p.purpose ?? ''}` : p.template
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ template: p.template as PageTemplate, purpose: p.purpose })
  }
  return out.slice(0, 8)
}

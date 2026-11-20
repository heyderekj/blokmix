// The guided start as one screen: a sentence with blanks, chip rows for what it understood, and the real page beside
// them. Every answer can be changed where it sits; a read of your own words (the reader, else keywords) fills every
// blank it can, but never one you set yourself. Then a look, then three ways to lay it out (until those become one row
// of versions). Pure, so the screen, the agent commands and the tests share it.

import { briefFeel, briefFromKind, FORMAT_LABEL, GOAL_LABEL, guessBrief, kindOf, patchBrief, type Brief, type Format, type Goal, type Industry } from './brief'
import { FEELS, fillStart, SHOWS, type Pick, type Picks, type StartFill } from './jev/sentence'
import { placeSection } from './jev/describe'
import { SENTENCE_FEEL, KIND_FEEL, type FeelWord } from './feel'
import { mergeRead, readPicks, type ExtraPage, type ReadBlank } from './reader/start'
import type { ReadStart } from './reader/schema'
import { recipeFor, RECIPES } from './start'
import { TYPE_LABEL } from './content'
import type { Kind, SectionType } from './types'

/** What was read from your pasted copy (or Jev's read of a description). */
export interface HeardBrief {
  mode: 'describe' | 'paste'
  /** Read by Jev (false: keywords only). */
  jev: boolean
  format: Format | null
  formats: Format[]
  industry: Industry | null
  industries: Industry[]
  /** Goals sure enough to tick for you. */
  goals: Goal[]
  /** The kind of site, when sure. */
  kind: Kind | null
  /** Home's sections: the kind's page as the description changes it, or the page your words make. */
  sections: SectionType[]
  /** How likely each optional section is wanted (descriptions). */
  want: Partial<Record<SectionType, number>>
  /** Looks (skin ids) that fit, best first. */
  looks: string[]
}

export type StartStep = 'describe' | 'versions'

export interface StartState {
  step: StartStep
  /** The sentence's blanks. */
  picks: Picks
  /** Blanks you filled or changed yourself: a read never overwrites them. */
  mine: string[]
  /** Blanks a read of your words filled ("From what you wrote"). */
  from: string[]
  /** What reads of your words said about the brief (under your own changes), and the kind of site they heard. */
  read: Partial<Brief>
  readKind: Kind | null
  /** Your changes from the chip rows, on top of everything else. */
  brief: Brief
  /** Home's sections after your ✕ and +; null keeps what the sentence and the brief make. */
  sections: SectionType[] | null
  /** Sections a read said to leave out. */
  hide: SectionType[]
  /** Feel words from the look step; empty keeps the sentence's. */
  feel: FeelWord[]
  /** Feelings to steer away from, and how you said them. */
  avoid: FeelWord[]
  avoidWords: string[]
  /** Pages besides home a read heard you ask for (made in the next PR's versions). */
  pages: ExtraPage[]
  tone: 'light' | 'dark' | null
  /** Your pasted copy, read: its page decides the sections. */
  copy: HeardBrief | null
  /** Started from a saved style guide: there's no look to pick. */
  fixedGuide?: boolean
}

export const emptyStart = (): StartState => ({ step: 'describe', picks: {}, mine: [], from: [], read: {}, readKind: null, brief: {}, sections: null, hide: [], feel: [], avoid: [], avoidWords: [], pages: [], tone: null, copy: null })

/** What the start says so far, worked out once for the screen. */
export interface StartView {
  fill: StartFill
  heard: HeardBrief | null
  name: string
  brief: Brief
  kind: Kind
  sections: SectionType[]
  feel: FeelWord[]
}

/** The sentence's own answers as a brief: the goal's button and goal, and the feelings of its feel blank. */
function sentenceBrief(fill: StartFill, picks: Picks): Brief {
  const goal = picks.goal?.[0]
  const typed = !!goal && !goal.id && !!goal.words.trim()
  // Every goal said, in order, at most three (like a read's).
  const goals = [...new Set((picks.goal ?? []).flatMap((p) => (p.id && SENTENCE_GOAL[p.id] ? [SENTENCE_GOAL[p.id]] : [])))].slice(0, 3)
  const feel = [...new Set((picks.feel ?? []).flatMap((p) => (p.id && SENTENCE_FEEL[p.id] ? [SENTENCE_FEEL[p.id]] : [])))]
  return patchBrief({}, {
    ...(fill.button ? { mainAction: fill.button, mainActionTyped: typed } : {}),
    ...(goals.length ? { goals } : {}),
    ...(feel.length ? { feel } : {}),
  })
}

/** What the brief reads as: keywords and the copy at the bottom, then the sentence, then reads of your words, then yours. */
export function briefFrom(s: StartState, fill = fillStart(s.picks)): Brief {
  const heard = heardOf(s, fill)
  const fromHeard: Brief = heard
    ? { ...(heard.format ? { format: heard.format } : {}), ...(heard.industry ? { industry: heard.industry } : {}), ...(heard.goals.length ? { goals: heard.goals } : {}) }
    : fill.text.trim()
      ? (({ sure: _, what: __, ...g }) => g)(guessBrief(fill.text))
      : {}
  const what = fill.text.trim() && fill.text.trim().length <= 600 ? { what: fill.text.trim() } : {}
  // Your own words for the feel (not an option's label), kept as said.
  const feelWords = (s.picks.feel ?? []).filter((p) => !p.id || FEELS.find((f) => f.id === p.id)?.label.toLowerCase() !== p.words.trim().toLowerCase()).map((p) => p.words.trim()).filter(Boolean)
  const read = patchBrief(patchBrief({ ...fromHeard, ...what }, sentenceBrief(fill, s.picks)), s.read)
  // A business you picked says what kind of site it is: a keyword elsewhere ("a podcast" in what to show) never turns a
  // bakery into a blog. Only the format gives way, and only when it would say another kind.
  const base = fill.kind && kindOf(read, fill.kind) !== fill.kind ? patchBrief(read, { format: briefFromKind(fill.kind).format }) : read
  return patchBrief(base, {
    ...(s.feel.length ? { feel: s.feel } : {}),
    ...(feelWords.length ? { feelWords } : {}),
    ...(s.avoid.length ? { avoid: s.avoid } : {}),
    ...s.brief,
  })
}

const heardOf = (s: StartState, fill: StartFill) => s.copy ?? heardFromSentence(fill, s.picks)

/** The kind of site it adds up to. */
export const kindFrom = (s: StartState, fill = fillStart(s.picks)): Kind => kindOf(briefFrom(s, fill), heardOf(s, fill)?.kind ?? s.readKind ?? 'studio')

/** Home's sections: yours, else your copy's page, else what you said to show, else the recipe for the brief. */
export function sectionsFrom(s: StartState, fill = fillStart(s.picks)): SectionType[] {
  if (s.sections) return s.sections
  const heard = heardOf(s, fill)
  if (heard?.mode === 'paste') return heard.sections
  // The recipe for the brief, with what you asked to show placed where it belongs.
  let page = recipeFor(briefFrom(s, fill), kindFrom(s, fill), heard?.want)
  for (const p of s.picks.show ?? []) {
    const t = SHOWS.find((x) => x.id === p.id)?.section
    if (t) page = placeSection(page, t)
  }
  return page.filter((t) => !s.hide.includes(t))
}

/** How it should feel to start with: yours, else what the industry and kind suggest. */
export function feelFrom(s: StartState, fill = fillStart(s.picks)): FeelWord[] {
  const b = briefFrom(s, fill)
  if (b.feel?.length) return b.feel
  return [...new Set([...briefFeel(b), ...KIND_FEEL[kindFrom(s, fill)]])].slice(0, 2)
}

/** Everything the screen needs from the state, in one pass. */
export function startView(s: StartState): StartView {
  const fill = fillStart(s.picks)
  return {
    fill,
    heard: heardOf(s, fill),
    name: fill.name.trim(),
    brief: briefFrom(s, fill),
    kind: kindFrom(s, fill),
    sections: sectionsFrom(s, fill),
    feel: feelFrom(s, fill),
  }
}

/** You set a blank yourself: a read leaves it alone from now on. */
export function setPicks(s: StartState, picks: Picks): StartState {
  const changed = Object.keys({ ...s.picks, ...picks }).filter((id) => JSON.stringify(s.picks[id] ?? []) !== JSON.stringify(picks[id] ?? []))
  if (!changed.length) return s
  return { ...s, picks, mine: [...new Set([...s.mine, ...changed])], from: s.from.filter((id) => !changed.includes(id)) }
}

/** Patch the brief from the chip rows. */
export const setBrief = (s: StartState, patch: Partial<Brief>): StartState => ({ ...s, brief: patchBrief(s.brief, patch) })

/**
 * A read of your words, folded in: it fills every blank it can, except blanks you set yourself and blanks you changed
 * since the read was asked for (`asked` is the sentence as it was then). When the words came from one blank (`own`),
 * that blank keeps them exactly, counted as the option the read heard. A paragraph written into a blank
 * (`own.paragraph`) says more than its blank: the blank takes what the read heard for it, and keeps the paragraph
 * only when the read said nothing about it.
 */
export function applyRead(s: StartState, read: ReadStart | null, asked: Picks = s.picks, own?: { blank: string; words: string; paragraph?: boolean }): StartState {
  if (!read) return s
  const holdsOwn = (id: string) => !!own && id === own.blank && (s.picks[id] ?? []).some((p) => p.words === own.words)
  const since = Object.keys({ ...asked, ...s.picks }).filter((id) => JSON.stringify(asked[id] ?? []) !== JSON.stringify(s.picks[id] ?? []) && !(own?.paragraph && holdsOwn(id)))
  const keep = [...new Set([...s.mine.filter((id) => id !== own?.blank), ...since])]
  const m = mergeRead(s.picks, read, keep)
  let picks = m.picks
  // A paragraph the read heard something in for its blank gives way to that; else it stays, as your words.
  const gaveWay = !!own?.paragraph && m.from.includes(own.blank as ReadBlank)
  if (own?.paragraph && !gaveWay) picks = { ...picks, [own.blank]: s.picks[own.blank] ?? [{ words: own.words }] }
  const heardOwn = !!own && !own.paragraph && !since.includes(own.blank) && !!readPicks(read)[own.blank as ReadBlank]?.some((p) => p.id)
  if (own && !own.paragraph && !since.includes(own.blank)) {
    const heardHere = readPicks(read)[own.blank as ReadBlank]
    const mine: Pick = { words: own.words, ...(heardHere?.[0]?.id ? { id: heardHere[0].id } : {}) }
    const others = (s.picks[own.blank] ?? []).filter((p) => p.words !== own.words)
    // What else the read heard here joins your words, never twice ("menu" from your words and from the read).
    const more = (heardHere ?? []).filter((p) => p.id !== mine.id && !others.some((o) => o.id === p.id))
    picks = { ...picks, [own.blank]: own.blank === 'show' ? [...others, mine, ...more] : [mine] }
  }
  const hide = SHOWS.filter((x) => read.hide.includes(x.id) && x.section).map((x) => x.section!)
  return {
    ...s,
    picks,
    mine: gaveWay ? s.mine.filter((id) => id !== own!.blank) : own ? [...new Set([...s.mine, own.blank])] : s.mine,
    from: [...new Set([...s.from, ...m.from, ...(heardOwn ? [own!.blank] : [])])],
    read: patchBrief(s.read, m.brief),
    readKind: m.kind ?? s.readKind,
    hide: [...new Set([...s.hide, ...hide])],
    avoid: [...new Set([...s.avoid, ...m.avoid])],
    avoidWords: [...new Set([...s.avoidWords, ...m.avoidWords])],
    pages: m.pages.length ? m.pages : s.pages,
    ...(m.pages.length ? { from: [...new Set([...s.from, ...m.from, ...(heardOwn ? [own!.blank] : []), 'pages'])] } : {}),
    tone: m.tone ?? s.tone,
  }
}

/** Stop steering away from a feeling. */
export const dropAvoid = (s: StartState, word: string): StartState => ({ ...s, avoidWords: s.avoidWords.filter((w) => w !== word), avoid: s.avoidWords.length <= 1 ? [] : s.avoid })

const lower = (t: string) => t.replace(/^./, (c) => c.toLowerCase())
const listOf = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''))

/** Why a section is on the page, in a few words: the goal or the thing you asked to show that put it there. */
function becauseOf(t: SectionType, v: StartView, picks: Picks): string | null {
  const show = (picks.show ?? []).find((p) => SHOWS.find((x) => x.id === p.id)?.section === t)
  if (show) return `you asked for ${show.words.trim()}`
  const goal = (v.brief.goals ?? []).find((g) => GOAL_SECTION_WORDS[g]?.includes(t))
  if (goal) return `you want to ${lower(GOAL_LABEL[goal])}`
  return null
}

const GOAL_SECTION_WORDS: Partial<Record<Goal, SectionType[]>> = {
  orders: ['pricing', 'contact', 'faq'],
  bookings: ['contact', 'faq'],
  sell: ['pricing', 'features'],
  signups: ['pricing', 'features', 'faq'],
  waitlist: ['cta', 'features'],
  tickets: ['pricing', 'team', 'faq'],
  subscribers: ['blog', 'cta'],
  showWork: ['gallery'],
  hire: ['gallery', 'contact', 'stats'],
  visit: ['contact', 'gallery'],
  calls: ['contact', 'testimonials'],
  donate: ['stats', 'cta'],
}

/**
 * What changed on the page and why, in a line or two from fixed templates ("Added Prices: you take orders."). `look`
 * is the theme's name before and after. Nothing here is written by a model.
 */
export function becauseLines(prev: StartView | null, next: StartView, picks: Picks, look?: { prev?: string; next?: string }): string[] {
  if (!prev) return []
  const out: string[] = []
  const later: string[] = []
  const added = next.sections.filter((t) => !prev.sections.includes(t))
  const gone = prev.sections.filter((t) => !next.sections.includes(t))
  for (const t of added) {
    const why = becauseOf(t, next, picks)
    out.push(`Added ${TYPE_LABEL[t]}${why ? `: ${why}` : ''}.`)
  }
  for (const w of next.fill.wants.filter((w) => !prev.fill.wants.includes(w))) out.push(`No ${w.replace(/^(an?|the|our)\s+/i, '')} section yet. Noted.`)
  if (gone.length) later.push(`Took out ${listOf(gone.map((t) => TYPE_LABEL[t]))}.`)
  if (next.brief.format && next.brief.format !== prev.brief.format) later.push(`Laid out as ${lower(FORMAT_LABEL[next.brief.format])}.`)
  if (next.brief.mainAction && next.brief.mainAction !== prev.brief.mainAction) later.push(`The main button says “${next.brief.mainAction}”.`)
  if (look?.next && look.next !== look.prev) {
    // Your own words say it best (they already hold any "not"); else the feel words and what to steer away from.
    const own = next.brief.feelWords?.length ? next.brief.feelWords.join(', ') : ''
    const feel = own || `${listOf(next.feel)}${next.brief.avoid?.length ? `, not ${listOf(next.brief.avoid)}` : ''}`
    later.push(`${look.next}${feel ? ` feels ${feel}` : ''}.`)
  }
  return [...out, ...later].slice(0, 2)
}

/** The section a change is about, so the page can scroll to it. */
export const changedSection = (prev: StartView | null, next: StartView): SectionType | null => (prev ? (next.sections.find((t) => !prev.sections.includes(t)) ?? null) : null)

// ---- The start sentence ("I'm making a site for [a bakery] called [Fern & Co]…") as answers ----

/** The sentence's goals (core/jev/sentence.ts) as the brief's. */
export const SENTENCE_GOAL: Record<string, Goal> = {
  order: 'orders',
  'book-table': 'bookings',
  book: 'bookings',
  visit: 'visit',
  call: 'calls',
  touch: 'calls',
  quote: 'calls',
  hire: 'hire',
  work: 'showWork',
  'sign-up': 'signups',
  try: 'signups',
  buy: 'sell',
  download: 'signups',
  waitlist: 'waitlist',
  tickets: 'tickets',
  rsvp: 'tickets',
  subscribe: 'subscribers',
  read: 'subscribers',
  donate: 'donate',
  listen: 'subscribers',
}

/** What the sentence says, read like a description: certain where a blank came from Blokmix's own lists. */
export function heardFromSentence(fill: StartFill, picks: Picks): HeardBrief | null {
  if (!fill.kind && !fill.text.trim()) return null
  const guess = guessBrief(fill.text)
  const byKind = briefFromKind(fill.kind ?? undefined)
  const goalId = picks.goal?.[0]?.id
  const goals = goalId && SENTENCE_GOAL[goalId] ? [SENTENCE_GOAL[goalId]] : (guess.goals ?? [])
  const format = guess.format ?? byKind.format ?? null
  const industry = guess.industry ?? byKind.industry ?? null
  return {
    mode: 'describe',
    jev: true,
    kind: fill.kind,
    format,
    formats: format ? [format] : [],
    industry,
    industries: industry ? [industry] : [],
    goals,
    sections: fill.sections ?? (fill.kind ? RECIPES[fill.kind].home : []),
    want: {},
    looks: fill.looks,
  }
}


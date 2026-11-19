// What this site's owner has shown they want, kept so every later row of suggestions leans their way: reactions to
// what was shown ("More like this", "Not this"), the direction they gave in words, what they actually did (the
// theme they kept, the part they swapped, what they passed on), and notes from agents and reviewers. Stored with the
// site's words (`content.taste`), shared by every draft, saved and undone like them. Context, never copy. Pure.

import type { Brief } from './brief'
import { groupOf, isTrait, TRAIT_GROUPS, TRAIT_WORD, type Trait } from './traits'

export const TASTE_KINDS = ['more', 'less', 'picked', 'passed', 'kept', 'swapped', 'dropped', 'note'] as const
export type TasteKind = (typeof TASTE_KINDS)[number]
export type TasteSource = 'you' | 'agent' | 'reviewer'

export interface TasteEvent {
  kind: TasteKind
  traits: Trait[]
  source: TasteSource
  at: number
  /** What it was about: a direction's id, a theme's id. Passed ones stay out of the next row. */
  ref?: string
  /** A note's lean: toward (1) or away (-1). */
  sign?: 1 | -1
}

export interface Taste {
  /** Their direction, as they wrote it (the last time they did). */
  words?: string
  events: TasteEvent[]
}

/** How many events a site keeps; the oldest go first. */
export const TASTE_CAP = 60

/** How far each kind of event moves a trait. Saying it outright counts most; what you passed on, least. */
export const TASTE_WEIGHT: Record<TasteKind, number> = { more: 3, less: -3, picked: 2, passed: -0.5, kept: 1, swapped: 1, dropped: -0.5, note: 2 }
/** Others' notes count less than your own reactions. */
const SOURCE_WEIGHT: Record<TasteSource, number> = { you: 1, agent: 0.5, reviewer: 0.75 }
/** An event this many events old counts half. */
const HALF_LIFE = 20
/** A feel word saved in the brief counts as a standing lean this strong. */
const BRIEF_LEAN = 2

export const emptyTaste = (): Taste => ({ events: [] })

/** A taste read from anywhere (the server, a mix file, an agent): unknown kinds and traits drop. */
export function cleanTaste(raw: unknown): Taste | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<Taste>
  const events = (Array.isArray(r.events) ? r.events : [])
    .filter((e): e is TasteEvent => !!e && (TASTE_KINDS as readonly string[]).includes(e.kind) && Array.isArray(e.traits))
    .map((e) => ({ ...e, traits: e.traits.filter(isTrait), source: e.source === 'agent' || e.source === 'reviewer' ? e.source : 'you', at: Number(e.at) || 0 }) as TasteEvent)
    .filter((e) => e.traits.length || e.ref)
    .slice(-TASTE_CAP)
  const words = typeof r.words === 'string' && r.words.trim() ? r.words.trim().slice(0, 300) : undefined
  return events.length || words ? { ...(words ? { words } : {}), events } : undefined
}

/** One more thing they showed: added at the end, the oldest dropped past the cap. */
export function noteTaste(taste: Taste | undefined, ...events: Omit<TasteEvent, 'at'>[]): Taste {
  const now = Date.now()
  const add = events.filter((e) => e.traits.length || e.ref).map((e) => ({ ...e, at: now }))
  const prev = taste ?? emptyTaste()
  return { ...prev, events: [...prev.events, ...add].slice(-TASTE_CAP) }
}

/** Stop leaning on one trait: it comes out of every event (an event with nothing left goes). */
export function dropLean(taste: Taste | undefined, trait: Trait): Taste {
  const prev = taste ?? emptyTaste()
  return { ...prev, events: prev.events.map((e) => ({ ...e, traits: e.traits.filter((t) => t !== trait) })).filter((e) => e.traits.length || e.ref) }
}

/** How much each trait is wanted (positive) or not (negative), newest events counting most. */
export function leanOf(taste: Taste | undefined, brief?: Pick<Brief, 'feel'>): Partial<Record<Trait, number>> {
  const lean: Partial<Record<Trait, number>> = {}
  const add = (t: Trait, v: number) => (lean[t] = (lean[t] ?? 0) + v)
  for (const w of brief?.feel ?? []) if (isTrait(w)) add(w, BRIEF_LEAN)
  const events = taste?.events ?? []
  events.forEach((e, i) => {
    const age = events.length - 1 - i
    const w = TASTE_WEIGHT[e.kind] * SOURCE_WEIGHT[e.source] * Math.pow(0.5, age / HALF_LIFE) * (e.kind === 'note' ? (e.sign ?? 1) : 1)
    for (const t of e.traits) add(t, w)
  })
  for (const k of Object.keys(lean) as Trait[]) lean[k] = Math.round(lean[k]! * 100) / 100
  return lean
}

/** The ids they passed on or said no to lately, so the next row doesn't show them again. */
export function passedRefs(taste: Taste | undefined, recent = 12): string[] {
  return [...new Set((taste?.events ?? []).slice(-recent).filter((e) => e.ref && (e.kind === 'passed' || e.kind === 'less')).map((e) => e.ref!))]
}

/** The strongest leans each way, for the line above a row: "Leaning warm, serif headings. Less: dark." */
export function topLeans(lean: Partial<Record<Trait, number>>, n = 4): { more: Trait[]; less: Trait[] } {
  const all = (Object.entries(lean) as [Trait, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  return { more: all.filter(([, v]) => v >= 1).slice(0, n).map(([t]) => t), less: all.filter(([, v]) => v <= -1).slice(0, 3).map(([t]) => t) }
}

export function tasteWords(lean: Partial<Record<Trait, number>>): string {
  const { more, less } = topLeans(lean)
  const list = (ts: Trait[]) => ts.map((t) => TRAIT_WORD[t]).join(', ')
  return [more.length && `Leaning ${list(more)}.`, less.length && `Less ${list(less)}.`].filter(Boolean).join(' ')
}

// ── Words to traits ───────────────────────────────────────────────────────────────────────────────────────────────
// A closed table first: the words people use for a look, each to the traits it means. Suggestions (core/jev/taste.ts)
// read what the table can't.

const WORDS: [RegExp, Trait[]][] = [
  [/\b(warm|cozy|cosy|friendly|homey|welcoming|inviting|handmade)\b/, ['warm']],
  [/\b(calm|quiet|gentle|peaceful|soothing|zen)\b/, ['calm']],
  [/\b(bold|loud|punchy|striking|confident|brutal(ist)?)\b/, ['bold']],
  [/\b(playful|fun|cheerful|quirky|whimsical|cute)\b/, ['playful']],
  [/\b(serious|corporate|professional|trustworthy|formal|official|businesslike)\b/, ['serious']],
  [/\b(classic|elegant|timeless|refined|premium|luxur(y|ious)|upscale|traditional)\b/, ['classic']],
  [/\b(modern|clean|sleek|contemporary|fresh|techy|techie)\b/, ['modern']],
  [/\b(dark|moody|night|nocturnal|black)\b/, ['dark']],
  [/\b(light|bright and airy|white)\b/, ['light']],
  [/\b(serif|editorial|magazine|bookish|literary|newspaper)\b/, ['serif']],
  [/\b(sans|geometric|grotesk|swiss)\b/, ['sans']],
  [/\b(mono(space)?|code|terminal|nerdy|hacker)\b/, ['mono']],
  [/\b(handwritten|hand-?drawn|script|scrappy)\b/, ['script']],
  [/\b(round(ed)?|soft|bubbly|pill)\b/, ['round']],
  [/\b(square|sharp|angular|boxy|crisp)\b/, ['square']],
  [/\b(colou?rful|vivid|vibrant|saturated|bright colou?rs?|neon|pop)\b/, ['vivid']],
  [/\b(muted|subtle|earthy|neutral|understated|pastel|toned down)\b/, ['muted']],
  [/\b(roomy|spacious|airy|minimal|breathing room|whitespace)\b/, ['airy']],
  [/\b(dense|compact|packed|busy|tight)\b/, ['dense']],
  [/\b(photo(s|graphic)?|pictures?|images?|visual|imagery)\b/, ['picture-led']],
  [/\b(typographic|type-?led|text-?heavy|wordy|big type)\b/, ['type-led']],
  [/\b(still|static|calm motion|no (animation|motion))\b/, ['still']],
  [/\b(animated|motion|moving|lively|dynamic)\b/, ['lively']],
  [/\b(weird|odd|strange|experimental|unusual|edgy|unexpected|out there)\b/, ['odd']],
  [/\b(safe|simple|plain|conventional|standard)\b/, ['plain']],
]
const AWAY = /\b(not|no|less|without|never|avoid|too|nothing|isn'?t|don'?t|stop)\b/

/** What their words lean toward and away from, from the table. "Warmer, not corporate" → more warm, less serious. */
export function traitsFromWords(text: string): { more: Trait[]; less: Trait[] } {
  const more = new Set<Trait>()
  const less = new Set<Trait>()
  // Each clause gets one direction: "not too dark, but bold" is less dark, more bold.
  for (const clause of text.toLowerCase().split(/[,.;!?\n]|\bbut\b|\band\b|\bwith\b/)) {
    const away = AWAY.test(clause)
    // "Warmer", "darker", "boldest" say the same as their plain word.
    const plain = clause.replace(/\b(\w{3,}?)(?:er|est)\b/g, '$1')
    for (const [re, traits] of WORDS) if (re.test(clause) || re.test(plain)) for (const t of traits) (away ? less : more).add(t)
  }
  // Within one group, saying one answer outright means less of the others ("dark" is less light).
  for (const t of [...more]) {
    const g = groupOf(t)
    if (g !== 'feel' && g !== 'opener') for (const o of TRAIT_GROUPS[g] as readonly Trait[]) if (o !== t && !more.has(o)) less.add(o)
  }
  for (const t of more) less.delete(t)
  return { more: [...more], less: [...less] }
}

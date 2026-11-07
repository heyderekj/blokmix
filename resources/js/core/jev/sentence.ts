// Say it in a sentence: fill-in-the-blank prompts, after the motion menu's sentence. Each
// blank opens options from lists Blokmix owns, and takes your own words too. Jev never
// writes: it ranks each open blank's options from what's filled so far, and maps your own
// words to the nearest option (your words still stand). With Jev off, a fixed order that
// leans on the kind of site keeps the sentence working.
//
// Two sentences: the start ("I'm making a site for [a bakery] called [Fern & Co]…") and the
// Jev bar's verb-led ones ("Make [Pricing] [darker]"), which build the same actions Say it
// does (`buildAction`), from certain answers instead of guessed ones.

import { KINDS, SECTION_TYPES, type Kind, type SectionType } from '../types'
import { TYPE_LABEL } from '../content'
import { RECIPES } from '../start'
import { placeSection } from './describe'
import { buildAction, type IntentId, type SayAction, type SayContext } from './say'
import { choice } from './ask'
import { clip } from './state'
import { merged, shuffled } from './shuffle'
import { choiceOf, ranked } from './read'
import type { ChoiceAnswer, Criterion, JevRequest, JevResponse } from './types'

export const SENTENCE_THRESHOLDS = {
  /** Your words count as an option (for the kind, sections, looks) at this, both orders agreeing. */
  match: 0.45,
  /** An option shown as "closest to your words" at this. */
  suggest: 0.12,
}

/** One thing a blank can say. `kinds` leans the order when Jev is off; the rest says what it means. */
export interface Choice {
  id: string
  label: string
  kinds?: Kind[]
  /** Which of its blank's groups it sits in ("Shops & places"), so a long list reads in kinds. */
  group?: string
}

export interface Blank {
  id: string
  /** What an empty blank shows: what it's asking for ("what it is"), never a made-up answer. */
  ask?: string
  /** An example answer ("a bakery"), only for Jev's question about the blank. */
  placeholder: string
  /** Its options' groups (shown A to Z). */
  groups?: string[]
  options: Choice[]
  /** Several picks ("our menu, opening hours and …"). */
  many?: boolean
  /** Your own words only, no options (the name). */
  ownOnly?: boolean
}

export type Segment = { text: string } | { blank: Blank }

/** A pick: an option (`id`), your own words (`words` alone), or your words mapped to an option (both). */
export interface Pick {
  id?: string
  words: string
}
export type Picks = Record<string, Pick[]>

// ---- The start's vocabularies ----

export interface Business extends Choice {
  kind: Kind
}

export const BUSINESS_GROUPS: Record<Kind, string> = {
  local: 'Shops & places',
  studio: 'Studios & services',
  product: 'Apps & products',
  event: 'Events',
  personal: 'Just me',
  writing: 'Writing & shows',
}

const biz = (kind: Kind, ...labels: string[]): Business[] =>
  labels.map((label) => ({ id: label.replace(/^(an?|my) /, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase(), label, kind, group: BUSINESS_GROUPS[kind] }))

/** Puts each option in its group, by id (a test checks none is left out). */
function inGroups<T extends Choice>(list: T[], groups: Record<string, string[]>): T[] {
  const of = new Map(Object.entries(groups).flatMap(([g, ids]) => ids.map((id) => [id, g] as const)))
  return list.map((o) => ({ ...o, group: of.get(o.id) }))
}

export const BUSINESSES: Business[] = [
  ...biz('local', 'a bakery', 'a café', 'a restaurant', 'a bar', 'a food truck', 'a coffee roaster', 'a bookshop', 'a florist', 'a hair salon', 'a barber', 'a nail studio', 'a gym', 'a yoga studio', 'a dentist', 'a clinic', 'a vet', 'a bike shop', 'a hardware store', 'a gift shop', 'a clothing shop', 'a hotel', 'a bed and breakfast', 'a school', 'a daycare', 'a dance studio', 'a tattoo studio', 'a car repair shop', 'a plumber', 'a cleaning service', 'a dog groomer'),
  ...biz('studio', 'a design studio', 'an agency', 'a photographer', 'a wedding photographer', 'an architect', 'an interior designer', 'an accountant', 'a law firm', 'a consultant', 'a coach', 'a therapist', 'a video studio', 'a marketing agency', 'a web developer', 'a translator'),
  ...biz('product', 'an app', 'a budgeting app', 'a SaaS tool', 'a developer tool', 'an AI tool', 'a browser extension', 'a game', 'a gadget', 'an online shop', 'a course'),
  ...biz('event', 'a conference', 'a festival', 'a meetup', 'a wedding', 'a product launch', 'a workshop', 'a fundraiser'),
  ...biz('personal', 'my portfolio', 'my CV', 'a personal site', 'an illustrator', 'a musician', 'a writer'),
  ...biz('writing', 'a newsletter', 'a blog', 'a podcast', 'a magazine', 'a recipe site'),
]

export interface Feel extends Choice {
  /** Skins that suit it, best first (samples/skins/*.json). */
  skins: string[]
}

export const FEEL_GROUPS: Record<string, string[]> = {
  'Warm & friendly': ['cozy', 'warm', 'friendly', 'earthy', 'simple'],
  'Calm & clean': ['calm', 'clean', 'minimal', 'trustworthy', 'precise'],
  'Bold & loud': ['bold', 'loud', 'confident', 'industrial', 'raw'],
  'Classic & elegant': ['premium', 'elegant', 'classic', 'editorial', 'bookish', 'retro'],
  'Dark & techy': ['dark', 'techy', 'nerdy'],
  'Soft & playful': ['playful', 'fun', 'soft', 'dreamy'],
}

export const FEELS: Feel[] = inGroups<Feel>([
  { id: 'cozy', label: 'cozy', skins: ['friendly', 'marginalia'], kinds: ['local', 'writing'] },
  { id: 'warm', label: 'warm', skins: ['friendly', 'marginalia'], kinds: ['local', 'studio', 'personal'] },
  { id: 'friendly', label: 'friendly', skins: ['friendly', 'puffin'], kinds: ['local', 'product', 'event'] },
  { id: 'playful', label: 'playful', skins: ['puffin', 'friendly'], kinds: ['product', 'event', 'personal'] },
  { id: 'calm', label: 'calm', skins: ['calm', 'editorial'], kinds: ['studio', 'local', 'writing'] },
  { id: 'clean', label: 'clean', skins: ['calm', 'technical'], kinds: ['product', 'studio'] },
  { id: 'minimal', label: 'minimal', skins: ['calm', 'monolith'], kinds: ['studio', 'personal'] },
  { id: 'bold', label: 'bold', skins: ['bold', 'monolith'], kinds: ['product', 'event'] },
  { id: 'loud', label: 'loud', skins: ['bold', 'monolith'], kinds: ['event'] },
  { id: 'confident', label: 'confident', skins: ['bold', 'calm'], kinds: ['product', 'studio'] },
  { id: 'premium', label: 'premium', skins: ['editorial', 'calm'], kinds: ['studio', 'local'] },
  { id: 'elegant', label: 'elegant', skins: ['editorial', 'marginalia'], kinds: ['studio', 'event'] },
  { id: 'editorial', label: 'like a magazine', skins: ['editorial', 'marginalia'], kinds: ['writing', 'personal'] },
  { id: 'bookish', label: 'bookish', skins: ['marginalia', 'editorial'], kinds: ['writing'] },
  { id: 'classic', label: 'classic', skins: ['editorial', 'marginalia'], kinds: ['studio', 'local'] },
  { id: 'earthy', label: 'earthy', skins: ['marginalia', 'friendly'], kinds: ['local'] },
  { id: 'retro', label: 'retro', skins: ['marginalia', 'bold'], kinds: ['local', 'event'] },
  { id: 'techy', label: 'techy', skins: ['technical', 'nightowl'], kinds: ['product'] },
  { id: 'precise', label: 'precise', skins: ['technical', 'calm'], kinds: ['product', 'studio'] },
  { id: 'nerdy', label: 'nerdy', skins: ['nightowl', 'technical'], kinds: ['product', 'personal'] },
  { id: 'dark', label: 'dark and moody', skins: ['nightowl', 'technical'], kinds: ['event', 'personal'] },
  { id: 'industrial', label: 'industrial', skins: ['monolith', 'bold'], kinds: ['local', 'studio'] },
  { id: 'raw', label: 'raw', skins: ['monolith', 'bold'], kinds: ['studio', 'personal'] },
  { id: 'soft', label: 'soft', skins: ['puffin', 'calm'], kinds: ['local', 'personal'] },
  { id: 'dreamy', label: 'dreamy', skins: ['puffin', 'calm'], kinds: ['event', 'personal'] },
  { id: 'fun', label: 'fun', skins: ['puffin', 'bold'], kinds: ['event', 'product'] },
  { id: 'trustworthy', label: 'trustworthy', skins: ['calm', 'editorial'], kinds: ['studio', 'product'] },
  { id: 'simple', label: 'simple', skins: ['calm', 'friendly'], kinds: ['local', 'personal', 'writing'] },
], FEEL_GROUPS)

export interface Goal extends Choice {
  /** The main button's words. */
  button: string
  /** Sections that help with it. */
  sections: SectionType[]
}

export const GOAL_GROUPS: Record<string, string[]> = {
  'Visit or book': ['order', 'book-table', 'book', 'visit'],
  'Get in touch': ['touch', 'call', 'quote', 'hire'],
  'Buy or sign up': ['sign-up', 'try', 'buy', 'download'],
  'Read, see or listen': ['work', 'read', 'subscribe', 'listen'],
  'Come along': ['tickets', 'rsvp', 'waitlist', 'donate'],
}

export const GOALS: Goal[] = inGroups<Goal>([
  { id: 'order', label: 'order ahead', button: 'Order ahead', sections: ['pricing', 'contact'], kinds: ['local'] },
  { id: 'book-table', label: 'book a table', button: 'Book a table', sections: ['contact'], kinds: ['local'] },
  { id: 'book', label: 'book an appointment', button: 'Book an appointment', sections: ['contact'], kinds: ['local', 'studio'] },
  { id: 'visit', label: 'find us', button: 'Find us', sections: ['contact'], kinds: ['local'] },
  { id: 'call', label: 'call us', button: 'Call us', sections: ['contact'], kinds: ['local', 'studio'] },
  { id: 'touch', label: 'get in touch', button: 'Get in touch', sections: ['contact'], kinds: ['studio', 'personal'] },
  { id: 'quote', label: 'ask for a quote', button: 'Ask for a quote', sections: ['contact', 'gallery'], kinds: ['studio'] },
  { id: 'hire', label: 'hire me', button: 'Hire me', sections: ['contact'], kinds: ['personal', 'studio'] },
  { id: 'work', label: 'see our work', button: 'See our work', sections: ['gallery'], kinds: ['studio', 'personal'] },
  { id: 'sign-up', label: 'sign up', button: 'Sign up', sections: ['pricing', 'faq'], kinds: ['product'] },
  { id: 'try', label: 'try it free', button: 'Try it free', sections: ['features', 'pricing'], kinds: ['product'] },
  { id: 'buy', label: 'buy', button: 'Buy now', sections: ['pricing'], kinds: ['product', 'local'] },
  { id: 'download', label: 'download the app', button: 'Download the app', sections: ['features'], kinds: ['product'] },
  { id: 'waitlist', label: 'join the waitlist', button: 'Join the waitlist', sections: ['cta'], kinds: ['product', 'event'] },
  { id: 'tickets', label: 'get tickets', button: 'Get tickets', sections: ['pricing', 'faq'], kinds: ['event'] },
  { id: 'rsvp', label: 'RSVP', button: 'RSVP', sections: ['faq'], kinds: ['event'] },
  { id: 'subscribe', label: 'subscribe', button: 'Subscribe', sections: ['blog', 'cta'], kinds: ['writing'] },
  { id: 'read', label: 'read my writing', button: 'Start reading', sections: ['blog'], kinds: ['writing', 'personal'] },
  { id: 'donate', label: 'donate', button: 'Donate', sections: ['stats'], kinds: ['event'] },
  { id: 'listen', label: 'listen', button: 'Listen now', sections: ['blog'], kinds: ['writing', 'personal'] },
], GOAL_GROUPS)

export interface Show extends Choice {
  /** The section it becomes, or null when Blokmix has none yet (it's counted as a want). */
  section: SectionType | null
}

export const SHOW_GROUPS: Record<string, string[]> = {
  'What you offer': ['menu', 'prices', 'services', 'features', 'shop', 'posts'],
  Proof: ['reviews', 'work', 'photos', 'clients', 'press', 'numbers'],
  'About you': ['story', 'team', 'speakers'],
  Practical: ['hours', 'where', 'map', 'contact', 'questions', 'schedule', 'events'],
}

export const SHOWS: Show[] = inGroups<Show>([
  { id: 'menu', label: 'our menu', section: 'pricing', kinds: ['local'] },
  { id: 'prices', label: 'prices', section: 'pricing', kinds: ['product', 'studio', 'local'] },
  { id: 'hours', label: 'opening hours', section: 'contact', kinds: ['local'] },
  { id: 'where', label: 'where to find us', section: 'contact', kinds: ['local', 'event'] },
  { id: 'reviews', label: 'reviews', section: 'testimonials', kinds: ['local', 'product', 'studio'] },
  { id: 'team', label: 'our team', section: 'team', kinds: ['studio', 'local'] },
  { id: 'questions', label: 'questions people ask', section: 'faq', kinds: ['product', 'local', 'event'] },
  { id: 'work', label: 'our work', section: 'gallery', kinds: ['studio', 'personal'] },
  { id: 'photos', label: 'photos', section: 'gallery', kinds: ['local', 'event', 'personal'] },
  { id: 'services', label: 'what we offer', section: 'features', kinds: ['studio', 'local'] },
  { id: 'features', label: 'what it does', section: 'features', kinds: ['product'] },
  { id: 'story', label: 'our story', section: 'content', kinds: ['local', 'studio', 'personal'] },
  { id: 'numbers', label: 'numbers', section: 'stats', kinds: ['product', 'event'] },
  { id: 'clients', label: 'clients we’ve worked with', section: 'logos', kinds: ['studio'] },
  { id: 'press', label: 'press', section: 'logos', kinds: ['product', 'event'] },
  { id: 'posts', label: 'posts', section: 'blog', kinds: ['writing', 'personal'] },
  { id: 'speakers', label: 'speakers', section: 'team', kinds: ['event'] },
  { id: 'contact', label: 'how to reach us', section: 'contact', kinds: ['studio', 'personal'] },
  { id: 'schedule', label: 'the schedule', section: null, kinds: ['event'] },
  { id: 'map', label: 'a map', section: null, kinds: ['local'] },
  { id: 'events', label: 'upcoming events', section: null, kinds: ['local', 'event'] },
  { id: 'shop', label: 'a shop', section: null, kinds: ['local', 'product'] },
], SHOW_GROUPS)

// ---- The start sentence ----

const filled = (picks: Picks, id: string) => (picks[id] ?? []).some((p) => p.words.trim())

export const START_BLANKS = {
  business: { id: 'business', ask: 'what it is', placeholder: 'a bakery', options: BUSINESSES, groups: Object.values(BUSINESS_GROUPS) },
  name: { id: 'name', ask: 'its name', placeholder: 'Fern & Co', options: [], ownOnly: true },
  feel: { id: 'feel', ask: 'a feeling', placeholder: 'cozy', options: FEELS, groups: Object.keys(FEEL_GROUPS) },
  goal: { id: 'goal', ask: 'do what', placeholder: 'order ahead', options: GOALS, groups: Object.keys(GOAL_GROUPS) },
  show: { id: 'show', ask: 'what to show', placeholder: 'our menu', options: SHOWS, many: true, groups: Object.keys(SHOW_GROUPS) },
} satisfies Record<string, Blank>

/**
 * "I'm making a site for [what it is] called [its name]. It should feel [a feeling] and help people [do what]. Show [what
 * to show]." The whole sentence from the start, every blank saying what it asks for, like a fill-in-the-blanks game.
 */
export function startSentence(_picks: Picks = {}): Segment[] {
  const B = START_BLANKS
  return [
    { text: 'I’m making a site for' },
    { blank: B.business },
    { text: 'called' },
    { blank: B.name },
    { text: '.' },
    { text: 'It should feel' },
    { blank: B.feel },
    { text: 'and help people' },
    { blank: B.goal },
    { text: '.' },
    { text: 'Show' },
    { blank: B.show },
    { text: '.' },
  ]
}

/** What the start sentence says, leaving out what's still blank: "I'm making a site for a bakery. It should feel cozy." */
export function startText(picks: Picks): string {
  const w = (id: string) => listWords((picks[id] ?? []).map((p) => p.words.trim()).filter(Boolean))
  const [business, name, feel, goal, show] = ['business', 'name', 'feel', 'goal', 'show'].map(w)
  const out: string[] = []
  if (business || name) out.push(`I’m making a site${business ? ` for ${business}` : ''}${name ? ` called ${name}` : ''}.`)
  if (feel || goal) out.push(`It should ${feel ? `feel ${feel}` : ''}${feel && goal ? ' and ' : ''}${goal ? `help people ${goal}` : ''}.`)
  if (show) out.push(`Show ${show}.`)
  return out.join(' ')
}

const byId = <T extends Choice>(list: T[], id: string | undefined) => (id ? list.find((x) => x.id === id) : undefined)

export interface StartFill {
  /** The kind, when the business is an option or your words were matched to one. */
  kind: Kind | null
  name: string
  /** Home's sections: the kind's page plus what you said to show and what the goal needs. Null without a kind. */
  sections: SectionType[] | null
  /** Skins that suit the feel, best first. */
  looks: string[]
  /** The main button's words, from the goal. */
  button?: string
  /** "a cozy bakery": the feel and the business, for colors by feel. */
  feel?: string
  /** Things you asked to show that Blokmix has no section for yet. */
  wants: string[]
  /** The sentence as words (blanks as you filled them). */
  text: string
}

/** What the start sentence says, as a start. */
export function fillStart(picks: Picks): StartFill {
  const one = (id: string) => picks[id]?.[0]
  const business = byId(BUSINESSES, one('business')?.id)
  const kind = business?.kind ?? null
  const feel = byId(FEELS, one('feel')?.id)
  const goal = byId(GOALS, one('goal')?.id)
  const shows = (picks.show ?? []).map((p) => ({ p, s: byId(SHOWS, p.id) }))
  let sections: SectionType[] | null = null
  if (kind) {
    sections = RECIPES[kind].home
    for (const t of [...(goal?.sections ?? []), ...shows.flatMap(({ s }) => (s?.section ? [s.section] : []))]) sections = placeSection(sections, t)
  }
  const feelWords = one('feel')?.words.trim()
  const businessWords = one('business')?.words.trim().replace(/^(an?|my|our)\s+/i, '')
  return {
    kind,
    name: one('name')?.words.trim() ?? '',
    sections,
    looks: feel?.skins ?? [],
    button: goal?.button ?? (one('goal')?.words.trim() ? capital(one('goal')!.words.trim()) : undefined),
    feel: feelWords ? `${feelWords}${businessWords ? ` ${businessWords}` : ''}` : undefined,
    wants: shows.filter(({ s }) => !s?.section).map(({ p }) => p.words.trim()).filter(Boolean),
    text: startText(picks),
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---- The Jev bar's sentences ----

export interface Verb extends Choice {
  intent: IntentId
}

export const VERBS: Verb[] = [
  { id: 'make', label: 'Make', intent: 'surface' },
  { id: 'move', label: 'Move', intent: 'move' },
  { id: 'add', label: 'Add', intent: 'add' },
  { id: 'remove', label: 'Remove', intent: 'remove' },
  { id: 'swap', label: 'Try another', intent: 'swap' },
  { id: 'colors', label: 'Change the colors to feel', intent: 'colors' },
  { id: 'dress', label: 'Find backgrounds for', intent: 'dress' },
]

/** How a section can change: its band or its width. */
export const SECTION_HOWS: (Choice & { intent: IntentId; arg: 'surface' | 'section_width'; value: string })[] = [
  { id: 'darker', label: 'darker', intent: 'surface', arg: 'surface', value: 'inverse' },
  { id: 'softer', label: 'softer', intent: 'surface', arg: 'surface', value: 'soft' },
  { id: 'brand', label: 'the brand color', intent: 'surface', arg: 'surface', value: 'brand' },
  { id: 'plain', label: 'plain', intent: 'surface', arg: 'surface', value: 'page' },
  { id: 'narrower', label: 'narrower', intent: 'width', arg: 'section_width', value: 'narrow' },
  { id: 'wider', label: 'wider', intent: 'width', arg: 'section_width', value: 'wide' },
  { id: 'full', label: 'full width', intent: 'width', arg: 'section_width', value: 'full' },
]

/** How the whole page can change: a dial a step, or light and dark. */
export const PAGE_HOWS: (Choice & { intent: IntentId; answers: Record<string, string> })[] = [
  { id: 'roomier', label: 'roomier', intent: 'dial', answers: { dial: 'spacing', more_less: 'more' } },
  { id: 'tighter', label: 'tighter', intent: 'dial', answers: { dial: 'spacing', more_less: 'less' } },
  { id: 'bigger', label: 'bigger text', intent: 'dial', answers: { dial: 'type', more_less: 'more' } },
  { id: 'smaller', label: 'smaller text', intent: 'dial', answers: { dial: 'type', more_less: 'less' } },
  { id: 'rounder', label: 'rounder', intent: 'dial', answers: { dial: 'roundness', more_less: 'more' } },
  { id: 'sharper', label: 'sharper', intent: 'dial', answers: { dial: 'roundness', more_less: 'less' } },
  { id: 'bolder', label: 'bolder', intent: 'dial', answers: { dial: 'weight', more_less: 'more' } },
  { id: 'lighter', label: 'lighter', intent: 'dial', answers: { dial: 'weight', more_less: 'less' } },
  { id: 'dark', label: 'dark', intent: 'tone', answers: { tone: 'dark' } },
  { id: 'light', label: 'light', intent: 'tone', answers: { tone: 'light' } },
]

export const WHERE: Choice[] = [
  { id: 'above', label: 'above' },
  { id: 'below', label: 'below' },
  { id: 'top', label: 'to the top' },
  { id: 'bottom', label: 'to the bottom' },
]

const PAGE: Choice = { id: 'page', label: 'the page' }

/** The page's sections as options, named as people see them ("Features", "Features (2)" when there are two). */
export function sectionChoices(ctx: SayContext, opts: { chrome?: boolean; except?: string } = {}): Choice[] {
  const list = ctx.sections.filter((s) => (opts.chrome || (s.type !== 'nav' && s.type !== 'footer')) && `s_${s.id}` !== opts.except)
  const seen = new Map<SectionType, number>()
  return list.map((s) => {
    const n = (seen.get(s.type) ?? 0) + 1
    seen.set(s.type, n)
    const twin = ctx.sections.filter((x) => x.type === s.type).length > 1
    return { id: `s_${s.id}`, label: twin ? `${TYPE_LABEL[s.type]} (${n})` : TYPE_LABEL[s.type] }
  })
}

const ADDABLE: Choice[] = SECTION_TYPES.filter((t) => t !== 'nav' && t !== 'footer').map((t) => ({ id: t, label: `a ${TYPE_LABEL[t]} section` }))

/** The bar's sentence for the verb you picked: "Make [Pricing] [darker]", "Move [Testimonials] [above] [Features]". */
export function barSentence(picks: Picks, ctx: SayContext): Segment[] {
  const verb: Blank = { id: 'verb', ask: 'do what', placeholder: 'Make', options: VERBS }
  const v = picks.verb?.[0]?.id
  const out: Segment[] = [{ blank: verb }]
  const section = (id = 'section', except?: string): Blank => ({ id, ask: 'which section', placeholder: 'Pricing', options: sectionChoices(ctx, { except }) })
  switch (v) {
    case 'make': {
      const target: Blank = { id: 'section', ask: 'what', placeholder: 'Pricing', options: [PAGE, ...sectionChoices(ctx)] }
      const page = picks.section?.[0]?.id === 'page'
      return [...out, { blank: target }, { blank: { id: 'how', ask: 'how', placeholder: page ? 'roomier' : 'darker', options: page ? PAGE_HOWS : SECTION_HOWS } }]
    }
    case 'move': {
      out.push({ blank: section() }, { blank: { id: 'where', ask: 'where', placeholder: 'above', options: WHERE } })
      const w = picks.where?.[0]?.id
      return w === 'above' || w === 'below' ? [...out, { blank: section('other', picks.section?.[0]?.id) }] : out
    }
    case 'add':
      return [...out, { blank: { id: 'type', ask: 'what kind', placeholder: 'a FAQ section', options: ADDABLE } }]
    case 'remove':
      return [...out, { blank: section() }]
    case 'swap':
      return [...out, { blank: section() }, { text: 'layout' }]
    case 'colors':
      return [...out, { blank: { id: 'feel', ask: 'a feeling', placeholder: 'cozy', options: FEELS } }]
    case 'dress':
      return [...out, { blank: section() }, { text: 'that feel' }, { blank: { id: 'feel', ask: 'a feeling', placeholder: 'premium', options: FEELS } }]
    default:
      return out
  }
}

/** A certain answer, shaped like Jev's, so the bar's sentences build actions the way Say it does. */
const sure = (option: string): ChoiceAnswer => ({ type: 'choice', choice: option, confidence: 1, probabilities: { [option]: 1 } })

export interface BarFill {
  action: SayAction | null
  /** What to hand the action: the feel's words for colors and dress, else the sentence. */
  text: string
}

/** A finished bar sentence as one ordinary action (the same one Say it would build), or null while a blank is empty. */
export function fillBar(picks: Picks, ctx: SayContext): BarFill {
  const segs = barSentence(picks, ctx)
  const text = sentenceText(segs, picks)
  const none = { action: null, text }
  if (openBlanks(segs, picks).length) return none
  const id = (b: string) => picks[b]?.[0]?.id
  const verb = byId(VERBS, id('verb'))
  if (!verb) return none
  const answers: Record<string, string> = {}
  let intent: IntentId = verb.intent
  const sec = id('section')
  if (sec?.startsWith('s_')) answers.section = sec
  let hand = text
  switch (verb.id) {
    case 'make': {
      if (sec === 'page') {
        const how = byId(PAGE_HOWS, id('how'))
        if (!how) return none
        intent = how.intent
        Object.assign(answers, how.answers)
      } else {
        const how = byId(SECTION_HOWS, id('how'))
        if (!how) return none
        intent = how.intent
        answers[how.arg] = how.value
      }
      break
    }
    case 'move': {
      const w = id('where')
      if (w === 'above' || w === 'below') {
        const other = id('other')
        if (!other) return none
        answers.other = other
        answers.above_below = w
      } else answers.other = w === 'top' ? 'top_of_page' : 'bottom_of_page'
      break
    }
    case 'add': {
      const t = id('type')
      if (!t) return none
      answers.section_type = t
      break
    }
    case 'colors':
    case 'dress':
      hand = picks.feel?.[0]?.words.trim() || text
      break
  }
  const res: JevResponse = { model: 'sentence', answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, sure(v)])), usage: { input_tokens: 0, output_tokens: 0 } }
  // The words carry no "top", "first" or "above" the blanks didn't put there, so buildAction reads the move as picked.
  return { action: buildAction(intent, res, text, ctx, 1), text: hand }
}

// ---- Shared: the words, what's open, the order, Jev's ranking and matching ----

/** The sentence as words: blanks as you filled them, "…" where they're empty. */
export function sentenceText(segs: Segment[], picks: Picks): string {
  const parts = segs.map((s) => {
    if ('text' in s) return s.text
    const words = (picks[s.blank.id] ?? []).map((p) => p.words.trim()).filter(Boolean)
    return words.length ? listWords(words) : '…'
  })
  return parts.join(' ').replace(/\s+([.,])/g, '$1').replace(/\s+/g, ' ').trim()
}

/** "our menu, opening hours and reviews". */
export const listWords = (w: string[]) => (w.length < 2 ? (w[0] ?? '') : `${w.slice(0, -1).join(', ')} and ${w.at(-1)}`)

/** The blanks still empty, in order (a many-blank counts as open until it has one pick). */
export function openBlanks(segs: Segment[], picks: Picks): Blank[] {
  return segs.flatMap((s) => ('blank' in s && !filled(picks, s.blank.id) ? [s.blank] : []))
}

/** Before Jev answers (or with Jev off): options for this kind of site first, the rest as listed. */
export function defaultOrder(options: Choice[], kind: Kind | null): Choice[] {
  if (!kind) return options
  return [...options.filter((o) => o.kinds?.includes(kind)), ...options.filter((o) => !o.kinds?.includes(kind))]
}

/** A blank's options best first: Jev's order when there is one, else the kind's lean. */
export function orderOptions(blank: Blank, order?: string[], kind: Kind | null = null): Choice[] {
  if (!order?.length) return defaultOrder(blank.options, kind)
  const at = new Map(order.map((id, i) => [id, i]))
  return [...blank.options].sort((a, b) => (at.get(a.id) ?? 999) - (at.get(b.id) ?? 999))
}

export interface OptionGroup {
  name: string
  options: Choice[]
}

/** A blank's options in its groups, the groups A to Z, each group best first. */
export function groupsOf(blank: Blank, order?: string[], kind: Kind | null = null): OptionGroup[] {
  const sorted = orderOptions(blank, order, kind)
  const names = [...new Set([...(blank.groups ?? []), ...sorted.map((o) => o.group ?? 'More')])].sort((x, y) => x.localeCompare(y))
  return names.map((name) => ({ name, options: sorted.filter((o) => (o.group ?? 'More') === name) })).filter((g) => g.options.length)
}

/**
 * A few to try first, once there's something to go on (Jev's order or the kind of site). Before that there are none: the
 * groups themselves already show the range.
 */
export function suggestedFor(blank: Blank, order?: string[], kind: Kind | null = null, count = 6): Choice[] {
  return order?.length || kind ? orderOptions(blank, order, kind).slice(0, count) : []
}

const criteria = (options: Choice[]): Record<string, Criterion> => Object.fromEntries(options.map((o) => [o.id, { what: o.label }]))

/** One request: for each open blank, which option fits best given the sentence so far. Each question carries the sentence. */
export function rankRequest(sentence: string, blanks: Blank[]): JevRequest {
  const questions: JevRequest['questions'] = {}
  for (const b of blanks) {
    if (b.ownOnly || b.options.length < 2) continue
    questions[`rank_${b.id}`] = choice({ question: `In this sentence, what fits best where it says “…” for “${b.placeholder}”?`, sentence: clip(sentence, 400) }, criteria(b.options.slice(0, 250)))
  }
  return { state: { sentence: clip(sentence, 400) }, questions }
}

/** Each blank's options, likeliest first. Blanks Jev didn't answer are left out (keep their order). */
export function readRank(res: JevResponse | null, blanks: Blank[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const b of blanks) {
    const a = choiceOf(res, `rank_${b.id}`)
    if (a) out[b.id] = ranked(a).map((x) => x.option)
  }
  return out
}

/** One request: which of a blank's options your own words are closest to (both orders, since a match is acted on). */
export function matchRequest(blank: Blank, words: string, sentence = ''): JevRequest {
  const opts = { ...criteria(blank.options.slice(0, 250)), none: { what: 'None of these is close' } }
  const said = clip(words.trim(), 200)
  return {
    state: { words: said },
    questions: shuffled('match', choice({ question: 'Which of these means about the same as these words?', words: said, ...(sentence ? { sentence: clip(sentence, 400) } : {}) }, opts)),
  }
}

export interface Matched {
  /** The option your words count as, when Jev is sure. */
  id: string | null
  /** The closest options, best first, to offer beside your words. */
  closest: string[]
}

export function readMatch(res: JevResponse | null): Matched {
  const m = merged(res, 'match')
  if (!m) return { id: null, closest: [] }
  const order = ranked(m).filter((x) => x.option !== 'none')
  const best = order[0]
  const id = best && m.agree && m.choice === best.option && best.p >= SENTENCE_THRESHOLDS.match ? best.option : null
  return { id, closest: order.filter((x) => x.p >= SENTENCE_THRESHOLDS.suggest).slice(0, 3).map((x) => x.option) }
}

/** Every kind a business can be, for checks. */
export const BUSINESS_KINDS = new Set(BUSINESSES.map((b) => b.kind))
export const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k)

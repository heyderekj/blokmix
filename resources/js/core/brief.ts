// What a site is for, in a few answers: what kind of site (a landing page, a portfolio…), the industry, what it should
// do for you, who it's for, and what its main button says. Context, never copy: it steers what Jev picks (sections,
// layouts, colors, photos), ranks what's offered first, and tells your agent what the site is for. Nothing here lands
// on a page unless you typed it into a field (the main button's words, when you typed them, count as yours).

import type { FeelWord } from './feel'
import type { Kind, ProjectContent, SectionType } from './types'

export const FORMATS = ['landing', 'business', 'portfolio', 'blog', 'event'] as const
export type Format = (typeof FORMATS)[number]

/** The site library's industries (`samples/library/seed.json`), less portfolio (a format), plus services and other. */
export const INDUSTRIES = ['saas', 'ai', 'devtools', 'fintech', 'ecommerce', 'agency', 'health', 'education', 'food', 'architecture', 'travel', 'nonprofit', 'events', 'media', 'services', 'other'] as const
export type Industry = (typeof INDUSTRIES)[number]

export const GOALS = ['sell', 'signups', 'waitlist', 'bookings', 'calls', 'orders', 'subscribers', 'showWork', 'hire', 'visit', 'tickets', 'donate'] as const
export type Goal = (typeof GOALS)[number]

export interface Brief {
  /** What it is, in their words (the start's sentence). Context only. */
  what?: string
  /** Who it's for, in their words. Context only. */
  who?: string
  format?: Format
  industry?: Industry
  /** The industry as they said it ("sourdough bakery"), when it's more specific than the list. */
  industryWords?: string
  goals?: Goal[]
  /** A goal in their words, when none of the list fits. */
  goalsOther?: string
  /** The main button's words. */
  mainAction?: string
  /** Typed by them (not picked from the chips): then they're their own words on the page. */
  mainActionTyped?: boolean
}

export const FORMAT_LABEL: Record<Format, string> = {
  landing: 'A landing page',
  business: 'A small business site',
  portfolio: 'A portfolio',
  blog: 'A blog or newsletter',
  event: 'An event page',
}

export const INDUSTRY_LABEL: Record<Industry, string> = {
  saas: 'Software',
  ai: 'AI',
  devtools: 'Developer tools',
  fintech: 'Money and finance',
  ecommerce: 'A shop',
  agency: 'An agency or studio',
  health: 'Health and wellness',
  education: 'Education',
  food: 'Food and drink',
  architecture: 'Architecture and design',
  travel: 'Travel',
  nonprofit: 'A nonprofit',
  events: 'Events',
  media: 'Media and writing',
  services: 'Services',
  other: 'Something else',
}

export const GOAL_LABEL: Record<Goal, string> = {
  sell: 'Sell things',
  signups: 'Get sign-ups',
  waitlist: 'Build a waitlist',
  bookings: 'Take bookings',
  calls: 'Book calls',
  orders: 'Take orders',
  subscribers: 'Grow a list of readers',
  showWork: 'Show my work',
  hire: 'Get hired',
  visit: 'Get people to visit',
  tickets: 'Sell tickets',
  donate: 'Raise money',
}

/** The sections each goal leans on, most useful first. */
export const GOAL_SECTIONS: Record<Goal, SectionType[]> = {
  sell: ['features', 'pricing', 'testimonials', 'faq'],
  signups: ['features', 'testimonials', 'pricing', 'faq'],
  waitlist: ['features', 'cta', 'faq'],
  bookings: ['contact', 'faq', 'testimonials'],
  calls: ['features', 'testimonials', 'contact'],
  orders: ['features', 'faq', 'contact'],
  subscribers: ['blog', 'cta', 'testimonials'],
  showWork: ['gallery', 'content', 'testimonials'],
  hire: ['gallery', 'stats', 'contact'],
  visit: ['gallery', 'contact', 'faq'],
  tickets: ['team', 'pricing', 'faq'],
  donate: ['stats', 'content', 'cta'],
}

/** The main button's words for a goal, by industry where it matters ('*' for the rest). */
export const GOAL_ACTIONS: Record<Goal, Partial<Record<Industry | '*', string[]>>> = {
  sell: { ecommerce: ['Shop now', 'See the shop'], '*': ['Buy now', 'See pricing'] },
  signups: { '*': ['Start free', 'Get started', 'Sign up'] },
  waitlist: { '*': ['Join the waitlist', 'Get early access'] },
  bookings: { food: ['Book a table'], health: ['Book an appointment'], travel: ['Book your stay'], '*': ['Book now'] },
  calls: { '*': ['Book a call', 'Get in touch'] },
  orders: { food: ['Order ahead', 'See the menu'], '*': ['Order now'] },
  subscribers: { '*': ['Subscribe', 'Get the newsletter'] },
  showWork: { '*': ['See the work', 'See my work'] },
  hire: { '*': ['Hire me', 'Get in touch'] },
  visit: { food: ['Plan a visit', 'See the menu'], '*': ['Plan a visit', 'Find us'] },
  tickets: { '*': ['Get tickets', 'Save your spot'] },
  donate: { '*': ['Donate', 'Give today'] },
}

/** How an industry tends to feel, so the first themes on offer fit (added to the kind's own). */
export const INDUSTRY_FEEL: Partial<Record<Industry, FeelWord[]>> = {
  saas: ['modern', 'calm'],
  ai: ['modern', 'dark'],
  devtools: ['modern', 'dark'],
  fintech: ['serious', 'calm'],
  ecommerce: ['bold', 'playful'],
  agency: ['bold', 'modern'],
  health: ['calm', 'warm'],
  education: ['warm', 'calm'],
  food: ['warm', 'playful'],
  architecture: ['classic', 'calm'],
  travel: ['warm', 'calm'],
  nonprofit: ['warm', 'serious'],
  events: ['bold', 'playful'],
  media: ['classic', 'serious'],
}

/** Words added to stock-photo searches for an industry. */
export const INDUSTRY_PHOTO: Partial<Record<Industry, string>> = {
  saas: 'office laptop',
  ai: 'abstract technology',
  devtools: 'code desk',
  fintech: 'finance',
  ecommerce: 'product',
  agency: 'studio',
  health: 'wellness',
  education: 'classroom learning',
  food: 'food cafe',
  architecture: 'architecture interior',
  travel: 'travel landscape',
  nonprofit: 'community',
  events: 'conference crowd',
  media: 'reading',
}

const SOFTWARE: Industry[] = ['saas', 'ai', 'devtools', 'fintech']

/** The kind of site the older parts of Blokmix go by (starters, recipes, sample words), from the brief. */
export function kindOf(b: Brief, fallback: Kind = 'studio'): Kind {
  const i = b.industry
  switch (b.format) {
    case 'landing':
      return i === 'events' ? 'event' : i === 'agency' || i === 'services' ? 'studio' : 'product'
    case 'business':
      return i === 'agency' || i === 'architecture' ? 'studio' : i && SOFTWARE.includes(i) ? 'product' : 'local'
    case 'portfolio':
      return i === 'agency' ? 'studio' : 'personal'
    case 'blog':
      return 'writing'
    case 'event':
      return 'event'
  }
  if (i === 'events') return 'event'
  if (i === 'media') return 'writing'
  if (i && SOFTWARE.includes(i)) return 'product'
  if (i === 'agency' || i === 'architecture') return 'studio'
  if (i === 'food' || i === 'health' || i === 'travel') return 'local'
  return fallback
}

/** A brief for a mix that only knows its kind (saved before briefs). */
export function briefFromKind(kind?: Kind): Brief {
  switch (kind) {
    case 'product':
      return { format: 'landing', industry: 'saas' }
    case 'studio':
      return { format: 'business', industry: 'agency' }
    case 'local':
      return { format: 'business' }
    case 'personal':
      return { format: 'portfolio' }
    case 'writing':
      return { format: 'blog', industry: 'media' }
    case 'event':
      return { format: 'event', industry: 'events' }
    default:
      return {}
  }
}

/** This mix's brief: its own, or one read from its kind. */
export const briefOf = (content: Pick<ProjectContent, 'brief' | 'kind'>): Brief => content.brief ?? briefFromKind(content.kind)

/** A brief with a patch on top; empty values drop out. */
export function patchBrief(b: Brief, patch: Partial<Brief>): Brief {
  const out: Record<string, unknown> = { ...b, ...patch }
  for (const [k, v] of Object.entries(out)) if (v === undefined || v === '' || v === null || (Array.isArray(v) && !v.length)) delete out[k]
  return out as Brief
}

// Words that give an industry away, for when suggestions are off. First match wins, so the specific ones come first.
const INDUSTRY_HINTS: [Industry, RegExp][] = [
  ['food', /\b(bakery|bakeries|caf[eé]|coffee|restaurant|bistro|bar|pizza|menu|kitchen|brunch|catering|food|wine|brewery|deli)\b/i],
  ['health', /\b(clinic|dentist|dental|therapy|therapist|yoga|gym|fitness|physio|wellness|health|doctor|massage|pilates|spa)\b/i],
  ['travel', /\b(hotel|travel|tours?|b&b|hostel|cabin|retreat|trip)\b/i],
  ['architecture', /\b(architect\w*|interiors?|interior design)\b/i],
  ['events', /\b(conference|festival|meetup|summit|launch party|event|wedding)\b/i],
  ['nonprofit', /\b(nonprofit|non-profit|charity|foundation|donat\w+|volunteer)\b/i],
  ['education', /\b(school|course|class(es)?|tutor\w*|teach\w*|lessons?|workshop|academy)\b/i],
  ['ai', /\b(ai|machine learning|llm|gpt|model)\b/i],
  ['devtools', /\b(api|sdk|developer|devtools?|cli|open source)\b/i],
  ['fintech', /\b(bank|banking|payments?|finance|invest\w*|budget\w*|accounting|tax)\b/i],
  ['ecommerce', /\b(shop|store|sell|products?|merch|e-?commerce|candles?|clothing|jewelry)\b/i],
  ['agency', /\b(agency|studio|design studio|branding|creative)\b/i],
  ['media', /\b(newsletter|blog|magazine|podcast|essays?|writing|publication)\b/i],
  ['saas', /\b(app|software|saas|platform|tool|dashboard|startup)\b/i],
  ['services', /\b(consult\w*|coach\w*|lawyer|plumb\w*|cleaning|photograph\w*|freelanc\w*|services?)\b/i],
]
const FORMAT_HINTS: [Format, RegExp][] = [
  ['portfolio', /\b(portfolio|my work|cv|r[eé]sum[eé]|i'?m an? |about me|freelanc\w*)\b/i],
  ['blog', /\b(newsletter|blog|magazine|essays?|podcast|publication)\b/i],
  ['event', /\b(conference|festival|meetup|summit|event|wedding)\b/i],
  ['landing', /\b(app|software|launch|waitlist|sign ?ups?|landing page|product)\b/i],
  ['business', /\b(bakery|caf[eé]|restaurant|shop|clinic|studio|agency|salon|gym|hotel|practice|business)\b/i],
]
const GOAL_HINTS: [Goal, RegExp][] = [
  ['bookings', /\b(book\w*|reserv\w*|appointments?|tables?)\b/i],
  ['orders', /\b(pre-?orders?|order\w*|delivery|takeaway|pick-?up)\b/i],
  ['sell', /\b(sell|shop|store|buy)\b/i],
  ['waitlist', /\b(waitlist|wait list|coming soon|early access|launch)\b/i],
  ['signups', /\b(sign ?ups?|free trial|users)\b/i],
  ['calls', /\b(calls?|consultations?|demo)\b/i],
  ['subscribers', /\b(subscrib\w*|newsletter|readers)\b/i],
  ['showWork', /\b(portfolio|my work|projects|case studies)\b/i],
  ['hire', /\b(hire|hiring me|freelanc\w*|available for)\b/i],
  ['visit', /\b(visit|hours|opening|come by|find us|location)\b/i],
  ['tickets', /\b(tickets?|rsvp)\b/i],
  ['donate', /\b(donat\w+|fundrais\w*|support us)\b/i],
]

/** A first guess at the brief from what they typed, by keywords: what the start offers when suggestions are off. */
export function guessBrief(text: string): Partial<Brief> & { sure: boolean } {
  const t = text.trim()
  const industry = INDUSTRY_HINTS.find(([, re]) => re.test(t))?.[0]
  const format = FORMAT_HINTS.find(([, re]) => re.test(t))?.[0]
  const goals = GOAL_HINTS.filter(([, re]) => re.test(t)).map(([g]) => g).slice(0, 3)
  return { ...(t ? { what: t } : {}), ...(format ? { format } : {}), ...(industry ? { industry } : {}), ...(goals.length ? { goals } : {}), sure: !!(format && industry) }
}

/** What a format leads with when no goal was given. */
const FORMAT_GOALS: Record<Format, Goal[]> = {
  landing: ['signups'],
  business: ['visit'],
  portfolio: ['showWork', 'hire'],
  blog: ['subscribers'],
  event: ['tickets'],
}

/** The goals that count: the ones given, else what the format usually wants. */
export const goalsOf = (b: Brief): Goal[] => (b.goals?.length ? b.goals : b.format ? FORMAT_GOALS[b.format] : [])

/** Words for the main button, best first: each goal's (for this industry), without repeats. */
export function actionChoices(b: Brief): string[] {
  const out: string[] = []
  for (const g of goalsOf(b)) {
    const by = GOAL_ACTIONS[g]
    for (const w of (b.industry && by[b.industry]) || by['*'] || []) if (!out.includes(w)) out.push(w)
  }
  return out.length ? out : ['Get started', 'Get in touch']
}

/** Sections the brief's goals lean on, most wanted first. */
export function goalSections(b: Brief): SectionType[] {
  const out: SectionType[] = []
  for (const g of goalsOf(b)) for (const t of GOAL_SECTIONS[g]) if (!out.includes(t)) out.push(t)
  return out
}

/** The feel words that suit this brief, to put the first themes on offer. */
export const briefFeel = (b: Brief): FeelWord[] => (b.industry ? (INDUSTRY_FEEL[b.industry] ?? []) : [])

const lower = (s: string) => s.replace(/^./, (c) => c.toLowerCase())

/**
 * The brief in one plain sentence, for Jev's requests and the agent: "Fern & Co: a small business site for food and
 * drink. It should take bookings and get people to visit. Main button: Book a table." The brand alone when nothing's known.
 */
export function briefContext(content: Pick<ProjectContent, 'brand' | 'brief' | 'kind'>): string {
  const b = briefOf(content)
  const name = content.brand?.trim() || 'The site'
  const what = b.format ? lower(FORMAT_LABEL[b.format]) : ''
  const industry = b.industryWords?.trim() || (b.industry && b.industry !== 'other' ? lower(INDUSTRY_LABEL[b.industry]) : '')
  const parts: string[] = []
  if (what || industry) parts.push(`${name}: ${what || 'a site'}${industry ? ` for ${industry}` : ''}.`)
  else parts.push(name)
  if (b.what?.trim()) parts.push(b.what.trim().replace(/[.!?]?$/, '.'))
  const goals = [...(b.goals ?? []).map((g) => lower(GOAL_LABEL[g])), ...(b.goalsOther?.trim() ? [b.goalsOther.trim()] : [])]
  if (goals.length) parts.push(`It should ${goals.length > 1 ? `${goals.slice(0, -1).join(', ')} and ${goals.at(-1)}` : goals[0]}.`)
  if (b.who?.trim()) parts.push(`For ${lower(b.who.trim()).replace(/[.!?]$/, '')}.`)
  if (b.mainAction?.trim()) parts.push(`Main button: ${b.mainAction.trim()}.`)
  return parts.join(' ')
}

/** The fields the main button's words go in, wherever the page has one. */
export const MAIN_ACTION_FIELDS: [SectionType, string][] = [
  ['hero', 'ctaPrimary'],
  ['nav', 'cta'],
  ['cta', 'ctaPrimary'],
  ['footer', 'ctaButton'],
]

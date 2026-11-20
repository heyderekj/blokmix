// A list typed into one of the start's blanks: "menu, opening hours, a map and reviews", "warm, handmade, a bit bold",
// "book a table, order ahead". Each item is read on its own and matched to the blank's options here, with no network
// (labels, labels without their "a"/"our", whole words either way, then a few synonyms), so a list never lands as one
// blob of words. What doesn't match stays as your words. Pure.

import { FEEL_SYNONYMS, bare } from '../reader/local'
import type { Blank, Choice } from './sentence'

/** A paragraph rather than a few words: long, more than one line, or two or more sentences. */
export const isParagraph = (t: string) => t.trim().length > 90 || /\n\s*\S/.test(t.trim()) || (t.match(/[.!?](\s|$)/g)?.length ?? 0) >= 2

/** Where people join items in a list, longest first. */
const JOIN = /\s*(?:,\s*(?:and|or|plus|&)\s+|;|,|\/|\s&\s|\s\+\s|\n|\s+(?:and|plus|or)\s+)\s*/i

/** The items of a list, in the order written, or null when it's one item or a paragraph. Each item is a few words. */
export function splitList(text: string): string[] | null {
  const t = text.trim().replace(/[.!]+$/, '')
  if (!t || /[.!?]\s/.test(t) || t.length > 160) return null
  const parts = t
    .split(JOIN)
    .map((p) => p.trim().replace(/^(?:and|or|plus)\s+/i, ''))
    .filter(Boolean)
  if (parts.length < 2 || parts.some((p) => p.split(/\s+/).length > 6)) return null
  return parts
}

/** An item said with a "no" in front ("no reviews", "not corporate"): asked to leave out, so not picked. */
export const saidNot = (item: string) => /^(?:no|not|never|without|nothing|avoid)\s+/i.test(item.trim())

/** Words for a thing to show that Blokmix lists under another label. */
const SHOW_SYNONYMS: Record<string, string> = {
  hours: 'hours', 'opening times': 'hours', 'open hours': 'hours', 'when we are open': 'hours', timetable: 'schedule',
  map: 'map', location: 'where', address: 'where', directions: 'where', 'find us': 'where', 'how to find us': 'where',
  testimonials: 'reviews', testimonial: 'reviews', review: 'reviews', 'what people say': 'reviews', quotes: 'reviews',
  faq: 'questions', faqs: 'questions', questions: 'questions', 'q&a': 'questions',
  staff: 'team', people: 'team', crew: 'team', founders: 'team',
  gallery: 'photos', pictures: 'photos', images: 'photos', pics: 'photos',
  portfolio: 'work', projects: 'work', 'case studies': 'work',
  pricing: 'prices', 'price list': 'prices', rates: 'prices', plans: 'prices', packages: 'prices', costs: 'prices',
  'what we do': 'services', offerings: 'services', 'what we offer': 'services',
  about: 'story', 'about us': 'story', history: 'story',
  stats: 'numbers', figures: 'numbers', logos: 'clients', 'client logos': 'clients', partners: 'clients',
  blog: 'posts', articles: 'posts', news: 'posts', writing: 'posts',
  email: 'contact', phone: 'contact', 'contact details': 'contact', 'get in touch': 'contact', 'contact form': 'contact',
  agenda: 'schedule', programme: 'schedule', program: 'schedule', lineup: 'speakers', 'line-up': 'speakers',
  gigs: 'events', shows: 'events', 'whats on': 'events', 'what’s on': 'events',
  store: 'shop', products: 'shop', merch: 'shop', 'online shop': 'shop',
  'food menu': 'menu', 'drinks menu': 'menu', 'our menus': 'menu', menus: 'menu',
}

/** Words for something people do on the site that Blokmix lists under another label. */
const GOAL_SYNONYMS: Record<string, string> = {
  reserve: 'book-table', reservations: 'book-table', 'make a reservation': 'book-table', 'book a table': 'book-table',
  'pre-order': 'order', preorder: 'order', 'order online': 'order', order: 'order', 'place an order': 'order',
  book: 'book', 'book a call': 'book', appointments: 'book', 'book in': 'book',
  visit: 'visit', 'come by': 'visit', 'come in': 'visit', 'visit us': 'visit',
  'call': 'call', phone: 'call', 'contact us': 'touch', 'email us': 'touch', 'reach out': 'touch',
  quote: 'quote', 'get a quote': 'quote', 'hire us': 'hire', 'work with me': 'hire', 'work with us': 'hire',
  'see the work': 'work', 'see my work': 'work', 'look at our work': 'work',
  register: 'sign-up', 'sign-up': 'sign-up', 'create an account': 'sign-up', 'free trial': 'try', 'try it': 'try',
  shop: 'buy', purchase: 'buy', 'buy things': 'buy', 'get the app': 'download', install: 'download',
  'join the list': 'waitlist', 'get early access': 'waitlist', 'buy tickets': 'tickets', tickets: 'tickets',
  newsletter: 'subscribe', 'sign up for the newsletter': 'subscribe', 'read': 'read', donations: 'donate', give: 'donate',
}

const clean = (s: string) => s.trim().toLowerCase().replace(/[“”"']/g, '').replace(/[.,;:!?]+$/, '')
const wordIn = (hay: string, needle: string) => new RegExp(`(?<![\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(hay)

/**
 * The option a few words mean in this blank, or null: the label itself, the label without its "a"/"our", a label held
 * whole in the words or the words held whole in a label ("hours" ↔ "opening hours"; the longest wins), then synonyms
 * (feelings, things to show, things to do). Never matches words said with a "no".
 */
export function matchOption(blank: Blank, words: string): Choice | null {
  const w = clean(words)
  if (!w || saidNot(w) || blank.ownOnly) return null
  const byId = (id: string | undefined) => (id ? blank.options.find((o) => o.id === id) ?? null : null)
  const exact = blank.options.find((o) => clean(o.label) === w || o.id === w)
  if (exact) return exact
  const b = bare(w)
  const bareHit = blank.options.find((o) => bare(clean(o.label)) === b)
  if (bareHit) return bareHit
  const synonyms = blank.id === 'show' ? SHOW_SYNONYMS : blank.id === 'goal' ? GOAL_SYNONYMS : blank.id === 'feel' ? FEEL_SYNONYMS : null
  // As written, without its "a"/"our", then without a plural "s" ("pre-orders" → pre-order).
  const syn = synonyms && [w, b, w.replace(/s$/, ''), b.replace(/s$/, '')].map((k) => synonyms[k]).find(Boolean)
  if (syn && byId(syn)) return byId(syn)
  // A label held whole in your words ("our full menu" → our menu), or your words held whole in a label (at least four
  // letters, so "a" or "us" never match). The longest label wins.
  const holding = blank.options
    .filter((o) => wordIn(w, bare(clean(o.label))) || (b.length >= 4 && wordIn(bare(clean(o.label)), b)))
    .sort((x, y) => y.label.length - x.label.length)[0]
  if (holding) return holding
  // A synonym held whole in your words ("our opening times" → hours).
  if (synonyms) {
    const hit = Object.entries(synonyms)
      .filter(([k]) => k.length >= 3 && wordIn(w, k))
      .sort((x, y) => y[0].length - x[0].length)[0]
    if (hit && byId(hit[1])) return byId(hit[1])
  }
  return null
}

// The reader's stand-in when it's off, slow or failing: the same read, from keywords. It knows far less (no clauses,
// no context), but it gives the start the same shape, so your own words never dead-end: "warm and handmade, not
// corporate" still turns into feelings to lean toward and one to steer away from. Every string is a slice of the text,
// so it passes the same span check as the real reader. Pure.

import { BUSINESSES, FEELS, GOALS as ACTIONS, SHOWS } from '../jev/sentence'
import { guessBrief } from '../brief'
import { PAGE_TEMPLATES, type PageTemplate } from '../site'
import type { SectionType } from '../types'
import type { ReadNeed, ReadStart } from './schema'

/** Words people use for a feel Blokmix lists under another name. */
export const FEEL_SYNONYMS: Record<string, string> = {
  cosy: 'cozy', homely: 'cozy', snug: 'cozy',
  handmade: 'earthy', 'hand-made': 'earthy', rustic: 'earthy', natural: 'earthy', organic: 'earthy', crafty: 'earthy',
  sleek: 'clean', crisp: 'clean', modern: 'clean', fresh: 'clean',
  corporate: 'trustworthy', professional: 'trustworthy', serious: 'trustworthy', businesslike: 'trustworthy',
  luxury: 'premium', luxurious: 'premium', upscale: 'premium', expensive: 'premium', fancy: 'elegant', refined: 'elegant',
  moody: 'dark', gothic: 'dark', quirky: 'playful', whimsical: 'playful', cheerful: 'friendly', welcoming: 'friendly',
  colourful: 'fun', colorful: 'fun', bright: 'fun', magazine: 'editorial', literary: 'bookish',
  vintage: 'retro', 'old-school': 'retro', nostalgic: 'retro', quiet: 'calm', serene: 'calm', peaceful: 'calm', relaxed: 'calm',
  techie: 'techy', futuristic: 'techy', technical: 'precise', gritty: 'raw', brutal: 'raw', brutalist: 'raw', punchy: 'bold', striking: 'bold',
  gentle: 'soft', pastel: 'soft', airy: 'soft', plain: 'simple', understated: 'minimal',
}

/** "not", "no", "never too"… right before a word turns it into something to steer away from. */
const NOT = /\b(?:not|no|never|nothing|without|avoid|isn['’]?t|aren['’]?t|less)\s+(?:too\s+|very\s+|so\s+|overly\s+|at\s+all\s+|a\s+bit\s+|remotely\s+)?$/i

export const bare = (label: string) => label.replace(/^(an?|my|our|the)\s+/i, '').toLowerCase()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Hit {
  at: number
  end: number
  /** The words as written. */
  words: string
  negated: boolean
}

/** Every whole-word place `phrase` appears in `text`. */
function hits(text: string, phrase: string): Hit[] {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu')
  return [...text.matchAll(re)].map((m) => ({ at: m.index!, end: m.index! + m[0].length, words: m[0], negated: NOT.test(text.slice(Math.max(0, m.index! - 40), m.index!)) }))
}

/** Feelings in the text, each with the words that said it, and whether it was said with a "not". */
export function feelsIn(text: string): { id: string; words: string; negated: boolean; at: number }[] {
  const out: { id: string; words: string; negated: boolean; at: number }[] = []
  const words = new Map<string, string>()
  for (const f of FEELS) {
    words.set(f.id, f.id)
    words.set(f.label.toLowerCase(), f.id)
  }
  for (const [w, id] of Object.entries(FEEL_SYNONYMS)) if (!words.has(w)) words.set(w, id)
  for (const [w, id] of words) for (const h of hits(text, w)) out.push({ id, words: h.words, negated: h.negated, at: h.at })
  // Longest first where they overlap ("dark and moody" over "dark").
  out.sort((a, b) => a.at - b.at || b.words.length - a.words.length)
  return out.filter((h, i) => !out.slice(0, i).some((o) => h.at < o.at + o.words.length && h.at >= o.at))
}

/** The start read from keywords: the same shape as the reader's, with nothing it couldn't find. */
export function keywordRead(text: string): ReadStart {
  const guess = guessBrief(text)
  const business = [...BUSINESSES]
    .sort((a, b) => bare(b.label).length - bare(a.label).length)
    .flatMap((b) => hits(text, bare(b.label)).filter((h) => !h.negated).map((h) => ({ b, h })))
    .sort((a, b) => a.h.at - b.h.at)[0]
  const inBusiness = (h: Hit) => !!business && h.at >= business.h.at && h.end <= business.h.end
  const feels = feelsIn(text).filter((f) => !business || f.at < business.h.at || f.at >= business.h.end)
  const action = ACTIONS.flatMap((a) => hits(text, a.label).filter((h) => !h.negated).map((h) => ({ a, h }))).sort((x, y) => x.h.at - y.h.at)[0]
  const shows = SHOWS.flatMap((s) => hits(text, bare(s.label)).filter((h) => !inBusiness(h)).map((h) => ({ s, h })))
  const name = /\b(?:called|named)\s+[“"']?([^.,;!?\n“”"]{1,40}?)[”"']?(?=[.,;!?\n]|\s+(?:and|that|which|who|in|on|for|with)\b|$)/i.exec(text)?.[1]?.trim() ?? null
  const who = /\bfor\s+((?:people|families|parents|kids|children|students|teams|anyone|everyone|small|local|busy|new|young|first[- ]time|dog|cat|pet|home|remote)[^.,;!?\n]{0,60})/i.exec(text)?.[1]?.trim() ?? null
  const pages = (Object.keys(PAGE_TEMPLATES) as (keyof typeof PAGE_TEMPLATES)[])
    .filter((t) => t !== 'blank')
    .flatMap((t) => hits(text, `${t} page`).filter((h) => !h.negated).map(() => ({ template: t, purpose: null })))
  const tone = /\b(dark)\s+(?:mode|theme|background|site)\b/i.test(text) ? 'dark' : /\b(light)\s+(?:mode|theme|background|site)\b/i.test(text) ? 'light' : null
  const uniq = <T,>(xs: T[]) => [...new Set(xs)]
  return {
    business: { id: (business?.b.id ?? null) as ReadStart['business']['id'], words: business?.h.words ?? null },
    kind: business?.b.kind ?? null,
    format: guess.format ?? null,
    industry: guess.industry ?? null,
    name: name || null,
    feel: {
      ids: uniq(feels.filter((f) => !f.negated).map((f) => f.id)) as ReadStart['feel']['ids'],
      words: uniq(feels.filter((f) => !f.negated).map((f) => f.words)),
      avoid: uniq(feels.filter((f) => f.negated).map((f) => f.id)) as ReadStart['feel']['avoid'],
      avoid_words: uniq(feels.filter((f) => f.negated).map((f) => f.words)),
    },
    goals: (guess.goals ?? []) as ReadStart['goals'],
    action: { id: (action?.a.id ?? null) as ReadStart['action']['id'], words: null },
    who,
    show: uniq(shows.filter((x) => !x.h.negated).map((x) => x.s.id)) as ReadStart['show'],
    hide: uniq(shows.filter((x) => x.h.negated).map((x) => x.s.id)) as ReadStart['hide'],
    pages,
    tone,
    unsure: [],
  }
}

/** Words that ask for a kind of section ("prices", "what people say"), in the order a need would want them. */
const NEED_WORDS: [SectionType, string[]][] = [
  ['pricing', ['pricing', 'prices', 'price list', 'price', 'plans', 'plan', 'packages', 'package', 'menu', 'rates', 'costs', 'cost', 'fees', 'tickets']],
  ['faq', ['faq', 'faqs', 'questions', 'question', 'answers', 'common questions', 'people ask']],
  ['contact', ['contact', 'get in touch', 'reach us', 'reach me', 'email', 'phone', 'call us', 'address', 'opening hours', 'hours', 'map', 'directions', 'find us', 'visit us', 'location']],
  ['team', ['team', 'staff', 'people behind', 'founders', 'who we are', 'our people', 'crew']],
  ['testimonials', ['reviews', 'review', 'testimonials', 'testimonial', 'what people say', 'what customers say', 'quotes', 'feedback', 'praise']],
  ['gallery', ['gallery', 'photos', 'pictures', 'portfolio', 'our work', 'projects', 'images', 'showcase']],
  ['features', ['features', 'services', 'what we do', 'what we offer', 'offerings', 'benefits', 'how it works', 'steps']],
  ['stats', ['numbers', 'stats', 'statistics', 'figures', 'results', 'metrics', 'impact']],
  ['logos', ['logos', 'clients', 'partners', 'press', 'as seen in', 'trusted by', 'sponsors']],
  ['blog', ['blog', 'posts', 'news', 'articles', 'updates', 'journal', 'stories']],
  ['content', ['story', 'our story', 'mission', 'history', 'explain', 'explains', 'background']],
  ['cta', ['sign up', 'signup', 'newsletter', 'subscribe', 'join', 'get started', 'book', 'booking', 'call to action', 'waitlist']],
  ['hero', ['headline', 'opening', 'intro', 'welcome']],
]

/** Words that ask for one of the page templates. */
const PAGE_WORDS: [PageTemplate, string[]][] = [
  ['about', ['about', 'about us', 'our story', 'who we are', 'team']],
  ['contact', ['contact', 'get in touch', 'find us', 'visit']],
  ['pricing', ['pricing', 'prices', 'plans', 'menu', 'packages']],
  ['blog', ['blog', 'news', 'posts', 'articles', 'journal']],
]

/**
 * "I need a [page | section] that …", from keywords: the sections its words ask for, in the order they're said (never
 * one said with a "not"), and for a page the template they point to. `what` is what was asked for, since the sentence
 * names it. The purpose is the text itself.
 */
export function keywordNeed(text: string, what: 'page' | 'section'): ReadNeed {
  const found = NEED_WORDS.flatMap(([type, words]) => words.flatMap((w) => hits(text, w).filter((h) => !h.negated).map((h) => ({ type, at: h.at, len: h.words.length }))))
  found.sort((a, b) => a.at - b.at || b.len - a.len)
  // Longest first where they overlap ("opening hours" over "opening").
  const kept = found.filter((h, i) => !found.slice(0, i).some((o) => h.at < o.at + o.len && h.at >= o.at))
  const sections = [...new Set(kept.map((f) => f.type))].slice(0, 4)
  const page = what === 'page' ? (PAGE_WORDS.flatMap(([t, words]) => words.flatMap((w) => hits(text, w).filter((h) => !h.negated).map((h) => ({ t, at: h.at })))).sort((a, b) => a.at - b.at)[0]?.t ?? 'blank') : null
  const purpose = text.trim() || null
  return { what, template: page, sections: sections as ReadNeed['sections'], purpose, unsure: sections.length || page !== 'blank' ? [] : purpose ? [purpose] : [] }
}

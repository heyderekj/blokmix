// Starting from a sentence: "a bakery on Elm Street that takes pre-orders, with a menu and
// our hours". Jev says what kind of site it is, which sections it needs, and which looks
// fit; code turns that into the kind's page with sections added or dropped. The sentence
// is never put on the page: it describes the site, it isn't copy. (Pasted copy goes
// through a page from your words instead; `textMode` tells the two apart.)

import { KINDS, type Kind, type SectionType } from '../types'
import { RECIPES } from '../start'
import { choice, noul } from './ask'
import { clip } from './state'
import { merged, shuffled } from './shuffle'
import { ranked, yes } from './read'
import { KIND_CRITERIA, SECTION_CRITERIA } from './vocab'
import type { Criterion, JevRequest, JevResponse } from './types'

export const DESCRIBE_THRESHOLDS = {
  /** The kind, when both orders agree at this. Below, the kind chip waits for you. */
  kind: 0.45,
  /** A section the kind doesn't have joins at this. */
  add: 0.7,
  /** A section the kind has is dropped at or below this. */
  drop: 0.15,
  /** A look worth offering. */
  skin: 0.15,
  /** A description is at most this long, and this many lines; more is copy to place. */
  describeChars: 240,
  describeLines: 2,
}

/** Sections a description can add or drop. The nav, hero, closing push and footer always stay. */
export const OPTIONAL: SectionType[] = ['logos', 'stats', 'features', 'content', 'gallery', 'team', 'testimonials', 'pricing', 'blog', 'faq', 'contact']

/** Where each section sits on a page, top to bottom, for placing one the kind doesn't have. */
const ORDER: SectionType[] = ['nav', 'hero', 'header', 'logos', 'stats', 'features', 'content', 'gallery', 'team', 'testimonials', 'pricing', 'blog', 'faq', 'contact', 'cta', 'footer']

export type TextMode = 'describe' | 'paste'

/** One or two short lines describe the site; anything longer is copy to place, word for word. Code decides, not Jev. */
export function textMode(text: string): TextMode {
  const lines = text.split('\n').filter((l) => l.trim())
  return lines.length > DESCRIBE_THRESHOLDS.describeLines || text.trim().length > DESCRIBE_THRESHOLDS.describeChars ? 'paste' : 'describe'
}

export interface Look {
  id: string
  name: string
  words: string
}

/** One request: the kind (both orders), whether each optional section is wanted, and the look (both orders). */
export function describeRequest(text: string, looks: Look[]): JevRequest {
  const description = clip(text.trim(), 400)
  const questions: JevRequest['questions'] = {
    ...shuffled('kind', choice({ question: 'What kind of website is this description for?', description }, KIND_CRITERIA)),
  }
  // Each question carries the description itself: pointing at the state makes Jev drift.
  for (const t of OPTIONAL) questions[`need_${t}`] = noul({ question: `Would the website described here need a section for this: ${SECTION_CRITERIA[t].what}?`, description })
  if (looks.length > 1) {
    const criteria: Record<string, Criterion> = Object.fromEntries(looks.slice(0, 40).map((l) => [l.id, { what: `${l.name}: ${l.words}` }]))
    Object.assign(questions, shuffled('look', choice({ question: 'Which of these looks suits the website described here best?', description }, criteria)))
  }
  return { state: { description }, questions }
}

export interface Described {
  /** The kind when Jev is sure (both orders agreeing), else null. */
  kind: Kind | null
  /** Every kind, likeliest first, for the chip's other choices. */
  kinds: { kind: Kind; p: number }[]
  /** How likely each optional section is wanted. */
  want: Partial<Record<SectionType, number>>
  /** Looks worth offering, best first (at most two). */
  looks: string[]
}

export function readDescribe(res: JevResponse | null): Described | null {
  const k = merged(res, 'kind')
  if (!res || !k) return null
  const kinds = ranked(k)
    .filter((x) => (KINDS as readonly string[]).includes(x.option))
    .map((x) => ({ kind: x.option as Kind, p: x.p }))
  const best = kinds[0]
  const kind = best && k.agree && best.p >= DESCRIBE_THRESHOLDS.kind ? best.kind : null
  const want: Described['want'] = {}
  for (const t of OPTIONAL) {
    const p = yes(res, `need_${t}`)
    if (p !== null) want[t] = p
  }
  const l = merged(res, 'look')
  const looks = l ? ranked(l).filter((x) => x.p >= DESCRIBE_THRESHOLDS.skin).slice(0, 2).map((x) => x.option) : []
  return { kind, kinds, want, looks }
}

/** The kind's home page with the sections a description asks for added and the ones it clearly doesn't want dropped. */
export function sectionsFor(kind: Kind, want: Described['want']): SectionType[] {
  const T = DESCRIBE_THRESHOLDS
  let out = RECIPES[kind].home.filter((t) => !(OPTIONAL.includes(t) && (want[t] ?? 1) <= T.drop))
  for (const t of OPTIONAL) if (!out.includes(t) && (want[t] ?? 0) >= T.add) out = placeSection(out, t)
  return out
}

/** A section added where it belongs on a page (before the first one that comes after it). */
export function placeSection(types: SectionType[], add: SectionType): SectionType[] {
  if (types.includes(add)) return types
  const at = types.findIndex((t) => ORDER.indexOf(t) > ORDER.indexOf(add))
  return at < 0 ? [...types, add] : [...types.slice(0, at), add, ...types.slice(at)]
}

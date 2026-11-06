// What people ask for that Blokmix can't do yet. When Say it, Pour or Dress it up find
// nothing that fits, Jev names what was wanted from a closed list (the gap finder's
// elements plus kinds of section Blokmix has no type for), and only that name is counted:
// never the words. Together with the gap finder, it says what to make next.

import { ELEMENTS } from './gaps'
import { choice } from './ask'
import { clip } from './state'
import { choiceOf, top } from './read'
import type { Criterion, JevRequest, JevResponse } from './types'

/** Sections Blokmix has no type for yet, beside the gap finder's elements. */
const NEW_SECTIONS: Record<string, Criterion> = {
  menu: { what: 'A food or drink menu with prices' },
  events: { what: 'A list of events, dates or a schedule' },
  products: { what: 'A shop: products with prices and buying' },
  booking: { what: 'Booking or reserving a time, a table or an appointment' },
  locations: { what: 'Several locations or a store finder' },
  hours: { what: 'Opening hours' },
  map: { what: 'A map' },
  video: { what: 'A video' },
  newsletter: { what: 'An email sign-up' },
  social: { what: 'Social media links or an Instagram feed' },
  reviews: { what: 'Star ratings or reviews from a review site' },
  portfolio: { what: 'Case studies or a portfolio of work' },
  jobs: { what: 'Job openings' },
  donate: { what: 'Donations or payments' },
  login: { what: 'Signing in or an account area' },
  search: { what: 'Search on the site' },
  language: { what: 'More than one language' },
  animation: { what: 'Animation or movement on the page' },
}

export const WANTS: Record<string, Criterion> = {
  ...NEW_SECTIONS,
  ...Object.fromEntries(ELEMENTS.filter((e) => !(e.id in NEW_SECTIONS)).map((e) => [e.id, { what: e.label }])),
  other: { what: 'Something else, or nothing a website shows' },
}

export const WANT_IDS = Object.keys(WANTS)

/** Counted only when this sure; anything vaguer isn't worth a row. */
export const WANT_THRESHOLD = 0.5

export type WantFeature = 'say' | 'pour' | 'dress'

export function wantRequest(texts: string[]): JevRequest {
  const questions: JevRequest['questions'] = {}
  texts.forEach((t, i) => {
    questions[`want_${i}`] = choice({ question: 'What is someone building a website asking for here?', ask: clip(t, 200) }, WANTS)
  })
  return { state: 'Someone building a website asked Blokmix for something it couldn’t do.', questions }
}

/** The wants worth counting: named, not "other", and sure enough. */
export function readWants(res: JevResponse | null, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const a = choiceOf(res, `want_${i}`)
    if (!a) continue
    const t = top(a)
    if (t.option !== 'other' && t.p >= WANT_THRESHOLD) out.push(t.option)
  }
  return out
}

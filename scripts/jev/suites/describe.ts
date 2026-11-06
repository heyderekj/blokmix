// Starting from a sentence: what kind of site it is, and which sections it clearly needs or
// doesn't. Hand-labelled descriptions, the way people type them into the start box; the
// rule before Jev was no kind at all (you picked it), so there's no baseline.

import { describeRequest } from '../../../resources/js/core/jev/describe'
import { merged, yes } from '../../../resources/js/core/jev'
import { skinList, WIREFRAME } from '../../../resources/js/core/skins'
import type { Kind, SectionType } from '../../../resources/js/core/types'
import type { Suite } from './index'
import type { Judged } from '../metrics'

interface Case {
  text: string
  kind: Kind
  /** Sections it clearly needs. */
  need?: SectionType[]
  /** Sections it clearly doesn't. */
  not?: SectionType[]
}

const CASES: Case[] = [
  { text: 'A bakery on Elm Street that takes pre-orders, with our menu, prices and opening hours', kind: 'local', need: ['pricing', 'contact'], not: ['blog', 'logos'] },
  { text: 'my dentist practice, need people to book a cleaning', kind: 'local', need: ['contact'], not: ['blog'] },
  { text: 'Bike repair shop in Leeds. Opening times, what we fix, how to find us', kind: 'local', need: ['contact', 'features'] },
  { text: 'a yoga studio with a class timetable and drop-in prices', kind: 'local', need: ['pricing'] },
  { text: 'Budgeting app for couples, free trial then $6 a month', kind: 'product', need: ['pricing', 'features'], not: ['team'] },
  { text: 'smart lamp that wakes you with sunrise light, preorder now', kind: 'product', need: ['features'] },
  { text: 'an API for sending invoices, developers sign up and pay per invoice', kind: 'product', need: ['pricing', 'faq'] },
  { text: 'Chrome extension that clips sections of websites', kind: 'product', need: ['features'], not: ['team'] },
  { text: 'Two-person brand design studio in Lisbon, show our work and get clients in touch', kind: 'studio', need: ['gallery', 'contact'], not: ['pricing'] },
  { text: 'wedding photographer, portfolio and packages', kind: 'studio', need: ['gallery', 'pricing'] },
  { text: 'Accountant for freelancers. Fixed monthly fee, questions people ask, book a call', kind: 'studio', need: ['pricing', 'faq', 'contact'] },
  { text: 'landscape architecture practice with a team of 12', kind: 'studio', need: ['team', 'gallery'] },
  { text: 'A one-day design conference in Porto on May 14, speakers and tickets', kind: 'event', need: ['team', 'pricing'], not: ['blog'] },
  { text: 'waitlist for our product launch next month', kind: 'event', not: ['team', 'gallery'] },
  { text: 'community meetup for React developers every second Tuesday', kind: 'event', need: ['faq'] },
  { text: 'summer music festival, lineup, tickets and camping info', kind: 'event', need: ['pricing', 'faq'] },
  { text: 'my portfolio as a frontend developer with my CV and how to hire me', kind: 'personal', need: ['contact'], not: ['pricing', 'logos'] },
  { text: 'personal site, about me and a few photos from my travels', kind: 'personal', need: ['gallery'], not: ['pricing'] },
  { text: 'illustrator portfolio, commissions open', kind: 'personal', need: ['gallery', 'contact'] },
  { text: 'resume site for a product manager', kind: 'personal', not: ['pricing', 'gallery'] },
  { text: 'A weekly newsletter about urban gardening, free to subscribe', kind: 'writing', need: ['blog'], not: ['pricing', 'team'] },
  { text: 'food blog with recipes and a few essays', kind: 'writing', need: ['blog'] },
  { text: 'independent magazine about architecture, paid subscriptions', kind: 'writing', need: ['blog', 'pricing'] },
  { text: 'my substack-style essays on tech and culture', kind: 'writing', need: ['blog'], not: ['gallery'] },
]

const looks = () =>
  skinList()
    .filter((s) => s.id !== WIREFRAME)
    .map((s) => ({ id: s.id, name: s.name, words: s.words }))

export const describe: Suite<Case> = {
  name: 'describe',
  load: async () => CASES,
  request: (c) => describeRequest(c.text, looks()),
  judge(c, res) {
    const k = merged(res, 'kind')
    const out: Judged[] = [{ truth: c.kind, jev: k?.choice ?? '', p: k?.probabilities[k.choice] ?? 0, agree: k?.agree }]
    for (const [t, want] of [...(c.need ?? []).map((t) => [t, 'yes'] as const), ...(c.not ?? []).map((t) => [t, 'no'] as const)]) {
      const p = yes(res, `need_${t}`) ?? 0.5
      const said = p >= 0.5 ? 'yes' : 'no'
      out.push({ truth: `${t}:${want}`, jev: `${t}:${said}`, p: said === 'yes' ? p : 1 - p, agree: undefined })
    }
    return out
  },
}

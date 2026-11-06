// Smart links: where a button should go when its words don't name a section outright.
// "See plans", "Book a table", "Meet us": Blokmix's keyword rule (core/links.ts
// suggestLink) catches "Pricing" but not these, so they lead nowhere. Jev picks one of
// the page's real sections or the site's pages, or says nothing fits.

import type { LinkTarget, SectionType } from '../types'
import { TYPE_LABEL } from '../content'
import type { LinkScope } from '../links'
import { choice, at } from './ask'
import { clip } from './state'
import { shuffled, merged } from './shuffle'
import { route, type Route } from './read'
import type { Criterion, JevRequest, JevResponse } from './types'

/** Set the link outright at `act` (both option orders agreeing); offer it as a fix from `offer`. */
export const LINK_THRESHOLDS = { act: 0.85, offer: 0.5 }

/** A link that leads nowhere today, with its words and where it sits. */
export interface LinkAsk {
  slotId: string
  blockId: string
  words: string
  sectionType: SectionType
}

export interface Destination {
  key: string
  target: LinkTarget | null
  label: string
  criterion: Criterion
}

/** Where a link from `fromSlotId` could go: this page's sections (not its own, the nav or footer) and the site's other pages. */
export function destinations(scope: LinkScope, headings: Record<string, string>, fromSlotId: string, here?: string): Destination[] {
  const out: Destination[] = []
  for (const s of scope.slots) {
    if (s.id === fromSlotId || s.type === 'nav' || s.type === 'footer' || scope.elsewhere?.[s.id]) continue
    const h = headings[s.id]
    out.push({ key: `s_${s.id}`, target: { to: 'section', slotId: s.id }, label: `${TYPE_LABEL[s.type]} section`, criterion: { what: `The ${TYPE_LABEL[s.type].toLowerCase()} section on this page${h ? `, headed “${clip(h, 80)}”` : ''}` } })
  }
  for (const p of scope.pages ?? []) {
    if (p.id === here || p.path === '/') continue
    out.push({ key: `p_${p.id}`, target: { to: 'page', path: p.path, pageId: p.id }, label: `${p.title} page`, criterion: { what: `The ${p.title} page (${p.path})` } })
  }
  out.push({ key: 'stay', target: null, label: 'nowhere', criterion: { what: 'None of these: the words don’t match any section or page here' } })
  return out
}

const qName = (i: number) => `to_${i}`

/** One request for every link that leads nowhere: one Choice each, asked in both option orders. */
export function linkRequest(asks: LinkAsk[], dests: (a: LinkAsk) => Destination[]): JevRequest {
  const questions = Object.assign(
    {},
    ...asks.map((a, i) =>
      shuffled(qName(i), choice(`Where should a visitor land after pressing ${at(`links[${i}].words`)}?`, Object.fromEntries(dests(a).map((d) => [d.key, d.criterion])))),
    ),
  )
  return { state: { links: asks.map((a) => ({ words: clip(a.words, 120), in_section: TYPE_LABEL[a.sectionType] })) }, questions }
}

export interface LinkGuess extends LinkAsk {
  target: LinkTarget | null
  label: string
  p: number
  agree: boolean
  route: Route
}

/** Jev's pick for each link, with how sure it is and whether to set it, offer it or leave it. */
export function readLinks(res: JevResponse | null, asks: LinkAsk[], dests: (a: LinkAsk) => Destination[]): LinkGuess[] {
  return asks.flatMap((a, i) => {
    const m = merged(res, qName(i))
    if (!m) return []
    const d = dests(a).find((x) => x.key === m.choice)
    if (!d || !d.target) return []
    const p = m.probabilities[m.choice] ?? 0
    const r = route(p, LINK_THRESHOLDS)
    return [{ ...a, target: d.target, label: d.label, p, agree: m.agree, route: r === 'act' && !m.agree ? 'offer' : r }]
  })
}

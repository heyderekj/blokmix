// Rules-based suggestions for adding a section: which kind of section fits a
// spot in the page's flow, and which clip or layout reads well next to its
// neighbours. Every suggestion carries a short reason, so it's explainable
// (and an agent can take this over later).

import type { Library, Rhythm, SectionType, Slot } from './types'
import { pickable } from './library'
import { SECTION_TYPES } from './types'
import { TYPE_LABEL } from './content'

type PageSlot = Pick<Slot, 'type' | 'clipId'>

export interface TypeSuggestion {
  type: SectionType
  score: number
  reason: string
  /** False when a hard rule rules it out here (a second nav, a footer mid-page). */
  allowed: boolean
}

export interface ClipSuggestion {
  clipId: string
  score: number
  reason: string
}

/**
 * What usually comes next after each type, strongest first. Built from the
 * common landing order (nav → hero → logos → features → stats → testimonials →
 * pricing → FAQ → CTA → footer) and the inner-page order (nav → page header →
 * content / team / contact / blog → CTA → footer).
 */
const NEXT: Record<SectionType, SectionType[]> = {
  nav: ['hero', 'header'],
  hero: ['logos', 'features', 'stats', 'content'],
  header: ['content', 'team', 'contact', 'blog', 'features'],
  logos: ['features', 'testimonials', 'stats'],
  features: ['stats', 'testimonials', 'pricing', 'cta', 'content'],
  stats: ['testimonials', 'features', 'pricing'],
  content: ['team', 'stats', 'features', 'cta'],
  team: ['testimonials', 'content', 'contact', 'cta'],
  testimonials: ['pricing', 'cta', 'faq'],
  pricing: ['faq', 'testimonials', 'cta'],
  blog: ['cta', 'contact', 'faq'],
  faq: ['cta', 'contact'],
  contact: ['faq', 'cta'],
  cta: ['footer'],
  footer: [],
}

/** Specific reasons for the pairings the research calls out. Keyed "above>type" or "type<below". */
const PAIR_REASON: Record<string, string> = {
  'hero>logos': 'Logos right after the hero build trust early',
  'nav>hero': 'Every landing page opens with a hero',
  'nav>header': 'Inner pages open with a page header',
  'features>testimonials': 'Proof right after you say what it does',
  'testimonials<pricing': 'Social proof just before pricing',
  'pricing>faq': 'Answers pricing questions before they stall',
  'cta<footer': 'A last call to action before the footer',
  'header>content': 'The story behind the page header',
  'header>team': 'Introduce the people on an about page',
  'header>contact': 'Get in touch, right under the header',
  'header>blog': 'Latest posts under the page header',
  'hero>features': 'Say what it does, right after the hero',
}

const lower = (t: SectionType) => (t === 'faq' || t === 'cta' ? TYPE_LABEL[t] : TYPE_LABEL[t].toLowerCase())

export function isInnerPage(slots: PageSlot[]): boolean {
  return slots.some((s) => s.type === 'header') && !slots.some((s) => s.type === 'hero')
}

/** Rank every section type for a new section inserted at `insertAt` (0 = top). */
export function suggestTypes(slots: PageSlot[], insertAt: number): TypeSuggestion[] {
  const above = slots[insertAt - 1]?.type
  const below = slots[insertAt]?.type
  const count = (t: SectionType) => slots.filter((s) => s.type === t).length
  const has = (t: SectionType) => count(t) > 0
  const atEnd = insertAt >= slots.length
  const inner = isInnerPage(slots)
  const opened = has('hero') || has('header')

  const out = SECTION_TYPES.map((type): TypeSuggestion => {
    const reasons: { w: number; text: string }[] = []
    const add = (w: number, text: string) => reasons.push({ w, text })
    let allowed = true
    const block = (text: string) => {
      allowed = false
      add(-100, text)
    }

    // Hard constraints.
    if (above === 'footer') block('Nothing goes below the footer')
    if (below === 'nav' && type !== 'nav') block('Nothing goes above the nav')
    if (type === 'nav') {
      if (has('nav')) block('The page already has a nav')
      else if (insertAt !== 0) block('The nav goes at the very top')
      else add(3, 'Every page starts with a nav')
    }
    if (type === 'footer') {
      if (has('footer')) block('The page already has a footer')
      else if (!atEnd) block('The footer goes at the very bottom')
      else add(3, 'Every page ends with a footer')
    }
    if (type === 'hero' || type === 'header') {
      if (opened) block(has('hero') ? 'The page already opens with a hero' : 'The page already opens with a page header')
      else if (slots.slice(0, insertAt).some((s) => s.type !== 'nav')) block(`The ${lower(type)} goes at the top`)
      else add(2, type === 'hero' ? 'The page has no hero yet' : 'An inner page could open with a page header')
    }

    // Flow affinity: what usually follows the section above, and leads into the one below.
    if (above) {
      const i = NEXT[above].indexOf(type)
      if (i >= 0) add(3 - i * 0.5, PAIR_REASON[`${above}>${type}`] ?? `Often follows the ${lower(above)}`)
    }
    if (below) {
      const i = NEXT[type].indexOf(below)
      if (i >= 0) add(2 - i * 0.4, PAIR_REASON[`${type}<${below}`] ?? `Leads into the ${lower(below)}`)
    }
    const afterAbove = above && NEXT[above].includes(type)
    const intoBelow = below && NEXT[type].includes(below)
    if (afterAbove && intoBelow && !PAIR_REASON[`${above}>${type}`] && !PAIR_REASON[`${type}<${below}`])
      add(0.5, `Bridges the ${lower(above)} and ${lower(below)}`)
    // A pairing rule named for this spot beats generic affinity.
    const named = PAIR_REASON[`${above}>${type}`] ?? PAIR_REASON[`${type}<${below}`]
    if (named) add(1, named)

    // Inner pages lean towards inner-page sections; landing pages away from them.
    const innerish = type === 'content' || type === 'team' || type === 'contact' || type === 'blog'
    if (inner && innerish) add(1, 'A good fit for an inner page')
    if (inner && (type === 'pricing' || type === 'logos')) add(-1, '')
    if (!inner && opened && innerish) add(-0.5, '')

    // Completeness: what the page is missing at this spot.
    if (type === 'cta' && below === 'footer' && !has('cta')) add(2, 'No call to action before the footer yet')
    if (type === 'features' && has('hero') && !has('features') && !inner) add(1, 'The page doesn’t say what it does yet')
    if (type === 'faq' && has('pricing') && !has('faq') && slots.findIndex((s) => s.type === 'pricing') < insertAt) add(1, 'Pricing usually raises a few questions')

    // Variety.
    if (type === above || type === below) add(-3, `Same as the section ${type === above ? 'above' : 'below'}`)
    if (count(type) >= 2) add(-2, `Already ${count(type)} on the page`)
    else if (count(type) === 1 && type !== above && type !== below) add(-1, '')

    const score = reasons.reduce((n, r) => n + r.w, 0)
    const best = allowed
      ? (reasons.find((r) => r.text.startsWith('Bridges')) ?? reasons.filter((r) => r.w > 0 && r.text).sort((a, b) => b.w - a.w)[0])
      : reasons.find((r) => r.w === -100)
    return { type, score, allowed, reason: best?.text ?? `A ${lower(type)} section` }
  })

  return out.sort((a, b) => Number(b.allowed) - Number(a.allowed) || b.score - a.score || SECTION_TYPES.indexOf(a.type) - SECTION_TYPES.indexOf(b.type))
}

const RHYTHM_WORD: Record<Rhythm, string> = { centered: 'Centered', split: 'Split', grid: 'Grid', stack: 'Stacked', band: 'Band' }

/**
 * Rank the clips and layouts for a section of `type` at `index`. With
 * `replace`, the section already at `index` is the one being swapped, so its
 * neighbours are index-1 and index+1; otherwise it's a new section inserted
 * there. Built-in layouts come first, ordered by how well their rhythm contrasts
 * with the neighbours: they're the dependable start for a new section. Your clips
 * follow (personal and specific, they stay a click away on their own shelf).
 */
export function suggestClip(type: SectionType, slots: PageSlot[], index: number, library: Library, replace = false): ClipSuggestion[] {
  const above = slots[index - 1]
  const below = slots[replace ? index + 1 : index]
  const aboveClip = above ? library.clips[above.clipId] : undefined
  const belowClip = below ? library.clips[below.clipId] : undefined

  return pickable(library, type)
    .map((clipId, order): ClipSuggestion & { order: number } => {
      const clip = library.clips[clipId]
      let score = clip.origin === 'layout' ? 100 : 0
      let reason = clip.origin === 'clip' ? 'From your clips' : ''
      const r = clip.rhythm
      if (r && aboveClip?.rhythm) {
        if (r !== aboveClip.rhythm) {
          score += 2
          if (!reason) reason = `${RHYTHM_WORD[r]}, to contrast the ${aboveClip.rhythm} ${lower(aboveClip.type)} above`
        } else {
          score -= 1
          if (!reason) reason = `${RHYTHM_WORD[r]}, like the ${lower(aboveClip.type)} above`
        }
      }
      if (r && belowClip?.rhythm && r !== belowClip.rhythm) score += 1
      if (clip.origin === 'clip' && aboveClip && aboveClip.sourceId === clip.sourceId && aboveClip.origin === 'clip') score -= 0.5
      if (!reason) reason = r ? `${RHYTHM_WORD[r]} layout` : 'A clean starting point'
      return { clipId, score, reason, order }
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ clipId, score, reason }) => ({ clipId, score, reason }))
}

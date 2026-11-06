// Pictures that fit. Two jobs:
//  - Find the subject of a photo (a Box) so a cropped picture keeps it in frame at every
//    ratio and on phones: the subject's center becomes the fill's focus (object-position).
//  - Rank stock photos by how well each fits the section's words and the skin's mood, one
//    Score per photo, so Jev's lean toward the first option can't creep in.

import type { StockPhoto } from '../types'
import { box, choice, noul, score, at } from './ask'
import { clip } from './state'
import { boxOf, choiceOf, levelP, scoreOf, yes } from './read'
import type { JevAsset, JevRequest, JevResponse } from './types'

export const PHOTO_THRESHOLDS = {
  /** The photo has one clear subject (else the center crop is as good as any). */
  subject: 0.5,
  /** A box covering less than this share of the picture is too small to trust, more is the whole thing. */
  minArea: 0.02,
  maxArea: 0.95,
}

const SUBJECT_KINDS = {
  person: { what: 'One or more people, their faces showing' },
  product: { what: 'An object or product' },
  food: { what: 'Food or drink' },
  animal: { what: 'An animal' },
  place: { what: 'A place, building, room or landscape with no single subject' },
  other: { what: 'Something else, or a pattern or texture' },
}

export function subjectRequest(ref: string, asset: JevAsset): JevRequest {
  return {
    model: 'jev-preview',
    state: { photo: ref },
    assets: { [ref]: asset },
    questions: {
      subject: box(`The main subject of ${at('photo')}: the person, face, product or thing the picture is about`),
      has_subject: noul(`Does ${at('photo')} have one clear main subject, rather than being a scene, a texture or a crowd?`),
      kind: choice(`What is the main subject of ${at('photo')}?`, SUBJECT_KINDS),
    },
  }
}

/**
 * The focus for a photo from Jev's answers, in fractions of the picture (`toPicture` maps from the letterboxed
 * canvas Jev saw). A person's focus sits near the top of their box, where the face is; anything else, its center.
 * Null when there's no clear subject or the box is too small or the whole picture.
 */
export function focusFrom(
  res: JevResponse | null,
  toPicture: (b: { top: number; bottom: number; left: number; right: number }) => { top: number; bottom: number; left: number; right: number } = (b) => b,
): { x: number; y: number; kind: string } | null {
  const b = boxOf(res, 'subject')?.box
  const clear = yes(res, 'has_subject') ?? 0
  if (!b || clear < PHOTO_THRESHOLDS.subject) return null
  const p = toPicture(b)
  const w = p.right - p.left
  const h = p.bottom - p.top
  const area = w * h
  if (!(w > 0 && h > 0) || area < PHOTO_THRESHOLDS.minArea || area > PHOTO_THRESHOLDS.maxArea) return null
  const kind = choiceOf(res, 'kind')?.choice ?? 'other'
  const round = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100) / 100
  return { x: round(p.left + w / 2), y: round(kind === 'person' ? p.top + h * 0.28 : p.top + h / 2), kind }
}

/** Stock thumbnails Jev can read: JPEG (no WebP/AVIF), cropped to a size inside its limits. */
export function jevThumbUrl(p: Pick<StockPhoto, 'url'>, w = 448, h = 336): string {
  const u = new URL(p.url)
  u.searchParams.set('w', String(w))
  u.searchParams.set('h', String(h))
  u.searchParams.set('fit', 'crop')
  u.searchParams.set('fm', 'jpg')
  u.searchParams.set('q', '70')
  u.searchParams.delete('auto')
  return u.toString()
}

/** A larger JPEG for finding the subject (not cropped, so the box lands on the whole picture). */
export function jevPhotoUrl(p: Pick<StockPhoto, 'url'>, w = 960): string {
  const u = new URL(p.url)
  u.searchParams.set('w', String(w))
  u.searchParams.set('fit', 'max')
  u.searchParams.set('fm', 'jpg')
  u.searchParams.set('q', '70')
  u.searchParams.delete('auto')
  return u.toString()
}

export const FIT_LEVELS = [
  'Wrong: about something else, or clashes with the words',
  'Weak: loosely related',
  'Fine: fits, but generic',
  'Good: clearly about this',
  'Great: exactly what these words are about, in the right mood',
]

export interface PhotoBrief {
  /** The section's own words: its heading and intro. */
  words: string
  /** What the site is (the kind in words) and the skin's one line, for mood. */
  site?: string
  look?: string
  query?: string
}

/** One Score per photo against the same brief, all in one request. */
export function rankRequest(brief: PhotoBrief, refs: string[], assets: Record<string, JevAsset>): JevRequest {
  const questions = Object.fromEntries(
    refs.map((ref, i) => [`fit_${i}`, score({ question: `How well would this photo illustrate ${at('section')}?`, photo: ref }, FIT_LEVELS)]),
  )
  return {
    state: {
      section: { words: clip(brief.words, 400), site: brief.site ?? null, look: brief.look ?? null, searched_for: brief.query ?? null },
    },
    questions,
    assets,
  }
}

/** Indexes in their new order: best fit first, the original order breaking ties (and keeping any Jev didn't rate). */
export function rankedOrder(res: JevResponse | null, count: number): { order: number[]; fit: (number | null)[] } {
  const fit = Array.from({ length: count }, (_, i) => {
    const a = scoreOf(res, `fit_${i}`)
    // The expected level, nudged by how much sits on Great: a sure "good" beats a split "good/wrong".
    return a ? a.score + 0.25 * levelP(a, FIT_LEVELS.length - 1) : null
  })
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => (fit[b] ?? -1) - (fit[a] ?? -1) || a - b)
  return { order, fit }
}

// A look from your own words: "warm and handmade, a bit editorial, roomier, not corporate". The feelings in them lean
// the theme (the start's feels and their synonyms, mapped to the theme's feel words; "not …" steers away), the nudges
// turn its dials (roomier, rounder, bolder…), and light or dark sets the tone. Pure: it only reads.

import { feelsIn } from './reader/local'
import { SENTENCE_FEEL, type FeelWord, type Nudge } from './feel'

export interface LookRead {
  /** Feel words to lean toward, in the order said. */
  words: FeelWord[]
  /** Feel words said with a "not", to steer away from. */
  avoid: FeelWord[]
  /** Dial nudges, in the order said. */
  nudges: Nudge[]
  tone: 'light' | 'dark' | null
}

/** Words that turn a dial, each read as one nudge (never one said with a "not"). */
const NUDGE_WORDS: [Nudge, RegExp][] = [
  ['roomier', /\b(roomier|more (?:space|room|breathing room)|spacious|airier|breathe)\b/i],
  ['tighter', /\b(tighter|denser|compact|more compact|less space)\b/i],
  ['rounder', /\b(rounder|rounded|round corners|soft corners|pill(?:-| )?shaped|bubbly)\b/i],
  ['sharper', /\b(sharper|square(?:d)?(?: corners)?|sharp corners|boxy|angular)\b/i],
  ['bolder', /\b(bolder|bigger (?:type|text|headings)|louder|heavier|chunky|punchier)\b/i],
  ['quieter', /\b(quieter|smaller (?:type|text)|subtler|subtle|understated|lighter type|softer)\b/i],
]

const NOT_BEFORE = /\b(?:not|no|never|without|avoid|less)\s+(?:too\s+|very\s+|so\s+|a\s+bit\s+)?$/i

export function readLook(text: string): LookRead {
  const words: FeelWord[] = []
  const avoid: FeelWord[] = []
  for (const f of feelsIn(text)) {
    const w = SENTENCE_FEEL[f.id]
    if (!w) continue
    if (f.negated) avoid.push(w)
    else words.push(w)
  }
  const nudges: Nudge[] = []
  for (const [nudge, re] of NUDGE_WORDS) {
    const m = re.exec(text)
    if (m && !NOT_BEFORE.test(text.slice(Math.max(0, m.index - 30), m.index))) nudges.push(nudge)
  }
  nudges.sort((a, b) => text.search(NUDGE_WORDS.find(([n]) => n === a)![1]) - text.search(NUDGE_WORDS.find(([n]) => n === b)![1]))
  const darkSaid = /\b(dark|darker|night|moody|black background)\b/i.exec(text)
  const lightSaid = /\b(light|lighter|bright|white background|airy)\b/i.exec(text)
  const said = (m: RegExpExecArray | null) => !!m && !NOT_BEFORE.test(text.slice(Math.max(0, m.index - 30), m.index))
  const tone = said(darkSaid) && !said(lightSaid) ? 'dark' : said(lightSaid) && !said(darkSaid) ? 'light' : null
  const uniq = <T,>(xs: T[]) => [...new Set(xs)]
  const toward: FeelWord[] = uniq(words).filter((w) => w !== 'dark')
  return { words: toward, avoid: uniq(avoid).filter((w) => !toward.includes(w)), nudges: uniq(nudges), tone }
}

/** Whether there's anything in it to act on. */
export const saysAnything = (r: LookRead) => !!(r.words.length || r.avoid.length || r.nudges.length || r.tone)

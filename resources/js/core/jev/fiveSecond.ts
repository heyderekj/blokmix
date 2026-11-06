// The five-second test: show the first screen's words to someone who's never seen the
// site and ask what it's for. Jev is that visitor. How sure it is matters as much as its
// guess: a visitor torn between "a studio" and "a product" is what a first screen
// shouldn't leave them. Only the words that show before scrolling are sent.

import { KINDS, type BlockInfo, type Kind } from '../types'
import type { ScoreCheck } from '../score'
import { choice, noul, at } from './ask'
import { clip } from './state'
import { merged, shuffled } from './shuffle'
import { topTwo, yes } from './read'
import { KIND_CRITERIA, KIND_WORDS } from './vocab'
import type { JevRequest, JevResponse } from './types'

export const FIVE_SECOND_THRESHOLDS = {
  /** A guess this likely (both orders agreeing) is a visitor who'd be sure. */
  sure: 0.75,
  /** Two kinds both at least this likely: the visitor is torn between them. */
  torn: 0.3,
  /** A check passes at `yes` and fails at `no`; between, it's said but doesn't count. */
  yes: 0.65,
  no: 0.35,
}

/** The first screen in words, as a visitor reads it. */
export interface FirstScreen {
  brand?: string
  nav: string[]
  headline?: string
  intro?: string
  buttons: string[]
  other: string[]
}

/** The words of the blocks that show above the fold, sorted into what a visitor notices. */
export function firstScreenWords(shown: { block: BlockInfo; words: string; sectionType: string }[]): FirstScreen {
  const out: FirstScreen = { nav: [], buttons: [], other: [] }
  for (const { block, words, sectionType } of shown) {
    const w = words.trim()
    if (!w) continue
    if (sectionType === 'nav') {
      if (block.kind === 'image' || block.field === 'brand' || block.field === 'logo') out.brand ??= w
      else if (block.kind === 'link' || block.kind === 'button') out.nav.push(w)
      continue
    }
    if (block.kind === 'heading' && !out.headline) out.headline = w
    else if (block.kind === 'button') out.buttons.push(w)
    else if (block.kind === 'text' && !out.intro && /^(intro|subhead|lead|body)$/i.test(block.field ?? '')) out.intro = w
    else if (block.kind !== 'item' && block.kind !== 'list' && block.kind !== 'card') out.other.push(w)
  }
  out.other = [...new Set(out.other)].slice(0, 12)
  return out
}

const KIND_OPTIONS = { ...KIND_CRITERIA, unclear: { what: 'Can’t tell from these words what kind of site this is' } }

export function fiveSecondRequest(fs: FirstScreen): JevRequest {
  return {
    state: {
      first_screen: {
        brand: fs.brand ? clip(fs.brand, 60) : null,
        nav_links: fs.nav.map((w) => clip(w, 40)),
        headline: fs.headline ? clip(fs.headline, 200) : null,
        intro: fs.intro ? clip(fs.intro, 300) : null,
        buttons: fs.buttons.map((w) => clip(w, 60)),
        other_words: fs.other.map((w) => clip(w, 120)),
      },
    },
    questions: {
      ...shuffled('kind', choice(`A visitor sees only ${at('first_screen')} for five seconds. What kind of site would they say this is?`, KIND_OPTIONS)),
      offer: noul(`Does ${at('first_screen.headline')} say what is offered or done here, so a visitor could repeat it?`, {
        true: { what: 'Names the thing, the service or the result', examples: ['Bread baked at 4am, on your table by 8', 'Invoices that send themselves'] },
        false: { what: 'A slogan or mood that could be anyone’s', examples: ['Welcome to the future', 'Dream bigger'] },
      }),
      button: noul(`Would a visitor know what happens after pressing the first of ${at('first_screen.buttons')}?`, {
        true: { what: 'An action with an object', examples: ['Book a table', 'Start a free trial', 'See the menu'] },
        false: { what: 'Vague or missing', examples: ['Learn more', 'Click here', 'Submit'] },
      }),
      audience: noul(`From ${at('first_screen')}, can you tell who this site is for?`),
    },
  }
}

export interface FiveSecondRead {
  /** The kind a visitor would guess, when they'd be sure of it. */
  kind: Kind | null
  /** The two kinds a visitor would be torn between, when they would be. */
  torn: [Kind, Kind] | null
  p: number
  /** The kind you said the site is, when it's not what a visitor would guess. */
  mismatch: Kind | null
  checks: ScoreCheck[]
  /** One line for the card. */
  words: string
}

const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k)

/** What a visitor would make of the first screen, in plain words, plus checks for the page score. */
export function readFiveSecond(res: JevResponse | null, fs: FirstScreen, said?: Kind): FiveSecondRead | null {
  const m = merged(res, 'kind')
  if (!m) return null
  const T = FIVE_SECOND_THRESHOLDS
  const [a, b] = topTwo(m)
  const sure = isKind(m.choice) && m.agree && (m.probabilities[m.choice] ?? 0) >= T.sure
  const torn = !sure && a && b && isKind(a.option) && isKind(b.option) && a.p >= T.torn && b.p >= T.torn ? ([a.option, b.option] as [Kind, Kind]) : null
  const kind = sure ? (m.choice as Kind) : null
  const p = m.probabilities[m.choice] ?? 0
  const words = kind
    ? `A visitor would guess ${KIND_WORDS[kind]}, and be sure of it.`
    : torn
      ? `A visitor could take this for ${KIND_WORDS[torn[0]]} or ${KIND_WORDS[torn[1]]}.`
      : isKind(m.choice) && p >= 0.5
        ? `A visitor would probably guess ${KIND_WORDS[m.choice]}.`
        : 'A visitor would find it hard to tell what this is for.'
  const mismatch = said && kind && kind !== said ? said : null

  const checks: ScoreCheck[] = [
    {
      id: 'five-second',
      ok: !!kind && !mismatch,
      weight: 2,
      words: mismatch ? `${words.replace(/\.$/, '')}, not ${KIND_WORDS[mismatch]}` : words,
    },
  ]
  const nounl = (id: string, v: number | null, ok: string, bad: string, show = true) => {
    if (v === null || !show) return
    const pass = v >= T.yes
    const fail = v <= T.no
    checks.push({ id, ok: pass, weight: pass || fail ? 1 : 0, words: pass ? ok : fail ? bad : `${ok.replace(/\.$/, '')}, mostly` })
  }
  nounl('says-what', yes(res, 'offer'), 'The headline says what you offer', 'The headline could be anyone’s: say what you offer', !!fs.headline)
  nounl('button-says', yes(res, 'button'), 'The first button says what happens next', 'The first button doesn’t say what happens next', fs.buttons.length > 0)
  nounl('who-for', yes(res, 'audience'), 'It’s clear who this is for', 'It doesn’t say who this is for')
  return { kind, torn, p, mismatch, checks, words: checks[0].words }
}

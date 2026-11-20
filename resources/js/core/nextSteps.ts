// What to look at next, right after a start lands: a few quiet hints above the dock instead of a panel thrown open.
// Each one says where it goes and, in one plain line, why it matters (the start of teaching design as you go). A
// hint retires once it's done (your words are in, the opener changed, another theme is on) or you dismiss it.

import type { ScoreCheck } from './score'

export type NextStepId = 'words' | 'layout' | 'look'

export interface NextStepsState {
  /** How the page looked when you landed: its sections' layouts and its theme. */
  base: { clips: string; skin: string | null }
  dismissed: NextStepId[]
}

export type NextStepAction =
  | { kind: 'words' }
  | { kind: 'layouts'; slotId: string }
  | { kind: 'design' }

export interface NextStep {
  id: NextStepId
  /** What to do, as a button: "Write your words". */
  label: string
  /** Why, in a few words (no stop): "83 spots still show sample text". */
  why: string
  action: NextStepAction
}

export interface NextStepsInput {
  state: NextStepsState | null
  /** The open page's sections, top to bottom. */
  slots: { id: string; type: string; clipId: string }[]
  /** Text spots on the open page still holding sample words, of how many. */
  sample: { left: number; total: number }
  /** The theme on now. */
  skin: string | null
  /** How many layouts the opener can step through. */
  openerLayouts: number
  /** How many themes fit this site. */
  themes: number
  /** What the first screen's measuring found (`lib/start.ts` `scoreStart`), when it's back. */
  checks?: ScoreCheck[]
}

/** The page's layouts as one string, to tell whether any changed. */
export const clipsKey = (slots: { clipId: string }[]) => slots.map((s) => s.clipId).join(' ')

/** Where hints start from: the page as it is now, nothing dismissed. */
export function landedSteps(slots: { clipId: string }[], skin: string | null): NextStepsState {
  return { base: { clips: clipsKey(slots), skin }, dismissed: [] }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The hints still worth showing, in the order to try them. Empty once they're all done or dismissed. */
export function nextSteps(i: NextStepsInput): NextStep[] {
  const st = i.state
  if (!st) return []
  const out: NextStep[] = []
  const off = (id: NextStepId) => st.dismissed.includes(id)

  if (!off('words') && i.sample.left > 0) {
    out.push({
      id: 'words',
      label: 'Write your words',
      why: `${plural(i.sample.left, 'spot')} still ${i.sample.left === 1 ? 'shows' : 'show'} sample text`,
      action: { kind: 'words' },
    })
  }

  const opener = i.slots.find((s) => s.type === 'hero') ?? i.slots.find((s) => s.type !== 'nav')
  if (!off('layout') && opener && clipsKey(i.slots) === st.base.clips && i.openerLayouts > 1) {
    // A first screen that doesn't hold up is the best reason to try another opener; otherwise, how many there are.
    const miss = i.checks?.find((c) => !c.ok && c.weight > 0 && /^(first|nav|headline)/.test(c.id))
    out.push({
      id: 'layout',
      label: 'Try another opener',
      why: miss ? shortMiss(miss.words) : `${plural(i.openerLayouts - 1, 'more way')} to start the page`,
      action: { kind: 'layouts', slotId: opener.id },
    })
  }

  if (!off('look') && i.skin === st.base.skin && i.themes > 1) {
    out.push({
      id: 'look',
      label: 'Try a look',
      why: 'Type, color and shape in one click',
      action: { kind: 'design' },
    })
  }
  return out
}

/** A first-screen miss in a few words: "On a phone, the headline continues below the first screen" → "Headline runs past a phone’s first screen". */
export function shortMiss(words: string): string {
  const m = /^On an? (\w+), the (headline|button) (?:continues|starts|sits) below the first screen$/i.exec(words)
  if (m) return `${m[2][0].toUpperCase()}${m[2].slice(1)} runs past a ${m[1]}’s first screen`
  return words.replace(/^The (nav|headline)/, (_, w: string) => w[0].toUpperCase() + w.slice(1)).replace(/^Part of the headline is clipped/, 'Headline is clipped')
}

/** Set a hint aside (dismissed, or followed). */
export function dismissStep(st: NextStepsState | null, id: NextStepId): NextStepsState | null {
  return st && !st.dismissed.includes(id) ? { ...st, dismissed: [...st.dismissed, id] } : st
}

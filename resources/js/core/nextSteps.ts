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
  /** What to do, as a button: "Make the words yours". */
  label: string
  /** Why, in one line. */
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
      label: 'Make the words yours',
      why: `${plural(i.sample.left, 'spot')} still ${i.sample.left === 1 ? 'holds' : 'hold'} sample words. Real words show whether a layout works.`,
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
      why: miss
        ? `${miss.words}. The first screen decides whether people stay.`
        : `${plural(i.openerLayouts - 1, 'other way')} to open the page. The first screen decides whether people stay.`,
      action: { kind: 'layouts', slotId: opener.id },
    })
  }

  if (!off('look') && i.skin === st.base.skin && i.themes > 1) {
    out.push({
      id: 'look',
      label: 'Try a look',
      why: 'A theme sets type, color and shape together, so every section speaks in one voice.',
      action: { kind: 'design' },
    })
  }
  return out
}

/** Set a hint aside (dismissed, or followed). */
export function dismissStep(st: NextStepsState | null, id: NextStepId): NextStepsState | null {
  return st && !st.dismissed.includes(id) ? { ...st, dismissed: [...st.dismissed, id] } : st
}

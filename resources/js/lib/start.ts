import { library } from '@/data/library'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { scorePage, SCREENS, SWEEP, type PageMeasure, type PageScore } from '@/core/score'
import { allSlots } from '@/core/site'
import { autoTitle } from '@/core/versions'
import type { VersionNode } from '@/core/types'
import { snapshotOf } from '@/state/snapshot'
import type { MixData } from '@/state/store'
import { measureFirstScreen } from './measure'

export type ScoredStart = StartCandidate & { score: PageScore }

/** Lay a start out at a laptop, a phone and the widths between, and read how it holds up. */
export async function scoreStart(c: StartCandidate): Promise<PageScore> {
  if (typeof document === 'undefined') return scorePage({})
  const data = { site: c.site, guide: c.guide, content: c.content }
  const screens = [SCREENS.laptop, SCREENS.phone, ...SWEEP.map((width) => ({ width, height: 900 }))]
  // Each width has its own hidden frame, so the widths lay out side by side.
  const measured = await Promise.all(screens.map((s) => measureFirstScreen(data, s.width, s.height)))
  const byWidth: Record<number, PageMeasure> = Object.fromEntries(measured.map((m) => [m.width, m]))
  return scorePage(byWidth)
}

/**
 * The guided start's three starts, measured and best first (a tie keeps the
 * starters ahead). Outside a browser nothing can be measured, so they come back
 * in the order they were made with an empty score.
 */
export async function scoredStarts(input: StartInput): Promise<ScoredStart[]> {
  const candidates = startCandidates(input, library)
  // Starts queue up at each width's frame, so they can all be asked for at once.
  const scored: ScoredStart[] = await Promise.all(candidates.map(async (c) => ({ ...c, score: await scoreStart(c) })))
  return scored.map((c, i) => ({ c, i })).sort((a, b) => b.c.score.score - a.c.score.score || a.i - b.i).map(({ c }) => c)
}

/** A start's name as a version: the starter's, else its hero's ("Photo backdrop"). */
function titleOf(s: StartCandidate): string {
  if (s.from === 'starter') return s.label.replace(/^Starter: /, '')
  const hero = s.site.pages[0]?.slots.find((x) => x.type === 'hero')
  return (hero && library.clips[hero.clipId]?.title) || autoTitle(allSlots(s.site), library)
}

/**
 * A new mix from the guided start: the start you picked is the board, and every
 * start (yours included) is kept as a version, A, B, C, to come back to.
 */
export function mixFromStart(input: Pick<StartInput, 'name'>, starts: StartCandidate[], chosen: string): MixData {
  const pick = starts.find((s) => s.id === chosen) ?? starts[0]
  const versions: Record<string, VersionNode> = {}
  let head: string | null = null
  starts.forEach((s, i) => {
    const id = `v_start${String.fromCharCode(65 + i)}`
    const letter = String.fromCharCode(65 + i)
    versions[id] = {
      id,
      letter,
      parentId: null,
      title: titleOf(s),
      status: 'in-progress',
      createdAt: Date.now() + i,
      kind: 'snapshot',
      snapshot: snapshotOf({ site: s.site, guide: s.guide, content: s.content, notes: [] }),
    }
    if (s === pick) head = id
  })
  return {
    mixName: input.name.trim() || 'Untitled mix',
    site: pick.site,
    guide: pick.guide,
    content: pick.content,
    versions,
    notes: [],
    branchFrom: null,
    head,
    framePos: {},
    clips: [],
  }
}

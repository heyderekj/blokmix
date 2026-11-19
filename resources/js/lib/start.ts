import { library } from '@/data/library'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { scorePage, SCREENS, SWEEP, type PageMeasure, type PageScore } from '@/core/score'
import { DRAFT_WORD, type Draft } from '@/core/drafts'
import type { MixData } from '@/state/store'
import { measureFirstScreen } from './measure'

export type ScoredStart = StartCandidate & { score: PageScore }

/** Lay a start out at a laptop, a phone and the widths between, and read how it holds up. */
export async function scoreStart(c: Pick<StartCandidate, 'site' | 'guide' | 'content'>): Promise<PageScore> {
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

/** What the flash says once a start is on the board. The hints above the dock say what to try next. */
export function startedWords(name: string, mix: Pick<MixData, 'site' | 'content'> & Partial<Pick<MixData, 'drafts'>>): string {
  const waiting = mix.content.tray?.length ?? 0
  const who = name.trim() || 'your site'
  const drafts = Object.keys(mix.drafts ?? {}).length
  const started = `Started ${who}${drafts > 1 ? ` with ${drafts} drafts` : ''}.`
  return waiting ? `${started} ${waiting} of your lines aren’t placed yet; Content shows them.` : started
}

/**
 * A new site from the guided start: only the start you picked, as Draft A. The others were a way to choose, not
 * drafts you asked for; another direction is a new draft whenever you want one. No versions yet: saving one starts
 * the draft's history.
 */
export function mixFromStart(input: Pick<StartInput, 'name'>, starts: StartCandidate[], chosen: string): MixData {
  const pick = starts.find((s) => s.id === chosen) ?? starts[0]
  const drafts: Record<string, Draft> = {
    draft_startA: { id: 'draft_startA', letter: 'A', name: `${DRAFT_WORD} A`, createdAt: Date.now(), status: 'in-progress', head: null, body: null },
  }
  return {
    mixName: input.name.trim() || 'Untitled site',
    site: pick.site,
    guide: pick.guide,
    content: pick.content,
    versions: {},
    drafts,
    draftId: 'draft_startA',
    notes: [],
    branchFrom: null,
    head: null,
    framePos: {},
    clips: [],
  }
}

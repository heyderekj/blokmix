import { library, slotClip } from '@/data/library'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { scorePage, SCREENS, SWEEP, type PageMeasure, type PageScore } from '@/core/score'
import { allSlots, pageView } from '@/core/site'
import { pageOwnership } from '@/core/ownWords'
import { autoTitle } from '@/core/versions'
import { DRAFT_WORD, type Draft } from '@/core/drafts'
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

/** What the flash says once a start is on the board: what's yours so far, and where the rest is. */
export function startedWords(name: string, mix: Pick<MixData, 'site' | 'content'>): string {
  const home = mix.site.pages[0]
  const slots = home ? pageView(mix.site, home.id) : []
  const { yours, total } = pageOwnership(slots, slotClip, mix.content)
  const waiting = mix.content.tray?.length ?? 0
  const left = total - yours
  const who = name.trim() || 'your mix'
  if (waiting) return `Started ${who}. ${waiting} of your lines aren’t placed yet; Content shows them.`
  return left ? `Started ${who}. ${left} spots on Home still hold sample words: Content shows them.` : `Started ${who}. The other starts are kept as drafts.`
}

/** A start's name as a version: the starter's, else its hero's ("Photo backdrop"). */
function titleOf(s: StartCandidate): string {
  if (s.from === 'starter') return s.label.replace(/^Starter: /, '')
  const hero = s.site.pages[0]?.slots.find((x) => x.type === 'hero')
  return (hero && library.clips[hero.clipId]?.title) || autoTitle(allSlots(s.site), library)
}

/**
 * A new mix from the guided start: the start you picked is the open draft, and the other starts come along as drafts
 * beside it (B and C), each yours to open and change. No versions yet: saving one starts a draft's history.
 */
export function mixFromStart(input: Pick<StartInput, 'name'>, starts: StartCandidate[], chosen: string): MixData {
  const pick = starts.find((s) => s.id === chosen) ?? starts[0]
  // The one you picked is Draft A; the others follow in the order they were offered.
  const order = [pick, ...starts.filter((s) => s !== pick)]
  const drafts: Record<string, Draft> = {}
  order.forEach((s, i) => {
    const letter = String.fromCharCode(65 + i)
    const id = `draft_start${letter}`
    drafts[id] = {
      id,
      letter,
      name: i === 0 ? `${DRAFT_WORD} ${letter}` : `${DRAFT_WORD} ${letter}: ${titleOf(s)}`,
      createdAt: Date.now() + i,
      status: 'in-progress',
      head: null,
      body: i === 0 ? null : { site: s.site, guide: s.guide, content: s.content },
    }
  })
  return {
    mixName: input.name.trim() || 'Untitled mix',
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

// The guided start's one box: what you type or paste becomes three starts. A sentence
// describes the site (Jev picks the kind, the sections and the looks); pasted copy is
// placed word for word (a page from your words, in three arrangements). Both come back
// measured, like every start.

import type { Kind, SectionType, Slot } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { chromeFor, contentFor, guideFor, RECIPES, type StartCandidate, type StartInput } from '@/core/start'
import { describeRequest, readDescribe, sectionsFor, textMode, type Look, type TextMode } from '@/core/jev/describe'
import { describeSections } from '@/core/jev/pageFromWords'
import { siteFromSlots } from '@/core/site'
import { skinList, skinOpen, WIREFRAME } from '@/core/skins'
import { library } from '@/data/library'
import { askJev } from './jev'
import { scoreStart, scoredStarts, type ScoredStart } from './start'
import { planPage, wordsPage, type PagePlan } from '@/state/jevPage'

/** What Jev heard in the box. */
export interface Heard {
  mode: TextMode
  /** The kind when Jev is sure; otherwise the chip waits for you. */
  kind: Kind | null
  /** Every kind, likeliest first. */
  kinds: Kind[]
  /** Home's sections: the kind's page as the description changes it, or the page your words make. */
  sections: SectionType[]
  /** Looks (skin ids) that fit a description, best first. */
  looks: string[]
  /** Pasted copy: the read, how many lines land and how many wait to be placed. */
  plan?: PagePlan
  lines?: number
  placed?: number
  waiting?: number
}

/** The looks Jev may pick from: every skin this plan opens but the raw Wireframe. */
export const looksOnOffer = (): Look[] =>
  skinList()
    .filter((s) => s.id !== WIREFRAME && skinOpen(library, s))
    .map((s) => ({ id: s.id, name: s.name, words: s.words }))

/** Ask Jev about the box's text. Null when Jev is off, slow, or there's nothing to read. */
export async function hearStart(text: string, fallbackKind: Kind = 'studio'): Promise<Heard | null> {
  const t = text.trim()
  if (t.length < 3) return null
  const mode = textMode(t)
  if (mode === 'paste') {
    const plan = await planPage(t)
    if (!plan) return null
    const kind = plan.read.kind
    const made = wordsPage(plan, 1, contentFor({ kind: kind ?? fallbackKind, name: '' }), (i) => `preview${i}`)
    return { mode, kind, kinds: kind ? [kind] : [], sections: made.types, looks: [], plan, lines: plan.lines.length, placed: plan.lines.length - made.tray.length, waiting: made.tray.length }
  }
  const res = await askJev(describeRequest(t, looksOnOffer()), { timeoutMs: 6000 })
  const read = readDescribe(res)
  if (!read) return null
  const kind = read.kind ?? read.kinds[0]?.kind ?? fallbackKind
  return { mode, kind: read.kind, kinds: read.kinds.map((k) => k.kind), sections: sectionsFor(kind, read.want), looks: read.looks }
}

/** A described start's sections for a kind you picked yourself: the kind's page, as the description changed it. */
export const sectionsForKind = (kind: Kind, heard: Heard | null) => (heard?.mode === 'describe' && heard.kind === kind ? heard.sections : RECIPES[kind].home)

const chromeSlot = (id: string, clipId: string): Slot => ({ id, type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP } })

/** Your words in three arrangements, each with a nav and footer so the page is whole; lines left over wait in its tray. */
export function wordsCandidates(input: StartInput, plan: PagePlan): StartCandidate[] {
  const guide = guideFor(input)
  const content = contentFor(input)
  const out: StartCandidate[] = []
  const seen = new Set<string>()
  for (const a of [1, 2, 3] as const) {
    const made = wordsPage(plan, a, content, (i) => `w${a}s${i}`)
    const sig = made.slots.map((s) => s.clipId).join()
    if (seen.has(sig)) continue
    seen.add(sig)
    const chrome = chromeFor(library, a - 1, input.seed)
    const slots = [chrome.nav ? chromeSlot(`w${a}nav`, chrome.nav) : null, ...made.slots, chrome.footer ? chromeSlot(`w${a}footer`, chrome.footer) : null].filter((s): s is Slot => !!s)
    out.push({
      id: `words${a}`,
      // The sections are the same in every arrangement: the hero's layout tells them apart.
      label: library.clips[made.slots.find((x) => x.type === 'hero')?.clipId ?? '']?.title ?? describeSections(made.types),
      from: 'words',
      site: siteFromSlots(slots),
      guide,
      content: made.tray.length ? { ...content, tray: made.tray } : content,
      shelves: { plain: slots.length, real: 0 },
    })
  }
  return out
}

/** Three starts from the box, measured, best first. */
export async function startsFromText(input: StartInput, heard: Heard): Promise<ScoredStart[]> {
  if (heard.mode === 'describe' || !heard.plan) return scoredStarts({ ...input, sections: input.sections ?? sectionsForKind(input.kind, heard) })
  const candidates = wordsCandidates(input, heard.plan)
  const scored: ScoredStart[] = await Promise.all(candidates.map(async (c) => ({ ...c, score: await scoreStart(c) })))
  return scored.map((c, i) => ({ c, i })).sort((a, b) => b.c.score.score - a.c.score.score || a.i - b.i).map(({ c }) => c)
}

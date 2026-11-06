// A page from anything you paste, on the board: one Jev request reads the text (cached,
// so the other arrangements come instantly), code builds the sections from built-in
// layouts that fit, and Pour places every line word for word.

import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { setPageSlots } from '@/core/site'
import { sectionClip, listMax } from '@/core/lists'
import { outline } from '@/core/outline'
import { parseHtml } from '@/core/html/parse'
import { splitLines, composePour, type Line } from '@/core/jev/pour'
import { chunkLines, chooseLayouts, pageRequest, pageSections, readPage, readsFor, describeSections, type Chunk, type PageRead } from '@/core/jev/pageFromWords'
import { library } from '@/data/library'
import { askJev } from '@/lib/jev'
import { uid } from './uid'
import { currentSlots, useStore } from './store'
import { applyPour, pourTargets, trayFrom, useWordsTray } from './jevPour'
import { findPage } from './commands/refs'

export interface PagePlan {
  lines: Line[]
  chunks: Chunk[]
  read: PageRead
}

/** Read the text once: what each run and line is, and what kind of site it's for. */
export async function planPage(text: string): Promise<PagePlan | null> {
  const lines = splitLines(text)
  if (!lines.length) return null
  const chunks = chunkLines(lines)
  const res = await askJev(pageRequest(lines, chunks), { timeoutMs: 8000 })
  const read = readPage(res, lines, chunks)
  return read ? { lines, chunks, read } : null
}

/** The most items a layout's lists hold (its own count or the list's max), so a run's items fit. */
function capacity(clipId: string): number {
  const c = library.clips[clipId]
  if (!c) return 0
  const sc = sectionClip(c)
  let most = 0
  const visit = (nodes: ReturnType<typeof outline>) => {
    for (const n of nodes) if (n.t === 'list') most = Math.max(most, listMax(sc.blocks.find((b) => b.id === n.id)?.list, n.listKey, n.items.length))
  }
  visit(outline(parseHtml(c.html)))
  return most
}

export interface BuiltPage {
  pageId: string
  sections: string[]
  placed: number
  waiting: number
  kind: PageRead['kind']
}

/**
 * Build it: a new page (or the open page's own sections replaced) from the `arrangement`th layouts that fit (1–3),
 * then every line poured in. Call inside one undo step.
 */
export function buildPage(plan: PagePlan, arrangement: 1 | 2 | 3, into: 'new_page' | 'this_page', pageRef?: string): BuiltPage {
  const st = useStore.getState()
  const sections = pageSections(plan.read)
  const clipIds = chooseLayouts(sections, plan.read, library, capacity, arrangement - 1)
  const slots: Slot[] = sections.map((s, i) => ({ id: uid('slot'), type: s.type, clipId: clipIds[i], locked: false, keep: { ...DEFAULT_KEEP } }))
  let pageId: string
  if (into === 'new_page') {
    pageId = st.addPage({ path: '/your-words', title: 'From your words', slots })
  } else {
    const page = findPage(pageRef)
    pageId = page.id
    useStore.setState((x) => ({ site: setPageSlots(x.site, page.id, slots), ui: { ...x.ui, pageId: page.id, focusedSlotId: null, selectedBlockId: null } }))
  }
  // The site's kind, when the guided start didn't say and Jev is sure.
  if (plan.read.kind && !useStore.getState().content.kind) useStore.setState((x) => ({ content: { ...x.content, kind: plan.read.kind! } }))
  const fresh = currentSlots(useStore.getState()).filter((s) => slots.some((n) => n.id === s.id))
  const { spots } = pourTargets(fresh)
  const reads = readsFor(plan.read, sections, slots.map((s) => s.id))
  const groupList = new Map(plan.read.chunks.flatMap((c) => c.lines.map((l) => [l.group, c.isList] as const)))
  const poured = composePour(reads, spots, (g) => groupList.get(g) ?? null)
  const done = applyPour(poured)
  const tray = trayFrom(poured)
  useWordsTray.setState((s) => ({ lines: [...s.lines, ...tray] }))
  return { pageId, sections: describeSections(sections.map((s) => s.type)).split(' · '), placed: done.placed, waiting: tray.length, kind: plan.read.kind }
}

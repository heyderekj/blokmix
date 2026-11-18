// A page from anything you paste, on the board: one Jev request reads the text (cached,
// so the other arrangements come instantly), code builds the sections from built-in
// layouts that fit, and Pour places every line word for word.

import { DEFAULT_KEEP, type ProjectContent, type SectionType, type Slot, type TrayLine } from '@/core/types'
import { setPageSlots } from '@/core/site'
import { sectionClip, listContext } from '@/core/lists'
import { outline } from '@/core/outline'
import { parseHtml } from '@/core/html/parse'
import { POUR_THRESHOLDS, splitLines, composePour, spotsOf, type Line, type Role } from '@/core/jev/pour'
import { paragraphChunks, chunkLines, chooseLayouts, pageRequest, pageSections, readPage, readsFor, describeSections, type Chunk, type PageRead } from '@/core/jev/pageFromWords'
import { library, slotClip } from '@/data/library'
import { askJev } from '@/lib/jev'
import { uid } from './uid'
import { useStore } from './store'
import { pourSlot, setTray, trayFrom } from './jevPour'
import { findPage } from './commands/refs'

export interface PagePlan {
  lines: Line[]
  chunks: Chunk[]
  read: PageRead
}

/** A local option when suggestions are unavailable. Blank lines separate sections. */
export function paragraphPlan(text: string): PagePlan {
  const lines = splitLines(text)
  const chunks = paragraphChunks(lines.slice(0, POUR_THRESHOLDS.maxLines))
  const roles: PageRead['roles'] = {}
  // A heading followed by named offerings, each in its own paragraph, is a common services or price list.
  const offerings = chunks.slice(1)
  const priceList = offerings.length >= 2 && offerings.every((c) => c.lines.some((l) => l.sure === 'price'))
  const serviceList = /\bservices?\b/i.test(chunks[0]?.lines[0]?.text ?? '')
  if (offerings.length >= 2 && (serviceList || priceList) && offerings.some((c) => c.lines.length >= 2) && offerings.every((c) => !c.lines[0].sure)) {
    const items = offerings.flatMap((c) => c.lines)
    for (const c of offerings) {
      c.lines.forEach((l, i) => {
        const role: Role = i === 0 ? 'title' : l.sure === 'price' ? 'price' : 'body'
        roles[l.i] = { role, p: 1, all: [{ option: role, p: 1 }] }
      })
    }
    chunks.splice(1, offerings.length, { c: 1, lines: items })
  }
  const typed = chunks.map((chunk, i) => {
    if (roles[chunk.lines[0].i]) return { ...chunk, type: (priceList ? 'pricing' : 'features') as SectionType, p: 1, isList: true }
    const type = i === 0 ? 'hero' : 'content'
    chunk.lines.forEach((line, j) => {
      const role = j === 0 ? (i === 0 ? 'headline' : 'heading') : j === 1 ? 'lead' : 'paragraph'
      roles[line.i] = { role, p: 1, all: [{ option: role, p: 1 }] }
    })
    return { ...chunk, type: type as SectionType, p: 1, isList: false }
  })
  return { lines, chunks, read: { kind: null, chunks: typed, roles } }
}

/** Read the text once: what each run and line is, and what kind of site it's for. */
export async function planPage(text: string, signal?: AbortSignal): Promise<PagePlan | null> {
  const lines = splitLines(text)
  if (!lines.length) return null
  const batch = lines.slice(0, POUR_THRESHOLDS.maxLines)
  const chunks = chunkLines(batch)
  const res = await askJev(pageRequest(batch, chunks), { timeoutMs: 8000, signal })
  const read = readPage(res, batch, chunks)
  return read ? { lines, chunks, read } : null
}

/** A prose edit can reuse Jev's existing section and field assignments when the line structure still matches. */
export function revisePageLines(plan: PagePlan, text: string): PagePlan | null {
  const lines = splitLines(text)
  if (lines.length !== plan.lines.length || lines.some((line, i) => {
    const old = plan.lines[i]
    return line.group !== old.group || line.sure !== old.sure || line.heading !== old.heading
  })) return null
  const update = <T extends Chunk>(chunk: T): T => ({ ...chunk, lines: chunk.lines.map((line) => lines[line.i]) })
  return { lines, chunks: plan.chunks.map(update), read: { ...plan.read, chunks: plan.read.chunks.map(update) } }
}

/** Match sections across an edit by type and shared copy first, then pair the remaining sections of a type
 * in order when their counts agree. A newly inserted section must never inherit another section's lock. */
export function matchPageSections(before: PagePlan, after: PagePlan): Map<number, number> {
  const old = pageSections(before.read)
  const next = pageSections(after.read)
  const matches = new Map<number, number>()
  const used = new Set<number>()
  const pair = (from: number, to: number) => {
    matches.set(from, to)
    used.add(to)
  }
  const candidates = old.flatMap((section, from) => {
    const words = new Set(section.chunk?.lines.map((line) => line.text))
    return next.flatMap((other, to) => {
      if (section.type !== other.type) return []
      const overlap = other.chunk?.lines.filter((line) => words.has(line.text)).length ?? 0
      return overlap ? [{ from, to, overlap }] : []
    })
  }).sort((a, b) => b.overlap - a.overlap || Math.abs(a.from - a.to) - Math.abs(b.from - b.to))
  for (const { from, to } of candidates) if (!matches.has(from) && !used.has(to)) pair(from, to)
  for (const type of new Set(old.map((section) => section.type))) {
    const from = old.flatMap((s, i) => s.type === type && !matches.has(i) ? [i] : [])
    const to = next.flatMap((s, i) => s.type === type && !used.has(i) ? [i] : [])
    if (from.length === to.length) from.forEach((id, i) => pair(id, to[i]))
  }
  return matches
}

/**
 * How many items of this kind (plans by their names, questions, people…) a layout holds: only lists whose items take
 * that role count, so a one-plan band whose plan lists eight features doesn't pass for eight plans.
 */
export function capacity(clipId: string, lead: Role | null): number {
  const c = library.clips[clipId]
  if (!c || !lead) return c ? Infinity : 0
  // The stamped section (block ids on its lists), as the board reads it: the raw html's lists have none.
  const sc = sectionClip(c)
  const spots = spotsOf('x', c.type, outline(parseHtml(sc.html)), (listId) => listContext(sc, {}, listId)?.max ?? 0)
  return Math.max(0, ...spots.filter((s) => s.role === lead && s.list).map((s) => s.list!.max))
}

/** A page made from your words, off the board: its sections with your words in them, and the lines left over. */
export interface WordsPage {
  slots: Slot[]
  /** Lines it wasn't sure of, with their homes in these sections. */
  tray: TrayLine[]
  placed: number
  /** The section types, top to bottom ("Hero · Menu · FAQ"). */
  types: SectionType[]
}

/** The selected layout and explicit lock at each section’s position in a page plan. */
export type PageLayouts = Readonly<Partial<Record<number, Pick<Slot, 'clipId' | 'locked'>>>>

/**
 * Build it, off the board: the `arrangement`th layouts that fit (1–3), every line poured in, and anything the text
 * didn't fill (an eyebrow, a second button, a note) hidden, never left saying the layout's sample words. Pictures stay.
 * `ids` names the sections (the board's uid, or fixed ids for the guided start's candidates).
 */
export function wordsPage(plan: PagePlan, arrangement: 1 | 2 | 3, content: ProjectContent, ids: (i: number) => string = () => uid('slot'), layouts: PageLayouts = {}): WordsPage {
  const sections = pageSections(plan.read)
  const clipIds = chooseLayouts(sections, plan.read, library, capacity, arrangement - 1)
  let slots: Slot[] = sections.map((s, i) => ({
    id: ids(i),
    type: s.type,
    clipId: layouts[i]?.clipId ?? clipIds[i],
    locked: layouts[i]?.locked ?? false,
    keep: { ...DEFAULT_KEEP },
  }))
  const spots = slots.flatMap((s) => {
    const clip = slotClip(s)
    return spotsOf(s.id, s.type, outline(parseHtml(clip.html)), (listId) => listContext(clip, s, listId)?.max ?? 0)
  })
  const reads = readsFor(plan.read, sections, slots.map((s) => s.id))
  const groupList = new Map(plan.read.chunks.flatMap((c) => c.lines.map((l) => [l.group, c.isList] as const)))
  const poured = composePour(reads, spots, (g) => groupList.get(g) ?? null)
  const readCount = plan.read.chunks.reduce((n, chunk) => n + chunk.lines.length, 0)
  for (const line of plan.lines.slice(readCount)) poured.tray.push({ line, homes: [] })
  slots = slots.map((s) => hideUnfilled(pourSlot(s, poured, content)))
  return { slots, tray: trayFrom(poured, slots), placed: poured.placed.length, types: sections.map((s) => s.type) }
}

/** Only your words: every small block whose field your text didn't fill is hidden (show it again from its section). */
function hideUnfilled(s: Slot): Slot {
  const clip = slotClip(s)
  const own = { ...(s.edits?.[s.clipId] ?? {}) }
  for (const b of clip.blocks) {
    if (b.kind === 'image' || b.kind === 'list' || b.kind === 'item' || b.kind === 'card') continue
    const field = b.field ?? clip.blocks.find((x) => x.parent === b.id && x.field)?.field
    if (field && !s.words?.[field]) own[b.id] = { ...own[b.id], hidden: true }
  }
  return { ...s, edits: { ...s.edits, [s.clipId]: own } }
}

export interface BuiltPage {
  pageId: string
  sections: string[]
  placed: number
  waiting: number
  kind: PageRead['kind']
}

/** Build it on the board: a new page, or the open page's own sections replaced. Call inside one undo step. */
export function buildPage(plan: PagePlan, arrangement: 1 | 2 | 3, into: 'new_page' | 'this_page', pageRef?: string, title?: string, layouts?: PageLayouts): BuiltPage {
  const st = useStore.getState()
  const made = wordsPage(plan, arrangement, st.content, undefined, layouts)
  let pageId: string
  if (into === 'new_page') {
    pageId = st.addPage({ path: title || '/your-words', title: title || 'From your words', slots: made.slots })
  } else {
    const page = findPage(pageRef)
    pageId = page.id
    useStore.setState((x) => ({ site: setPageSlots(x.site, page.id, made.slots), ui: { ...x.ui, pageId: page.id, focusedSlotId: null, selectedBlockId: null } }))
  }
  // The site's kind, when the guided start didn't say and Jev is sure.
  if (plan.read.kind && !useStore.getState().content.kind) useStore.setState((x) => ({ content: { ...x.content, kind: plan.read.kind! } }))
  setTray((lines) => [...lines, ...made.tray])
  return { pageId, sections: describeSections(made.types).split(' · '), placed: made.placed, waiting: made.tray.length, kind: plan.read.kind }
}

import type { BlockInfo, BlockStyle, Note, Page, Slot } from '@/core/types'
import { applyBindings } from '@/core/collections'
import { bindContextFor, templateEntry } from '../collections'
import { allSlots, isShared, normalizePath, pageOf, pageOfSlot, pageView, updateSlotIn } from '@/core/site'
import { isMark, SOURCE_LABEL } from '@/core/notes'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { effectiveEdit } from '@/core/blocks/style'
import { advise } from '@/core/advise'
import { resolveGuide } from '@/core/guide'
import { library, slotClip } from '@/data/library'
import { sectionAnchors, sectionLinks, siteScope } from '@/core/links'
import { editList, ListError, type ListOp } from '@/core/lists'
import { outline, type OutlineList, type OutlineNode } from '@/core/outline'
import { parseHtml } from '@/core/html/parse'
import { useStore } from '../store'

/** How commands find what they act on (sections, blocks, notes, lists), and how they describe it back. */

export class CommandError extends Error {}

/** A page by path ("/about"), title ("About") or id; the page open on the canvas when none is given. */
export function findPage(ref?: string | null): Page {
  const { site, ui } = useStore.getState()
  if (ref == null || ref === '') return pageOf(site, ui.pageId)
  const r = ref.trim().toLowerCase()
  const hit = site.pages.find((p) => p.id === ref) ?? site.pages.find((p) => p.path === normalizePath(ref)) ?? site.pages.find((p) => p.title.toLowerCase() === r)
  if (!hit) throw new CommandError(`No page "${ref}". Pages: ${site.pages.map((p) => `${p.path} (${p.title})`).join(', ')}`)
  return hit
}

/**
 * A section: its id (anywhere on the site), its position or type on a page (the
 * open one unless `page` says), its anchor ("team"), or a page and anchor
 * ("/about#team"). "nav" and "footer" are the site's shared ones.
 */
export function findSection(ref: string | number, page?: string | null): Slot {
  const { site } = useStore.getState()
  if (typeof ref === 'string' && /^\d+$/.test(ref)) ref = Number(ref)
  if (typeof ref === 'string' && ref.includes('#')) {
    const [path, anchor] = ref.split('#')
    return findSection(anchor, path || '/')
  }
  const byId = typeof ref === 'string' ? allSlots(site).find((s) => s.id === ref) : undefined
  if (byId) return byId
  const p = findPage(page)
  const view = pageView(site, p.id)
  const anchors = sectionAnchors(view)
  const r = typeof ref === 'string' ? ref.toLowerCase() : ''
  const hit =
    typeof ref === 'number'
      ? view[ref - 1]
      : r === 'nav' || r === 'footer'
        ? (site.shared[r] ?? view.find((s) => s.type === r))
        : (view.find((s) => s.type === r) ?? view.find((s) => TYPE_LABEL[s.type].toLowerCase() === r) ?? view.find((s) => anchors[s.id] === r))
  if (!hit) throw new CommandError(`No section "${ref}" on ${p.title} (${p.path}). Sections: ${view.map((s, i) => `${i + 1} ${s.type} (${s.id})`).join(', ')}`)
  return hit
}

/** Where a section's links can lead, from its own page (the shared nav and footer see every page). */
export function linkScopeFor(slotId: string) {
  const { site } = useStore.getState()
  return siteScope(site, pageOfSlot(site, slotId)?.id ?? null)
}

/** Where a section sits top to bottom on its page (the shared ones: on the page asked about). 0 when hidden there. */
export function positionOf(slot: Slot, pageRef?: string | null): number {
  const { site } = useStore.getState()
  const p = pageOfSlot(site, slot.id) ?? findPage(pageRef)
  return pageView(site, p.id).indexOf(slot) + 1
}

/** "Hero (section 2 of About)". */
export function placeOf(slot: Slot): string {
  const { site } = useStore.getState()
  if (isShared(site, slot.id)) return `${TYPE_LABEL[slot.type]} (shared on every page)`
  const p = pageOfSlot(site, slot.id)
  const i = p ? pageView(site, p.id).indexOf(slot) + 1 : 0
  return `${TYPE_LABEL[slot.type]} (section ${i}${p && site.pages.length > 1 ? ` of ${p.title}` : ''})`
}

export function findBlock(slot: Slot, ref: string): BlockInfo {
  const blocks = slotClip(slot).blocks
  const r = ref.trim().toLowerCase()
  const hit = blocks.find((b) => b.id === ref) ?? blocks.find((b) => b.label.toLowerCase() === r) ?? blocks.find((b) => b.label.toLowerCase().endsWith(r))
  if (!hit) throw new CommandError(`No block "${ref}" in ${TYPE_LABEL[slot.type]}. Blocks: ${blocks.map((b) => `${b.id} ${b.label}`).join('; ')}`)
  return hit
}

export function findNote(ref: string | number) {
  const marks = useStore.getState().notes.filter(isMark)
  const n = typeof ref === 'number' ? ref : /^n?\d+$/i.test(ref) ? Number(ref.replace(/^n/i, '')) : null
  const hit = n !== null ? marks.find((m) => m.number === n) : marks.find((m) => m.id === ref)
  if (!hit) throw new CommandError(`No mark "${ref}". Marks: ${marks.map((m) => `N${m.number}`).join(', ') || 'none yet'}`)
  return hit
}

/** A mark as an agent reads it: what it's on in words, never selectors. */
export function describeNote(n: Note) {
  const st = useStore.getState()
  const a = n.anchor
  let on = 'the whole page'
  let section: string | null = null
  if ('slotId' in a) {
    const slot = allSlots(st.site).find((s) => s.id === a.slotId)
    section = slot?.id ?? null
    const name = slot ? placeOf(slot) : 'a removed section'
    if (a.kind === 'block') on = `${a.label}${slot && slot.clipId !== a.clipId ? ' (on a clip that’s no longer shown)' : ''}`
    else if (a.kind === 'words') on = `the words “${a.quote}” in ${a.label} (field ${a.field})`
    else if (a.kind === 'area') on = `an area of ${name} (${Math.round(a.rect.x * 100)}% across, ${Math.round(a.rect.y * 100)}% down, ${Math.round(a.rect.w * 100)}% × ${Math.round(a.rect.h * 100)}%)`
    else on = name
  }
  return {
    id: n.id,
    number: `N${n.number}`,
    kind: n.kind,
    status: n.status,
    by: n.source ? SOURCE_LABEL[n.source] : 'You',
    on,
    section,
    block: a.kind === 'block' || a.kind === 'words' ? a.blockId : null,
    field: a.kind === 'words' ? a.field : null,
    quote: a.kind === 'block' || a.kind === 'words' ? (a.quote ?? null) : null,
    text: n.text,
    suggestedCopy: n.suggestedCopy ?? null,
    resolution: n.resolution ?? null,
    replies: (n.replies ?? []).map((r) => ({ by: r.author, text: r.text })),
  }
}

/** The section as it shows: lists bound to your collections filled from their entries. */
export function shownSlot(slot: Slot): Slot {
  if (!slot.bind || !library.clips[slot.clipId]) return slot
  const st = useStore.getState()
  const entry = templateEntry(st.site.pages.find((p) => p.slots.some((s) => s.id === slot.id)), st.ui.previewEntry)
  return applyBindings(slot, library.clips[slot.clipId], { ...bindContextFor(st.site), entry })
}

export function wordsFor(slot: Slot) {
  const clip = slotClip(slot)
  return resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
}

export function describeSection(slot: Slot, position: number) {
  const st = useStore.getState()
  const clip = slotClip(slot)
  const words = wordsFor(slot)
  const links = sectionLinks(clip.blocks, slot.edits?.[clip.id], words, linkScopeFor(slot.id), slot.id)
  return {
    id: slot.id,
    position,
    type: slot.type,
    label: TYPE_LABEL[slot.type],
    clip: { id: clip.id, title: clip.title, origin: clip.origin, source: library.sources[clip.sourceId]?.name, rhythm: clip.rhythm ?? null },
    ...((slot.inspiredBy ?? clip.inspiredBy) ? { inspiredBy: slot.inspiredBy ?? clip.inspiredBy } : {}),
    keep: { layout: slot.keep.layout, style: slot.keep.style, copy: slot.keep.content, motion: slot.keep.motion, locked: slot.locked },
    spacing: slot.spacing ?? {},
    surface: slot.surface ?? 'page',
    motion: slot.motion ?? { mode: slot.keep.motion ? 'captured' : 'none' },
    words,
    blocks: clip.blocks.map((b) => {
      const e = effectiveEdit(slot.edits?.[clip.id]?.[b.id], st.guide.components?.[b.kind])
      return {
        id: b.id,
        label: b.label,
        kind: b.kind,
        parent: b.parent,
        field: b.field ?? null,
        words: b.field ? words[b.field] : null,
        look: e?.variant ?? null,
        style: e?.style ?? null,
        motion: e?.motion ?? null,
        image: b.kind === 'image' ? (e?.media ?? null) : undefined,
        link: b.linkable ? links[b.id]?.href : undefined,
        hidden: !!e?.hidden,
        // What differs on phones (≤760px): spacing, or hidden there only.
        mobile: e?.mobile ?? null,
      }
    }),
  }
}

export function findList(slot: Slot, ref: string): BlockInfo {
  const lists = slotClip(slot).blocks.filter((b) => b.kind === 'list')
  const r = ref.trim().toLowerCase()
  const hit =
    lists.find((b) => b.id === ref) ??
    lists.find((b) => b.label.toLowerCase() === r) ??
    lists.find((b) => b.list?.toLowerCase() === r && b.listKey) ??
    lists.find((b) => b.list?.toLowerCase() === r) ??
    lists.find((b) => b.label.toLowerCase().endsWith(r))
  if (!hit) throw new CommandError(`No list "${ref}" in ${TYPE_LABEL[slot.type]}. Lists: ${lists.map((b) => `${b.id} ${b.label}`).join('; ') || 'none'}`)
  return hit
}

export function outlineOf(slot: Slot): OutlineNode[] {
  return outline(parseHtml(slotClip(slot).html))
}

export function findOutlineList(nodes: OutlineNode[], id: string): OutlineList | undefined {
  for (const n of nodes) {
    if (n.t !== 'list') continue
    if (n.id === id) return n
    for (const it of n.items) {
      const hit = findOutlineList(it.nodes, id)
      if (hit) return hit
    }
  }
  return undefined
}

/** A section's list change, with the list's own explanation when it can't be done. */
export function changeList(slot: Slot, change: ListOp): Slot {
  try {
    return editList(slot, slotClip(slot), useStore.getState().content, change)
  } catch (e) {
    if (e instanceof ListError) throw new CommandError(e.message)
    throw e
  }
}

export const putSlot = (next: Slot) => useStore.setState((st) => ({ site: updateSlotIn(st.site, next.id, () => next) }))

export const itemsOf = (slot: Slot, listId: string) => slotClip(slot).blocks.filter((b) => b.parent === listId && b.kind === 'item')

export const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>


/** The checklist for one section; with a width and its measured boxes, at that width. */
export function adviceFor(slot: Slot, at?: { width: number; rects?: Record<string, { w: number; h: number }> }) {
  const st = useStore.getState()
  const clip = slotClip(slot)
  return advise({
    blocks: clip.blocks,
    sectionType: clip.type,
    width: at?.width,
    rects: at?.rects,
    edits: slot.edits?.[clip.id],
    components: st.guide.components,
    tokens: resolveGuide(st.guide).tokens,
    swatches: st.guide.swatches,
    fields: wordsFor(slot),
    links: sectionLinks(clip.blocks, slot.edits?.[clip.id], wordsFor(slot), linkScopeFor(slot.id), slot.id),
  })
}


/** null in a style input clears that property; undefined leaves it alone. */
export function styleFrom(input: Record<string, unknown> | undefined): Partial<BlockStyle> | undefined {
  if (!input) return undefined
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === null ? undefined : v])) as Partial<BlockStyle>
}

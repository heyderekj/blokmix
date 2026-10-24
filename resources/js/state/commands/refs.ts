import type { BlockInfo, BlockStyle, Note, Slot } from '@/core/types'
import { isMark, SOURCE_LABEL } from '@/core/notes'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { effectiveEdit } from '@/core/blocks/style'
import { advise } from '@/core/advise'
import { resolveGuide } from '@/core/guide'
import { library, slotClip } from '@/data/library'
import { sectionAnchors, sectionLinks } from '@/core/links'
import { editList, ListError, type ListOp } from '@/core/lists'
import { outline, type OutlineList, type OutlineNode } from '@/core/outline'
import { parseHtml } from '@/core/html/parse'
import { useStore } from '../store'

/** How commands find what they act on (sections, blocks, notes, lists), and how they describe it back. */

export class CommandError extends Error {}

export function findSection(ref: string | number): Slot {
  const { slots } = useStore.getState()
  if (typeof ref === 'string' && /^\d+$/.test(ref)) ref = Number(ref)
  const hit =
    typeof ref === 'number'
      ? slots[ref - 1]
      : (slots.find((s) => s.id === ref) ?? slots.find((s) => s.type === ref.toLowerCase()) ?? slots.find((s) => TYPE_LABEL[s.type].toLowerCase() === ref.toLowerCase()))
  if (!hit) throw new CommandError(`No section "${ref}". Sections: ${slots.map((s, i) => `${i + 1} ${s.type} (${s.id})`).join(', ')}`)
  return hit
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
    const slot = st.slots.find((s) => s.id === a.slotId)
    section = slot?.id ?? null
    const name = slot ? `${TYPE_LABEL[slot.type]} (section ${st.slots.indexOf(slot) + 1})` : 'a removed section'
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

export function wordsFor(slot: Slot) {
  const clip = slotClip(slot)
  return resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
}

export function describeSection(slot: Slot, position: number) {
  const st = useStore.getState()
  const clip = slotClip(slot)
  const words = wordsFor(slot)
  const links = sectionLinks(clip.blocks, slot.edits?.[clip.id], words, st.slots, slot.id, sectionAnchors(st.slots))
  return {
    id: slot.id,
    position,
    type: slot.type,
    label: TYPE_LABEL[slot.type],
    clip: { id: clip.id, title: clip.title, origin: clip.origin, source: library.sources[clip.sourceId]?.name, rhythm: clip.rhythm ?? null },
    keep: { layout: slot.keep.layout, style: slot.keep.style, copy: slot.keep.content, motion: slot.keep.motion, locked: slot.locked },
    spacing: slot.spacing ?? {},
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

export const putSlot = (next: Slot) => useStore.setState((st) => ({ slots: st.slots.map((x) => (x.id === next.id ? next : x)) }))

export const itemsOf = (slot: Slot, listId: string) => slotClip(slot).blocks.filter((b) => b.parent === listId && b.kind === 'item')

export const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>


export function adviceFor(slot: Slot) {
  const st = useStore.getState()
  const clip = slotClip(slot)
  return advise({
    blocks: clip.blocks,
      sectionType: clip.type,
    edits: slot.edits?.[clip.id],
    components: st.guide.components,
    tokens: resolveGuide(st.guide).tokens,
    swatches: st.guide.swatches,
    fields: wordsFor(slot),
    links: sectionLinks(clip.blocks, slot.edits?.[clip.id], wordsFor(slot), st.slots, slot.id, sectionAnchors(st.slots)),
  })
}


/** null in a style input clears that property; undefined leaves it alone. */
export function styleFrom(input: Record<string, unknown> | undefined): Partial<BlockStyle> | undefined {
  if (!input) return undefined
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === null ? undefined : v])) as Partial<BlockStyle>
}

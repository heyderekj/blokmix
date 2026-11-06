// Whose words are on the page: yours (typed, poured, picked, or the name and email you
// gave the guided start), or not yours yet (a layout's sample words, the guided start's
// filler, a clipped section's own words). Content counts them and marks the filler, so
// "make it yours" is a number that goes down, not a feeling.

import type { Clip, ProjectContent, Slot } from './types'
import { resolveFields } from './content'

export type Owner = 'yours' | 'filler' | 'clipped'

export interface FieldOwner {
  field: string
  owner: Owner
}

/** A key into `ProjectContent.mine`. */
export const mineKey = (type: string, field: string) => `${type}.${field}`

/** Who a field's words belong to. */
export function fieldOwner(slot: Pick<Slot, 'type' | 'words' | 'keep'>, clip: Pick<Clip, 'type' | 'fields'>, content: ProjectContent, field: string): Owner {
  const own = slot.words?.[field]
  if (own != null && own.trim() !== '') return 'yours'
  if (slot.keep.content) return 'clipped'
  const copy = content.fields[clip.type]?.[field]
  if (copy && content.mine?.includes(mineKey(clip.type, field))) return 'yours'
  return 'filler'
}

/** Every field a section shows (hidden blocks and empty fields left out), in reading order, with whose words they are. */
export function ownership(slot: Slot, clip: Pick<Clip, 'id' | 'type' | 'fields' | 'blocks'>, content: ProjectContent): FieldOwner[] {
  const edits = slot.edits?.[clip.id] ?? {}
  const byId = new Map(clip.blocks.map((b) => [b.id, b]))
  const hidden = (id: string | null): boolean => {
    for (let at = id; at; at = byId.get(at)?.parent ?? null) if (edits[at]?.hidden) return true
    return false
  }
  const shown = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
  const seen = new Set<string>()
  const out: FieldOwner[] = []
  for (const b of clip.blocks) {
    if (!b.field || b.kind === 'image' || seen.has(b.field)) continue
    seen.add(b.field)
    if (hidden(b.id) || !shown[b.field]?.trim()) continue
    out.push({ field: b.field, owner: fieldOwner(slot, clip, content, b.field) })
  }
  return out
}

/** How many of a page's words are yours, of how many it shows. */
export function pageOwnership(slots: Slot[], clipOf: (s: Slot) => Pick<Clip, 'id' | 'type' | 'fields' | 'blocks'>, content: ProjectContent): { yours: number; total: number } {
  let yours = 0
  let total = 0
  for (const s of slots) {
    for (const f of ownership(s, clipOf(s), content)) {
      total++
      if (f.owner === 'yours') yours++
    }
  }
  return { yours, total }
}

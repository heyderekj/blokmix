// "This reads like a menu of 4. Make it a menu": a section's own words poured into a layout of another type. Every line
// keeps the part it played (a heading stays a heading, each item's title stays a title); lines the new layout has no
// place for wait in Words to place. The section keeps its id, so notes and links follow. One undo step.

import type { SectionType, Slot } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { listContext } from '@/core/lists'
import { suggestClip } from '@/core/suggest'
import { composePour, roleOfField, spotsOf, type Line, type Read } from '@/core/jev/pour'
import { itemsOf } from '@/core/wordsFit'
import { library, slotClip } from '@/data/library'
import { currentSlots, useStore } from './store'
import { outlineOf, wordsFor } from './commands/refs'
import { capacity } from './jevPage'
import { pourSlot, setTray, trayFrom } from './jevPour'
import type { OutlineNode } from '@/core/outline'

/** A section's words as lines, top to bottom, each with the part it plays (items' lines grouped per item). */
export function sectionLines(slot: Slot): { lines: Line[]; roles: Record<number, Read['role']>; lists: Set<number> } {
  const words = wordsFor(slot)
  const lines: Line[] = []
  const roles: Record<number, Read['role']> = {}
  const lists = new Set<number>()
  let group = 0
  const walk = (ns: OutlineNode[], inItem = false) => {
    for (const n of ns) {
      if (n.t === 'field') {
        const text = words[n.field]?.trim()
        if (!text) continue
        const role = roleOfField(slot.type, n.field, inItem ? n.key : undefined) ?? 'other'
        roles[lines.length] = role
        lines.push({ i: lines.length, text, group, heading: role === 'heading' || role === 'headline' })
      } else {
        group++
        lists.add(group)
        for (const it of n.items) walk(it.nodes, true)
        group++
      }
    }
  }
  walk(outlineOf(slot))
  return { lines, roles, lists }
}

/** The layout of `type` that best holds these words: one whose main list fits the items, ordered as suggestions are. */
export function bestLayoutFor(type: SectionType, slot: Slot, view: Slot[], at: number): string | null {
  const items = itemsOf(slot.type, outlineOf(slot))
  const all = suggestClip(type, view, at, library, true).map((x) => x.clipId)
  const built = all.filter((id) => library.clips[id]?.origin === 'layout')
  const pool = built.length ? built : all
  return pool.find((id) => capacity(id, items.lead) >= items.count) ?? pool[0] ?? null
}

/** Turn a section into another type, its words poured in. Returns how many lines landed and how many wait. */
export function retypeSection(slotId: string, type: SectionType, clipId?: string): { placed: number; waiting: number } | null {
  const st = useStore.getState()
  const view = currentSlots(st)
  const at = view.findIndex((s) => s.id === slotId)
  const old = view[at]
  if (!old || old.type === type || old.locked || old.type === 'nav' || old.type === 'footer') return null
  const target = clipId ?? bestLayoutFor(type, old, view, at)
  if (!target || library.clips[target]?.type !== type) return null
  const { lines, roles, lists } = sectionLines(old)
  let fresh: Slot = { id: old.id, type, clipId: target, locked: false, keep: { ...DEFAULT_KEEP }, ...(old.surface ? { surface: old.surface } : {}), ...(old.width ? { width: old.width } : {}) }
  const clip = slotClip(fresh)
  const spots = spotsOf(fresh.id, type, outlineOf(fresh), (listId) => listContext(clip, fresh, listId)?.max ?? 0)
  const reads: Read[] = lines.map((line) => ({ line, role: roles[line.i], pRole: 1, slotId: fresh.id, pSection: 1, roles: [{ option: roles[line.i], p: 1 }], sections: [{ option: `s_${fresh.id}`, p: 1 }] }))
  const poured = composePour(reads, spots, (g) => lists.has(g))
  fresh = pourSlot(fresh, poured, st.content)
  const sections = view.map((s) => (s.id === slotId ? fresh : s))
  useStore.setState((s) => ({ site: replaceSlot(s.site, slotId, fresh) }))
  const tray = trayFrom(poured, sections)
  if (tray.length) setTray((t) => [...t, ...tray])
  return { placed: poured.placed.length, waiting: tray.length }
}

/** The site with one section swapped for another (same place, same page). */
function replaceSlot(site: ReturnType<typeof useStore.getState>['site'], id: string, slot: Slot) {
  return {
    ...site,
    pages: site.pages.map((p) => ({ ...p, slots: p.slots.map((s) => (s.id === id ? slot : s)) })),
  }
}

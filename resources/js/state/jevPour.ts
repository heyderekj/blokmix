// Pour in your words, on the board: read the page's sections into places a line can go,
// ask Jev what each line is and where it belongs, and write the plan as one undo step.
// Words a pour replaces stay as options (‹ › brings them back); lines Jev isn't sure of
// wait in the Words to place tray.

import { create } from 'zustand'
import type { Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { currentWords, keepOption } from '@/core/words'
import { listContext } from '@/core/lists'
import { composePour, listRunsFrom, pourRequest, readLines, spotsOf, splitLines, type Line, type PourPlan, type PourSection, type Role, type Spot } from '@/core/jev/pour'
import { slotClip } from '@/data/library'
import { askJev } from '@/lib/jev'
import { currentSlots, useStore } from './store'
import { changeList, findOutlineList, itemsOf, outlineOf, putSlot, wordsFor } from './commands/refs'

/** Lines a pour couldn't place for sure, each with its best two homes. Not undoable state. */
export interface TrayLine {
  id: string
  text: string
  homes: { slotId: string; role: Role; label: string }[]
}
export const useWordsTray = create<{ lines: TrayLine[] }>()(() => ({ lines: [] }))

/** The sections a pour may write into: not the shared nav or footer, not locked, not keeping their source's words. */
export function pourTargets(slots: Slot[]): { sections: PourSection[]; spots: Spot[] } {
  const sections: PourSection[] = []
  const spots: Spot[] = []
  for (const s of slots) {
    if (s.type === 'nav' || s.type === 'footer' || s.locked || s.keep.content) continue
    const clip = slotClip(s)
    const words = wordsFor(s)
    const h = clip.blocks.find((b) => b.kind === 'heading' && b.field && words[b.field])
    sections.push({ slotId: s.id, type: s.type, heading: h?.field ? words[h.field] : undefined })
    const mine = spotsOf(s.id, s.type, outlineOf(s), (listId) => listContext(clip, s, listId)?.max ?? 0)
    // Lists that show a collection fill from its entries: a pour leaves them be.
    spots.push(...mine.filter((sp) => !(sp.list && s.bind?.lists?.[sp.list.listKey])))
  }
  return { sections, spots }
}

export interface Poured {
  lines: Line[]
  plan: PourPlan
}

/** What a pour would do with this text on these sections, or null when Jev is off. */
export async function planPour(text: string, slots: Slot[] = currentSlots(useStore.getState())): Promise<Poured | null> {
  const lines = splitLines(text)
  if (!lines.length) return { lines, plan: { words: {}, lists: {}, placed: [], tray: [] } }
  const { sections, spots } = pourTargets(slots)
  if (!sections.length) return { lines, plan: { words: {}, lists: {}, placed: [], tray: lines.map((line) => ({ line, homes: [] })) } }
  const res = await askJev(pourRequest(lines, sections), { timeoutMs: 8000 })
  if (!res) return null
  return { lines, plan: composePour(readLines(res, lines), spots, listRunsFrom(res)) }
}

const sectionOf = (id: string) => currentSlots(useStore.getState()).find((s) => s.id === id)

/** Your words in a field, keeping what it showed before as an option. */
function write(slot: Slot, field: string, text: string): Slot {
  const st = useStore.getState()
  const before = currentWords(slotClip(slot), slot, st.content, field)
  const kept = before && before.trim() !== text.trim() ? keepOption(slot, field, before, 'you') : slot
  return { ...kept, words: { ...kept.words, [field]: text } }
}

/** Write a plan: single fields, then each list grown or trimmed to the items poured and filled. Call inside one step. */
export function applyPour(plan: PourPlan): { sections: number; placed: number } {
  const touched = new Set<string>([...Object.keys(plan.words), ...Object.keys(plan.lists)])
  for (const slotId of touched) {
    let slot = sectionOf(slotId)
    if (!slot) continue
    for (const [field, text] of Object.entries(plan.words[slotId] ?? {})) slot = write(slot, field, text)
    for (const l of Object.values(plan.lists[slotId] ?? {})) {
      if (!l.items.length) continue
      const want = Math.min(l.items.length, l.max || l.items.length)
      while (itemsOf(slot, l.listId).length < want) slot = changeList(slot, { op: 'add', listId: l.listId })
      while (itemsOf(slot, l.listId).length > want) {
        const items = itemsOf(slot, l.listId)
        slot = changeList(slot, { op: 'remove', itemId: items[items.length - 1].id })
      }
      const node = findOutlineList(outlineOf(slot), l.listId)
      if (!node) continue
      l.items.slice(0, want).forEach((item, n) => {
        const fields = node.items[n]?.nodes.filter((x) => x.t === 'field') ?? []
        for (const [key, text] of Object.entries(item)) {
          const f = fields.find((x) => x.t === 'field' && x.key === key)
          if (f && f.t === 'field') slot = write(slot!, f.field, text)
        }
      })
    }
    putSlot(slot)
  }
  return { sections: touched.size, placed: plan.placed.length }
}

/** The unsure lines into the tray, with their homes named. */
export function trayFrom(plan: PourPlan): TrayLine[] {
  return plan.tray.map(({ line, homes }) => ({
    id: `${Date.now().toString(36)}-${line.i}`,
    text: line.text,
    homes: homes.map((h) => {
      const s = sectionOf(h.slotId)
      return { ...h, label: `${s ? TYPE_LABEL[s.type] : 'Section'} · ${roleWord(h.role)}` }
    }),
  }))
}

const ROLE_WORDS: Record<Role, string> = {
  headline: 'Headline', heading: 'Heading', eyebrow: 'Label', lead: 'Intro', paragraph: 'Paragraph', button: 'Button', title: 'Item title',
  body: 'Item text', question: 'Question', answer: 'Answer', quote: 'Quote', name: 'Name', role: 'Role', price: 'Price', stat: 'Number', contact: 'Contact', other: 'Small print',
}
export const roleWord = (r: Role) => ROLE_WORDS[r] ?? r

/** Put a tray line where you picked: the first field of that role in that section (the next free item in a list). */
export function placeFromTray(line: TrayLine, home: TrayLine['homes'][number]): boolean {
  const slot = sectionOf(home.slotId)
  if (!slot) return false
  const { spots } = pourTargets([slot])
  const st = useStore.getState()
  const isEmpty = (sp: Spot) => !currentWords(slotClip(slot), slot, st.content, sp.field).trim()
  const spot = spots.filter((s) => s.role === home.role).sort((a, b) => Number(isEmpty(b)) - Number(isEmpty(a)))[0]
  if (!spot) return false
  putSlot(write(slot, spot.field, line.text))
  useWordsTray.setState((s) => ({ lines: s.lines.filter((x) => x.id !== line.id) }))
  return true
}

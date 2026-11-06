// Pour in your words, on the board: read the page's sections into places a line can go,
// ask Jev what each line is and where it belongs, and write the plan as one undo step.
// Words a pour replaces stay as options (‹ › brings them back); lines Jev isn't sure of
// wait in the Words to place tray.

import type { ProjectContent, Slot, TrayLine } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { currentWords, keepOption } from '@/core/words'
import { editList, listContext } from '@/core/lists'
import { composePour, listRunsFrom, pourRequest, readLines, spotsOf, splitLines, type Line, type PourPlan, type PourSection, type Role, type Spot } from '@/core/jev/pour'
import { slotClip } from '@/data/library'
import { askJev } from '@/lib/jev'
import { currentSlots, useStore, type State } from './store'
import { findOutlineList, itemsOf, outlineOf, putSlot, wordsFor } from './commands/refs'

export type { TrayLine }

const NO_LINES: TrayLine[] = []
/** Words to place: lines a pour couldn't place for sure, each with its best two homes. Saved with the mix's words. */
export const trayLines = (s: Pick<State, 'content'>) => s.content.tray ?? NO_LINES

/** Change the tray (inside whatever undo step is running). */
export function setTray(change: (lines: TrayLine[]) => TrayLine[]) {
  useStore.setState((st) => {
    const lines = change(st.content.tray ?? [])
    const { tray: _old, ...rest } = st.content
    return { content: lines.length ? { ...rest, tray: lines } : rest }
  })
}

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
function write(slot: Slot, field: string, text: string, content: ProjectContent): Slot {
  const before = currentWords(slotClip(slot), slot, content, field)
  const kept = before && before.trim() !== text.trim() ? keepOption(slot, field, before, 'you') : slot
  return { ...kept, words: { ...kept.words, [field]: text } }
}

/**
 * One section with a plan's words written in: single fields, then each list grown or trimmed to the items poured
 * and filled. Pure: the board and the guided start both use it.
 */
export function pourSlot(slot: Slot, plan: PourPlan, content: ProjectContent): Slot {
  for (const [field, text] of Object.entries(plan.words[slot.id] ?? {})) slot = write(slot, field, text, content)
  for (const l of Object.values(plan.lists[slot.id] ?? {})) {
    if (!l.items.length) continue
    const want = Math.min(l.items.length, l.max || l.items.length)
    const change = (op: Parameters<typeof editList>[3]) => {
      try {
        slot = editList(slot, slotClip(slot), content, op)
        return true
      } catch {
        return false
      }
    }
    while (itemsOf(slot, l.listId).length < want) if (!change({ op: 'add', listId: l.listId })) break
    while (itemsOf(slot, l.listId).length > want) {
      const items = itemsOf(slot, l.listId)
      if (!change({ op: 'remove', itemId: items[items.length - 1].id })) break
    }
    const node = findOutlineList(outlineOf(slot), l.listId)
    if (!node) continue
    l.items.slice(0, want).forEach((item, n) => {
      const fields = node.items[n]?.nodes.filter((x) => x.t === 'field') ?? []
      for (const [key, text] of Object.entries(item)) {
        const f = fields.find((x) => x.t === 'field' && x.key === key)
        if (f && f.t === 'field') slot = write(slot, f.field, text, content)
      }
    })
  }
  return slot
}

/** Write a plan onto the board. Call inside one step. */
export function applyPour(plan: PourPlan): { sections: number; placed: number } {
  const touched = new Set<string>([...Object.keys(plan.words), ...Object.keys(plan.lists)])
  const content = useStore.getState().content
  for (const slotId of touched) {
    const slot = sectionOf(slotId)
    if (slot) putSlot(pourSlot(slot, plan, content))
  }
  return { sections: touched.size, placed: plan.placed.length }
}

/** The unsure lines as tray lines, with their homes named from these sections (the open page's by default). */
export function trayFrom(plan: PourPlan, slots: Slot[] = currentSlots(useStore.getState())): TrayLine[] {
  const stamp = Date.now().toString(36)
  return plan.tray.map(({ line, homes }) => ({
    id: `${stamp}-${line.i}`,
    text: line.text,
    homes: homes.map((h) => {
      const s = slots.find((x) => x.id === h.slotId)
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
  putSlot(write(slot, spot.field, line.text, st.content))
  setTray((lines) => lines.filter((x) => x.id !== line.id))
  return true
}

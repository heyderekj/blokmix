// Say it on the board: read the page into Say it's context, ask Jev as you type (only the
// latest words are answered), and run what it understood through the ordinary commands,
// as you, so the buy sheet and one-step undo work as they always do.

import { create } from 'zustand'
import type { SectionType } from '@/core/types'
import { readDials, toneOfGuide } from '@/core/dials'
import { resolveGuide } from '@/core/guide'
import { skinList } from '@/core/skins'
import { suggestClip } from '@/core/suggest'
import { contractRefusal } from '@/core/contract'
import { TYPE_LABEL } from '@/core/content'
import { sayRequest, understand, type SayAction, type SayContext, type Understood } from '@/core/jev/say'
import { library, slotClip } from '@/data/library'
import { askLatest } from '@/lib/jev'
import { currentSlots, useStore } from './store'
import { runCommand } from './commands'
import { wordsFor } from './commands/refs'

/** Which of Jev's tools Say it (or anything else) asked to open, and on what. */
export const useJevTools = create<{ open: 'pour' | 'page' | 'colors' | 'dress' | null; slotId?: string; text?: string; into?: 'new_page' | 'this_page' }>()(() => ({ open: null }))

export function sayContext(): SayContext {
  const st = useStore.getState()
  const tokens = resolveGuide(st.guide).tokens
  const sections = currentSlots(st).map((s, i) => {
    const clip = slotClip(s)
    const words = wordsFor(s)
    const h = clip.blocks.find((b) => b.kind === 'heading' && b.field && words[b.field])
    return { id: s.id, type: s.type as SectionType, position: i + 1, heading: h?.field ? words[h.field] : undefined, locked: s.locked }
  })
  return { sections, dials: readDials(tokens), tone: toneOfGuide(tokens) === 'dark' ? 'dark' : 'light', skins: skinList().map((k) => ({ id: k.id, name: k.name, words: k.words })) }
}

/** "Another hero": the next layout that suits that spot, filled in when it's understood. */
function withLayout(a: SayAction): SayAction | null {
  if (a.command !== 'swap_section') return a
  const st = useStore.getState()
  const slots = currentSlots(st)
  const index = slots.findIndex((s) => s.id === a.slotId)
  const slot = slots[index]
  if (!slot) return null
  const next = suggestClip(slot.type, slots, index, library, true).find((c) => c.clipId !== slot.clipId)
  return next ? { ...a, input: { ...a.input, clip_id: next.clipId } } : null
}

export interface Heard extends Understood {
  /** Why the contract would refuse the action an agent asked for (you can still do it). */
  kept?: string | null
}

/** What these words would do, or null when Jev is off or newer words came in. */
export async function hear(text: string): Promise<Heard | null> {
  const t = text.trim()
  if (t.length < 2) return { action: null, options: [] }
  const ctx = sayContext()
  const res = await askLatest('say', sayRequest(t, ctx))
  if (!res) return null
  const u = understand(res, t, ctx)
  const action = u.action ? withLayout(u.action) : null
  const options = u.options.map(withLayout).filter((x): x is SayAction => !!x)
  const kept = action?.command ? contractRefusal(useStore.getState().contract, action.command, action.input ?? {}) : null
  return { action, options, kept }
}

/** Do it: an ordinary command as you (one undo step, the buy sheet when it needs a pack), or open a tool. */
export async function doSay(a: SayAction, text: string): Promise<string | null> {
  const st = useStore.getState()
  if (a.open) {
    useJevTools.setState({ open: a.open, slotId: a.slotId, text })
    return null
  }
  if (!a.command) return null
  const out = await Promise.resolve(runCommand(a.command, a.input ?? {}, 'you'))
  if (a.slotId && a.command !== 'remove_section') st.setUi({ focusedSlotId: a.slotId })
  if (a.command === 'show' || a.command === 'five_second_test') return null
  if (a.command === 'place_links') {
    const r = out as { message?: string }
    st.showFlash(r?.message ?? 'Links updated', { undo: true })
    return null
  }
  st.showFlash(a.words, { undo: true })
  return null
}

export const sectionName = (type: SectionType) => TYPE_LABEL[type]

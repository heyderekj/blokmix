// Say it on the board: read the page into Say it's context, ask Jev as you type (only the
// latest words are answered), and run what it understood through the ordinary commands,
// as you, so the buy sheet and one-step undo work as they always do.

import { splitSay } from '@/core/jev/sayParts'
import { create } from 'zustand'
import type { SectionType } from '@/core/types'
import { readDials, toneOfGuide } from '@/core/dials'
import { resolveGuide } from '@/core/guide'
import { skinList } from '@/core/skins'
import { pageOf } from '@/core/site'
import { cycleIds } from '@/core/library'
import { suggestClip } from '@/core/suggest'
import { opposingBands } from '@/core/surface'
import { contractRefusal } from '@/core/contract'
import { TYPE_LABEL } from '@/core/content'
import { sayRequest, understand, type SayAction, type SayContext, type Understood } from '@/core/jev/say'
import { readLocalSay } from '@/core/jev/sayLocal'
import { library, slotClip } from '@/data/library'
import { askJev, jevOn } from '@/lib/jev'
import { noteWants } from '@/lib/jevWants'
import { setStylePanel } from '@/ui/panels/stylePanel'
import { currentSlots, mixClipIds, useStore } from './store'
import { oneUndoStep, runCommand } from './commands'
import { wordsFor } from './commands/refs'

/** Which of Jev's tools Say it (or anything else) asked to open, and on what. */
export const useJevTools = create<{
  open: 'pour' | 'page' | 'colors' | 'dress' | 'restyle' | null
  slotId?: string
  text?: string
  into?: 'new_page' | 'this_page'
  /** Words handed over to place at once (pasted into the Say it bar), not to look at first. */
  auto?: 'pour' | 'page'
}>()(() => ({ open: null }))

export function sayContext(st = useStore.getState()): SayContext {
  const tokens = resolveGuide(st.guide).tokens
  const slots = currentSlots(st)
  const sections: SayContext['sections'] = slots.map((s, i) => {
    const clip = slotClip(s)
    const words = wordsFor(s)
    const h = clip.blocks.find((b) => b.kind === 'heading' && b.field && words[b.field])
    return {
      id: s.id, type: s.type, position: i + 1, heading: h?.field ? words[h.field] : undefined, locked: s.locked,
      originalStyle: s.keep.style, surface: s.surface ?? st.guide.sections?.[s.type]?.surface ?? 'page', width: s.width ?? 'standard',
    }
  })
  return {
    sections, pageId: pageOf(st.site, st.ui.pageId).id, dials: readDials(tokens), tone: toneOfGuide(tokens),
    opposingBands: opposingBands(tokens, slots, st.guide.sections).length, originalView: st.ui.mode === 'captured',
    skins: skinList().map((k) => ({ id: k.id, name: k.name, words: k.words })),
  }
}

/** "Another hero": the next layout that suits that spot, filled in when it's understood. */
function withLayout(a: SayAction): SayAction | null {
  if (a.command !== 'swap_section') return a
  const st = useStore.getState()
  const slots = currentSlots(st)
  const index = slots.findIndex((s) => s.id === a.slotId)
  const slot = slots[index]
  if (!slot) return null
  const options = cycleIds(library, slot.type, mixClipIds(st), slot.clipId)
  const next = suggestClip(slot.type, slots, index, library, true, options).find((c) => c.clipId !== slot.clipId)
  return next ? { ...a, input: { ...a.input, clip_id: next.clipId } } : null
}

export interface Heard extends Understood {
  /** Why the contract would refuse the action an agent asked for (you can still do it). */
  kept?: string | null
}

export function previewSay(u: Understood): Heard {
  const action = u.action ? withLayout(u.action) : null
  const options = u.options.map(withLayout).filter((x): x is SayAction => !!x)
  const kept = action?.command ? contractRefusal(useStore.getState().contract, action.command, action.input ?? {}) : null
  const message = u.message ?? (u.action && !action ? 'There’s no other layout available for this section.' : undefined)
  return { action, options, kept, message }
}

/** What these words would do. Common edits are resolved locally before asking for suggestions. */
export async function hear(text: string, ctx = sayContext(), signal?: AbortSignal): Promise<Heard> {
  const t = text.trim()
  if (t.length < 2) return { action: null, options: [] }
  const local = readLocalSay(t, ctx)
  if (local) return previewSay(local)
  if (!(await jevOn())) return { action: null, options: [], message: 'Try a built-in edit such as “make the page light”, “roomier” or “add a FAQ”.' }
  const res = await askJev(sayRequest(t, ctx), { signal })
  if (!res) return { action: null, options: [], message: 'Suggestions didn’t respond. Try a built-in edit such as “make the page light” or “add a FAQ”.' }
  const heard = previewSay(understand(res, t, ctx))
  // Count unmet requests after a pause. Editing the input or leaving the bar cancels the count.
  if (!heard.action && !heard.options.length && !heard.message && !signal?.aborted) {
    const kind = useStore.getState().content.kind
    const timer = setTimeout(() => { if (!signal?.aborted) void noteWants([t], 'say', undefined, kind) }, 2500)
    signal?.addEventListener('abort', () => clearTimeout(timer), { once: true })
  }
  return heard
}

/** Do it: an ordinary command as you (one undo step), or open a tool. */
export async function doSay(a: SayAction, text: string): Promise<void> {
  const st = useStore.getState()
  if (a.open) {
    useJevTools.setState({ open: a.open, slotId: a.slotId, text, auto: undefined, into: undefined })
    // Bring the requested controls into view.
    if (a.open === 'colors' || a.open === 'restyle') st.setUi({ leftPanel: 'look', guideView: 'look' })
    if (a.open === 'dress') {
      const slots = currentSlots(st)
      const target = a.slotId ?? slots.find((s) => s.type === 'hero')?.id ?? slots[0]?.id
      if (!target) {
        useJevTools.setState({ open: null })
        throw new Error('Add a section to find a background for it.')
      }
      useJevTools.setState({ slotId: target })
      st.focusSlot(target)
      st.selectBlock(null)
      st.setUi({ sheet: 'none' })
      setStylePanel(true)
    }
    return
  }
  if (!a.command) return
  if (a.command === 'five_second_test') {
    st.setUi({ sheet: 'packet' })
    return
  }
  const out = await runCommand(a.command, a.input ?? {}, 'you')
  const after = useStore.getState()
  const changed = st.guide !== after.guide || st.site !== after.site || st.content !== after.content
  if (['tone', 'surface', 'width', 'dial', 'skin', 'surprise'].includes(a.intent) && after.ui.mode === 'captured') st.setUi({ mode: 'unified' })
  if (a.command === 'show') return
  if (a.slotId && currentSlots(after).some((s) => s.id === a.slotId) && a.command !== 'remove_section') st.focusSlot(a.slotId)
  if (a.command === 'place_links') {
    const r = out as { message?: string }
    st.showFlash(r?.message ?? 'Links updated', { undo: changed })
    return
  }
  st.showFlash(a.words, { undo: changed })
}

export const sectionName = (type: SectionType) => TYPE_LABEL[type]

export interface SayPart {
  text: string
  action: SayAction
}

/** A request that's two or more edits ("make the hero darker and move testimonials to the top"), each read here. */
export function hearParts(text: string, ctx = sayContext()): SayPart[] | null {
  const read = (part: string) => {
    const local = readLocalSay(part, ctx)
    const action = local ? previewSay(local).action : null
    // Only edits run in a row: opening a tool waits for you.
    return action && action.command && !action.open ? action : null
  }
  const parts = splitSay(text, (p) => !!read(p))
  return parts ? parts.map((p) => ({ text: p, action: read(p)! })) : null
}

/**
 * Do them in the order said. Each part is read again just before it runs, against the page as the last one left it
 * (an added section moves the others along). Stops at the first that can't be done and says which.
 */
export async function doSayParts(parts: SayPart[]): Promise<void> {
  // All of it is one ⌘Z.
  await oneUndoStep(async () => {
    const done: string[] = []
    for (const p of parts) {
      const local = readLocalSay(p.text, sayContext())
      const action = local ? previewSay(local).action : null
      if (!action) throw new Error(done.length ? `Did “${done.join('” and “')}”, then couldn’t ${p.text}.` : `Couldn’t ${p.text}.`)
      await doSay(action, p.text)
      done.push(action.words)
    }
  })
  const st = useStore.getState()
  st.showFlash(parts.map((p) => p.action.words).join(' · '), { undo: true })
}

// Smart links on the board: find the buttons and links that lead nowhere, ask Jev where
// each should go, and keep its guesses (not undoable state) so the checklist can offer
// them as one-click fixes. place_links sets the sure ones.

import { create } from 'zustand'
import type { Slot } from '@/core/types'
import { allSlots, pageOfSlot } from '@/core/site'
import { linkWords, sectionLinks } from '@/core/links'
import { slotClip } from '@/data/library'
import { destinations, linkRequest, readLinks, type Destination, type LinkAsk, type LinkGuess } from '@/core/jev/links'
import { askJev } from '@/lib/jev'
import { useStore } from './store'
import { linkScopeFor, wordsFor } from './commands/refs'

/** Jev's guesses by `${slotId}:${blockId}`, each for the words it was asked about. */
export const useJevLinks = create<{ guesses: Record<string, LinkGuess> }>()(() => ({ guesses: {} }))

const key = (slotId: string, blockId: string) => `${slotId}:${blockId}`

/** The first heading's words of each section, so Jev knows what a section is about, not just its type. */
function headings(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of allSlots(useStore.getState().site)) {
    const clip = slotClip(s)
    const words = wordsFor(s)
    const h = clip.blocks.find((b) => b.kind === 'heading' && b.field && words[b.field])
    if (h?.field) out[s.id] = words[h.field]
  }
  return out
}

/** Links in these sections that lead nowhere, have words, and weren't set to "nowhere" on purpose. */
export function deadLinks(slots: Slot[]): LinkAsk[] {
  const out: LinkAsk[] = []
  for (const s of slots) {
    const clip = slotClip(s)
    const words = wordsFor(s)
    const edits = s.edits?.[s.clipId]
    const resolved = sectionLinks(clip.blocks, edits, words, linkScopeFor(s.id), s.id)
    for (const b of clip.blocks) {
      if (!b.linkable || (b.kind !== 'button' && b.kind !== 'link')) continue
      if (edits?.[b.id]?.link || edits?.[b.id]?.hidden || resolved[b.id]?.href !== '#') continue
      const w = linkWords(b, clip.blocks, words).trim()
      if (w) out.push({ slotId: s.id, blockId: b.id, words: w, sectionType: s.type })
    }
  }
  return out
}

/** Ask Jev about these links (cached by their words), remember the guesses, and return them. */
export async function guessLinks(asks: LinkAsk[]): Promise<LinkGuess[]> {
  if (!asks.length) return []
  const { site } = useStore.getState()
  const heads = headings()
  const memo = new Map<string, Destination[]>()
  const dests = (a: LinkAsk) => {
    if (!memo.has(a.slotId)) memo.set(a.slotId, destinations(linkScopeFor(a.slotId), heads, a.slotId, pageOfSlot(site, a.slotId)?.id))
    return memo.get(a.slotId)!
  }
  const res = await askJev(linkRequest(asks, dests))
  if (!res) return []
  const guesses = readLinks(res, asks, dests)
  useJevLinks.setState((s) => ({ guesses: { ...s.guesses, ...Object.fromEntries(guesses.map((g) => [key(g.slotId, g.blockId), g])) } }))
  return guesses
}

/** A guess for this block, if Jev made one for the words it shows now. */
export function guessFor(slotId: string, blockId: string, words: string): LinkGuess | undefined {
  const g = useJevLinks.getState().guesses[key(slotId, blockId)]
  return g && g.words === words.trim() ? g : undefined
}

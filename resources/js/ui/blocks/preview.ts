import { create } from 'zustand'
import type { BlockEdit, SliderChoice, Slot } from '@/core/types'
import type { TreatmentValue } from '@/core/treatments'

/**
 * A look you're hovering in a picker, shown on the page before you commit it.
 * Kept out of the undoable store so browsing never adds history.
 */
interface BlockPreview {
  slotId: string | null
  blockId: string | null
  patch: Partial<BlockEdit> | null
  show: (slotId: string, blockId: string, patch: Partial<BlockEdit>) => void
  clear: () => void
  /** Ask the frame to start editing a block's words in place. */
  editText: { id: string; n: number } | null
  requestEditText: (blockId: string) => void
  /** Words you're hovering in the words menu, shown in place before you choose them. */
  words: { slotId: string; field: string; text: string } | null
  showWords: (w: { slotId: string; field: string; text: string } | null) => void
  /** "Another way to say it": the next words typed into this field are kept as an option too. */
  keepNext: { slotId: string; field: string } | null
  setKeepNext: (k: { slotId: string; field: string } | null) => void
  /** A backdrop you're hovering or dialing (null value = none), shown before you keep it. */
  backdrop: { slotId: string; value: TreatmentValue | null } | null
  showBackdrop: (b: { slotId: string; value: TreatmentValue | null } | null) => void
  /** A slider arrangement you're pointing at, shown before you keep it. */
  slider: { slotId: string; value: SliderChoice } | null
  showSlider: (s: { slotId: string; value: SliderChoice } | null) => void
  /** Bumped to play entrances again on the focused section. */
  replays: number
  replay: () => void
}

export const useBlockPreview = create<BlockPreview>()((set) => ({
  slotId: null,
  blockId: null,
  patch: null,
  show: (slotId, blockId, patch) => set({ slotId, blockId, patch }),
  clear: () => set({ slotId: null, blockId: null, patch: null }),
  editText: null,
  requestEditText: (id) => set((s) => ({ editText: { id, n: (s.editText?.n ?? 0) + 1 } })),
  words: null,
  showWords: (words) => set({ words }),
  keepNext: null,
  setKeepNext: (keepNext) => set({ keepNext }),
  backdrop: null,
  showBackdrop: (backdrop) => set({ backdrop }),
  slider: null,
  showSlider: (slider) => set({ slider }),
  replays: 0,
  replay: () => set((s) => ({ replays: s.replays + 1 })),
}))

/** The slot as it would look with the hovered preview applied. */
export function withPreview(slot: Slot, p: Pick<BlockPreview, 'slotId' | 'blockId' | 'patch' | 'words'> & { backdrop?: BlockPreview['backdrop']; slider?: BlockPreview['slider'] }): Slot {
  if (p.words && p.words.slotId === slot.id) slot = { ...slot, words: { ...slot.words, [p.words.field]: p.words.text } }
  if (p.backdrop && p.backdrop.slotId === slot.id) slot = { ...slot, backdrop: p.backdrop.value ?? undefined }
  if (p.slider && p.slider.slotId === slot.id) slot = { ...slot, slider: Object.fromEntries(Object.entries(p.slider.value).filter(([, v]) => v !== undefined)) }
  if (p.slotId !== slot.id || !p.blockId || !p.patch) return slot
  const forClip = slot.edits?.[slot.clipId] ?? {}
  const cur = forClip[p.blockId] ?? {}
  const next: BlockEdit = {
    ...cur,
    ...p.patch,
    style: p.patch.style ? { ...cur.style, ...p.patch.style } : cur.style,
    motion: p.patch.motion ? { ...cur.motion, ...p.patch.motion } : cur.motion,
  }
  return { ...slot, edits: { ...slot.edits, [slot.clipId]: { ...forClip, [p.blockId]: next } } }
}

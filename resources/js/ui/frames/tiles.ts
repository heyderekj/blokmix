import { create } from 'zustand'
import type { FrameRect } from '@/frame/bridge'

/**
 * Where the focused section's movable list items sit on the page, as its frame last reported: what the sliding-tile
 * arrows and ⌥ + arrow keys use to find the item above, below or beside one.
 */
export const useTiles = create<{ slotId: string | null; ids: string[]; rects: Record<string, FrameRect>; set: (slotId: string | null, ids: string[], rects: Record<string, FrameRect>) => void }>(
  (set) => ({ slotId: null, ids: [], rects: {}, set: (slotId, ids, rects) => set({ slotId, ids, rects }) }),
)

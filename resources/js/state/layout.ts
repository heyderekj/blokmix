import { create } from 'zustand'

/** Every block's box in its section (px from the section's top left), per section, as measured at one page width. */
export type BlockRects = Record<string, Record<string, { x: number; y: number; w: number; h: number }>>

/** Measured, non-persisted layout facts the canvas needs (row offsets, frame sizes). */
interface LayoutState {
  rows: Record<string, { top: number; height: number }>
  frameHeights: Record<string, number>
  sections: Record<string, { slot: string; top: number; height: number }[]>
  setRow: (slotId: string, top: number, height: number) => void
  setFrameHeight: (id: string, h: number) => void
  setSections: (id: string, s: { slot: string; top: number; height: number }[]) => void
  /** Block boxes by page width (1280, 390), from lib/measure.ts, with the page they were measured from. */
  blockRects: Record<number, { key: string; rects: BlockRects }>
  setBlockRects: (width: number, key: string, rects: BlockRects) => void
}

export const useLayout = create<LayoutState>()((set) => ({
  rows: {},
  frameHeights: {},
  sections: {},
  blockRects: {},
  setRow: (slotId, top, height) =>
    set((s) => {
      const r = s.rows[slotId]
      if (r && r.top === top && r.height === height) return {}
      return { rows: { ...s.rows, [slotId]: { top, height } } }
    }),
  setFrameHeight: (id, h) => set((s) => (s.frameHeights[id] === h ? {} : { frameHeights: { ...s.frameHeights, [id]: h } })),
  setSections: (id, sections) => set((s) => ({ sections: { ...s.sections, [id]: sections } })),
  setBlockRects: (width, key, rects) => set((s) => ({ blockRects: { ...s.blockRects, [width]: { key, rects } } })),
}))

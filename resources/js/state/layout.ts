import { create } from 'zustand'

/** Measured, non-persisted layout facts the canvas needs (row offsets, frame sizes). */
interface LayoutState {
  rows: Record<string, { top: number; height: number }>
  frameHeights: Record<string, number>
  sections: Record<string, { slot: string; top: number; height: number }[]>
  setRow: (slotId: string, top: number, height: number) => void
  setFrameHeight: (id: string, h: number) => void
  setSections: (id: string, s: { slot: string; top: number; height: number }[]) => void
}

export const useLayout = create<LayoutState>()((set) => ({
  rows: {},
  frameHeights: {},
  sections: {},
  setRow: (slotId, top, height) =>
    set((s) => {
      const r = s.rows[slotId]
      if (r && r.top === top && r.height === height) return {}
      return { rows: { ...s.rows, [slotId]: { top, height } } }
    }),
  setFrameHeight: (id, h) => set((s) => (s.frameHeights[id] === h ? {} : { frameHeights: { ...s.frameHeights, [id]: h } })),
  setSections: (id, sections) => set((s) => ({ sections: { ...s.sections, [id]: sections } })),
}))

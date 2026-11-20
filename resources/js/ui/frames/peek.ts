import { create } from 'zustand'

/**
 * A layout you're pointing at in a section's row of layouts, shown in the section before you pick it (nothing is kept
 * until you click). The row already holds every layout as a tile, so showing one is only a matter of which is in front.
 */
export const useLayoutPeek = create<{ slotId: string | null; clipId: string | null }>()(() => ({ slotId: null, clipId: null }))

export const peekLayout = (slotId: string | null, clipId: string | null = null) => {
  const s = useLayoutPeek.getState()
  if (s.slotId !== slotId || s.clipId !== clipId) useLayoutPeek.setState({ slotId, clipId })
}

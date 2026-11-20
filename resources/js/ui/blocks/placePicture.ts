import { addFile } from '@/lib/assets'
import { currentSlots, useStore } from '@/state/store'
import { autoFocus } from '@/state/jevPhotos'
import { slotClip } from '@/data/library'
import { fillFor } from './ImageMenu'

/**
 * A file dropped or pasted onto a picture fills it, as Upload in its menu would: stored, downscaled, kept in the crop
 * and description it had, one undo step. A photo's subject is kept in frame when suggestions are on.
 */
export async function placePicture(slotId: string, blockId: string, file: File): Promise<boolean> {
  const st = useStore.getState()
  const slot = currentSlots(st).find((s) => s.id === slotId)
  const block = slot ? slotClip(slot).blocks.find((b) => b.id === blockId) : undefined
  if (!slot || block?.kind !== 'image') return false
  try {
    const fill = fillFor(await addFile(file), slot.edits?.[slot.clipId]?.[blockId]?.media)
    useStore.getState().editBlock(slotId, blockId, { media: fill })
    useStore.getState().showFlash('Picture placed', { undo: true })
    if (fill.source === 'upload') void autoFocus(slotId, blockId)
    return true
  } catch (e) {
    useStore.getState().showFlash((e as Error).message)
    return false
  }
}

/** A file pasted with a picture selected goes into it; with anything else selected, nothing happens. */
export function pastePicture(file: File): boolean {
  const st = useStore.getState()
  const slot = currentSlots(st).find((s) => s.id === st.ui.focusedSlotId)
  const id = st.ui.selectedBlockId
  if (!slot || !id || slotClip(slot).blocks.find((b) => b.id === id)?.kind !== 'image') return false
  void placePicture(slot.id, id, file)
  return true
}

import { useStore } from '@/state/store'
import { canvasApi } from '@/ui/canvas/Canvas'

/** Open a draft and show its page; Undo goes back to the one you were in. */
export function openDraft(id: string) {
  const st = useStore.getState()
  const d = st.drafts[id]
  if (!d || id === st.draftId) return
  if (!st.switchDraft(id)) return
  st.showFlash(`Opened ${d.name}`, { undo: true })
  setTimeout(() => canvasApi.fitMix(), 60)
}

/** A new draft, a copy of the open one (or of a saved version), opened. */
export function newDraft(from?: { draft?: string; version?: string }) {
  const st = useStore.getState()
  const id = st.addDraft(from)
  if (!id) return null
  const d = useStore.getState().drafts[id]
  st.showFlash(`Made ${d.name}: a copy to try things on. The others stay as they are.`, { undo: true })
  setTimeout(() => canvasApi.fitMix(), 60)
  return id
}

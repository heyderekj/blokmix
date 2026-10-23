import { useStore } from '@/state/store'
import { snapshotKey } from '@/core/versions'
import { canvasApi } from '@/ui/canvas/Canvas'
import { placeVersions } from '@/ui/canvas/geometry'
import { useLayout } from '@/state/layout'

/** Save a version from the working mix, unless it's identical to the one it came from. */
export function pressVersionAndFly() {
  const st = useStore.getState()
  const head = st.head ? st.versions[st.head] : null
  if (head && snapshotKey(head.snapshot) === snapshotKey(st) && head.parentId === (st.branchFrom ?? head.parentId)) {
    st.showFlash(`Nothing new since ${head.letter}: slide something first`)
    return
  }
  const id = st.pressVersion()
  const v = useStore.getState().versions[id]
  st.showFlash(`Saved version ${v.letter}. ⇧1 shows them all`)
}

export function focusFrame(id: string) {
  const st = useStore.getState()
  const p = placeVersions(st.versions, st.ui.viewport, st.framePos).find((x) => x.id === id)
  if (!p) return
  const h = useLayout.getState().frameHeights[id] ?? 3000
  canvasApi.focusRect({ x: p.x - 80, y: p.y - 120, w: p.w + 160, h: Math.min(h, 2600) + 160 }, 0.6)
}

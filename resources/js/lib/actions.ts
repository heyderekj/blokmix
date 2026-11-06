import { currentSlots, useStore } from '@/state/store'
import { snapshotKey } from '@/core/versions'
import { canvasApi } from '@/ui/canvas/Canvas'
import { VIEW_W, placeVersions } from '@/ui/canvas/geometry'
import { normalizePath } from '@/core/site'
import { useLayout } from '@/state/layout'

/** Save a version from the working mix, unless it's identical to the one it came from. */
export function pressVersionAndFly() {
  const st = useStore.getState()
  const head = st.head ? st.versions[st.head] : null
  if (head && snapshotKey(head.snapshot) === snapshotKey(st)) {
    st.showFlash(`Nothing new since ${head.letter}: change something first`)
    return
  }
  const id = st.pressVersion()
  const v = useStore.getState().versions[id]
  const draft = st.drafts[st.draftId]
  st.showFlash(`Saved ${v.letter}${draft ? ` in ${draft.name}` : ''}. Its history is under ${draft?.letter ?? 'the draft'} ▾ in the top bar.`)
}

export function focusFrame(id: string) {
  const st = useStore.getState()
  const p = placeVersions(st).find((x) => x.id === id)
  if (!p) return
  const h = useLayout.getState().frameHeights[id] ?? 3000
  canvasApi.focusRect({ x: p.x - 80, y: p.y - 120, w: p.w + 160, h: Math.min(h, 2600) + 160 }, 0.6)
}

/** Bring a section into view on the canvas (a link to it was followed), opening its page first if it's on another. */
export function revealSection(slotId: string) {
  const st = useStore.getState()
  if (!currentSlots(st).some((s) => s.id === slotId)) st.focusSlot(slotId)
  // A page that just opened lays its rows out over the next frames.
  let tries = 0
  const go = () => {
    const row = useLayout.getState().rows[slotId]
    const w = VIEW_W[useStore.getState().ui.viewport]
    if (row) canvasApi.focusRect({ x: -40, y: row.top - 60, w: w + 80, h: Math.min(row.height, 1400) + 120 }, 0.8)
    else if (tries++ < 30) requestAnimationFrame(go)
  }
  go()
}

/** Follow a link to another page of the site ("/about"), if there is one. */
export function openPagePath(href: string) {
  const st = useStore.getState()
  const path = normalizePath(href.split('#')[0])
  const page = st.site.pages.find((p) => p.path === path)
  if (!page) return st.showFlash(`${path} isn’t a page yet. Add it from Pages.`)
  st.openPage(page.id)
  const w = VIEW_W[st.ui.viewport]
  canvasApi.focusRect({ x: -40, y: -60, w: w + 80, h: 1200 }, 0.8)
}

import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { useStore, currentSlots } from '@/state/store'
import { edgePan } from '../canvas/dragPan'

/** Where a dragged section would land: a line across the page at that seam, in screen pixels. */
const useDropLine = create<{ line: { left: number; top: number; width: number } | null }>()(() => ({ line: null }))

/** Sections that move: everything but the site's shared nav (first) and footer (last). */
function movable(slotId: string) {
  const { site } = useStore.getState()
  return site.shared.nav?.id !== slotId && site.shared.footer?.id !== slotId
}

/**
 * Press on a section's rail (or its bar's grip) and move to pick the section up: a line shows the seam it will drop
 * into, the canvas pans near the window's edges (the wheel pans too), letting go moves it there (one undo step) and
 * Escape puts it back. A press without moving stays a click. Frames stop taking the pointer for the drag.
 */
export function pressSection(slotId: string, e: React.PointerEvent) {
  if (e.button !== 0 || !movable(slotId)) return
  const x0 = e.clientX
  const y0 = e.clientY
  let active = false
  let client = { x: x0, y: y0 }
  let target: number | null = null
  let pan: ReturnType<typeof edgePan> | null = null
  const row = () => document.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slotId)}"]`)

  // The nearest seam the section can drop into (between the shared nav and footer), and where it is on screen.
  const measure = () => {
    const st = useStore.getState()
    const slots = currentSlots(st)
    const rects = slots.map((s) => document.querySelector(`[data-slot="${CSS.escape(s.id)}"]`)?.getBoundingClientRect())
    if (rects.some((r) => !r)) return
    const first = st.site.shared.nav && slots[0]?.id === st.site.shared.nav.id ? 1 : 0
    const last = st.site.shared.footer && slots.at(-1)?.id === st.site.shared.footer.id ? slots.length - 1 : slots.length
    let best = first
    let dist = Infinity
    for (let i = first; i <= last; i++) {
      const y = i < slots.length ? rects[i]!.top : rects[slots.length - 1]!.bottom
      if (Math.abs(y - client.y) < dist) {
        dist = Math.abs(y - client.y)
        best = i
      }
    }
    target = best
    const r = rects[0]!
    const y = best < slots.length ? rects[best]!.top : rects[slots.length - 1]!.bottom
    useDropLine.setState({ line: { left: r.left, top: y, width: r.width } })
  }
  const move = (ev: PointerEvent) => {
    client = { x: ev.clientX, y: ev.clientY }
    if (!active) {
      if (Math.abs(client.x - x0) + Math.abs(client.y - y0) < 5) return
      active = true
      document.documentElement.setAttribute('data-dragging-section', '')
      row()?.setAttribute('data-dragging', '')
      pan = edgePan(measure)
    }
    pan?.move(client.x, client.y)
    measure()
  }
  const wheel = () => active && requestAnimationFrame(measure)
  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key, true)
    window.removeEventListener('wheel', wheel)
    pan?.stop()
    document.documentElement.removeAttribute('data-dragging-section')
    row()?.removeAttribute('data-dragging')
    useDropLine.setState({ line: null })
    if (!active || !commit || target == null) return
    const st = useStore.getState()
    const from = currentSlots(st).findIndex((s) => s.id === slotId)
    const to = target > from ? target - 1 : target
    if (from >= 0 && to !== from) st.moveSlot(slotId, to)
  }
  const up = () => finish(true)
  const cancel = () => finish(false)
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !active) return
    ev.preventDefault()
    ev.stopImmediatePropagation()
    finish(false)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key, true)
  window.addEventListener('wheel', wheel, { passive: true })
}

export { movable as sectionMovable }

/** The seam a dragged section will drop into. */
export function SectionDropLine() {
  const line = useDropLine((s) => s.line)
  if (!line) return null
  return createPortal(
    <div className="pointer-events-none fixed z-[100]" style={{ left: line.left - 8, top: line.top - 2, width: line.width + 16, height: 4 }}>
      <div className="size-full rounded-full bg-key shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-key)_25%,transparent)]" />
    </div>,
    document.body,
  )
}

import { canvasApi, CHROME } from './Canvas'

/** Move the canvas by a screen distance. */
export function panBy(dx: number, dy: number) {
  const c = canvasApi.get()
  canvasApi.set({ ...c, x: c.x + dx, y: c.y + dy })
}

/**
 * While something is dragged, the canvas pans by itself when the pointer nears the window's edges (faster the closer
 * it gets), so a long page can be crossed in one drag. `onTick` runs after each step, for re-reading what's under
 * the pointer now that the page moved under it.
 */
export function edgePan(onTick?: () => void) {
  let p: { x: number; y: number } | null = null
  let raf = 0
  const ZONE = 64
  const MAX = 18
  const speed = (d: number) => (d < ZONE ? Math.round(((ZONE - Math.max(0, d)) / ZONE) * MAX) : 0)
  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (!p) return
    const top = p.y - CHROME.top
    const bottom = window.innerHeight - CHROME.bottom - p.y
    const left = p.x - CHROME.left
    const right = window.innerWidth - CHROME.right - p.x
    const dy = speed(top) - speed(bottom)
    const dx = speed(left) - speed(right)
    if (!dx && !dy) return
    panBy(dx, dy)
    onTick?.()
  }
  raf = requestAnimationFrame(tick)
  return {
    move: (x: number, y: number) => void (p = { x, y }),
    stop: () => cancelAnimationFrame(raf),
  }
}

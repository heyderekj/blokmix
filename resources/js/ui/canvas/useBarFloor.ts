import { useLayoutEffect, type DependencyList, type RefObject } from 'react'
import { canvasApi, onPaint } from './Canvas'
import { screenFloor } from './inView'

/**
 * Keep a bar that hangs below something on screen. The bar is anchored in world space (`anchor`, a 0×0 element
 * placed where the bar belongs inside `row`); when that spot is below the dock (a tall section, a block near the
 * bottom of the screen), the anchor is nudged up to just above the dock, but never above the row's top. It is also
 * nudged left so it never runs past the row's right edge.
 *
 * Works on every painted camera frame without a React render, the way the camera itself paints: the nudge is a
 * `translate` on the anchor, in world pixels.
 */
export function useBarFloor(anchor: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>, row: RefObject<HTMLElement | null>, deps: DependencyList) {
  useLayoutEffect(() => {
    let raf = 0
    let burst = 0
    const fit = () => {
      const a = anchor.current
      const b = bar.current
      const r = row.current
      if (!a || !b || !r) return
      const z = canvasApi.get().z || 1
      const rr = r.getBoundingClientRect()
      // Where the anchor sits without any nudge: its layout offset in the row, scaled to the screen.
      const ax = rr.left + a.offsetLeft * z
      const ay = rr.top + a.offsetTop * z
      const br = b.getBoundingClientRect()
      const floor = screenFloor()
      let dy = 0
      if (ay + br.height > floor) dy = Math.max(floor - br.height - ay, rr.top - ay)
      let dx = 0
      if (ax + br.width > rr.right) dx = Math.max(rr.right - br.width - ax, rr.left - ax)
      a.style.translate = dx || dy ? `${dx / z}px ${dy / z}px` : ''
    }
    const soon = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }
    // Heights glide (a layout step, a menu opening): follow for a moment after anything changes.
    const follow = () => {
      const until = performance.now() + 320
      const tick = () => {
        fit()
        if (performance.now() < until) burst = requestAnimationFrame(tick)
      }
      cancelAnimationFrame(burst)
      burst = requestAnimationFrame(tick)
    }
    follow()
    const off = onPaint(soon)
    const ro = new ResizeObserver(follow)
    if (bar.current) ro.observe(bar.current)
    if (row.current) ro.observe(row.current)
    window.addEventListener('resize', soon)
    return () => {
      off()
      ro.disconnect()
      window.removeEventListener('resize', soon)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(burst)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

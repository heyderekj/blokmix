import { useLayoutEffect, type DependencyList, type RefObject } from 'react'
import { create } from 'zustand'
import { canvasApi, onPaint } from './Canvas'
import { screenFloor } from './inView'
import type { Camera } from './geometry'

/**
 * Keep a bar that hangs below something on screen. The bar is anchored in world space (`anchor`, a 0×0 element
 * placed where the bar belongs inside `row`); when that spot is below the dock (a tall section, a block near the
 * bottom of the screen), the anchor is nudged up to just above the dock, but never above the row's top. It is also
 * nudged left so it never runs past the row's right edge.
 *
 * Cheap on every frame: the page is measured only when something changes size (the row, the bar, the window), in
 * world units; each painted camera frame then places the bar with arithmetic and at most one style write, never a
 * layout read (which would make the browser lay out the whole canvas, every frame, while you pan).
 */
export function useBarFloor(anchor: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>, row: RefObject<HTMLElement | null>, deps: DependencyList, key?: string) {
  useLayoutEffect(() => {
    // No bar showing in this row (most rows, most of the time): nothing to follow, no work per frame.
    if (!anchor.current || !bar.current || !row.current) {
      if (key) setOverhang(key, 0)
      return
    }
    let hang = -1
    let burst = 0
    let raf = 0
    // Measured in world (page) pixels, plus the screen's floor, refreshed only when sizes change.
    let m: { rowX: number; rowY: number; rowW: number; rowH: number; ax: number; ay: number; barW: number; barH: number; floor: number; rootX: number; rootY: number } | null = null
    const report = (px: number) => {
      if (!key || px === hang) return
      hang = px
      setOverhang(key, px)
    }
    const measure = () => {
      const a = anchor.current
      const b = bar.current
      const r = row.current
      const root = canvasApi.el()
      if (!a || !b || !r || !root) return void (m = null)
      const cam = canvasApi.get()
      const rr = r.getBoundingClientRect()
      const box = root.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      // The row's world position from where it is on screen now, so later frames need only the camera.
      m = {
        rowX: (rr.left - box.left - cam.x) / cam.z,
        rowY: (rr.top - box.top - cam.y) / cam.z,
        rowW: rr.width / cam.z,
        rowH: rr.height / cam.z,
        ax: a.offsetLeft,
        ay: a.offsetTop,
        // The bar is drawn at screen size (capped): keep its own size, unscaled.
        barW: br.width / barScale(cam.z),
        barH: br.height / barScale(cam.z),
        floor: screenFloor(),
        rootX: box.left,
        rootY: box.top,
      }
    }
    const place = (cam: Camera) => {
      const a = anchor.current
      if (!a || !m) return
      const z = cam.z || 1
      const s = barScale(z)
      const left = m.rootX + cam.x + m.rowX * z
      const top = m.rootY + cam.y + m.rowY * z
      const right = left + m.rowW * z
      const bottom = top + m.rowH * z
      const ax = left + m.ax * z
      const ay = top + m.ay * z
      const bw = m.barW * s
      const bh = m.barH * s
      let dy = 0
      if (ay + bh > m.floor) dy = Math.max(m.floor - bh - ay, top - ay)
      let dx = 0
      if (ax + bw > right) dx = Math.max(right - bw - ax, left - ax)
      const t = dx || dy ? `${dx / z}px ${dy / z}px` : ''
      if (a.style.translate !== t) a.style.translate = t
      // How far the bar hangs below the row, on screen: what sits under the page makes that much room.
      report(Math.max(0, Math.round(ay + dy + bh - bottom)))
    }
    const refit = () => {
      measure()
      place(canvasApi.get())
    }
    // Heights glide (a layout step, a menu opening): re-measure for a moment after anything changes size.
    const follow = () => {
      const until = performance.now() + 320
      const tick = () => {
        refit()
        if (performance.now() < until) burst = requestAnimationFrame(tick)
      }
      cancelAnimationFrame(burst)
      burst = requestAnimationFrame(tick)
    }
    refit()
    follow()
    const off = onPaint(place)
    const ro = new ResizeObserver(follow)
    ro.observe(bar.current)
    ro.observe(row.current)
    // The row moves when a section above it changes height (the page grows), and the floor when the dock grows.
    if (row.current.parentElement) ro.observe(row.current.parentElement)
    const dock = document.querySelector('[data-dock]')
    if (dock) ro.observe(dock)
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(refit)
    }
    window.addEventListener('resize', onResize)
    return () => {
      off()
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(burst)
      if (key) setOverhang(key, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** How big a bar is on screen per page pixel: drawn at screen size, never more than 3.4× the page (the bars' CSS). */
const barScale = (z: number) => Math.min(1 / z, 3.4) * z

/** How far each bar hangs below its section, on screen, by "<slot id>:section" or "<slot id>:block". */
export const useBarOverhang = create<{ px: Record<string, number> }>()(() => ({ px: {} }))
const setOverhang = (key: string, px: number) =>
  useBarOverhang.setState((s) => ((s.px[key] ?? 0) === px ? s : { px: { ...s.px, [key]: px } }))

/** The room a section's bars need below it right now (0 when none hangs over). */
export const barRoomBelow = (s: { px: Record<string, number> }, slotId: string | undefined) =>
  slotId ? Math.max(s.px[`${slotId}:section`] ?? 0, s.px[`${slotId}:block`] ?? 0) : 0

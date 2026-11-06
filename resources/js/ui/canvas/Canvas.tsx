import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useStore, currentSlots } from '@/state/store'
import { useLayout } from '@/state/layout'
import type { NoteAnchor } from '@/core/types'
import { pressable, typing } from '../shell/keys'
import { fitRect, MIX_ID, placeDrafts, placeVersions, VIEW_W, zoomAt, type Camera } from './geometry'
import { centerX, clampZ, fitWidth as fitWidthOf, leavesPage, normalizeWheel, PAGE_HEAD, pageBounds, round, rubber, stepZoom, unrubber, zoomFactor, type View } from './camera'
import { useInsets } from './insets'

/** Insets of the floating chrome, so "fit" lands in the visible middle. */
export const CHROME = { top: 72, bottom: 88, left: 24, right: 24 }

export type CanvasMode = 'page' | 'canvas'
type Point = { x: number; y: number }

type Api = {
  /** The camera as shown right now (mid-glide, where it is; once still, the same object it came to rest on). */
  get: () => Camera
  /** Where the camera is headed. */
  target: () => Camera
  set: (c: Camera, animate?: boolean) => void
  zoomBy: (f: number) => void
  /** Zoom to `z` around a point on screen (canvas coordinates; the middle of the free space by default). */
  zoomTo: (z: number, anchor?: Point) => void
  /** One zoom stop in or out. */
  zoomStep: (dir: 1 | -1) => void
  fitAll: () => void
  fitMix: () => void
  /** The page as wide as the free space allows (and back to scrolling it, from the canvas). */
  fitWidth: () => void
  /** Frame the selected section (or version), ⇧2. False when nothing's selected. */
  zoomToSelection: () => boolean
  focusRect: (r: { x: number; y: number; w: number; h: number }, maxZ?: number) => void
  /** Put this page y at the top of the screen. */
  scrollToY: (worldY: number, animate?: boolean) => void
  /** Scroll by a screen distance (keys). */
  scrollBy: (dy: number) => void
  /** Bring a section into view: its top at the top, or the least scroll that shows it. */
  revealRow: (slotId: string, how?: 'top' | 'nearest') => void
  /** The open page's top. */
  pageTop: (animate?: boolean) => void
  mode: () => CanvasMode
  setMode: (m: CanvasMode, opts?: { slotId?: string }) => void
  onSettle: typeof onSettle
  view: () => View
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
  el: () => HTMLElement | null
}

const IDENTITY: Camera = { x: 0, y: 0, z: 1 }
export const canvasApi: Api = {
  get: () => IDENTITY,
  target: () => IDENTITY,
  set: () => {},
  zoomBy: () => {},
  zoomTo: () => {},
  zoomStep: () => {},
  fitAll: () => {},
  fitMix: () => {},
  fitWidth: () => {},
  zoomToSelection: () => false,
  focusRect: () => {},
  scrollToY: () => {},
  scrollBy: () => {},
  revealRow: () => {},
  pageTop: () => {},
  mode: () => useStore.getState().ui.canvasMode ?? 'page',
  setMode: () => {},
  onSettle: (fn) => onSettle(fn),
  view: () => ({ w: window.innerWidth, h: window.innerHeight, ...CHROME }),
  screenToWorld: (x, y) => ({ x, y }),
  worldToScreen: (x, y) => ({ x, y }),
  el: () => null,
}

/** Everything that sits in world space but sizes itself to the screen (the bars) listens to each painted frame. */
const painted = new Set<(c: Camera) => void>()
export function onPaint(fn: (c: Camera) => void) {
  painted.add(fn)
  return () => {
    painted.delete(fn)
  }
}

/** The camera came to rest (no movement for a moment): sizes that need a layout follow it then. */
const settled = new Set<(c: Camera) => void>()
export function onSettle(fn: (c: Camera) => void) {
  settled.add(fn)
  return () => {
    settled.delete(fn)
  }
}

export function chromeInsets() {
  return CHROME
}

/** Find what a world point lands on, for attaching sticky notes. */
export function anchorAt(wx: number, wy: number): NoteAnchor {
  const st = useStore.getState()
  const lay = useLayout.getState()
  const w = VIEW_W[st.ui.viewport]
  if (wx >= 0 && wx <= w && wy >= 0) {
    for (const slot of currentSlots(st)) {
      const r = lay.rows[slot.id]
      if (r && wy >= r.top && wy <= r.top + r.height) return { kind: 'slot', slotId: slot.id, dx: wx, dy: wy - r.top }
    }
  }
  for (const p of placeVersions(st)) {
    const h = lay.frameHeights[p.id] ?? 1200
    if (wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + h) return { kind: 'frame', frameId: p.id, dx: wx - p.x, dy: wy - p.y }
  }
  return { kind: 'world', x: wx, y: wy }
}

/** How long the camera must hold still to count as settled. */
const SETTLE_MS = 140
/** A scroll past the page's ends springs back this long after the last wheel event. */
const SPRING_AFTER = 120
/** After a pinch lets go of the page, the rest of that gesture is ignored (it would fight the glide to the canvas). */
const SWALLOW_MS = 260

/**
 * The camera, two of it: where it's headed (`target`) and where it is on screen (`cur`). Glides move `cur` toward
 * `target` a frame at a time; any gesture starts from `cur` and cancels the glide, so nothing ever jumps. Wheel and
 * pinch events only move `cur` and ask for one paint on the next frame.
 *
 * In page mode the page fits the free space's width and scrolls up and down like a website (with a give at either
 * end); pinching zooms it around the pointer's height, and pinching out far enough lets go of it: the free canvas.
 */
function makeCamera(root: RefObject<HTMLDivElement | null>, world: RefObject<HTMLDivElement | null>) {
  const st = useStore.getState
  let cur: Camera = st().camera ?? { x: 0, y: 0, z: 0.3 }
  let target = cur
  let tweenRaf = 0
  let landTimer = 0
  let settleTimer = 0
  let frameReq = 0
  let moving = false
  let shownZl = NaN
  let shownZ = NaN
  /** Page mode: the zoom was changed by hand (a pinch, a key), so the page doesn't refit by itself. */
  let zoomed = false
  /** A scroll past the page's ends, as it would be without the give. */
  let raw: number | null = null
  let springTimer = 0
  let swallowTimer = 0
  let swallowing = false
  let rect = { left: 0, top: 0, width: 0, height: 0 }

  const mode = (): CanvasMode => st().ui.canvasMode ?? 'page'
  const measure = () => {
    const r = root.current?.getBoundingClientRect()
    if (r) rect = { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  const view = (): View => {
    if (!rect.width) measure()
    const ins = useInsets.getState()
    return { w: rect.width, h: rect.height, top: CHROME.top, bottom: CHROME.bottom, left: CHROME.left + ins.left, right: CHROME.right + ins.right }
  }
  const middle = (v = view()): Point => ({ x: v.left + (v.w - v.left - v.right) / 2, y: v.top + (v.h - v.top - v.bottom) / 2 })
  const pageW = () => VIEW_W[st().ui.viewport]
  const pageH = () => {
    const rows = useLayout.getState().rows
    let h = 0
    for (const slot of currentSlots(st())) {
      const r = rows[slot.id]
      if (r) h = Math.max(h, r.top + r.height)
    }
    return Math.max(h, 400)
  }
  const pageKey = () => st().ui.pageId ?? st().site.pages[0]?.id ?? 'home'
  const fitZ = () => fitWidthOf(pageW(), view()).z
  const bounds = (z: number) => pageBounds(pageH(), z, view())
  const clampY = (y: number, z: number) => {
    const b = bounds(z)
    return Math.min(b.max, Math.max(b.min, y))
  }
  /** A camera held to the page: centred across, inside its scroll. */
  const onPage = (c: Camera): Camera => ({ z: c.z, x: centerX(pageW(), c.z, view()), y: clampY(c.y, c.z) })
  /** How far the page can stretch past an end. */
  const give = () => Math.max(80, (rect.height - CHROME.top - CHROME.bottom) * 0.22)

  // ── Painting ───────────────────────────────────────────────────────────────

  const paint = (c: Camera) => {
    const w = world.current
    const r = root.current
    if (!w || !r) return
    const dpr = window.devicePixelRatio || 1
    w.style.transform = `translate(${round(c.x, dpr)}px, ${round(c.y, dpr)}px) scale(${c.z})`
    const g = dotGrid(c)
    // A pan changes only positions: no style below the world is touched, so nothing re-lays out.
    if (c.z !== shownZl) {
      shownZl = c.z
      w.style.setProperty('--zl', String(c.z))
      r.style.backgroundImage = g.image
      r.style.backgroundSize = g.size
    }
    r.style.backgroundPosition = g.position
    if (!moving) {
      moving = true
      w.style.willChange = 'transform'
    }
    window.clearTimeout(settleTimer)
    settleTimer = window.setTimeout(settle, SETTLE_MS)
    for (const fn of painted) fn(c)
  }

  /** Still for a moment: the world re-rasterises sharp, sizes that need a layout catch up, and the spot is saved. */
  const settle = () => {
    moving = false
    const w = world.current
    if (w) {
      w.style.willChange = ''
      if (cur.z !== shownZ) {
        shownZ = cur.z
        w.style.setProperty('--z', String(cur.z))
      }
    }
    save()
    for (const fn of settled) fn(cur)
  }

  const save = () => {
    const c = cur
    const page = mode() === 'page'
    const key = pageKey()
    const y = Math.round((CHROME.top - c.y) / c.z)
    useStore.setState((s) => ({
      camera: c,
      ...(page && s.ui.pageScroll?.[key] !== y ? { ui: { ...s.ui, pageScroll: { ...s.ui.pageScroll, [key]: y } } } : {}),
    }))
  }

  const cancelGlide = () => {
    if (tweenRaf) cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
    window.clearTimeout(landTimer)
    target = cur
  }

  /** Move now, painting at once (drags, edge pans, anything that reads the page right after). */
  const jump = (c: Camera) => {
    cancelGlide()
    cancelAnimationFrame(frameReq)
    frameReq = 0
    cur = target = c
    paint(c)
  }

  /** Move with a gesture: as many events as come, one paint per frame. */
  const nudge = (c: Camera) => {
    cancelGlide()
    cur = target = c
    if (!frameReq)
      frameReq = requestAnimationFrame(() => {
        frameReq = 0
        paint(cur)
      })
  }

  /**
   * Glide to a camera. Zoom eases in log space (25% → 100% feels as even as 100% → 200%); in page mode the page stays
   * centred the whole way.
   */
  const glide = (to: Camera, D = 520) => {
    cancelGlide()
    cancelAnimationFrame(frameReq)
    frameReq = 0
    target = to
    if (D <= 0 || (to.x === cur.x && to.y === cur.y && to.z === cur.z)) {
      cur = to
      paint(to)
      return
    }
    const from = cur
    const v = view()
    const pw = pageW()
    // Already centred on the page: stay centred the whole way (coming from the canvas, slide across instead).
    const lockX = mode() === 'page' && Math.abs(from.x - centerX(pw, from.z, v)) < 1 && Math.abs(to.x - centerX(pw, to.z, v)) < 1
    const start = performance.now()
    const lz0 = Math.log(from.z)
    const lz1 = Math.log(to.z)
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / D)
      const e = 1 - Math.pow(1 - t, 4)
      if (t < 1) {
        const z = Math.exp(lz0 + (lz1 - lz0) * e)
        cur = { z, x: lockX ? centerX(pw, z, v) : from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
        tweenRaf = requestAnimationFrame(step)
      } else {
        cur = to
        tweenRaf = 0
      }
      paint(cur)
    }
    tweenRaf = requestAnimationFrame(step)
    // Background tabs pause animation frames; always land on the destination.
    landTimer = window.setTimeout(() => {
      if (target === to && cur !== to) {
        cancelAnimationFrame(tweenRaf)
        tweenRaf = 0
        cur = to
        paint(to)
      }
    }, D + 120)
  }

  // ── Modes ──────────────────────────────────────────────────────────────────

  const storeMode = (m: CanvasMode) => {
    if (mode() !== m) st().setUi({ canvasMode: m })
  }

  const fitAll = () => {
    storeMode('canvas')
    raw = null
    const s = st()
    const lay = useLayout.getState()
    const w = pageW()
    let x1 = -120
    let y1 = -80
    let x2 = w + 120
    let y2 = pageH()
    for (const p of [...placeDrafts(s), ...placeVersions(s)]) {
      x1 = Math.min(x1, p.x)
      y1 = Math.min(y1, p.y - 80)
      x2 = Math.max(x2, p.x + p.w)
      y2 = Math.max(y2, p.y + (lay.frameHeights[p.id] ?? 1200))
    }
    glide(fitRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, view(), 0.6))
  }

  /** A pinch let go of the page: the canvas, everything in view. The rest of the gesture is ignored. */
  const leavePage = () => {
    swallowing = true
    window.clearTimeout(swallowTimer)
    swallowTimer = window.setTimeout(() => (swallowing = false), SWALLOW_MS)
    fitAll()
  }

  /** Back to the page, fitting its width, keeping what's in the middle of the screen there (or its top). */
  const toPage = (slotId?: string) => {
    storeMode('page')
    zoomed = false
    raw = null
    const v = view()
    const m = middle(v)
    const z = fitZ()
    const wy = (m.y - cur.y) / cur.z
    const wx = (m.x - cur.x) / cur.z
    const over = wx >= -200 && wx <= pageW() + 200 && wy >= 0 && wy <= pageH()
    const y = over ? m.y - wy * z : bounds(z).max
    glide(onPage({ z, x: 0, y }), 420)
    if (slotId) window.setTimeout(() => api.revealRow(slotId, 'nearest'), 430)
  }

  /** Fit the page again after the free space changed (a panel docked, the window resized), keeping its top line. */
  const refit = (D: number) => {
    if (mode() !== 'page') return
    const z = zoomed ? target.z : fitZ()
    const wy = (CHROME.top - target.y) / target.z
    // Not held to the page's end: rows may still be measuring (a restored spot deep in the page stays).
    const to = { z, x: centerX(pageW(), z, view()), y: CHROME.top - wy * z }
    if (D) glide(to, D)
    else jump(to)
  }

  // ── Gestures ───────────────────────────────────────────────────────────────

  /** A pinch (or ⌘-scroll) step to `nz` around a screen point. */
  const pinchTo = (nz: number, sx: number, sy: number, from = cur) => {
    raw = null
    if (mode() === 'page') {
      if (leavesPage(nz, fitZ())) return leavePage()
      zoomed = Math.abs(nz - fitZ()) > 1e-3
      nudge(onPage(zoomAt(from, sx, sy, nz)))
    } else nudge(zoomAt(from, sx, sy, nz))
  }

  const springBack = () => {
    raw = null
    if (mode() !== 'page') return
    const to = onPage(cur)
    if (to.y !== cur.y) glide(to, 280)
  }

  const swallow = () => {
    window.clearTimeout(swallowTimer)
    swallowTimer = window.setTimeout(() => (swallowing = false), SWALLOW_MS)
  }

  /** Wheel: scroll the page (or pan the canvas), pinch and ⌘-scroll zoom. */
  const wheel = (e: WheelEvent) => {
    if (swallowing) return swallow()
    const v = view()
    const w = normalizeWheel(e, v.h - v.top - v.bottom)
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    if (w.zoom) {
      // A mouse wheel's click goes one stop, gliding; a pinch follows the fingers.
      if (w.notch) return api.zoomTo(stepZoom(target.z, w.dy < 0 ? 1 : -1), { x: sx, y: sy })
      return pinchTo(clampZ(cur.z * zoomFactor(w, cur.z)), sx, sy)
    }
    if (mode() !== 'page') return nudge({ ...cur, x: cur.x - w.dx, y: cur.y - w.dy })
    // Across the page: nothing to see, it stays centred.
    if (!w.dy) return
    window.clearTimeout(springTimer)
    const x = centerX(pageW(), cur.z, v)
    if (w.notch) {
      // A mouse wheel: a short glide a click at a time, no give.
      raw = null
      return glide({ z: cur.z, x, y: clampY(target.y - w.dy, cur.z) }, 160)
    }
    const b = bounds(cur.z)
    const d = give()
    if (raw === null) raw = unrubber(cur.y, b.min, b.max, d)
    raw -= w.dy
    // Never stretch further than one push past the end gets you (momentum keeps pushing).
    nudge({ z: cur.z, x, y: rubber(raw, b.min, b.max, d) })
    if (raw > b.max || raw < b.min) springTimer = window.setTimeout(springBack, SPRING_AFTER)
    else raw = null
  }

  /** A drag of the background (or the hand tool, Space, the middle button): the canvas follows, or the page scrolls. */
  const dragTo = (start: Camera, dx: number, dy: number) => {
    raw = null
    if (mode() === 'page') nudge(onPage({ ...start, y: start.y + dy }))
    else nudge({ ...start, x: start.x + dx, y: start.y + dy })
  }

  // Safari pinches with gesture events (and no ctrl-wheel); a pinch over a frame arrives forwarded from it.
  let gesture: { z: number } | null = null
  const gestureStart = () => {
    gesture = { z: cur.z }
  }
  const gestureChange = (scale: number, sx: number, sy: number) => {
    if (!gesture || swallowing) return swallowing ? swallow() : undefined
    pinchTo(clampZ(gesture.z * scale), sx, sy)
  }
  const gestureEnd = () => {
    gesture = null
  }

  // Two fingers on a touch screen: pinch and pan together.
  let touch: { dist: number; mid: Point; cam: Camera } | null = null
  const touchPinch = (pts: Point[], begin: boolean) => {
    const [a, b] = pts
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
    if (begin || !touch) {
      touch = { dist, mid, cam: cur }
      return
    }
    if (swallowing) return
    const nz = clampZ(touch.cam.z * (dist / touch.dist))
    const c = zoomAt(touch.cam, touch.mid.x, touch.mid.y, nz)
    raw = null
    if (mode() === 'page') {
      if (leavesPage(nz, fitZ())) return leavePage()
      zoomed = Math.abs(nz - fitZ()) > 1e-3
      nudge(onPage({ ...c, y: c.y + (mid.y - touch.mid.y) }))
    } else nudge({ z: nz, x: c.x + (mid.x - touch.mid.x), y: c.y + (mid.y - touch.mid.y) })
  }
  const touchEnd = () => {
    touch = null
  }

  // ── The public API ─────────────────────────────────────────────────────────

  const api: Omit<Api, 'onSettle' | 'mode'> = {
    get: () => cur,
    target: () => target,
    view,
    el: () => root.current,
    set: (c, animate = false) => {
      raw = null
      const to = mode() === 'page' ? onPage(c) : c
      if (animate) glide(to)
      else jump(to)
    },
    screenToWorld: (sx, sy) => ({ x: (sx - rect.left - cur.x) / cur.z, y: (sy - rect.top - cur.y) / cur.z }),
    worldToScreen: (wx, wy) => ({ x: wx * cur.z + cur.x + rect.left, y: wy * cur.z + cur.y + rect.top }),
    zoomTo: (nz, anchor) => {
      const z = clampZ(nz)
      const a = anchor ?? middle()
      raw = null
      if (mode() === 'page') {
        if (leavesPage(z, fitZ())) {
          // Stepping out past the page lets go of it, at that zoom, where you are.
          storeMode('canvas')
          return glide(zoomAt(target, a.x, a.y, z), 220)
        }
        zoomed = Math.abs(z - fitZ()) > 1e-3
        return glide(onPage(zoomAt(target, a.x, a.y, z)), 220)
      }
      glide(zoomAt(target, a.x, a.y, z), 220)
    },
    zoomBy: (f) => api.zoomTo(target.z * f),
    zoomStep: (dir) => api.zoomTo(stepZoom(target.z, dir)),
    fitAll,
    fitMix: () => {
      if (mode() === 'page') {
        zoomed = false
        raw = null
        const z = fitZ()
        return glide(onPage({ z, x: 0, y: bounds(z).max }), 420)
      }
      // The page's width (with room for the rail and arrows), from its top.
      const v = view()
      const w = pageW()
      const availW = v.w - v.left - v.right
      const z = clampZ(Math.min(availW / (w * 1.2), 0.6))
      glide({ z, x: v.left + (availW - w * z) / 2, y: v.top + PAGE_HEAD })
    },
    fitWidth: () => {
      if (mode() !== 'page') return toPage()
      zoomed = false
      raw = null
      const z = fitZ()
      const m = middle()
      const wy = (m.y - target.y) / target.z
      glide(onPage({ z, x: 0, y: m.y - wy * z }), 260)
    },
    zoomToSelection: () => {
      const s = st()
      const v = view()
      const availH = v.h - v.top - v.bottom
      const row = s.ui.focusedSlotId ? useLayout.getState().rows[s.ui.focusedSlotId] : undefined
      const onPageNow = row && currentSlots(s).some((x) => x.id === s.ui.focusedSlotId)
      if (onPageNow && row) {
        const r = { x: -40, y: row.top - 24, w: pageW() + 80, h: row.height + 48 }
        if (mode() === 'page') {
          // The page stays put across; the section fills the height it can, between fitting the width and letting go.
          const fz = fitZ()
          const z = Math.max(fz * 0.62, Math.min(fz, availH / r.h))
          zoomed = Math.abs(z - fz) > 1e-3
          const y = r.h * z > availH ? v.top - r.y * z : v.top + (availH - r.h * z) / 2 - r.y * z
          glide(onPage({ z, x: 0, y }), 320)
        } else glide(fitRect(r, v, 1), 320)
        return true
      }
      const frame = s.ui.selectedFrameId && s.ui.selectedFrameId !== MIX_ID ? placeVersions(s).find((p) => p.id === s.ui.selectedFrameId) : undefined
      if (frame) {
        storeMode('canvas')
        const h = useLayout.getState().frameHeights[frame.id] ?? 1200
        glide(fitRect({ x: frame.x - 40, y: frame.y - 80, w: frame.w + 80, h: Math.min(h, 2600) + 120 }, view(), 1), 320)
        return true
      }
      return false
    },
    focusRect: (r, maxZ = 0.6) => {
      raw = null
      if (mode() === 'page') {
        // Something on the page: scroll to it. Anything off it (a version) needs the canvas.
        const w = pageW()
        if (r.x >= -300 && r.x + r.w <= w + 300) return api.scrollToY(r.y)
        storeMode('canvas')
      }
      glide(fitRect(r, view(), maxZ))
    },
    scrollToY: (wy, animate = true) => {
      raw = null
      const t = target
      const c = { ...t, y: CHROME.top + 12 - wy * t.z }
      const to = mode() === 'page' ? onPage(c) : c
      if (animate) glide(to, 360)
      else jump(to)
    },
    scrollBy: (dy) => {
      raw = null
      const c = { ...target, y: target.y - dy }
      glide(mode() === 'page' ? onPage(c) : c, 200)
    },
    revealRow: (slotId, how = 'nearest') => {
      const row = useLayout.getState().rows[slotId]
      if (!row) return
      const v = view()
      const t = target
      const ceil = v.top + 12
      const floor = v.h - v.bottom - 12
      const top = row.top * t.z + t.y
      const bottom = (row.top + row.height) * t.z + t.y
      let y = t.y
      if (how === 'top' || top < ceil) y = ceil - row.top * t.z
      else if (bottom > floor) y = row.height * t.z > floor - ceil ? ceil - row.top * t.z : floor - (row.top + row.height) * t.z
      if (y === t.y) return
      const c = { ...t, y }
      glide(mode() === 'page' ? onPage(c) : c, 360)
    },
    pageTop: (animate = true) => {
      raw = null
      const t = target
      const c = { ...t, y: CHROME.top + PAGE_HEAD }
      const to = mode() === 'page' ? onPage(c) : c
      if (animate) glide(to, 360)
      else jump(to)
    },
    setMode: (m, opts) => {
      if (m === 'page') return toPage(opts?.slotId)
      if (mode() !== 'canvas') fitAll()
    },
  }

  /** The first paint: the saved spot (the page's, in page mode), or the page's top fitting its width. */
  const start = () => {
    measure()
    const saved = st().camera
    if (mode() === 'page') {
      const fz = fitZ()
      const z = saved && !leavesPage(saved.z, fz) ? saved.z : fz
      zoomed = Math.abs(z - fz) > 2e-3
      const wy = st().ui.pageScroll?.[pageKey()]
      const y = wy !== undefined ? CHROME.top - wy * z : saved && z === saved.z ? saved.y : CHROME.top + PAGE_HEAD
      // Rows aren't measured yet: place it without holding it to the page's end.
      jump({ z: zoomed ? z : fz, x: centerX(pageW(), zoomed ? z : fz, view()), y })
      return null
    }
    jump(cur)
    return saved ? null : window.setTimeout(() => api.fitMix(), 60)
  }

  return { api, start, measure, refit, wheel, dragTo, gestureStart, gestureChange, gestureEnd, touchPinch, touchEnd, mode, get: () => cur }
}

export function Canvas({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  // The API is in place from the first render, before any child's effects ask for it.
  const [cam] = useState(() => {
    const c = makeCamera(root, world)
    Object.assign(canvasApi, c.api)
    return c
  })
  const tool = useStore((s) => s.ui.tool)
  const [panning, setPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  // First paint; then follow the window, docked panels and the open page.
  useEffect(() => {
    // Again here: in development React makes the camera twice and keeps one; this is the one kept.
    Object.assign(canvasApi, cam.api)
    const t = cam.start()
    const el = root.current!
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        cam.measure()
        cam.refit(0)
      })
    })
    ro.observe(el)
    const offInsets = useInsets.subscribe(() => cam.refit(200))
    const offPage = useStore.subscribe((s, prev) => {
      if (s.ui.pageId !== prev.ui.pageId) canvasApi.pageTop(false)
    })
    return () => {
      if (t) window.clearTimeout(t)
      ro.disconnect()
      cancelAnimationFrame(raf)
      offInsets()
      offPage()
    }
  }, [cam])

  // Wheel and gestures.
  useEffect(() => {
    const el = root.current!
    let wheeling = 0
    const hold = () => {
      // While a gesture lasts, frames stop taking the pointer: the rest of it comes straight here
      // instead of through whichever frame is under it.
      if (!el.hasAttribute('data-wheeling')) el.setAttribute('data-wheeling', '')
      window.clearTimeout(wheeling)
      wheeling = window.setTimeout(() => el.removeAttribute('data-wheeling'), 180)
    }
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-scroll-ok]')) return
      e.preventDefault()
      hold()
      if (gesturing) return
      cam.wheel(e)
    }
    let gesturing = false
    type GestureEvt = Event & { scale: number; clientX: number; clientY: number }
    const onGesture = (e: Event) => {
      e.preventDefault()
      const g = e as GestureEvt
      const r = el.getBoundingClientRect()
      if (e.type === 'gesturestart') {
        gesturing = true
        cam.gestureStart()
      } else if (e.type === 'gesturechange') {
        hold()
        cam.gestureChange(g.scale, g.clientX - r.left, g.clientY - r.top)
      } else {
        gesturing = false
        cam.gestureEnd()
      }
    }
    // A pinch over a frame (Safari): the frame forwards it in page coordinates.
    const onFrameGesture = (e: Event) => {
      const d = (e as CustomEvent<{ phase: 'start' | 'change' | 'end'; scale: number; x: number; y: number }>).detail
      const r = el.getBoundingClientRect()
      if (d.phase === 'start') {
        gesturing = true
        cam.gestureStart()
      } else if (d.phase === 'change') {
        hold()
        cam.gestureChange(d.scale, d.x - r.left, d.y - r.top)
      } else {
        gesturing = false
        cam.gestureEnd()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) el.addEventListener(t, onGesture)
    el.addEventListener('mx-gesture', onFrameGesture)
    return () => {
      el.removeEventListener('wheel', onWheel)
      for (const t of ['gesturestart', 'gesturechange', 'gestureend']) el.removeEventListener(t, onGesture)
      el.removeEventListener('mx-gesture', onFrameGesture)
    }
  }, [cam])

  // Space: tap shuffles, hold + drag pans.
  const spaceState = useRef({ down: false, moved: false })
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Space on a focused button presses it; it doesn't shuffle the page.
      if (e.code !== 'Space' || typing(e.target) || pressable(e.target)) return
      e.preventDefault()
      if (e.repeat || spaceState.current.down) return
      spaceState.current = { down: true, moved: false }
      setSpaceHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !spaceState.current.down) return
      const { moved } = spaceState.current
      spaceState.current = { down: false, moved: false }
      setSpaceHeld(false)
      if (!moved && !typing(e.target)) useStore.getState().shuffle()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const drag = useRef<{ x: number; y: number; cam: Camera; pan: boolean; moved: boolean } | null>(null)
  const touches = useRef(new Map<number, Point>())

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size === 2) {
        drag.current = null
        setPanning(false)
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        cam.touchPinch([...touches.current.values()], true)
        return
      }
    }
    const onBackground = e.target === root.current || e.target === world.current
    const pan = e.button === 1 || tool === 'hand' || spaceState.current.down || (onBackground && e.button === 0 && tool === 'select')
    if (!pan && !(onBackground && tool === 'sticky')) return
    drag.current = { x: e.clientX, y: e.clientY, cam: cam.get(), pan, moved: false }
    if (pan) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size >= 2) return cam.touchPinch([...touches.current.values()].slice(0, 2), false)
    }
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) > 3) {
      d.moved = true
      if (d.pan) setPanning(true)
      if (spaceState.current.down) spaceState.current.moved = true
    }
    if (d.pan && d.moved) cam.dragTo(d.cam, dx, dy)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId)
      if (touches.current.size < 2) cam.touchEnd()
    }
    const d = drag.current
    drag.current = null
    setPanning(false)
    if (!d || d.moved) return
    const st = useStore.getState()
    if (tool === 'sticky') {
      const p = canvasApi.screenToWorld(e.clientX, e.clientY)
      st.addNote(anchorAt(p.x, p.y))
    } else if (e.target === root.current || e.target === world.current) {
      st.setUi({ selectedFrameId: null, focusedSlotId: null, previewFrameId: null, sheet: 'none' })
    }
  }

  // Sticky tool works anywhere: clicks on frames place notes too.
  const onClickCapture = (e: React.MouseEvent) => {
    if (tool !== 'sticky') return
    if ((e.target as HTMLElement).closest('[data-chrome]')) return
    e.stopPropagation()
    e.preventDefault()
    const p = canvasApi.screenToWorld(e.clientX, e.clientY)
    useStore.getState().addNote(anchorAt(p.x, p.y))
  }

  const cursor = panning ? 'grabbing' : spaceHeld || tool === 'hand' ? 'grab' : tool === 'sticky' ? 'copy' : tool === 'note' ? 'crosshair' : 'default'

  return (
    <div
      ref={root}
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        cursor,
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-blokmix-clip')) e.preventDefault()
      }}
      onDrop={(e) => {
        document.documentElement.removeAttribute('data-dragging-clip')
        const clipId = e.dataTransfer.getData('application/x-blokmix-clip')
        const st = useStore.getState()
        const type = clipId.split('.')[0] as Parameters<typeof st.addSlot>[0]
        if (!clipId) return
        e.preventDefault()
        st.addSlot(type, clipId, currentSlots(st).length)
      }}
      data-canvas
    >
      <div
        ref={world}
        className="absolute left-0 top-0 origin-top-left"
        style={{ pointerEvents: spaceHeld || tool === 'hand' ? 'none' : undefined }}
        data-world
      >
        {children}
      </div>
    </div>
  )
}

export { MIX_ID }

/**
 * Two dot grids, four times apart, cross-fading as you zoom: the fine one fades
 * out as its dots crowd together just as the coarse one is already there, so
 * spacing on screen always stays between 16 and 64px and never jumps.
 */
const BASE = 24
const MIN = 16
export function dotGrid(c: Camera) {
  const raw = BASE * c.z
  const level = Math.max(0, Math.ceil(Math.log(MIN / raw) / Math.log(4)))
  const fine = raw * Math.pow(4, level)
  const coarse = fine * 4
  const fade = Math.min(1, Math.max(0, (fine - MIN) / 28))
  const dot = (alpha: number, r: number) =>
    `radial-gradient(circle, color-mix(in srgb, var(--canvas-dot) ${Math.round(alpha * 100)}%, transparent) ${r}px, transparent ${r + 0.35}px)`
  return {
    image: `${dot(1, 1.1)}, ${dot(fade, 1.1)}`,
    size: `${coarse}px ${coarse}px, ${fine}px ${fine}px`,
    position: `${c.x}px ${c.y}px, ${c.x}px ${c.y}px`,
  }
}

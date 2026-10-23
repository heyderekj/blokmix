import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import type { NoteAnchor } from '@/core/types'
import { clampZ, fitRect, MIX_ID, placeVersions, VIEW_W, zoomAt, type Camera } from './geometry'

/** Insets of the floating chrome, so "fit" lands in the visible middle. */
export const CHROME = { top: 72, bottom: 88, left: 24, right: 24 }

type Api = {
  get: () => Camera
  set: (c: Camera, animate?: boolean) => void
  zoomBy: (f: number) => void
  fitAll: () => void
  fitMix: () => void
  focusRect: (r: { x: number; y: number; w: number; h: number }, maxZ?: number) => void
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
  el: () => HTMLElement | null
}

export const canvasApi: Api = {
  get: () => ({ x: 0, y: 0, z: 1 }),
  set: () => {},
  zoomBy: () => {},
  fitAll: () => {},
  fitMix: () => {},
  focusRect: () => {},
  screenToWorld: (x, y) => ({ x, y }),
  worldToScreen: (x, y) => ({ x, y }),
  el: () => null,
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
    for (const slot of st.slots) {
      const r = lay.rows[slot.id]
      if (r && wy >= r.top && wy <= r.top + r.height) return { kind: 'slot', slotId: slot.id, dx: wx, dy: wy - r.top }
    }
  }
  for (const p of placeVersions(st.versions, st.ui.viewport, st.framePos)) {
    const h = lay.frameHeights[p.id] ?? 1200
    if (wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + h) return { kind: 'frame', frameId: p.id, dx: wx - p.x, dy: wy - p.y }
  }
  return { kind: 'world', x: wx, y: wy }
}

export function Canvas({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const cam = useRef<Camera>(useStore.getState().camera ?? { x: 0, y: 0, z: 0.3 })
  const tool = useStore((s) => s.ui.tool)
  const [panning, setPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const saveTimer = useRef<number>(0)
  const animating = useRef(false)

  const apply = useCallback((c: Camera, animate = false) => {
    cam.current = c
    const w = world.current
    const r = root.current
    if (!w || !r) return
    w.style.transition = animate ? 'transform 560ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
    w.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.z})`
    w.style.setProperty('--z', String(c.z))
    const dot = 24 * c.z < 8 ? 24 * c.z * 4 : 24 * c.z
    r.style.backgroundSize = `${dot}px ${dot}px`
    r.style.backgroundPosition = `${c.x}px ${c.y}px`
    animating.current = animate
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => useStore.getState().setCamera(c), 300)
  }, [])

  // Public API used by the toolbar, zoom controls and shortcuts.
  useEffect(() => {
    const view = () => {
      const r = root.current!.getBoundingClientRect()
      return { w: r.width, h: r.height, ...chromeInsets() }
    }
    const mixRect = () => {
      const st = useStore.getState()
      const w = VIEW_W[st.ui.viewport]
      const lay = useLayout.getState()
      const h = Math.max(800, ...Object.values(lay.rows).map((r) => r.top + r.height))
      return { x: 0, y: -80, w, h: h + 80, wFull: w }
    }
    canvasApi.get = () => cam.current
    canvasApi.set = apply
    canvasApi.el = () => root.current
    canvasApi.screenToWorld = (sx, sy) => {
      const c = cam.current
      const r = root.current!.getBoundingClientRect()
      return { x: (sx - r.left - c.x) / c.z, y: (sy - r.top - c.y) / c.z }
    }
    canvasApi.worldToScreen = (wx, wy) => {
      const c = cam.current
      const r = root.current!.getBoundingClientRect()
      return { x: wx * c.z + c.x + r.left, y: wy * c.z + c.y + r.top }
    }
    canvasApi.zoomBy = (f) => {
      const v = view()
      const cx = v.left + (v.w - v.left - v.right) / 2
      const cy = v.top + (v.h - v.top - v.bottom) / 2
      apply(zoomAt(cam.current, cx, cy, cam.current.z * f), true)
    }
    canvasApi.focusRect = (rect, maxZ = 0.6) => apply(fitRect(rect, view(), maxZ), true)
    canvasApi.fitMix = () => {
      const m = mixRect()
      const v = view()
      // Fit the page width (with a peek of the neighbor tiles) and start at the top.
      const padX = m.w * 0.22
      const availW = v.w - v.left - v.right
      const z = clampZ(Math.min(availW / (m.w + padX * 2), 0.6))
      apply({ z, x: v.left + (availW - m.w * z) / 2, y: v.top + 64 }, true)
    }
    canvasApi.fitAll = () => {
      const st = useStore.getState()
      const lay = useLayout.getState()
      const m = mixRect()
      let x1 = -m.w * 0.9
      let y1 = m.y
      let x2 = m.w * 1.9
      let y2 = m.y + m.h
      for (const p of placeVersions(st.versions, st.ui.viewport, st.framePos)) {
        x1 = Math.min(x1, p.x)
        y1 = Math.min(y1, p.y - 80)
        x2 = Math.max(x2, p.x + p.w)
        y2 = Math.max(y2, p.y + (lay.frameHeights[p.id] ?? 1200))
      }
      apply(fitRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, view(), 0.6), true)
    }
  }, [apply])

  // First paint: restore the saved camera or frame the working mix.
  useEffect(() => {
    apply(cam.current)
    if (!useStore.getState().camera) {
      const t = window.setTimeout(() => canvasApi.fitMix(), 60)
      return () => window.clearTimeout(t)
    }
  }, [apply])

  // Wheel: two-finger scroll pans, pinch / ⌘-scroll zooms.
  useEffect(() => {
    const el = root.current!
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-scroll-ok]')) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const c = cam.current
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.004))
        apply(zoomAt(c, e.clientX - r.left, e.clientY - r.top, c.z * f))
      } else {
        apply({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [apply])

  // Space: tap shuffles, hold + drag pans.
  const spaceState = useRef({ down: false, moved: false })
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
    }
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e.target)) return
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

  const drag = useRef<{ x: number; y: number; cx: number; cy: number; pan: boolean; moved: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    const onBackground = e.target === root.current || e.target === world.current
    const pan = e.button === 1 || tool === 'hand' || spaceState.current.down || (onBackground && e.button === 0 && tool === 'select')
    if (!pan && !(onBackground && tool === 'sticky')) return
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, pan, moved: false }
    if (pan) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) > 3) {
      d.moved = true
      if (d.pan) setPanning(true)
      if (spaceState.current.down) spaceState.current.moved = true
    }
    if (d.pan && d.moved) apply({ ...cam.current, x: d.cx + dx, y: d.cy + dy })
  }

  const onPointerUp = (e: React.PointerEvent) => {
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

  const cursor = panning ? 'grabbing' : spaceHeld || tool === 'hand' ? 'grab' : tool === 'sticky' ? 'copy' : 'default'

  return (
    <div
      ref={root}
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        cursor,
        backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1.1px, transparent 1.3px)',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClickCapture={onClickCapture}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-mixtape-clip')) e.preventDefault()
      }}
      onDrop={(e) => {
        const clipId = e.dataTransfer.getData('application/x-mixtape-clip')
        const st = useStore.getState()
        const type = clipId.split('.')[0] as Parameters<typeof st.addSlot>[0]
        if (!clipId) return
        e.preventDefault()
        st.addSlot(type, clipId, st.slots.length)
      }}
      data-canvas
    >
      <div
        ref={world}
        className="absolute left-0 top-0 origin-top-left"
        style={{ willChange: 'transform', pointerEvents: spaceHeld || tool === 'hand' ? 'none' : undefined }}
        data-world
      >
        {children}
      </div>
    </div>
  )
}

export { MIX_ID }

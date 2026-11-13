/**
 * The canvas camera's arithmetic, pure: what a wheel event means, how far one zoom step goes, where the page sits
 * when it fits the window's width, how far it scrolls and how it gives at its ends. `Canvas.tsx` does the moving.
 */

import { clampZ, MAX_Z } from './geometry'

export { clampZ, MAX_Z, MIN_Z } from './geometry'

/** The space the canvas has: the window less the floating chrome and any docked panel. */
export interface View {
  w: number
  h: number
  top: number
  bottom: number
  left: number
  right: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** One wheel event in pixels, and what kind of hand made it. */
export interface Wheel {
  dx: number
  dy: number
  /** A zoom: a trackpad pinch (the browser sends it as ctrl + wheel) or ⌘/ctrl + wheel. */
  zoom: boolean
  /** A mouse wheel's click (whole lines or a big round jump), not a trackpad's stream of small deltas. */
  notch: boolean
}

const LINE = 16

/**
 * Wheel deltas come in pixels, lines (Firefox with a mouse) or pages. Everything here works in pixels. Shift + a
 * mouse wheel scrolls sideways where the system doesn't already turn it.
 */
export function normalizeWheel(
  e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
  pageH = 800,
): Wheel {
  const k = e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? pageH : 1
  let dx = e.deltaX * k
  let dy = e.deltaY * k
  if (e.shiftKey && !dx && !(e.ctrlKey || e.metaKey)) {
    dx = dy
    dy = 0
  }
  // Trackpads send many small, often fractional deltas; a mouse wheel's click is a line, or a big round number.
  const notch = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY) && !e.deltaX)
  return { dx, dy, zoom: !!(e.ctrlKey || e.metaKey), notch }
}

/** Wheel events closer together than this belong to one gesture (a trackpad's momentum tail included). */
export const WHEEL_GAP = 200

/** What made a wheel gesture, decided across its events rather than one at a time. */
export interface WheelHand {
  kind: 'pad' | 'mouse'
  at: number
}

/**
 * Trackpads often send whole-pixel deltas of 50 or more in a fast flick, which look like a mouse wheel's click on
 * their own. So a gesture is a mouse wheel only while every event in it reads as a click; once one doesn't, the rest
 * of that gesture is a trackpad's, and the page follows the fingers instead of gliding a click at a time.
 */
export function wheelHand(prev: WheelHand | null, notch: boolean, now: number): WheelHand {
  if (!prev || now - prev.at >= WHEEL_GAP) return { kind: notch ? 'mouse' : 'pad', at: now }
  return { kind: prev.kind === 'pad' || !notch ? 'pad' : 'mouse', at: now }
}

/** Zoom stops: every zoom step (keys, the dock, a mouse wheel's click) lands on the next one. */
export const ZOOM_STOPS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2] as const

/** The next stop in or out from any zoom (one that's between stops goes to the nearest one that way). */
export function stepZoom(z: number, dir: 1 | -1): number {
  const eps = 1e-3
  if (dir > 0) return ZOOM_STOPS.find((s) => s > z + eps) ?? MAX_Z
  return [...ZOOM_STOPS].reverse().find((s) => s < z - eps) ?? ZOOM_STOPS[0]
}

/** A pinch's step at most per event, so a fast flick or a lagging frame can't jump. */
export const PINCH_MIN = 0.85
export const PINCH_MAX = 1.18

/** How much one zoom event multiplies the zoom by: a click of a mouse wheel goes one stop, a pinch follows the fingers. */
export function zoomFactor(w: Pick<Wheel, 'dy' | 'notch'>, z: number): number {
  if (!w.dy) return 1
  if (w.notch) return stepZoom(z, w.dy < 0 ? 1 : -1) / z
  return clamp(Math.exp(-w.dy * 0.01), PINCH_MIN, PINCH_MAX)
}

/** Room either side of the page when it fits the width (for the sections' rails and the + between them). */
export function pagePad(view: View) {
  return clamp((view.w - view.left - view.right) * 0.05, 16, 56)
}

/** The x that centres a page this wide, at this zoom, in the free space. */
export function centerX(pageW: number, z: number, view: View) {
  const availW = view.w - view.left - view.right
  return view.left + (availW - pageW * z) / 2
}

/** The page as wide as the free space allows (never past `maxZ`, 100% by default), centred in it. */
export function fitWidth(pageW: number, view: View, pad = pagePad(view), maxZ = 1): { z: number; x: number } {
  const availW = view.w - view.left - view.right
  const z = clampZ(Math.min(maxZ, (availW - pad * 2) / pageW))
  return { z, x: centerX(pageW, z, view) }
}

/** Screen room above the page (its header) and below it (Add a section). */
export const PAGE_HEAD = 64
export const PAGE_TAIL = 120

/**
 * How far the page scrolls, as the camera's y: `max` shows its top (header in view), `min` its end resting above the
 * dock. A page shorter than the screen doesn't scroll.
 */
export function pageBounds(pageH: number, z: number, view: View, head = PAGE_HEAD, tail = PAGE_TAIL): { min: number; max: number } {
  const max = view.top + head
  const min = view.h - view.bottom - tail - pageH * z
  return { min: Math.min(min, max), max }
}

/** How far past an end the page gives for a push of `d`: less and less, never more than `dim`. */
const give = (d: number, dim: number) => (1 - 1 / ((d * 0.55) / dim + 1)) * dim
const ungive = (e: number, dim: number) => (1 / (1 - Math.min(e, dim * 0.999) / dim) - 1) * (dim / 0.55)

/** A scroll past either end, drawn with an elastic give (the page springs back once you let go). */
export function rubber(y: number, min: number, max: number, dim: number): number {
  if (y > max) return max + give(y - max, dim)
  if (y < min) return min - give(min - y, dim)
  return y
}

/** Where a scroll would be without the give: the inverse of `rubber`, to pick a stretched page up mid-spring. */
export function unrubber(y: number, min: number, max: number, dim: number): number {
  if (y > max) return max + ungive(y - max, dim)
  if (y < min) return min - ungive(min - y, dim)
  return y
}

/**
 * Pinching the page out far enough (below 60% of fitting its width) lets go of it: the free canvas takes over. It
 * never comes back by itself; Esc, ⌘0 or a click on the page does.
 */
export const LEAVE_PAGE = 0.6
export const leavesPage = (z: number, fitZ: number) => z < fitZ * LEAVE_PAGE - 1e-6

/** Snap to the device's pixel grid, so text and lines at 100% land sharp. */
export const round = (v: number, dpr = 1) => Math.round(v * dpr) / dpr

export type ZoomAction = 'in' | 'out' | 'fitWidth' | 'actual' | 'fitAll' | 'selection'

/**
 * The view's keys, Figma's way: ⌘= ⌘+ ⌘− step, ⌘0 fits the width, ⌘1 is 100%; ⇧1 fits everything, ⇧2 the selection,
 * ⇧0 is 100%; + and − step too.
 */
export function zoomKey(e: { key: string; code?: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }): ZoomAction | null {
  if (e.altKey) return null
  const mod = !!(e.metaKey || e.ctrlKey)
  const k = e.key
  const digit = e.code?.startsWith('Digit') ? e.code.slice(5) : /^[0-9]$/.test(k) ? k : null
  if (mod) {
    if (k === '=' || k === '+' || e.code === 'NumpadAdd') return 'in'
    if (k === '-' || k === '_' || e.code === 'NumpadSubtract') return 'out'
    if (e.shiftKey) return null
    if (digit === '0') return 'fitWidth'
    if (digit === '1') return 'actual'
    return null
  }
  if (e.shiftKey) {
    if (digit === '1' || k === '!') return 'fitAll'
    if (digit === '2' || k === '@') return 'selection'
    if (digit === '0' || k === ')') return 'actual'
  }
  if (k === '=' || k === '+') return 'in'
  if (k === '-' || k === '_') return 'out'
  return null
}

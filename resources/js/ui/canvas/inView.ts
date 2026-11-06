import { canvasApi, CHROME } from './Canvas'
import { clampZ, type Camera } from './geometry'

/**
 * Nudge the canvas so a menu that opened on the page is fully visible: clear
 * of the dock below and the top bar above.
 */
/** The lowest a menu or bar can sit on screen: just above the dock. */
export function screenFloor() {
  const dock = [...document.querySelectorAll('[data-dock] .glass-panel')].at(-1)
  let floor = dock?.getBoundingClientRect().top ?? window.innerHeight - CHROME.bottom
  // On a phone the Style panel is a sheet along the bottom: the floor is its top.
  const sheet = document.querySelector('[data-style-sheet]')?.getBoundingClientRect()
  if (sheet && sheet.left < window.innerWidth / 2) floor = Math.min(floor, sheet.top)
  return floor - 12
}

export function keepInView(el: Element | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const floor = screenFloor()
  const ceiling = CHROME.top
  const dy = r.bottom > floor ? floor - r.bottom : r.top < ceiling ? ceiling - r.top : 0
  if (!dy) return
  const cam = canvasApi.get()
  canvasApi.set({ ...cam, y: cam.y + Math.max(dy, ceiling - r.top) }, true)
}

/** Where the camera was before a docked panel moved it, and where the panel left it, so closing can go back. */
let beside: { before: Camera; left: Camera } | null = null

/**
 * Bring a section into the free space beside a docked panel, so its changes show live: pan as little as needed, and
 * zoom out only if it can't fit (never in). The room left below it is for the section's bar.
 */
export function frameBeside(el: Element, panel: Element) {
  const cam = canvasApi.get()
  const r = el.getBoundingClientRect()
  const p = panel.getBoundingClientRect()
  const dock = [...document.querySelectorAll('[data-dock] .glass-panel')].at(-1)
  const sheet = p.left < window.innerWidth / 2 // on a phone the panel is a sheet along the bottom
  const area = {
    left: sheet ? 12 : 88, // the section's rail
    right: sheet ? window.innerWidth - 12 : p.left - 92,
    top: CHROME.top,
    bottom: (sheet ? p.top : (dock?.getBoundingClientRect().top ?? window.innerHeight - CHROME.bottom)) - 64, // its bar, which sits below it
  }
  const w = area.right - area.left
  const h = area.bottom - area.top
  if (w <= 0 || h <= 0 || !r.width || !r.height) return
  const z = clampZ(cam.z * Math.min(1, w / r.width, h / r.height))
  const worldX = (r.left - cam.x) / cam.z
  const worldY = (r.top - cam.y) / cam.z
  const nw = (r.width / cam.z) * z
  const nh = (r.height / cam.z) * z
  // Zooming holds the section's top left corner still; then the least pan that brings it all into the space.
  const dx = r.left < area.left ? area.left - r.left : r.left + nw > area.right ? area.right - nw - r.left : 0
  const dy = r.top < area.top ? area.top - r.top : r.top + nh > area.bottom ? area.bottom - nh - r.top : 0
  if (z === cam.z && !dx && !dy) return
  const next: Camera = { x: cam.x + (worldX * cam.z - worldX * z) + dx, y: cam.y + (worldY * cam.z - worldY * z) + dy, z }
  beside = { before: beside?.before ?? cam, left: next }
  canvasApi.set(next, true)
}

/** The panel closed: back to where you were, unless you've moved the canvas yourself since. */
export function leaveBeside() {
  const was = beside
  beside = null
  if (was && canvasApi.get() === was.left) canvasApi.set(was.before, true)
}

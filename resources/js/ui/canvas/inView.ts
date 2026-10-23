import { canvasApi, CHROME } from './Canvas'

/**
 * Nudge the canvas so a menu that opened on the page is fully visible: clear
 * of the dock below and the top bar above.
 */
export function keepInView(el: Element | null) {
  if (!el) return
  const dock = [...document.querySelectorAll('[data-dock] .glass-panel')].at(-1)
  const r = el.getBoundingClientRect()
  const floor = (dock?.getBoundingClientRect().top ?? window.innerHeight - CHROME.bottom) - 12
  const ceiling = CHROME.top
  const dy = r.bottom > floor ? floor - r.bottom : r.top < ceiling ? ceiling - r.top : 0
  if (!dy) return
  const cam = canvasApi.get()
  canvasApi.set({ ...cam, y: cam.y + Math.max(dy, ceiling - r.top) }, true)
}

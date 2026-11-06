import { useEffect, useRef } from 'react'

/** Typing into a field: no shortcut should take the key. */
export function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/**
 * A focused control that Enter or Space should press (a button, a link, a tab, a switch…), so those keys don't save a
 * version or shuffle the page instead.
 */
export function pressable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el?.closest?.('button, a[href], summary, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="checkbox"], [role="option"], [role="menuitem"], [role="slider"]')
}

/**
 * Esc closes the thing on top, and only that: an open menu, a tab, a sheet. Whatever opened last is closed first; the
 * key then stops there, so it doesn't also step out of the selection or close the panel underneath.
 */
const layers: (() => void)[] = []
let listening = false
function onEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !layers.length) return
  e.preventDefault()
  e.stopPropagation()
  layers[layers.length - 1]()
}

export function useEscape(open: boolean, close: () => void) {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open) return
    const layer = () => latest.current()
    layers.push(layer)
    if (!listening) {
      // Capture on the window runs before every other key handler.
      window.addEventListener('keydown', onEscape, true)
      listening = true
    }
    return () => {
      const i = layers.lastIndexOf(layer)
      if (i >= 0) layers.splice(i, 1)
    }
  }, [open])
}

import { create } from 'zustand'

/**
 * Panels docked at the window's sides (the Style panel on the right, the Words panel on the left), in screen pixels.
 * The canvas fits the page into what's left between them.
 */
export const useInsets = create<{ left: number; right: number }>()(() => ({ left: 0, right: 0 }))

export function setInset(side: 'left' | 'right', px: number) {
  const v = Math.max(0, Math.round(px))
  if (useInsets.getState()[side] !== v) useInsets.setState({ [side]: v })
}

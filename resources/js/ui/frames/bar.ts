import type { CSSProperties } from 'react'

/**
 * One look for the bars that float by a selection (the section bar and the block bar): solid, lifted, 16px corners,
 * so they read over any section and match each other.
 */
export const BAR_SURFACE: CSSProperties = {
  borderRadius: 16,
  backgroundColor: 'var(--lift)',
  boxShadow: '0 0 0 1px rgb(0 0 0 / 0.08), 0 12px 28px -12px rgb(0 0 0 / 0.35)',
}

/** The gap between a bar and what it belongs to (Tailwind padding on the bar's wrapper). */
export const BAR_GAP = 'pt-2.5'

/** Every bar button: a pill, with press feedback; hover only where there's a pointer to hover with. */
export const BAR_BUTTON =
  'flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.97] pointer-coarse:min-h-11 pointer-coarse:min-w-11'

/**
 * Plays a reel (`core/reel.ts`): the strip of tiles slides once, decelerating, and settles a few pixels back onto the
 * one it lands on. Web Animations on transform and opacity only, so nothing lays out while it rolls.
 */

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const SETTLE = 'cubic-bezier(0.33, 0, 0.2, 1)'

/** Slide `strip` left by `distance` px over `duration` ms, rolling `settle` px past and back. */
export function spinStrip(strip: HTMLElement, { distance, duration, delay = 0, settle = 0 }: { distance: number; duration: number; delay?: number; settle?: number }): Animation {
  const frames: Keyframe[] = settle
    ? [
        { transform: 'translateX(0)', easing: EASE_OUT },
        { offset: 0.84, transform: `translateX(${-(distance + settle)}px)`, easing: SETTLE },
        { transform: `translateX(${-distance}px)` },
      ]
    : [
        { transform: 'translateX(0)', easing: EASE_OUT },
        { transform: `translateX(${-distance}px)` },
      ]
  return strip.animate(frames, { duration, delay, fill: 'both' })
}

/** Reduced motion: the landing tile fades in over the one it replaces. */
export function fadeTile(tile: HTMLElement, { duration, delay = 0 }: { duration: number; delay?: number }): Animation {
  return tile.animate([{ opacity: 0 }, { opacity: 1 }], { duration, delay, easing: 'ease-out', fill: 'both' })
}

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

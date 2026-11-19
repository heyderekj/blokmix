/**
 * The reel: how a section rolls from one layout to another when you Mix, like a slot machine's window. Pure: which
 * layouts pass through the window and how long it takes. `ui/motion/reel.ts` plays it.
 *
 * A plan is the strip of tiles laid side by side: the layout you had first, a couple passing through, the one it lands
 * on last. The window slides along it once, decelerating.
 */

export interface ReelOptions {
  /** Layouts already drawn and measured: only those can pass through (an unready frame would flash empty). */
  ready?: (id: string) => boolean
  /** How many layouts may pass through between the first and the last (0–2). */
  pass?: number
  /** Varies which layouts pass through from one Mix to the next. */
  seed?: number
}

/** The most layouts a row may show passing through on one spin. */
export const MAX_PASS = 2

/**
 * The strip: `from` first, up to `pass` ready layouts after it in the cycle's order, `to` last. Never repeats one, and
 * never passes through `from` or `to`. Landing where it started is no spin at all: just `[from]`.
 */
export function reelPlan(ids: readonly string[], from: string, to: string, { ready = () => true, pass = MAX_PASS, seed = 0 }: ReelOptions = {}): string[] {
  if (from === to) return [from]
  const n = ids.length
  const start = Math.max(0, ids.indexOf(from))
  // The others in the order the reel rolls (forward from where it is), ready ones only.
  const ahead: string[] = []
  for (let k = 1; k < n; k++) {
    const id = ids[(start + k) % n]
    if (id !== from && id !== to && ready(id)) ahead.push(id)
  }
  const take = Math.max(0, Math.min(Math.floor(pass), MAX_PASS, ahead.length))
  if (!take) return [from, to]
  // A seeded window into what's ahead, kept in rolling order so the strip reads as one reel.
  const offset = (((Math.floor(seed) % ahead.length) + ahead.length) % ahead.length)
  const picked = new Set(Array.from({ length: take }, (_, i) => ahead[(offset + i) % ahead.length]))
  return [from, ...ahead.filter((id) => picked.has(id)), to]
}

/** How many tiles a row may wake for a spin: four, or two once more than five rows are on screen. */
export const reelTiles = (rowsOnScreen: number) => (rowsOnScreen > 5 ? 2 : 4)

export interface ReelTiming {
  /** Wait before this row starts (its stagger). */
  delay: number
  /** The slide itself. */
  duration: number
  /** How far it rolls past the landing spot before settling back, in px. */
  settle: number
  /** When the row's height starts easing to the new layout's, from the row's start (after `delay`). */
  heightDelay: number
  heightDuration: number
}

export const REEL = {
  duration: 520,
  /** A Mix during a spin lands that one and starts a shorter one. */
  quick: 340,
  /** A cross-fade instead, for reduced motion. */
  fade: 220,
  stagger: 60,
  /** The last row starts no later than this, however many rows there are. */
  maxDelay: 300,
  settle: 6,
} as const

/** The timing of the row that is `rank`th from the top among the rows on screen. */
export function reelTiming(rank: number, { quick = false, reduced = false }: { quick?: boolean; reduced?: boolean } = {}): ReelTiming {
  const duration = reduced ? REEL.fade : quick ? REEL.quick : REEL.duration
  const delay = Math.min(Math.max(0, Math.floor(rank)) * REEL.stagger, REEL.maxDelay)
  // The height holds while the reel rolls, then eases once over its last stretch.
  const heightDelay = reduced ? 0 : Math.round(duration * 0.55)
  return { delay, duration, settle: reduced ? 0 : REEL.settle, heightDelay, heightDuration: duration - heightDelay }
}

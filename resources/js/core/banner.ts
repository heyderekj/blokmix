// An announcement banner any nav can add: a strip of messages above the nav,
// scrolling like a ticker. It's the same banner block a clipped ticker is
// (kind "banner", its messages a list of notice fields), so it takes the same
// looks (Inverted, Quiet, Accent, Still), the same words and the same list
// edits. It sits just before the nav's root, so the nav's own padding and
// layout stay as they were.

import type { HEl, HNode } from './html/parse'
import type { Slot } from './types'

/** Fixed ids for the added banner's blocks, outside the clip's own b0… so nothing shifts. */
export const BANNER_ID = 'x0'
const LIST_ID = 'x1'
const COUNT = 4

const el = (tag: string, attrs: [string, string][], kids: HNode[] = []): HEl => ({ t: 'el', tag, ns: 'html', attrs, kids })
const nl: HNode = { t: 'text', v: '\n' }

/** The banner's markup, with source words from the page's own copy fallback. */
export function bannerTree(words: (field: string) => string): HEl {
  const notes = Array.from({ length: COUNT }, (_, i) => i + 1)
  const items = notes.map((n) =>
    el('span', [['class', 'mx-banner-note'], ['data-mx-block', 'item'], ['data-mx-label', 'Message'], ['data-mx-field', `notice${n}`], ['data-mx-b', `x${n + 1}`]], [{ t: 'text', v: words(`notice${n}`) }]),
  )
  const mirrors = notes.map((n) => el('span', [['class', 'mx-banner-note'], ['data-mx-mirror', `notice${n}`]], [{ t: 'text', v: words(`notice${n}`) }]))
  return el('div', [['class', 'mx-banner'], ['data-mx-block', 'banner'], ['data-mx-label', 'Banner'], ['data-mx-b', BANNER_ID], ['data-mx-extra', 'banner']], [
    el('div', [['class', 'mx-banner-track']], [
      el('div', [['class', 'mx-banner-group'], ['data-mx-block', 'list'], ['data-mx-list', 'notices'], ['data-mx-b', LIST_ID]], items.flatMap((x) => [nl, x])),
      el('div', [['class', 'mx-banner-group'], ['aria-hidden', 'true'], ['data-mx-set', LIST_ID]], mirrors.flatMap((x) => [nl, x])),
    ]),
  ])
}

/** The banner's own CSS, in tokens: at rest in the clip layer, the scroll in the motion layer. */
export const BANNER_CSS = `@layer clip {
  .mx-banner { overflow: hidden; background: var(--mx-color-text); color: var(--mx-color-bg); }
  .mx-banner-track { display: flex; width: max-content; }
  .mx-banner-group {
    display: flex; align-items: center; gap: var(--mx-space-6); margin: 0;
    padding: var(--mx-space-2) var(--mx-space-6) var(--mx-space-2) 0;
    font-family: var(--mx-font-mono); font-size: max(var(--mx-text-xs), 12px); font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
  }
  .mx-banner-note { display: inline-flex; align-items: center; gap: var(--mx-space-6); }
  .mx-banner-note::after { content: "✦"; color: var(--mx-color-primary); }
}`

/** The scroll, dropped with reduced motion or when the section's motion is off. */
export const BANNER_MOTION = `@layer motion {
  @media (prefers-reduced-motion: no-preference) {
    .mx-banner-track { animation: mx-banner-marquee 32s linear infinite; }
    .mx-banner:hover .mx-banner-track { animation-play-state: paused; }
  }
}
@keyframes mx-banner-marquee { to { transform: translateX(-50%); } }`

/** Whether a clip already has a banner of its own (a clipped ticker). */
export function hasOwnBanner(blocks: { kind: string; id: string }[]): boolean {
  return blocks.some((b) => b.kind === 'banner' && b.id !== BANNER_ID)
}

/** An added banner scrolls when the section's motion is on (captured or a preset), not when it's None. */
export function bannerMoves(slot: Pick<Slot, 'keep' | 'motion'>): boolean {
  if (slot.motion?.mode === 'none') return false
  return slot.keep.motion || slot.motion?.mode === 'preset'
}

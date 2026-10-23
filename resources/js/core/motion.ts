// Motion presets for sections and blocks, written to the craft rules (CLAUDE.md):
// transform and opacity only, ease-out (never ease-in), never from scale(0),
// hover only where a real pointer hovers, and reduced motion keeps fades only.
// Easing and durations follow Koati's motion tokens and Emil Kowalski's guidance.

import type { BlockEdit, BlockInfo, BlockKind, BlockMotion, EnterPreset, HoverPreset, LoopPreset, MotionSpeed, ScrollPreset, SectionMotion } from './types'

export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
export const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

/** Entrances are page moments, so they can run longer than UI motion. */
export const ENTER_MS: Record<MotionSpeed, number> = { quick: 260, normal: 420, slow: 640 }
export const HOVER_MS = 200
export const STAGGER_MS = 60
const MAX_STAGGER = 8

export interface PresetInfo<T extends string> {
  id: T
  label: string
  hint: string
  /** Which blocks it suits; undefined = any. */
  kinds?: BlockKind[]
}

export const ENTER_INFO: PresetInfo<EnterPreset>[] = [
  { id: 'rise', label: 'Rise', hint: 'Fades up a short way: the dependable default' },
  { id: 'fade', label: 'Fade', hint: 'Just appears, softly' },
  { id: 'pop', label: 'Pop', hint: 'Scales in from 95%: lively for cards and badges' },
  { id: 'drop', label: 'Drop', hint: 'Settles down from above' },
  { id: 'slide', label: 'Slide', hint: 'Comes in from the side' },
  { id: 'blur', label: 'Blur', hint: 'Sharpens into focus: calm and premium' },
]

const PRESSABLE: BlockKind[] = ['button', 'link', 'card', 'item', 'image', 'icon', 'badge']
export const HOVER_INFO: PresetInfo<HoverPreset>[] = [
  { id: 'lift', label: 'Lift', hint: 'Rises a little with a deeper shadow', kinds: ['button', 'card', 'item', 'image'] },
  { id: 'glow', label: 'Glow', hint: 'A soft halo in your primary', kinds: ['button', 'card', 'item', 'icon'] },
  { id: 'tilt', label: 'Tilt', hint: 'Leans slightly: playful', kinds: ['card', 'item', 'image', 'badge', 'icon'] },
  { id: 'zoom', label: 'Zoom', hint: 'Grows a touch', kinds: ['image', 'icon', 'card', 'item'] },
  { id: 'nudge', label: 'Nudge', hint: 'Steps forward, inviting the click', kinds: ['button', 'link'] },
  { id: 'underline', label: 'Underline', hint: 'An underline draws in', kinds: ['link', 'heading'] },
]

export const SCROLL_INFO: PresetInfo<ScrollPreset>[] = [
  { id: 'reveal', label: 'Reveal', hint: 'Plays its entrance as it scrolls into view' },
  { id: 'parallax', label: 'Parallax', hint: 'Drifts slower than the page as you scroll', kinds: ['image', 'card', 'icon'] },
]

export const LOOP_INFO: PresetInfo<LoopPreset>[] = [
  { id: 'float', label: 'Float', hint: 'Bobs gently, for illustrations and badges', kinds: ['image', 'icon', 'badge', 'card'] },
  { id: 'breathe', label: 'Breathe', hint: 'Swells very slightly', kinds: ['image', 'icon', 'badge', 'button'] },
  { id: 'spin', label: 'Spin', hint: 'Turns slowly, for marks and stickers', kinds: ['icon', 'image', 'badge'] },
]

export const SPEED_LABEL: Record<MotionSpeed, string> = { quick: 'Quick', normal: 'Normal', slow: 'Slow' }

export const presetsFor = <T extends string>(list: PresetInfo<T>[], kind: BlockKind) => list.filter((p) => !p.kinds || p.kinds.includes(kind))
export const canHover = (kind: BlockKind) => PRESSABLE.includes(kind) || kind === 'heading'

/* ---------- CSS ---------- */

/** Keyframes for a preset; `p` is a name prefix that keeps them unique to a section. */
function enterKeyframes(p: string, e: EnterPreset): string {
  const from: Record<EnterPreset, string> = {
    rise: 'opacity: 0; translate: 0 14px;',
    fade: 'opacity: 0;',
    pop: 'opacity: 0; scale: 0.95;',
    drop: 'opacity: 0; translate: 0 -14px;',
    slide: 'opacity: 0; translate: -24px 0;',
    blur: 'opacity: 0; filter: blur(8px); scale: 0.99;',
  }
  return `@keyframes ${p}-${e} { from { ${from[e]} } }`
}

const LOOP_KEYFRAMES: Record<LoopPreset, (p: string) => string> = {
  float: (p) => `@keyframes ${p}-float { from { translate: 0 -4px; } to { translate: 0 4px; } }`,
  breathe: (p) => `@keyframes ${p}-breathe { from { scale: 1; } to { scale: 1.03; } }`,
  spin: (p) => `@keyframes ${p}-spin { to { rotate: 1turn; } }`,
}

const HOVER_CSS: Record<HoverPreset, { rest: string; hover: string }> = {
  lift: {
    rest: `transition: translate ${HOVER_MS}ms ${EASE_OUT}, box-shadow ${HOVER_MS}ms ${EASE_OUT};`,
    hover: 'translate: 0 -4px; box-shadow: 0 2px 4px color-mix(in oklab, var(--mx-color-text) 8%, transparent), 0 16px 32px -12px color-mix(in oklab, var(--mx-color-text) 30%, transparent);',
  },
  glow: {
    rest: `transition: box-shadow ${HOVER_MS}ms ${EASE_OUT};`,
    hover: 'box-shadow: 0 0 0 4px color-mix(in oklab, var(--mx-color-primary) 18%, transparent), 0 8px 28px -8px color-mix(in oklab, var(--mx-color-primary) 55%, transparent);',
  },
  tilt: { rest: `transition: rotate ${HOVER_MS}ms ${EASE_OUT}, scale ${HOVER_MS}ms ${EASE_OUT};`, hover: 'rotate: -1.5deg; scale: 1.01;' },
  zoom: { rest: `transition: scale ${HOVER_MS}ms ${EASE_OUT};`, hover: 'scale: 1.03;' },
  nudge: { rest: `transition: translate ${HOVER_MS}ms ${EASE_OUT};`, hover: 'translate: 3px 0;' },
  underline: {
    rest: `background: linear-gradient(currentColor, currentColor) no-repeat 0 100% / 0 1.5px; transition: background-size ${HOVER_MS + 60}ms ${EASE_OUT};`,
    hover: 'background-size: 100% 1.5px;',
  },
}

export interface MotionCssInput {
  blocks: BlockInfo[]
  /** Each block's effective edit (its own over any page-wide default). */
  edits: (b: BlockInfo) => BlockEdit | undefined
  section?: SectionMotion
  /** Selector for a block, and for the section root. */
  select: (b: BlockInfo) => string
  root: string
  /** Prefix for keyframe names, unique per section. */
  prefix: string
  /** The canvas can't scroll a section, so scroll presets play on load there instead. */
  canvas?: boolean
}

/**
 * Motion for a section and its blocks. Movement lives inside
 * prefers-reduced-motion: no-preference; with reduced motion, entrances become
 * a short fade and everything else stays still. Returns '' when nothing moves.
 */
export function motionCss(i: MotionCssInput): string {
  const p = i.prefix
  const sec = i.section?.mode === 'preset' ? i.section : undefined
  const frames = new Set<string>()
  const moving: string[] = []
  const reduced: string[] = []

  const entrance = (sel: string, preset: EnterPreset, speed: MotionSpeed, delay: number, onScroll: boolean) => {
    frames.add(enterKeyframes(p, preset))
    const ms = ENTER_MS[speed]
    const base = `animation: ${p}-${preset} ${ms}ms ${EASE_OUT} ${delay}ms both;`
    if (onScroll && !i.canvas) {
      frames.add(enterKeyframes(p, 'fade'))
      moving.push(
        `${sel} { ${base} }\n@supports (animation-timeline: view()) { ${sel} { animation: ${p}-${preset} linear both; animation-timeline: view(); animation-range: entry 0% cover 28%; } }`,
      )
    } else moving.push(`${sel} { ${base} }`)
    frames.add(enterKeyframes(p, 'fade'))
    reduced.push(`${sel} { animation: ${p}-fade 200ms ease-out ${Math.min(delay, 120)}ms both; }`)
  }

  // Section preset: the root arrives, or its top-level blocks arrive one after another.
  if (sec) {
    const enter = sec.enter ?? 'rise'
    const speed = sec.speed ?? 'normal'
    if (sec.stagger) {
      const tops = i.blocks.filter((b) => !b.parent || i.blocks.find((x) => x.id === b.parent)?.kind === 'list')
      tops.forEach((b, n) => {
        if (i.edits(b)?.motion?.enter) return // the block's own entrance (or 'none') wins
        entrance(i.select(b), enter, speed, Math.min(n, MAX_STAGGER) * STAGGER_MS, !!sec.onScroll)
      })
    } else entrance(i.root, enter, speed, 0, !!sec.onScroll)
  }

  for (const b of i.blocks) {
    const m: BlockMotion | undefined = i.edits(b)?.motion
    if (!m) continue
    const sel = i.select(b)
    const speed = m.speed ?? sec?.speed ?? 'normal'
    if (m.enter && m.enter !== 'none') entrance(sel, m.enter, speed, 0, m.scroll === 'reveal')
    else if (m.scroll === 'reveal') entrance(sel, sec?.enter ?? 'rise', speed, 0, true)
    if (m.hover) {
      const h = HOVER_CSS[m.hover]
      moving.push(`${sel} { ${h.rest} }\n@media (hover: hover) and (pointer: fine) { ${sel}:hover { ${h.hover} } }`)
    }
    if (m.scroll === 'parallax' && !i.canvas) {
      frames.add(`@keyframes ${p}-parallax { from { translate: 0 6%; } to { translate: 0 -6%; } }`)
      moving.push(`@supports (animation-timeline: view()) { ${sel} { animation: ${p}-parallax linear both; animation-timeline: view(); } }`)
    }
    if (m.loop) {
      frames.add(LOOP_KEYFRAMES[m.loop](p))
      const loop =
        m.loop === 'spin'
          ? `${p}-spin ${m.speed === 'quick' ? 8 : m.speed === 'slow' ? 24 : 14}s linear infinite`
          : `${p}-${m.loop} ${m.speed === 'quick' ? 2.4 : m.speed === 'slow' ? 5 : 3.6}s ${EASE_IN_OUT} infinite alternate`
      // A loop after an entrance: the entrance plays first, then the loop takes over.
      const after = m.enter && m.enter !== 'none' ? `, ${p}-${m.enter} ${ENTER_MS[speed]}ms ${EASE_OUT} both` : ''
      moving.push(`${sel} { animation: ${loop}${after}; }`)
    }
  }

  if (!moving.length) return ''
  return [
    `@media (prefers-reduced-motion: no-preference) {\n${[...frames].join('\n')}\n${moving.join('\n')}\n}`,
    reduced.length ? `@media (prefers-reduced-motion: reduce) {\n${enterKeyframes(p, 'fade')}\n${reduced.join('\n')}\n}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Motion in words, for the packet: "Rise entrance, staggered, on scroll". */
export function describeSectionMotion(m: SectionMotion | undefined): string | null {
  if (!m || m.mode === 'captured') return null
  if (m.mode === 'none') return 'none'
  const e = ENTER_INFO.find((x) => x.id === (m.enter ?? 'rise'))!.label
  return [`${e} entrance`, m.stagger && 'blocks one after another (60ms apart)', m.onScroll && 'plays as it scrolls into view', m.speed && m.speed !== 'normal' && SPEED_LABEL[m.speed].toLowerCase()]
    .filter(Boolean)
    .join(', ')
}

export function describeBlockMotion(m: BlockMotion | undefined): string | null {
  if (!m) return null
  const parts = [
    m.enter === 'none' ? 'no entrance' : m.enter && `${m.enter} entrance`,
    m.hover && `${m.hover} on hover`,
    m.scroll && (m.scroll === 'reveal' ? 'reveals on scroll' : 'parallax on scroll'),
    m.loop && `${m.loop} loop`,
    m.speed && m.speed !== 'normal' && m.speed,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

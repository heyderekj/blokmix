// Icon packs: one curated set of meaningful names (arrow-right, mail, star…)
// drawn by Lucide, Phosphor, Tabler and Heroicons at several weights. Clips
// name their icons, so the same icon redraws in whichever set the style guide
// uses; a source's own set is identified from the icons in its clips.

import data from '../data/icons.json'
import type { HEl, HNode } from './html/parse'
import { attr, parseHtml } from './html/parse'

type Pack = 'lucide' | 'phosphor' | 'tabler' | 'heroicons'
const PACKS = data.packs as Record<Pack, Record<string, Record<string, string>>>

export const ICON_NAMES: readonly string[] = data.names

export interface IconSet {
  /** The token value: "pack:weight". */
  id: string
  pack: Pack
  weight: string
  label: string
  style: 'outline' | 'solid' | 'duotone'
  /** Outline sets: the stroke they're drawn with (in the pack's own units). */
  stroke?: number
}

export const ICON_SETS: IconSet[] = [
  { id: 'lucide:light', pack: 'lucide', weight: 'regular', label: 'Lucide Light', style: 'outline', stroke: 1.5 },
  { id: 'lucide:regular', pack: 'lucide', weight: 'regular', label: 'Lucide', style: 'outline', stroke: 2 },
  { id: 'lucide:bold', pack: 'lucide', weight: 'regular', label: 'Lucide Bold', style: 'outline', stroke: 2.5 },
  { id: 'phosphor:thin', pack: 'phosphor', weight: 'thin', label: 'Phosphor Thin', style: 'outline' },
  { id: 'phosphor:light', pack: 'phosphor', weight: 'light', label: 'Phosphor Light', style: 'outline' },
  { id: 'phosphor:regular', pack: 'phosphor', weight: 'regular', label: 'Phosphor', style: 'outline' },
  { id: 'phosphor:bold', pack: 'phosphor', weight: 'bold', label: 'Phosphor Bold', style: 'outline' },
  { id: 'phosphor:fill', pack: 'phosphor', weight: 'fill', label: 'Phosphor Fill', style: 'solid' },
  { id: 'phosphor:duotone', pack: 'phosphor', weight: 'duotone', label: 'Phosphor Duotone', style: 'duotone' },
  { id: 'tabler:light', pack: 'tabler', weight: 'regular', label: 'Tabler Light', style: 'outline', stroke: 1.5 },
  { id: 'tabler:regular', pack: 'tabler', weight: 'regular', label: 'Tabler', style: 'outline', stroke: 2 },
  { id: 'tabler:bold', pack: 'tabler', weight: 'regular', label: 'Tabler Bold', style: 'outline', stroke: 2.5 },
  { id: 'tabler:filled', pack: 'tabler', weight: 'filled', label: 'Tabler Filled', style: 'solid' },
  { id: 'heroicons:outline', pack: 'heroicons', weight: 'outline', label: 'Heroicons', style: 'outline', stroke: 1.5 },
  { id: 'heroicons:solid', pack: 'heroicons', weight: 'solid', label: 'Heroicons Solid', style: 'solid' },
]

export const DEFAULT_ICON_SET = 'lucide:regular'

export function iconSet(id: string | undefined): IconSet {
  return ICON_SETS.find((s) => s.id === id) ?? ICON_SETS.find((s) => s.id === DEFAULT_ICON_SET)!
}

export const PACK_CREDIT: Record<Pack, string> = {
  lucide: 'Lucide (ISC), lucide.dev',
  phosphor: 'Phosphor Icons (MIT), phosphoricons.com',
  tabler: 'Tabler Icons (MIT), tabler.io/icons',
  heroicons: 'Heroicons (MIT), heroicons.com',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/**
 * An icon as SVG in a set, sized to fill its box and coloured by currentColor.
 * `attrs` are kept from the clip's own <svg> (class, width, height, aria-*), so
 * the clip's sizing still applies.
 */
export function iconSvg(name: string, setId: string | undefined, attrs: [string, string][] = []): string | null {
  const set = iconSet(setId)
  let body = PACKS[set.pack]?.[set.weight]?.[name]
  // Tabler doesn't fill every icon: use its outline rather than nothing.
  if (!body && set.pack === 'tabler') body = PACKS.tabler.regular[name]
  if (!body) return null
  const outlineFallback = set.id === 'tabler:filled' && !PACKS.tabler.filled[name]
  const keep = attrs.filter(([k]) => !/^(viewbox|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|xmlns)$/i.test(k))
  const wrap: [string, string][] =
    set.pack === 'phosphor'
      ? [['viewBox', '0 0 256 256'], ['fill', 'currentColor']]
      : set.style === 'solid' && !outlineFallback
        ? [['viewBox', '0 0 24 24'], ['fill', 'currentColor']]
        : [
            ['viewBox', '0 0 24 24'],
            ['fill', 'none'],
            ['stroke', 'currentColor'],
            ['stroke-width', String(set.stroke ?? 2)],
            ['stroke-linecap', 'round'],
            ['stroke-linejoin', 'round'],
          ]
  const all = [...wrap, ...keep, ...(keep.some(([k]) => k === 'aria-hidden' || k === 'aria-label' || k === 'role') ? [] : [['aria-hidden', 'true'] as [string, string]])]
  return `<svg xmlns="http://www.w3.org/2000/svg" ${all.map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>${body}</svg>`
}

/* ---------- identifying a source's icon style ---------- */

export interface Identified {
  set: string
  reason: string
}

/**
 * Guess the closest set from a source's own icons: outline or solid, how heavy
 * the stroke is (relative to the icon's size), and whether corners are round.
 */
export function identifyIconSet(svgs: string[]): Identified | null {
  if (!svgs.length) return null
  let strokeIcons = 0
  let fillIcons = 0
  let duo = 0
  let square = 0
  const weights: number[] = []
  for (const svg of svgs) {
    const view = /viewBox="([\d.\s-]+)"/i.exec(svg)?.[1]?.trim().split(/\s+/).map(Number)
    const size = view && view.length === 4 ? Math.max(view[2], view[3]) : 24
    const stroked = /stroke="(?!none)[^"]+"/i.test(svg) || /stroke:\s*(?!none)/i.test(svg)
    const filled = /fill="(?!none)[^"]+"/i.test(svg.replace(/^<svg[^>]*>/i, ''))
    if (stroked) {
      strokeIcons++
      const sw = Number(/stroke-width="([\d.]+)"/i.exec(svg)?.[1] ?? 2)
      weights.push((sw / size) * 24) // normalise to a 24-unit icon
      if (/stroke-linecap="(square|butt)"/i.test(svg) || /stroke-linejoin="(miter|bevel)"/i.test(svg)) square++
    }
    if (filled && !stroked) fillIcons++
    if (filled && stroked && /opacity="0?\.\d+"/.test(svg)) duo++
  }
  const n = svgs.length
  const avg = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 2
  const sharp = square > strokeIcons / 2
  let set: string
  let why: string
  if (duo >= n / 2) {
    set = 'phosphor:duotone'
    why = 'two-tone icons'
  } else if (fillIcons > strokeIcons) {
    set = sharp ? 'tabler:filled' : 'heroicons:solid'
    why = 'solid, filled icons'
  } else if (sharp) {
    set = avg >= 2.25 ? 'tabler:bold' : avg <= 1.6 ? 'tabler:light' : 'tabler:regular'
    why = `${avg.toFixed(1)}px square-cornered strokes`
  } else {
    set = avg >= 2.25 ? 'phosphor:bold' : avg <= 1.35 ? 'phosphor:thin' : avg <= 1.65 ? 'heroicons:outline' : 'lucide:regular'
    why = `${avg.toFixed(1)}px rounded strokes`
  }
  return { set, reason: `${why} in ${n} icon${n > 1 ? 's' : ''} → ${iconSet(set).label}` }
}

/* ---------- swapping icons in a clip ---------- */


/** Icon names a clip uses. */
export function iconNamesIn(html: string): string[] {
  return [...new Set([...html.matchAll(/data-mx-icon="([\w-]+)"/g)].map((m) => m[1]))]
}

/**
 * Redraw a clip's named icons in a set. `overrides` swaps the icon in an icon
 * block (by block id, b0…) for another name; it replaces the block's first <svg>.
 * Blocks are counted in document order, as everywhere else.
 */
export function swapIcons(tree: HNode[], setId: string, overrides: Record<string, string> = {}): HNode[] {
  let order = 0
  const walk = (nodes: HNode[], iconBlock: string | null): HNode[] => {
    let swappedInBlock = false
    return nodes.map((n) => {
      if (n.t !== 'el') return n
      let block = iconBlock
      if (attr(n, 'data-mx-block') !== undefined) {
        const id = `b${order++}`
        block = attr(n, 'data-mx-block') === 'icon' ? id : null
      }
      if (n.tag === 'svg') {
        const override = block && !swappedInBlock ? overrides[block] : undefined
        const name = override ?? attr(n, 'data-mx-icon')
        if (block) swappedInBlock = true
        // An icon whose parts carry classes is a mechanism the clip animates (a plus that turns into a minus):
        // it keeps its own drawing, unless you chose a different icon for its block.
        const animated = !override && n.kids.some((k) => k.t === 'el' && attr(k, 'class') !== undefined)
        if (name && !animated) {
          const svg = iconSvg(name, setId, n.attrs.filter(([k]) => k !== 'data-mx-icon'))
          const el = svg ? (parseHtml(svg)[0] as HEl) : null
          if (el) return { ...el, attrs: [...el.attrs, ['data-mx-icon', name]] }
        }
        return n
      }
      return { ...n, kids: walk(n.kids, block === iconBlock ? iconBlock : block) }
    })
  }
  return walk(tree, null)
}

/** The icon name an icon block's clip drew (its first named <svg>), if any. */
export function blockIconName(html: string, blockId: string): string | undefined {
  let order = 0
  let found: string | undefined
  const walk = (nodes: HNode[], inBlock: boolean) => {
    for (const n of nodes) {
      if (found || n.t !== 'el') continue
      let here = inBlock
      if (attr(n, 'data-mx-block') !== undefined) here = `b${order++}` === blockId
      if (here && n.tag === 'svg') {
        found = attr(n, 'data-mx-icon')
        if (found) return
      }
      walk(n.kids, here)
    }
  }
  walk(parseHtml(html), false)
  return found
}

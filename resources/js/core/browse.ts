import type { Clip, ClipStyle, Density, Library, Rhythm, SectionType } from './types'
import { CLIP_STYLES, DENSITIES, RHYTHMS } from './types'
import { hexToRgb, luminance } from './tokens'
import { TYPE_LABEL } from './content'

/**
 * Browsing the library the way Landbook does: by how a section is laid out, how it feels, how much it holds,
 * its tone and color, and whether it has pictures. Style and density are written in clip.json; the rest is read
 * off the clip itself, so captured clips can be browsed too.
 */

export const HUES = ['mono', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] as const
export type Hue = (typeof HUES)[number]
export type Tone = 'light' | 'dark'

export interface Facets {
  type: SectionType
  rhythm?: Rhythm
  style?: ClipStyle
  density?: Density
  tone: Tone
  color: Hue
  pictures: boolean
}

/** The filterable facets, in the order the Crate shows them, with every value they can take. */
export const FACET_GROUPS = {
  rhythm: { label: 'Layout', values: RHYTHMS },
  style: { label: 'Style', values: CLIP_STYLES },
  density: { label: 'Density', values: DENSITIES },
  pictures: { label: 'Pictures', values: ['with', 'without'] },
  tone: { label: 'Tone', values: ['light', 'dark'] },
  color: { label: 'Color', values: HUES },
} as const satisfies Record<string, { label: string; values: readonly string[] }>

export type FacetGroup = keyof typeof FACET_GROUPS
/** Chosen values per group: OR within a group, AND across groups. */
export type FacetFilter = Partial<Record<FacetGroup, string[]>>

export const FACET_LABEL: Record<string, string> = {
  centered: 'Centered',
  split: 'Split',
  grid: 'Grid',
  stack: 'Stack',
  band: 'Band',
  with: 'With pictures',
  without: 'No pictures',
}

export function facetLabel(value: string): string {
  return FACET_LABEL[value] ?? value[0].toUpperCase() + value.slice(1)
}

/** Light when the background is closer to white than black (the midpoint of contrast against both). */
export function toneOf(hex: string): Tone {
  const rgb = hexToRgb(hex)
  return rgb && luminance(rgb) < 0.18 ? 'dark' : 'light'
}

/** The color family a hex reads as; near-greys are mono. */
export function hueOf(hex: string): Hue {
  const rgb = hexToRgb(hex)
  if (!rgb) return 'mono'
  const [r, g, b] = rgb.map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (s < 0.18 || l < 0.08 || l > 0.96) return 'mono'
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h < 15 || h >= 345) return 'red'
  if (h < 40) return 'orange'
  if (h < 65) return 'yellow'
  if (h < 165) return 'green'
  if (h < 255) return 'blue'
  if (h < 290) return 'purple'
  return 'pink'
}

export function facetsOf(clip: Clip): Facets {
  return {
    type: clip.type,
    rhythm: clip.rhythm,
    style: clip.style,
    density: clip.density,
    tone: toneOf(clip.tokens['color.bg']),
    color: hueOf(clip.tokens['color.primary']),
    pictures: /data-mx-block="image"/.test(clip.html),
  }
}

function valueOf(f: Facets, group: FacetGroup): string | undefined {
  return group === 'pictures' ? (f.pictures ? 'with' : 'without') : f[group]
}

function haystack(lib: Library, clip: Clip): string {
  const source = lib.sources[clip.sourceId]
  return [clip.title, clip.layoutPattern.replace(/-/g, ' '), TYPE_LABEL[clip.type], source?.name, clip.style, clip.density, clip.rhythm]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Every word of the query must appear somewhere in the clip's title, pattern, type, source or tags. */
export function matchesQuery(lib: Library, clip: Clip, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = haystack(lib, clip)
  return words.every((w) => text.includes(w))
}

export function matchesFacets(clip: Clip, filter: FacetFilter): boolean {
  const f = facetsOf(clip)
  return (Object.keys(filter) as FacetGroup[]).every((g) => {
    const want = filter[g]
    if (!want?.length) return true
    const v = valueOf(f, g)
    return v !== undefined && want.includes(v)
  })
}

export function searchClips(lib: Library, ids: string[], opts: { query?: string; facets?: FacetFilter }): string[] {
  return ids.filter((id) => {
    const clip = lib.clips[id]
    return clip && matchesQuery(lib, clip, opts.query ?? '') && matchesFacets(clip, opts.facets ?? {})
  })
}

/** How many of these clips take each value, per group. A group with fewer than two values isn't worth showing. */
export function facetCounts(lib: Library, ids: string[]): Record<FacetGroup, Record<string, number>> {
  const out = Object.fromEntries(Object.keys(FACET_GROUPS).map((g) => [g, {}])) as Record<FacetGroup, Record<string, number>>
  for (const id of ids) {
    const clip = lib.clips[id]
    if (!clip) continue
    const f = facetsOf(clip)
    for (const g of Object.keys(FACET_GROUPS) as FacetGroup[]) {
      const v = valueOf(f, g)
      if (v !== undefined) out[g][v] = (out[g][v] ?? 0) + 1
    }
  }
  return out
}

export function activeFacetCount(filter: FacetFilter): number {
  return Object.values(filter).reduce((n, v) => n + (v?.length ?? 0), 0)
}

// Directions: a theme and the page's arrangement, curated to suit each other (Counter Service with a big photo up top
// and the menu in plain rows; Mastered with a product shot, a logo row and pricing in tiers). Not fixed pages: a
// direction dresses whatever sections the brief asks for, with its own layouts where it has them and today's ranking
// where it doesn't. Rows of directions are ranked by the brief and by the site's taste (core/taste.ts), so every row
// leans toward what its owner has shown they want. The starters count as directions too. Pure.

import { z } from 'zod'
import { FORMATS, INDUSTRIES, type Brief } from './brief'
import { emptyContract, STYLE_AREAS } from './contract'
import { resolveGuide } from './guide'
import { heroFamily } from './heroLayouts'
import { pickable } from './library'
import { partSource, skinById, swapThemeParts, themeList, type Skin, type ThemeParts } from './skins'
import { contentFor, countShelves, fillPage, guideFor, otherPages, RECIPES, siteFromPages, type StartCandidate, type StartInput } from './start'
import { navForStart } from './startNav'
import { leanOf, passedRefs, type Taste } from './taste'
import { themeFit, themeReason } from './themeRanking'
import { primaryFamily } from './tokens'
import { groupOf, traitsOf, type Trait } from './traits'
import { DENSITIES, KINDS, SECTION_TYPES, type Density, type GuideState, type Kind, type Library, type SectionType, type Starter } from './types'

export interface Direction {
  id: string
  name: string
  /** One plain line: what it is and why it works. It's what the row says under each page. */
  why: string
  /** A theme id, or a theme and its variant ('acoustic/practice'). */
  theme: string
  /** Parts swapped in from other themes (core/skins.ts swapThemeParts). */
  parts?: ThemeParts
  /** Its own layouts per section type, best first. Types it leaves out are filled the usual way. */
  layouts: Partial<Record<SectionType, string[]>>
  density?: Density
  kinds?: Kind[]
  industries?: (typeof INDUSTRIES)[number][]
  formats?: (typeof FORMATS)[number][]
  /** 0 safe, 1 a little unexpected, 2 strange. Rows show odd ones only to someone who leans that way. */
  odd?: 0 | 1 | 2
  /** Picked by a person (samples/directions, the starters) rather than put together on the spot. */
  curated: boolean
  /** A starter's id, when the direction is one. */
  starterId?: string
}

const shape = z.object({
  name: z.string().min(1).max(60),
  why: z.string().min(1).max(200),
  theme: z.string().min(1),
  parts: z.partialRecord(z.enum(STYLE_AREAS), z.string()).optional(),
  layouts: z.partialRecord(z.enum(SECTION_TYPES), z.array(z.string()).min(1).max(4)),
  density: z.enum(DENSITIES).optional(),
  kinds: z.array(z.enum(KINDS)).optional(),
  industries: z.array(z.enum(INDUSTRIES)).optional(),
  formats: z.array(z.enum(FORMATS)).optional(),
  odd: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
})

/** A direction file (samples/directions/<id>.json). Layout names may be short ("split" for "hero.layout-split"). */
export function parseDirection(id: string, json: unknown): Direction {
  const d = shape.parse(json)
  const layouts = Object.fromEntries(Object.entries(d.layouts).map(([type, ids]) => [type, ids!.map((x) => (x.includes('.') ? x : `${type}.layout-${x}`))]))
  return { id, ...d, layouts, curated: true }
}

/** A starter as a direction: its theme and its own layouts, every page's. */
export function directionFromStarter(s: Starter, lib: Library): Direction {
  const layouts: Partial<Record<SectionType, string[]>> = {}
  for (const page of s.pages)
    for (const id of page.sections) {
      const type = lib.clips[id]?.type
      if (type && !layouts[type]?.includes(id)) (layouts[type] ??= []).push(id)
    }
  return {
    id: `starter-${s.id}`,
    name: s.name,
    why: s.blurb,
    theme: s.skin,
    layouts,
    kinds: [s.kind],
    industries: s.industries as Direction['industries'],
    formats: s.formats as Direction['formats'],
    odd: 0,
    curated: true,
    starterId: s.id,
  }
}

const directions: Direction[] = []
export function registerDirections(list: Direction[]) {
  directions.splice(0, directions.length, ...list)
}
export const directionList = (): Direction[] => directions
export const directionById = (id: string): Direction | undefined => directions.find((d) => d.id === id)

/** A theme with one of the library's openers, for when the curated ones run out. Ranked below curated ones. */
export function composeDirection(skin: Skin, heroId: string, lib: Library): Direction {
  const title = lib.clips[heroId]?.title ?? 'its own opener'
  return { id: `${skin.id.replace('/', '~')}+${heroId.replace(/^hero\.layout-/, '')}`, name: `${skin.name}, ${title.toLowerCase()}`, why: skin.words, theme: skin.id, layouts: { hero: [heroId] }, curated: false }
}

/** The style guide a direction leaves: its theme (with your brand color and light or dark), then its own parts. */
export function directionGuide(d: Direction, input: Pick<StartInput, 'brand' | 'mode' | 'palette' | 'variant'> = {}): GuideState {
  const guide = guideFor({ ...input, skin: d.theme })
  if (!d.parts) return guide
  try {
    return swapThemeParts(guide, d.parts, emptyContract())
  } catch {
    return guide
  }
}

/** The sections a start lays out: yours when you changed them, else the kind's usual page. */
function typesFor(input: Pick<StartInput, 'kind' | 'sections'>) {
  const recipe = RECIPES[input.kind]
  const own = !!input.sections?.length && input.sections.join() !== recipe.home.join()
  return { home: own ? input.sections! : recipe.home, about: own ? undefined : recipe.about }
}

const prefsOf = (d: Direction) => ({ layouts: d.layouts, density: d.density })

/** Home's layouts in a direction, top to bottom. */
export function directionPage(d: Direction, types: SectionType[], lib: Library, seed = 0, variant = 0): string[] {
  return fillPage(lib, types, variant, seed, undefined, prefsOf(d))
}

/** A start in a direction: the brief's sections, its layouts, its look, your words. */
export function directionStart(d: Direction, input: StartInput, lib: Library, variant = 0): StartCandidate {
  const seed = input.seed ?? 0
  const { home, about } = typesFor(input)
  const pages = [{ path: '/', title: 'Home', sections: directionPage(d, home, lib, seed, variant) }]
  pages.push(...otherPages(input, about, lib, variant, seed, prefsOf(d)))
  const site = siteFromPages(lib, pages, `${d.id.replace(/[^a-z0-9]/gi, '')}_`)
  const content = contentFor(input)
  const placed = navForStart(site, content, lib)
  return {
    id: `dir-${d.id}`,
    label: d.name,
    from: d.starterId ? 'starter' : 'library',
    ...(d.starterId ? { starterId: d.starterId } : {}),
    site: placed.site,
    guide: directionGuide(d, input),
    content: placed.content,
    shelves: countShelves(lib, placed.site),
    direction: d.id,
  }
}

export interface RankedDirection {
  direction: Direction
  traits: Trait[]
  score: number
  /** The direction's own line, or (put together on the spot) what its look is. */
  why: string
  /** The one that tries something they haven't said anything about yet. */
  stretch?: boolean
  guide: GuideState
}

export interface RankDirectionOptions {
  input: Pick<StartInput, 'kind' | 'sections' | 'brand' | 'mode' | 'palette' | 'variant' | 'brief' | 'seed'>
  lib: Library
  taste?: Taste
  pool?: Direction[]
  count?: number
  exclude?: string[]
  /** How strange a direction may be before it costs (0–2). Leaning toward "unusual" raises it. */
  odd?: number
  /** Hold the look (a theme id) or the layouts (a direction id) and vary the other half. */
  pin?: { look?: string; layout?: string }
}

/** Weights: what the brief says about the site, then the taste. */
const W = { kind: 3, industry: 6, format: 2, lean: 2, curated: 2, odd: 10, sameOpener: 12, sameTheme: 6, sameType: 2, sameColor: 2 }

function poolFor(o: RankDirectionOptions): Direction[] {
  const base = o.pool ?? directionList()
  if (o.pin?.look) {
    const look = o.pin.look
    const seen = new Set<string>()
    return base
      .filter((d) => {
        const key = JSON.stringify(d.layouts)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((d) => ({ ...d, id: `${d.id}~${look.replace('/', '~')}`, theme: look, parts: undefined, curated: false }))
  }
  if (o.pin?.layout) {
    const from = base.find((d) => d.id === o.pin!.layout) ?? directionById(o.pin.layout)
    if (!from) return base
    return themeList()
      .filter((s) => s.id !== 'wireframe')
      .map((s) => ({ ...from, id: `${from.id}~${s.id.replace('/', '~')}`, name: `${from.name} in ${s.name}`, theme: s.id, parts: undefined, curated: false }))
  }
  return base
}

/**
 * A row of directions for this site, best first, never two alike: the brief (kind, industry, format, feel) and the
 * taste decide the order, odd ones wait until someone leans that way, and what was passed on lately stays out. Once
 * there's any taste, the last place goes to a stretch: the best one that tries something not yet said either way.
 */
export function rankDirections(o: RankDirectionOptions): RankedDirection[] {
  const { input, lib } = o
  const count = o.count ?? 3
  const brief: Brief = input.brief ?? {}
  const lean = leanOf(o.taste, brief)
  const leanTo = (t: Trait) => lean[t] ?? 0
  const oddOk = Math.max(0, Math.min(2, (o.odd ?? 1) + Math.sign(leanTo('odd') - leanTo('plain'))))
  const out = new Set([...(o.exclude ?? []), ...passedRefs(o.taste)])
  const types = typesFor(input).home

  const score = (d: Direction): (RankedDirection & { opener?: string; family: string; color: string; themeId: string }) | null => {
    const skin = skinById(d.theme)
    if (!skin || out.has(d.id)) return null
    const guide = directionGuide(d, input)
    const tokens = resolveGuide(guide).tokens
    const clipIds = directionPage(d, types, lib, input.seed ?? 0)
    const traits = traitsOf(guide, clipIds, lib, { feel: skin.feel, odd: d.odd })
    const fit =
      themeFit(skin, tokens, brief) +
      (d.kinds?.includes(input.kind) ? W.kind : 0) +
      (brief.industry && d.industries?.includes(brief.industry) ? W.industry : 0) +
      (brief.format && d.formats?.includes(brief.format) ? W.format : 0) +
      traits.reduce((n, t) => n + leanTo(t), 0) * W.lean +
      (d.curated ? W.curated : 0) -
      Math.max(0, (d.odd ?? 0) - oddOk) * W.odd
    const hero = clipIds.find((id) => lib.clips[id]?.type === 'hero')
    return {
      direction: d,
      traits,
      score: Math.round(fit * 100) / 100,
      why: d.curated ? d.why : `${skin.name}: ${themeReason(guide)}`,
      guide,
      opener: hero && heroFamily(hero, lib),
      family: primaryFamily(tokens['font.display']),
      color: tokens['color.primary'],
      themeId: skin.baseId ?? skin.id,
    }
  }

  let scored = poolFor(o).map(score).filter((x): x is NonNullable<ReturnType<typeof score>> => !!x)
  // Not enough curated ones left (most passed on): put some together from the themes and the openers.
  if (scored.length < count && !o.pin) {
    const heroes = pickable(lib, 'hero').filter((id) => lib.clips[id].origin === 'layout')
    const extra = themeList()
      .filter((s) => s.id !== 'wireframe')
      .flatMap((s, i) => [heroes[i % heroes.length], heroes[(i + 3) % heroes.length]].filter(Boolean).map((h) => composeDirection(s, h, lib)))
    scored = [...scored, ...extra.map(score).filter((x): x is NonNullable<ReturnType<typeof score>> => !!x)]
  }

  const chosen: typeof scored = []
  const penalty = (c: (typeof scored)[number]) =>
    chosen.reduce(
      (n, p) =>
        n +
        (c.opener && p.opener === c.opener ? W.sameOpener : 0) +
        (p.themeId === c.themeId ? W.sameTheme : 0) +
        (p.family === c.family ? W.sameType : 0) +
        (p.color === c.color ? W.sameColor : 0),
      0,
    )
  const byScore = (a: (typeof scored)[number], b: (typeof scored)[number]) => b.score - penalty(b) - (a.score - penalty(a)) || a.direction.id.localeCompare(b.direction.id)
  const tasted = !!o.taste?.events.length
  while (chosen.length < count) {
    const left = scored.filter((c) => !chosen.includes(c))
    if (!left.length) break
    const last = chosen.length === count - 1 && count >= 3 && tasted
    if (last) {
      const said = new Set((Object.keys(lean) as Trait[]).map(groupOf))
      const shown = new Set(chosen.flatMap((c) => c.traits))
      const stretch = left.filter((c) => c.traits.some((t) => !shown.has(t) && !said.has(groupOf(t)))).sort(byScore)[0]
      if (stretch) {
        chosen.push({ ...stretch, stretch: true })
        continue
      }
    }
    chosen.push(left.sort(byScore)[0])
  }
  return chosen.map(({ direction, traits, score, why, guide, stretch }) => ({ direction, traits, score, why, guide, ...(stretch ? { stretch } : {}) }))
}

/** A row of starts, one per direction: what the start's row of pages is made from. */
export function directionStarts(input: StartInput, lib: Library, opts: Omit<RankDirectionOptions, 'input' | 'lib'> = {}): StartCandidate[] {
  return rankDirections({ ...opts, input, lib }).map((r) => directionStart(r.direction, input, lib))
}

/** Problems with the directions: themes or parts that don't resolve, layouts that don't exist or aren't offered. */
export function checkDirections(lib: Library, pool: Direction[] = directionList()): string[] {
  const problems: string[] = []
  for (const d of pool) {
    if (!skinById(d.theme)) problems.push(`${d.id}: no theme "${d.theme}"`)
    for (const [area, part] of Object.entries(d.parts ?? {})) if (!partSource(area as never, part!)) problems.push(`${d.id}: no ${area} part "${part}"`)
    for (const [type, ids] of Object.entries(d.layouts) as [SectionType, string[]][]) {
      for (const id of ids) {
        const clip = lib.clips[id]
        if (!clip) problems.push(`${d.id}: no layout ${id}`)
        else if (clip.type !== type) problems.push(`${d.id}: ${id} is a ${clip.type}, listed under ${type}`)
        else if (!pickable(lib, type).includes(id)) problems.push(`${d.id}: ${id} isn't offered (a draft or a sample)`)
      }
    }
    if (/\bjev\b/i.test(d.why)) problems.push(`${d.id}: its line uses a code name people never see`)
  }
  return problems
}

/**
 * How unusual each layout and theme is, read off the curated directions: the least unusual one that uses it (0 safe,
 * 1 a little unexpected, 2 strange). Ones no direction uses count as safe.
 */
export function oddness(pool: Direction[] = directionList()): { layouts: Map<string, number>; themes: Map<string, number> } {
  const layouts = new Map<string, number>()
  const themes = new Map<string, number>()
  const note = (m: Map<string, number>, id: string, odd: number) => m.set(id, Math.min(m.get(id) ?? odd, odd))
  for (const d of pool) {
    const odd = d.odd ?? 0
    for (const ids of Object.values(d.layouts)) for (const id of ids ?? []) note(layouts, id, odd)
    note(themes, d.theme.split('/')[0], odd)
  }
  return { layouts, themes }
}

/** "How unusual" on Mix: 0 safe (only what conventional directions use), 1 anything (the default), 2 strange (the odd ones first). */
export const UNUSUAL = [0, 1, 2] as const
export type Unusual = (typeof UNUSUAL)[number]

/** The options Mix may land on at a setting: safe ones, any, or the unusual ones (falling back to any when there are none). */
export function byUnusual<T>(options: T[], odd: Unusual, oddOf: (o: T) => number): T[] {
  if (odd === 1) return options
  const fit = options.filter((o) => (odd === 0 ? oddOf(o) === 0 : oddOf(o) >= 1))
  return fit.length ? fit : options
}

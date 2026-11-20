// Skins: a whole look you can swap in one move, over layouts that stay the same. A skin is tokens, effects, text styles,
// block looks, section defaults and a picture style. Applying one writes into the mix's own style guide, so every mix
// keeps its own copy and everything stays tweakable; the contract says what a swap leaves alone. Pure: the files in
// samples/skins/ are loaded by data/skins.ts.

import { PART_RECIPES } from './partRecipes'
import { PAIRINGS } from './colorPairs'
import { FORMATS, INDUSTRIES, type Format, type Industry } from './brief'
import { z } from 'zod'
import type { GuideState, Library, PictureDefault, SectionDefault, SectionType, Site, TokenKey, TokenSet, VersionNode } from './types'
import { allSlots } from './site'
import { SKETCH_IDS, SKETCH_MODES } from './sketchCatalog'
import { MOCK_IDS } from './treatments/mocks'
import { SAMPLE_PHOTOS, PLACEHOLDER_STYLES, SECTION_TYPES, TOKEN_KEYS } from './types'
import { resolveGuide } from './guide'
import { BASE_TOKENS, CONTRAST_PAIRS, contrastRatio, hexToRgb, primaryFamily, TOKEN_GROUP_OF } from './tokens'
import { setTone, toneOfGuide } from './dials'
import { paletteFrom } from './palette'
import { cleanTreatment, EFFECT_IDS, isBackdropId, shadowToken, type EffectId, type EffectsState } from './treatments'
import type { TextStyleEdits } from './textStyles'
import { FEEL_WORDS, type FeelWord } from './feel'
import { emptyContract, isKept, settingOf, STYLE_AREAS, type Contract, type StyleArea } from './contract'

export interface Skin {
  id: string
  baseId?: string
  industries?: Industry[]
  formats?: Format[]
  flavors?: { id: string; name: string; industry: Industry; parts: Partial<Record<StyleArea, string>> }[]
  name: string
  /** One line a non-designer can picture. */
  words: string
  mode: 'light' | 'dark'
  /** How it feels, in the Look panel's words (`core/feel.ts`): what “warm” or “serious” brings up. */
  feel: FeelWord[]
  tokens: Partial<TokenSet>
  effects?: EffectsState
  textStyles?: TextStyleEdits
  components?: GuideState['components']
  sections?: Partial<Record<SectionType, SectionDefault>>
  picture?: PictureDefault
}

/** The skin everything starts in: plain, grey and honest about being a sketch. */
export const WIREFRAME = 'wireframe'

const shape = z.object({
  name: z.string(),
  industries: z.array(z.enum(INDUSTRIES)).optional(),
  formats: z.array(z.enum(FORMATS)).optional(),
  flavors: z
    .array(z.object({ id: z.string(), name: z.string(), industry: z.enum(INDUSTRIES), parts: z.partialRecord(z.enum(STYLE_AREAS), z.string()) }))
    .optional(),
  words: z.string().default(''),
  mode: z.enum(['light', 'dark']).default('light'),
  feel: z.array(z.enum(FEEL_WORDS)).default([]),
  tokens: z.record(z.string(), z.string()).default({}),
  effects: z
    .record(
      z.string(),
      z.object({ id: z.string().optional(), preset: z.string().optional(), params: z.record(z.string(), z.any()).optional(), seed: z.number().optional() }),
    )
    .optional(),
  textStyles: z.record(z.string(), z.any()).optional(),
  components: z.record(z.string(), z.any()).optional(),
  sections: z.record(z.string(), z.any()).optional(),
  picture: z.object({ style: z.enum(PLACEHOLDER_STYLES), mode: z.enum(SKETCH_MODES).optional(), photo: z.boolean().optional(), subjects: z.array(z.enum([...SAMPLE_PHOTOS, ...SKETCH_IDS, ...MOCK_IDS])).min(1).optional(), mockParams: z.record(z.string(), z.any()).optional(), params: z.record(z.string(), z.any()).optional() }).optional(),
})

/** A skin's file, checked: known tokens, effects, sections and backdrops only. Throws, so a bad file fails its test. */
export function parseSkin(id: string, json: unknown): Skin {
  const r = shape.parse(json)
  const bad = Object.keys(r.tokens).find((k) => !TOKEN_KEYS.includes(k as TokenKey))
  if (bad) throw new Error(`Skin ${id}: unknown token ${bad}`)
  const effects: EffectsState = {}
  for (const [k, v] of Object.entries(r.effects ?? {})) {
    if (!(EFFECT_IDS as readonly string[]).includes(k)) throw new Error(`Skin ${id}: unknown effect ${k}`)
    const clean = cleanTreatment('effect', { ...v, id: k } as never)
    if (clean) effects[k as EffectId] = clean
  }
  const sections: Skin['sections'] = {}
  for (const [type, def] of Object.entries((r.sections ?? {}) as Record<string, SectionDefault>)) {
    if (!(SECTION_TYPES as readonly string[]).includes(type)) throw new Error(`Skin ${id}: unknown section type ${type}`)
    const backdrop = def.backdrop && cleanTreatment('backdrop', def.backdrop)
    if (def.backdrop && (!backdrop || !isBackdropId(backdrop.id))) throw new Error(`Skin ${id}: unknown backdrop on ${type}`)
    sections[type as SectionType] = { ...def, ...(backdrop ? { backdrop } : {}) }
  }
  return {
    id,
    name: r.name,
    industries: r.industries,
    formats: r.formats,
    flavors: r.flavors,
    words: r.words,
    mode: r.mode,
    feel: r.feel,
    tokens: r.tokens as Partial<TokenSet>,
    ...(Object.keys(effects).length ? { effects } : {}),
    ...(r.textStyles ? { textStyles: r.textStyles as TextStyleEdits } : {}),
    ...(r.components ? { components: r.components as GuideState['components'] } : {}),
    ...(Object.keys(sections).length ? { sections } : {}),
    ...(r.picture ? { picture: r.picture as PictureDefault } : {}),
  }
}

const skins: Skin[] = []
export function registerSkins(list: Skin[]) {
  skins.splice(0, skins.length, ...list)
}
export const skinList = (): Skin[] => skins

/** Themes that were folded into others, by their old id: a mix or an agent that names one gets the theme it became. */
export const RETIRED_SKINS: Record<string, string> = {
  calm: 'studio',
  technical: 'afterhours',
  nightowl: 'afterhours',
  editorial: 'liner-notes',
  marginalia: 'liner-notes',
  friendly: 'lofi',
  puffin: 'dreampop',
  bold: 'flyer',
  monolith: 'flyer',
}
/** A theme's id today, following a retired one to the theme it became. */
export const canonicalSkinId = (id: string): string => RETIRED_SKINS[id] ?? id
export const skinById = (id: string): Skin | undefined => {
  const want = canonicalSkinId(id)
  const [base, flavor, extra] = want.split('/')
  if (extra !== undefined || flavor === '') return undefined
  const skin = skins.find((s) => s.id === base)
  if (!flavor || !skin) return skin
  const recipe = skin.flavors?.find((f) => f.id === flavor)
  if (!recipe) return undefined
  const guide = swapThemeParts(applySkin({ base: BASE_TOKENS, choices: {}, candidates: [] }, skin), recipe.parts)
  return {
    ...skin,
    components: guide.components,
    sections: guide.sections,
    textStyles: guide.textStyles,
    picture: guide.picture,
    effects: guide.effects,
    tokens: guide.base,
    id: want,
    baseId: base,
    name: recipe.name,
    industries: [recipe.industry],
    flavors: undefined,
  }
}
/** The theme a guide says it wears, by today's id and name (a mix saved in "Calm" reads "Studio"); its values stay its own. */
export function skinRefOf(ref: GuideState['skin']): GuideState['skin'] {
  if (!ref || !RETIRED_SKINS[ref.id]) return ref
  const now = skinById(ref.id)
  return now ? { ...ref, id: now.id, name: now.name } : ref
}

/** A skin's whole token set: the neutral base with its choices on top. */
export const skinTokens = (skin: Pick<Skin, 'tokens'>): TokenSet => ({ ...BASE_TOKENS, ...skin.tokens })

/** Which token pairs fail AA under these tokens, in words. Skins must read in every mode they offer. */
export function contrastFailures(t: TokenSet): string[] {
  return CONTRAST_PAIRS.flatMap(([a, b, label]) => ((contrastRatio(t[a], t[b]) ?? 0) < 4.5 ? [`${label} (${t[a]} on ${t[b]})`] : []))
}

/**
 * The guide with a skin on it, as one change. What the contract keeps stays exactly as it resolves now. Your
 * candidates and swatches stay too: a clipped section's values remain on offer, and `x:` colors keep their definition.
 */
export function applySkin(guide: GuideState, skin: Skin, contract: Contract = emptyContract()): GuideState {
  const picks = STYLE_AREAS.filter((area) => !isKept(contract, area)).map((area) => ({ area, skin }))
  return {
    ...writeParts(guide, picks, contract),
    skin: { id: skin.baseId ?? skin.id, name: skin.name, ...(skin.baseId ? { flavor: skin.id.split('/')[1] } : {}) },
  }
}

export type ThemeParts = Partial<Record<StyleArea, string>>

/** A part owns whole token groups but only its own fields in shared effects and section defaults. */
function writeParts(guide: GuideState, picks: { area: StyleArea; skin: Skin }[], contract: Contract): GuideState {
  const out = { ...guide, base: { ...guide.base }, choices: { ...guide.choices } }
  for (const { area, skin } of picks) {
    const tokens = skinTokens(skin)
    if (area === 'color' && settingOf(contract, area) === 'tweak') {
      const tone = guide.mode ?? skin.mode
      if (guide.brand) Object.assign(tokens, paletteFrom(guide.brand.color, tone, guide.brand.variant))
      else if (guide.mode) Object.assign(tokens, setTone(tokens, tone))
    }
    if (area === 'shape' && skin.effects?.shadow) tokens['shadow.card'] = shadowToken(skin.effects.shadow)
    for (const key of TOKEN_KEYS) {
      if (TOKEN_GROUP_OF[key] !== area) continue
      out.base[key] = tokens[key]
      if (guide.candidates?.some((c) => c.values[key] != null)) out.choices[key] = { kind: 'custom', value: tokens[key] }
      else delete out.choices[key]
    }
    if (area === 'shape' || area === 'looks') {
      const effects = { ...out.effects }
      for (const key of EFFECT_IDS) {
        if ((key === 'shadow') !== (area === 'shape')) continue
        if (skin.effects?.[key]) effects[key] = skin.effects[key]
        else delete effects[key]
      }
      if (Object.keys(effects).length) out.effects = effects
      else delete out.effects
    }
    if (area === 'type') out.textStyles = skin.textStyles
    if (area === 'looks') out.components = skin.components
    if (area === 'pictures') out.picture = skin.picture
    if (area === 'motion' || area === 'sections') {
      const sections = { ...out.sections }
      for (const type of SECTION_TYPES) {
        const current = sections[type] ?? {}
        const incoming = skin.sections?.[type] ?? {}
        const { motion, ...rest } = area === 'motion' ? current : incoming
        const enter = area === 'motion' ? incoming.motion : current.motion
        const next = enter ? { ...rest, motion: enter } : rest
        if (Object.keys(next).length) sections[type] = next
        else delete sections[type]
      }
      out.sections = Object.keys(sections).length ? sections : undefined
    }
  }
  for (const key of ['components', 'sections', 'effects', 'textStyles', 'picture'] as const) if (out[key] === undefined) delete out[key]
  return out
}

export const refId = (ref: GuideState['skin']) => (ref?.flavor ? `${ref.id}/${ref.flavor}` : ref?.id)
export const themeList = () => skins.flatMap((skin) => [skin, ...(skin.flavors ?? []).map((f) => skinById(`${skin.id}/${f.id}`)!)])
export function partSource(area: StyleArea, id: string): Skin | undefined {
  const recipe = PART_RECIPES.find((p) => p.area === area && p.id === id)
  if (!recipe) return skins.find((s) => s.id === id)
  const skin = skins.find((s) => s.id === recipe.from)
  if (!skin) return undefined
  return {
    ...skin,
    ...recipe.overrides,
    tokens: { ...skin.tokens, ...(recipe.overrides && 'tokens' in recipe.overrides ? recipe.overrides.tokens : {}) },
    id,
    name: recipe.name,
  }
}

export function swapThemeParts(guide: GuideState, parts: ThemeParts, contract: Contract = emptyContract()): GuideState {
  let source = guide
  const picks = Object.entries(parts).map(([key, id]) => {
    const area = key as StyleArea
    if (isKept(contract, area)) throw new Error(`The contract says Keep for ${area}.`)
    if (area === 'color') {
      const [kind, pairing, mode] = id.split('/')
      if (kind === 'brand') {
        const pair = PAIRINGS.find((p) => p.id === pairing)
        if (!guide.brand || !pair || (mode !== 'light' && mode !== 'dark')) throw new Error('Unknown brand pairing')
        const tokens = paletteFrom(guide.brand.color, mode, pair.variant)
        source = { ...guide, mode, brand: { ...guide.brand, variant: pair.variant } }
        return { area, skin: { id, name: pair.name, words: '', feel: [], mode, tokens } satisfies Skin }
      }
      source = { ...guide }
      delete source.brand
      delete source.mode
    }
    const skin = partSource(area, id)
    if (!skin) throw new Error(`Unknown theme part: ${id}`)
    return { area, skin }
  })
  return writeParts(source, picks, contract)
}

const AREA_WORD: Record<StyleArea, string> = {
  color: 'color',
  type: 'type',
  shape: 'shapes',
  space: 'spacing',
  motion: 'motion',
  looks: 'block looks',
  sections: 'sections',
  pictures: 'pictures',
}

const mix = (...parts: (string | number)[]) => {
  let h = 2166136261
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

export interface Surprise {
  guide: GuideState
  /** Which skin each rolled area came from. */
  picks: { area: StyleArea; skin: Skin }[]
  /** "Type from Liner Notes, color from Flyer." */
  words: string
}

/**
 * Surprise me: a remix, not randomness. Each area marked Surprise (or, with none marked, each one not kept) comes whole
 * from another skin, chosen by the seed. Palettes travel whole and every skin's palette passes AA (a test checks), so a
 * rolled palette stays readable. Null when nothing can change.
 */
export function surpriseMe(
  guide: GuideState,
  contract: Contract,
  seed: number,
  pool: Skin[],
  keep: readonly StyleArea[] = [],
  unusual: { odd: 0 | 1 | 2; oddOf: (id: string) => number } = { odd: 1, oddOf: () => 0 },
): Surprise | null {
  // Areas you pinned (Keep what you like) stay as they are too, apart from Rules for your agent.
  const marked = STYLE_AREAS.filter((a) => settingOf(contract, a) === 'surprise' && !keep.includes(a))
  const rolled = marked.length ? marked : STYLE_AREAS.filter((a) => !isKept(contract, a) && !keep.includes(a))
  const all = pool.filter((s) => s.id !== WIREFRAME && s.id !== guide.skin?.id)
  // How unusual: safe draws from the themes closest to this look (and no odd ones), strange from the farthest (odd first).
  const here = resolveGuide(guide).tokens
  const near = [...all].sort((a, b) => lookDistance(here, skinTokens(a)) - lookDistance(here, skinTokens(b)))
  const half = Math.max(1, Math.ceil(near.length / 2))
  const safe = near.filter((s) => unusual.oddOf(s.id) === 0).slice(0, half)
  const odd = all.filter((s) => unusual.oddOf(s.id) >= 1)
  const others = unusual.odd === 0 ? (safe.length ? safe : near.slice(0, half)) : unusual.odd === 2 ? [...odd, ...near.slice(-half).filter((s) => !odd.includes(s))] : all
  if (!rolled.length || !others.length) return null
  const picks = rolled.map((area, i) => ({ area, skin: others[mix(seed, area, i) % others.length] }))
  const name = `Mix of ${[...new Set(picks.map((p) => p.skin.name))].join(', ')}`
  const words = `${picks.map((p, i) => `${i ? AREA_WORD[p.area] : AREA_WORD[p.area].replace(/^./, (c) => c.toUpperCase())} from ${p.skin.name}`).join(', ')}.`
  return { guide: { ...writeParts(guide, picks, contract), skin: { id: 'remix', name } }, picks, words }
}

/** A guide that came from no skin (your own values), so a mix made with one isn't taken for one saved before skins. */
export const OWN_LOOK = { id: 'own', name: 'Your own' }

const rgbDistance = (a: string, b: string) => {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return 0.5
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) / 441.67
}
const family = (stack: string) => primaryFamily(stack).toLowerCase()

/** How far a skin's look is from these values: a small number is close. Light or dark and the main color count most. */
export function lookDistance(t: TokenSet, s: TokenSet): number {
  const number = (v: string) => parseFloat(v) || 0
  return (
    (toneOfGuide(t) === toneOfGuide(s) ? 0 : 100) +
    rgbDistance(t['color.primary'], s['color.primary']) * 40 +
    rgbDistance(t['color.bg'], s['color.bg']) * 10 +
    (family(t['font.display']) === family(s['font.display']) ? 0 : 20) +
    (family(t['font.body']) === family(s['font.body']) ? 0 : 8) +
    Math.min(10, Math.abs(number(t['radius.base']) - number(s['radius.base'])) / 2) +
    Math.abs(number(t['type.displayWeight']) - number(s['type.displayWeight'])) / 100 +
    Math.abs(number(t['stroke.width']) - number(s['stroke.width'])) * 3
  )
}

/** The skin closest to these values. Wireframe only for a mix that was already plain greys: it's a choice, not a default. */
export function closestSkin(tokens: TokenSet, pool: Skin[]): Skin | null {
  const grey = (s: Skin) => (['color.bg', 'color.primary', 'color.text'] as const).every((k) => s.tokens[k] === tokens[k])
  const open = pool.filter((s) => s.id !== WIREFRAME || grey(s))
  if (open.some((s) => s.id === WIREFRAME)) return open.find((s) => s.id === WIREFRAME)!
  return open.reduce<Skin | null>((best, s) => (!best || lookDistance(tokens, skinTokens(s)) < lookDistance(tokens, skinTokens(best)) ? s : best), null)
}

/**
 * Dress a mix saved before skins, now its layouts are bare. Everything it already chose stays, its colors and fonts above
 * all; only what it never had comes from the closest skin: block looks, section defaults and pictures. Pure and
 * repeatable, so a version and the mix it came from dress alike. A shadow effect would change its card shadow, so that's left.
 */
export function dressOldGuide(guide: GuideState, pool: Skin[]): GuideState {
  const skin = closestSkin(resolveGuide(guide).tokens, pool)
  if (!skin) return guide
  const { shadow: _shadow, ...effects } = skin.effects ?? {}
  const out: GuideState = {
    ...guide,
    effects: guide.effects ?? (Object.keys(effects).length ? effects : undefined),
    textStyles: guide.textStyles ?? skin.textStyles,
    components: skin.components || guide.components ? { ...skin.components, ...guide.components } : undefined,
    sections: guide.sections ?? skin.sections,
    picture: guide.picture ?? skin.picture,
    skin: { id: skin.id, name: skin.name },
  }
  for (const k of ['effects', 'textStyles', 'components', 'sections', 'picture'] as const) if (out[k] === undefined) delete out[k]
  return out
}

/**
 * A mix as it opens: one saved before skins, with built-in layouts, gets dressed, versions too. One with none yet is only
 * marked as your own look, so it isn't dressed later for having no skin. Anything that has a skin is left exactly as it is.
 */
export function dressSavedMix<M extends { guide: GuideState; site: Site; versions?: Record<string, VersionNode> }>(
  mix: M,
  lib: Pick<Library, 'clips'>,
  pool: Skin[],
): M {
  const dressed = (guide: GuideState, site: Site): GuideState => {
    if (guide.skin) return guide
    return allSlots(site).some((s) => lib.clips[s.clipId]?.origin === 'layout') ? dressOldGuide(guide, pool) : { ...guide, skin: OWN_LOOK }
  }
  const versions =
    mix.versions &&
    Object.fromEntries(
      Object.entries(mix.versions).map(([id, v]) => [
        id,
        v.snapshot?.guide && !v.snapshot.guide.skin ? { ...v, snapshot: { ...v.snapshot, guide: dressed(v.snapshot.guide, v.snapshot.site) } } : v,
      ]),
    )
  return { ...mix, guide: dressed(mix.guide, mix.site), ...(versions ? { versions } : {}) }
}

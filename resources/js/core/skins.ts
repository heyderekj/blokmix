// Skins: a whole look you can swap in one move, over layouts that stay the same. A skin is tokens, effects, text styles,
// block looks, section defaults and a picture style. Applying one writes into the mix's own style guide, so every mix
// keeps its own copy and everything stays tweakable; the contract says what a swap leaves alone. Pure: the files in
// samples/skins/ are loaded by data/skins.ts.

import { z } from 'zod'
import type { GuideState, Library, PictureDefault, SectionDefault, SectionType, Site, TokenKey, TokenSet, VersionNode } from './types'
import { allSlots } from './site'
import { PLACEHOLDER_STYLES, SECTION_TYPES, TOKEN_KEYS } from './types'
import { resolveGuide } from './guide'
import { BASE_TOKENS, CONTRAST_PAIRS, contrastRatio, hexToRgb, primaryFamily, TOKEN_GROUP_OF } from './tokens'
import { toneOfGuide } from './dials'
import { cleanTreatment, EFFECT_IDS, isBackdropId, shadowToken, type EffectId, type EffectsState } from './treatments'
import type { TextStyleEdits } from './textStyles'
import { emptyContract, isKept, settingOf, STYLE_AREAS, type Contract, type StyleArea } from './contract'

export interface Skin {
  id: string
  name: string
  /** One line a non-designer can picture. */
  words: string
  /** Free skins work on any plan; the rest come with a mix pack. */
  tier: 'free' | 'pack'
  mode: 'light' | 'dark'
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
  words: z.string().default(''),
  tier: z.enum(['free', 'pack']).default('pack'),
  mode: z.enum(['light', 'dark']).default('light'),
  tokens: z.record(z.string(), z.string()).default({}),
  effects: z.record(z.string(), z.object({ id: z.string().optional(), preset: z.string().optional(), params: z.record(z.string(), z.any()).optional(), seed: z.number().optional() })).optional(),
  textStyles: z.record(z.string(), z.any()).optional(),
  components: z.record(z.string(), z.any()).optional(),
  sections: z.record(z.string(), z.any()).optional(),
  picture: z.object({ style: z.enum(PLACEHOLDER_STYLES), params: z.record(z.string(), z.any()).optional() }).optional(),
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
    words: r.words,
    tier: r.tier,
    mode: r.mode,
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
export const skinById = (id: string): Skin | undefined => skins.find((s) => s.id === id)

/** Whether this mix's plan opens a skin (`library.paid` follows the mix's owner). */
export const skinOpen = (lib: { paid?: boolean }, skin: Pick<Skin, 'tier'>) => lib.paid !== false || skin.tier === 'free'

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
  const now = resolveGuide(guide).tokens
  const next = skinTokens(skin)
  // The skin's shadow effect is its card shadow, the way setEffects keeps them in step.
  if (skin.effects?.shadow) next['shadow.card'] = shadowToken(skin.effects.shadow)
  const base = { ...next }
  const choices: GuideState['choices'] = {}
  for (const key of TOKEN_KEYS) {
    if (isKept(contract, TOKEN_GROUP_OF[key])) {
      base[key] = now[key]
      choices[key] = { kind: 'custom', value: now[key] }
    } else if ((guide.candidates ?? []).some((c) => c.values[key] != null)) {
      // A candidate beats the base when nothing's chosen, so the skin has to say it out loud.
      choices[key] = { kind: 'custom', value: next[key] }
    }
  }
  const looksKept = isKept(contract, 'looks')
  const out: GuideState = {
    ...guide,
    base,
    candidates: guide.candidates ?? [],
    choices,
    effects: looksKept ? guide.effects : skin.effects,
    textStyles: looksKept ? guide.textStyles : skin.textStyles,
    components: looksKept ? guide.components : skin.components,
    sections: isKept(contract, 'sections') ? guide.sections : skin.sections,
    picture: isKept(contract, 'pictures') ? guide.picture : skin.picture,
    skin: { id: skin.id, name: skin.name },
  }
  // Unset fields stay out of the saved mix.
  for (const k of ['effects', 'textStyles', 'components', 'sections', 'picture'] as const) if (out[k] === undefined) delete out[k]
  return out
}

const AREA_WORD: Record<StyleArea, string> = { color: 'color', type: 'type', shape: 'shapes', space: 'spacing', motion: 'motion', looks: 'block looks', sections: 'sections', pictures: 'pictures' }

const mix = (...parts: (string | number)[]) => {
  let h = 2166136261
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

export interface Surprise {
  guide: GuideState
  /** Which skin each rolled area came from. */
  picks: { area: StyleArea; skin: Skin }[]
  /** "Type from Editorial, color from Monolith." */
  words: string
}

/**
 * Surprise me: a remix, not randomness. Each area marked Surprise (or, with none marked, each one not kept) comes whole
 * from another skin, chosen by the seed. Palettes travel whole and every skin's palette passes AA (a test checks), so a
 * rolled palette stays readable. Null when nothing can change.
 */
export function surpriseMe(guide: GuideState, contract: Contract, seed: number, pool: Skin[]): Surprise | null {
  const marked = STYLE_AREAS.filter((a) => settingOf(contract, a) === 'surprise')
  const rolled = marked.length ? marked : STYLE_AREAS.filter((a) => !isKept(contract, a))
  const others = pool.filter((s) => s.id !== WIREFRAME && s.id !== guide.skin?.id)
  if (!rolled.length || !others.length) return null
  const picks = rolled.map((area, i) => ({ area, skin: others[mix(seed, area, i) % others.length] }))
  const pickFor = (a: StyleArea) => picks.find((p) => p.area === a)?.skin

  const now = resolveGuide(guide).tokens
  const tokens = { ...now }
  for (const key of TOKEN_KEYS) {
    const from = pickFor(TOKEN_GROUP_OF[key])
    if (from) tokens[key] = skinTokens(from)[key]
  }
  const remix: Skin = {
    id: 'remix',
    name: `Mix of ${[...new Set(picks.map((p) => p.skin.name))].join(', ')}`,
    words: '',
    tier: 'pack',
    mode: 'light',
    tokens,
    effects: pickFor('looks') ? pickFor('looks')!.effects : guide.effects,
    textStyles: pickFor('looks') ? pickFor('looks')!.textStyles : guide.textStyles,
    components: pickFor('looks') ? pickFor('looks')!.components : guide.components,
    sections: pickFor('sections') ? pickFor('sections')!.sections : guide.sections,
    picture: pickFor('pictures') ? pickFor('pictures')!.picture : guide.picture,
  }
  // Everything that didn't roll keeps its exact value, candidates and all.
  const hold: Contract = { areas: Object.fromEntries(STYLE_AREAS.filter((a) => !rolled.includes(a)).map((a) => [a, 'keep'])), keep: [], surprise: [] }
  const words = `${picks.map((p, i) => `${i ? AREA_WORD[p.area] : AREA_WORD[p.area].replace(/^./, (c) => c.toUpperCase())} from ${p.skin.name}`).join(', ')}.`
  return { guide: applySkin(guide, remix, hold), picks, words }
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
function lookDistance(t: TokenSet, s: TokenSet): number {
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
export function dressSavedMix<M extends { guide: GuideState; site: Site; versions?: Record<string, VersionNode> }>(mix: M, lib: Pick<Library, 'clips'>, pool: Skin[]): M {
  const dressed = (guide: GuideState, site: Site): GuideState => {
    if (guide.skin) return guide
    return allSlots(site).some((s) => lib.clips[s.clipId]?.origin === 'layout') ? dressOldGuide(guide, pool) : { ...guide, skin: OWN_LOOK }
  }
  const versions = mix.versions && Object.fromEntries(Object.entries(mix.versions).map(([id, v]) => [id, v.snapshot?.guide && !v.snapshot.guide.skin ? { ...v, snapshot: { ...v.snapshot, guide: dressed(v.snapshot.guide, v.snapshot.site) } } : v]))
  return { ...mix, guide: dressed(mix.guide, mix.site), ...(versions ? { versions } : {}) }
}

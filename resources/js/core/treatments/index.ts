// Treatments: the visual layer that makes a design yours. Effects in the style
// guide, backdrops behind sections, generative pictures and UI mockups in image
// blocks, each a set of dials (params.ts) with presets, drawn from your palette.
// Live ones (shaders.ts) run as WebGL behind sections and in image blocks.

import { z } from 'zod'
import { EFFECTS, EFFECT_IDS, isEffectId, type EffectsState } from './effects'
import { BACKDROP_IDS, backdropInfo, backdropParams } from './backdrops'
import { FILLS, FILL_IDS } from './fills'
import { SHADERS, SHADER_IDS } from './shaders'
import { MOCK_IDS, MOCK_PARAMS, MOCK_PRESETS, mockSource } from './mocks'
import { clampParams, type ParamSpecs, type Preset, type TreatmentValue } from './params'

export * from './params'
export { EFFECTS, EFFECT_IDS, effectsVars, shadowToken, isEffectId, type EffectId, type EffectsState } from './effects'
export { BACKDROPS, BACKDROP_IDS, CSS_BACKDROP_IDS, backdropCss, backdropDecls, backdropInfo, backdropParams, backdropShaderId, isBackdropId, type BackdropId } from './backdrops'
export { SHADERS, SHADER_IDS, isShaderId, shaderColors, shaderFrame, shaderSpec, type ShaderId, type ShaderSpec } from './shaders'
export { FILLS, FILL_IDS, fillSvg, isFillId, type FillId } from './fills'
export { MOCK_IDS, MOCK_PARAMS, MOCK_PRESETS, MOCK_BASE_CSS, mockRender, mockSource, mockSources, isMockId, registerMocks, type MockId, type MockSource } from './mocks'

export type Surface = 'effect' | 'backdrop' | 'fill' | 'mock'

export interface TreatmentInfo {
  id: string
  surface: Surface
  label: string
  hint: string
  params: ParamSpecs
  presets: Preset[]
  /** A live WebGL shader: it moves, and exports ship /mx-shaders.js with a poster. */
  live?: boolean
}

/** Every treatment, for the dial panels and for agents (list_treatments). */
export function treatmentList(surface?: Surface): TreatmentInfo[] {
  const all: TreatmentInfo[] = [
    ...EFFECT_IDS.map((id) => ({ id, surface: 'effect' as const, label: EFFECTS[id].label, hint: EFFECTS[id].hint, params: EFFECTS[id].params, presets: EFFECTS[id].presets })),
    ...BACKDROP_IDS.map((id) => {
      const b = backdropInfo(id)
      return { id, surface: 'backdrop' as const, label: b.label, hint: b.hint, params: backdropParams(id), presets: b.presets, ...(b.live ? { live: true } : {}) }
    }),
    ...FILL_IDS.map((id) => ({ id, surface: 'fill' as const, label: FILLS[id].label, hint: FILLS[id].hint, params: FILLS[id].params, presets: FILLS[id].presets })),
    ...SHADER_IDS.map((id) => ({ id, surface: 'fill' as const, label: SHADERS[id].label, hint: SHADERS[id].hint, params: SHADERS[id].params, presets: SHADERS[id].presets, live: true })),
    ...MOCK_IDS.map((id) => ({ id, surface: 'mock' as const, label: mockSource(id)?.label ?? id, hint: mockSource(id)?.hint ?? '', params: MOCK_PARAMS, presets: MOCK_PRESETS })),
  ]
  return surface ? all.filter((t) => t.surface === surface) : all
}

export function treatmentInfo(surface: Surface, id: string): TreatmentInfo | undefined {
  return treatmentList(surface).find((t) => t.id === id)
}

/** A treatment's value with its dials checked: unknown dials dropped, out-of-range ones clamped. */
export function cleanTreatment(surface: Surface, v: TreatmentValue): TreatmentValue | null {
  const info = treatmentInfo(surface, v.id)
  if (!info) return null
  const all = clampParams(info.params, v.params)
  const params = Object.fromEntries(Object.entries(all).filter(([k]) => v.params && k in v.params))
  return { id: v.id, ...(Object.keys(params).length ? { params } : {}), ...(v.seed !== undefined ? { seed: v.seed } : {}), ...(v.preset ? { preset: v.preset } : {}) }
}

/** A curated set of effects that work together (samples/treatments/*.json): the Effects shelf. */
export interface Look {
  id: string
  label: string
  hint: string
  effects: EffectsState
}

const looks: Look[] = []
export function registerLooks(list: Look[]) {
  looks.splice(0, looks.length, ...list)
}
export function lookList(): Look[] {
  return looks
}

/** A look's file, checked: only known effects with clean dials. */
export function parseLook(id: string, json: unknown): Look | null {
  const shape = z.object({ label: z.string(), hint: z.string().default(''), effects: z.record(z.string(), z.object({ id: z.string(), params: z.record(z.string(), z.any()).optional(), seed: z.number().optional() })) })
  const r = shape.safeParse(json)
  if (!r.success) return null
  const effects: EffectsState = {}
  for (const [k, v] of Object.entries(r.data.effects)) {
    if (!isEffectId(k)) continue
    const clean = cleanTreatment('effect', { ...v, id: k })
    if (clean) effects[k] = clean
  }
  return { id, label: r.data.label, hint: r.data.hint, effects }
}

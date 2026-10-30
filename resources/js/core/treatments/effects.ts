// Style guide effects: shadow, gradient, grain, glass and glow, as CSS variables
// every section and block look can use (--mx-shadow-*, --mx-gradient, --mx-grain,
// --mx-glass-*, --mx-glow). Colors are palette roles, so they re-theme live.

import type { CssVars, TokenSet } from '../types'
import { clampParams, cssColor, hexColor, n2, tint, type ParamSpecs, type ParamValues, type Preset, type TreatmentValue } from './params'
import { grainSvg, svgUrl } from './noise'

export const EFFECT_IDS = ['shadow', 'gradient', 'grain', 'glass', 'glow'] as const
export type EffectId = (typeof EFFECT_IDS)[number]

export interface Effect {
  id: EffectId
  label: string
  hint: string
  params: ParamSpecs
  presets: Preset[]
  vars: (p: ParamValues, tokens: TokenSet) => CssVars
}

const ANGLE = { kind: 'slider', label: 'Light from', min: 0, max: 360, step: 5, unit: '°', default: 180 } as const

/** Smooth, layered shadows: each layer twice the last, so depth reads as one soft falloff. */
export function layeredShadow(p: ParamValues, scale = 1): string {
  const elev = (p.elevation as number) * scale
  if (elev <= 0) return 'none'
  const layers = p.layers as number
  const rad = (((p.angle as number) - 90) * Math.PI) / 180
  // Light from above (180°) throws the shadow down.
  const dx = -Math.cos(rad)
  const dy = -Math.sin(rad)
  const total = p.opacity as number
  const out: string[] = []
  for (let i = 1; i <= layers; i++) {
    const d = (elev * 2 ** i) / 2 ** layers
    const blur = d * (1 + (p.softness as number) / 50)
    const spread = (-(p.tighten as number) / 100) * d
    out.push(`${n2(dx * d)}px ${n2(dy * d)}px ${n2(blur)}px ${n2(spread)}px ${tint(p.tint as string, total / layers)}`)
  }
  return out.join(', ')
}

export const EFFECTS: Record<EffectId, Effect> = {
  shadow: {
    id: 'shadow',
    label: 'Shadow',
    hint: 'How cards and raised things lift off the page',
    params: {
      elevation: { kind: 'slider', label: 'Elevation', min: 0, max: 48, unit: 'px', default: 16 },
      softness: { kind: 'slider', label: 'Softness', min: 0, max: 100, unit: '%', default: 60 },
      layers: { kind: 'slider', label: 'Layers', min: 1, max: 6, default: 4 },
      opacity: { kind: 'slider', label: 'Strength', min: 0, max: 60, unit: '%', default: 18 },
      tighten: { kind: 'slider', label: 'Tighten', min: 0, max: 60, unit: '%', default: 20 },
      angle: ANGLE,
      tint: { kind: 'color', label: 'Tint', default: 'text' },
    },
    presets: [
      { id: 'hairline', label: 'Hairline', values: { elevation: 3, softness: 20, layers: 2, opacity: 14, tighten: 0 } },
      { id: 'soft', label: 'Soft', values: { elevation: 16, softness: 60, layers: 4, opacity: 18, tighten: 20 } },
      { id: 'floating', label: 'Floating', values: { elevation: 36, softness: 90, layers: 5, opacity: 24, tighten: 35 } },
      { id: 'colored', label: 'Colored', values: { elevation: 22, softness: 70, layers: 4, opacity: 34, tighten: 30, tint: 'primary' } },
      { id: 'flat', label: 'Flat', values: { elevation: 0 } },
    ],
    vars: (p) => ({
      '--mx-shadow-sm': layeredShadow(p, 0.35),
      '--mx-shadow-card': layeredShadow(p),
      '--mx-shadow-lg': layeredShadow(p, 2.2),
    }),
  },
  gradient: {
    id: 'gradient',
    label: 'Gradient',
    hint: 'The page’s one gradient: gradient buttons, headings and backdrops use it',
    params: {
      shape: {
        kind: 'choice',
        label: 'Shape',
        options: [
          { id: 'linear', label: 'Linear' },
          { id: 'radial', label: 'Radial' },
          { id: 'conic', label: 'Conic' },
        ],
        default: 'linear',
      },
      angle: { kind: 'slider', label: 'Angle', min: 0, max: 360, step: 5, unit: '°', default: 120 },
      stops: { kind: 'stops', label: 'Colors', min: 2, max: 5, default: ['primary', 'accent'] },
      smooth: { kind: 'toggle', label: 'Blend in oklab', default: true },
    },
    presets: [
      { id: 'brand', label: 'Brand', values: { stops: ['primary', 'accent'], angle: 120 } },
      { id: 'sunrise', label: 'Sunrise', values: { stops: ['accent', 'primary', 'text'], angle: 160 } },
      { id: 'halo', label: 'Halo', values: { shape: 'radial', stops: ['accent', 'primary'] } },
      { id: 'prism', label: 'Prism', values: { shape: 'conic', stops: ['primary', 'accent', 'surface', 'primary'], angle: 90 } },
      { id: 'quiet', label: 'Quiet', values: { stops: ['surface', 'bg'], angle: 180 } },
    ],
    vars: (p) => ({ '--mx-gradient': gradientCss(p) }),
  },
  grain: {
    id: 'grain',
    label: 'Grain',
    hint: 'A film-grain texture that grain looks and backdrops lay over color',
    params: {
      amount: { kind: 'slider', label: 'Amount', min: 0, max: 60, unit: '%', default: 18 },
      size: { kind: 'slider', label: 'Size', min: 0.5, max: 3, step: 0.1, default: 1 },
      color: { kind: 'color', label: 'Color', default: 'text' },
    },
    presets: [
      { id: 'fine', label: 'Fine', values: { amount: 12, size: 0.7 } },
      { id: 'film', label: 'Film', values: { amount: 22, size: 1.1 } },
      { id: 'riso', label: 'Riso', values: { amount: 38, size: 1.8, color: 'primary' } },
    ],
    vars: (p, tokens) => ({
      '--mx-grain': svgUrl(grainSvg(hexColor(p.color as string, tokens), { amount: p.amount as number, size: p.size as number })),
    }),
  },
  glass: {
    id: 'glass',
    label: 'Glass',
    hint: 'Frosted panels: the glass card look and glass backdrops',
    params: {
      blur: { kind: 'slider', label: 'Blur', min: 0, max: 40, unit: 'px', default: 16 },
      fill: { kind: 'slider', label: 'Fill', min: 0, max: 95, unit: '%', default: 62 },
      saturate: { kind: 'slider', label: 'Saturate', min: 100, max: 220, step: 5, unit: '%', default: 140 },
      edge: { kind: 'slider', label: 'Edge light', min: 0, max: 100, unit: '%', default: 70 },
      tint: { kind: 'color', label: 'Tint', default: 'bg' },
    },
    presets: [
      { id: 'frost', label: 'Frost', values: { blur: 16, fill: 62, edge: 70 } },
      { id: 'clear', label: 'Clear', values: { blur: 8, fill: 24, edge: 50, saturate: 180 } },
      { id: 'milk', label: 'Milk', values: { blur: 28, fill: 82, edge: 30 } },
      { id: 'tinted', label: 'Tinted', values: { blur: 20, fill: 40, tint: 'primary', edge: 40 } },
    ],
    vars: (p) => ({
      '--mx-glass-fill': tint(p.tint as string, p.fill as number),
      '--mx-glass-blur': `blur(${p.blur}px) saturate(${p.saturate}%)`,
      '--mx-glass-edge': tint('bg', p.edge as number),
    }),
  },
  glow: {
    id: 'glow',
    label: 'Glow',
    hint: 'A colored halo for things that should shine (the glow hover and glow backdrops)',
    params: {
      color: { kind: 'color', label: 'Color', default: 'accent' },
      size: { kind: 'slider', label: 'Size', min: 0, max: 80, unit: 'px', default: 28 },
      strength: { kind: 'slider', label: 'Strength', min: 0, max: 100, unit: '%', default: 45 },
    },
    presets: [
      { id: 'ember', label: 'Ember', values: { color: 'accent', size: 28, strength: 45 } },
      { id: 'neon', label: 'Neon', values: { color: 'primary', size: 18, strength: 85 } },
      { id: 'aura', label: 'Aura', values: { color: 'accent', size: 70, strength: 30 } },
    ],
    vars: (p) => ({ '--mx-glow': `0 0 ${p.size}px ${n2((p.size as number) / 8)}px ${tint(p.color as string, p.strength as number)}` }),
  },
}

/** A gradient from the gradient dials. */
export function gradientCss(p: ParamValues): string {
  const stops = (p.stops as string[]).map(cssColor).join(', ')
  const space = p.smooth ? 'in oklab ' : ''
  if (p.shape === 'radial') return `radial-gradient(${space}circle at 30% 20%, ${stops})`
  if (p.shape === 'conic') return `conic-gradient(${space}from ${p.angle}deg at 50% 50%, ${stops})`
  return `linear-gradient(${space}${p.angle}deg, ${stops})`
}

export type EffectsState = Partial<Record<EffectId, TreatmentValue>>

/** The variables the effects you set add to the page (none for effects you haven't set). */
export function effectsVars(effects: EffectsState | undefined, tokens: TokenSet): CssVars {
  if (!effects) return {}
  const out: CssVars = {}
  for (const id of EFFECT_IDS) {
    const v = effects[id]
    if (!v) continue
    const e = EFFECTS[id]
    Object.assign(out, e.vars(clampParams(e.params, v.params), tokens))
  }
  return out
}

/** The shadow effect as the style guide's card shadow token. */
export function shadowToken(v: TreatmentValue): string {
  return layeredShadow(clampParams(EFFECTS.shadow.params, v.params))
}

export function isEffectId(id: string): id is EffectId {
  return (EFFECT_IDS as readonly string[]).includes(id)
}

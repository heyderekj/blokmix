// Live WebGL treatments (Paper Shaders, Apache-2.0): a mesh gradient, grain
// flow, dithering, liquid metal, fluted glass and god rays, behind a section or
// in an image block. Like every treatment they're dials (params.ts) drawn from
// your palette; here the dials become the shader's uniforms. Frames and exports
// run them with the same small runtime (/mx-shaders.js) over a baked poster,
// which is what reduced motion and browsers without WebGL see.

import { DitheringShapes, DitheringTypes, GlassDistortionShapes, GlassGridShapes, GrainGradientShapes, LiquidMetalShapes, ShaderFitOptions, getShaderColorFromString } from '@paper-design/shaders'
import type { PlaceholderStyle, TokenSet } from '../types'
import { clampParams, hexColor, type ColorValue, type ParamSpecs, type ParamValues, type Preset } from './params'

export const SHADER_IDS = ['mesh-gradient', 'grain-flow', 'dithering', 'liquid-metal', 'fluted-glass', 'god-rays'] as const
export type ShaderId = (typeof SHADER_IDS)[number]

export type Uniform = number | boolean | number[] | number[][]

/**
 * A shader ready to run: which one, its uniforms (colors already resolved from
 * the palette), how fast it moves and where in its loop it starts. `image` is a
 * picture for shaders that look through something (fluted glass), as an SVG data URI.
 */
export interface ShaderSpec {
  id: ShaderId
  u: Record<string, Uniform>
  speed: number
  frame: number
  image?: string
}

export interface Shader {
  id: ShaderId
  label: string
  hint: string
  params: ParamSpecs
  presets: Preset[]
  uniforms: (p: ParamValues, tokens: TokenSet) => Record<string, Uniform>
  /** Fluted glass looks through a picture: one of the palette placeholders. */
  image?: (p: ParamValues) => PlaceholderStyle
  /** Shaders that read Paper's noise texture (the runtime loads it). */
  noise?: boolean
}

const color = (label: string, d: ColorValue) => ({ kind: 'color', label, default: d }) as const
const unit = (label: string, d: number) => ({ kind: 'slider', label, min: 0, max: 1, step: 0.01, default: d }) as const
const speed = (d: number) => ({ kind: 'slider', label: 'Speed', min: 0, max: 2, step: 0.05, default: d }) as const
const scale = (d: number) => ({ kind: 'slider', label: 'Zoom', min: 0.2, max: 3, step: 0.05, default: d }) as const
const choice = <T extends string>(label: string, ids: readonly T[], labels: Record<T, string>, d: T) =>
  ({ kind: 'choice', label, options: ids.map((id) => ({ id, label: labels[id] })), default: d }) as const

/** A color as the shader takes it: 0–1 RGBA, rounded so it stays short in markup. */
function rgba(v: ColorValue, tokens: TokenSet): number[] {
  return getShaderColorFromString(hexColor(v, tokens)).map((x) => Math.round(x * 1000) / 1000)
}

/** The sizing uniforms every shader takes; sections and blocks are covered edge to edge. */
function sizing(p: ParamValues, over: { scale?: number; offsetY?: number; rotation?: number } = {}): Record<string, Uniform> {
  return {
    u_fit: ShaderFitOptions.cover,
    u_scale: over.scale ?? (typeof p.scale === 'number' ? p.scale : 1),
    u_rotation: over.rotation ?? (typeof p.rotation === 'number' ? p.rotation : 0),
    u_offsetX: 0,
    u_offsetY: over.offsetY ?? 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
  }
}

const GRAIN_SHAPES = Object.keys(GrainGradientShapes) as (keyof typeof GrainGradientShapes)[]
const DITHER_SHAPES = Object.keys(DitheringShapes) as (keyof typeof DitheringShapes)[]
const DITHER_TYPES = Object.keys(DitheringTypes) as (keyof typeof DitheringTypes)[]
const METAL_SHAPES = Object.keys(LiquidMetalShapes) as (keyof typeof LiquidMetalShapes)[]
const GLASS_GRIDS = Object.keys(GlassGridShapes) as (keyof typeof GlassGridShapes)[]
const GLASS_SHAPES = Object.keys(GlassDistortionShapes) as (keyof typeof GlassDistortionShapes)[]
const BEHIND_GLASS = ['mesh', 'waves', 'shapes', 'arch'] as const

export const SHADERS: Record<ShaderId, Shader> = {
  'mesh-gradient': {
    id: 'mesh-gradient',
    label: 'Mesh gradient',
    hint: 'Color spots drifting and melting into each other',
    params: {
      colors: { kind: 'stops', label: 'Colors', min: 2, max: 6, default: ['primary', 'accent', 'surface', 'bg'] },
      distortion: unit('Distortion', 0.8),
      swirl: unit('Swirl', 0.1),
      grain: unit('Grain', 0),
      scale: scale(1),
      speed: speed(0.5),
    },
    presets: [
      { id: 'drift', label: 'Drift', values: { colors: ['primary', 'accent', 'surface', 'bg'], distortion: 0.8, swirl: 0.1, speed: 0.5 } },
      { id: 'lava', label: 'Lava', values: { colors: ['primary', 'accent', 'text'], distortion: 1, swirl: 0.6, speed: 0.8 } },
      { id: 'mist', label: 'Mist', values: { colors: ['bg', 'surface', 'accent'], distortion: 0.5, swirl: 0.2, grain: 0.25, speed: 0.25 } },
    ],
    uniforms: (p, t) => {
      const colors = (p.colors as string[]).map((c) => rgba(c, t))
      return { u_colors: colors, u_colorsCount: colors.length, u_distortion: p.distortion as number, u_swirl: p.swirl as number, u_grainMixer: p.grain as number, u_grainOverlay: (p.grain as number) / 2, ...sizing(p) }
    },
  },
  'grain-flow': {
    id: 'grain-flow',
    label: 'Grain flow',
    hint: 'A grainy gradient that moves, in seven forms',
    params: {
      back: color('Behind', 'bg'),
      colors: { kind: 'stops', label: 'Colors', min: 1, max: 7, default: ['primary', 'accent', 'surface'] },
      shape: choice('Form', GRAIN_SHAPES, { wave: 'Wave', dots: 'Dots', truchet: 'Truchet', corners: 'Corners', ripple: 'Ripple', blob: 'Blob', sphere: 'Sphere' }, 'corners'),
      softness: unit('Softness', 0.5),
      intensity: unit('Intensity', 0.5),
      noise: unit('Grain', 0.25),
      scale: scale(1),
      speed: speed(0.6),
    },
    presets: [
      { id: 'corners', label: 'Corners', values: { shape: 'corners', colors: ['primary', 'accent', 'surface'] } },
      { id: 'blob', label: 'Blob', values: { shape: 'blob', back: 'text', colors: ['primary', 'accent'], noise: 0.4 } },
      { id: 'ripple', label: 'Ripple', values: { shape: 'ripple', back: 'surface', colors: ['primary', 'bg'], softness: 0.8, intensity: 0.3 } },
    ],
    uniforms: (p, t) => {
      const colors = (p.colors as string[]).map((c) => rgba(c, t))
      return {
        u_colorBack: rgba(p.back as string, t),
        u_colors: colors,
        u_colorsCount: colors.length,
        u_softness: p.softness as number,
        u_intensity: p.intensity as number,
        u_noise: p.noise as number,
        u_shape: GrainGradientShapes[p.shape as keyof typeof GrainGradientShapes],
        ...sizing(p),
      }
    },
    noise: true,
  },
  dithering: {
    id: 'dithering',
    label: 'Dithering',
    hint: 'Two colors dithered over a moving pattern, like an old screen',
    params: {
      back: color('Paper', 'bg'),
      front: color('Ink', 'primary'),
      shape: choice('Pattern', DITHER_SHAPES, { simplex: 'Noise', warp: 'Warp', dots: 'Dots', wave: 'Wave', ripple: 'Ripple', swirl: 'Swirl', sphere: 'Sphere' }, 'warp'),
      type: choice('Dither', DITHER_TYPES, { random: 'Random', '2x2': '2×2', '4x4': '4×4', '8x8': '8×8' }, '4x4'),
      pixel: { kind: 'slider', label: 'Pixel', min: 1, max: 8, step: 0.5, unit: 'px', default: 2 },
      scale: scale(0.6),
      speed: speed(0.5),
    },
    presets: [
      { id: 'warp', label: 'Warp', values: { shape: 'warp', type: '4x4' } },
      { id: 'globe', label: 'Globe', values: { shape: 'sphere', type: '8x8', back: 'text', front: 'accent', pixel: 3 } },
      { id: 'static', label: 'Static', values: { shape: 'simplex', type: 'random', back: 'surface', front: 'text', pixel: 1.5, speed: 0.3 } },
    ],
    uniforms: (p, t) => ({
      u_colorBack: rgba(p.back as string, t),
      u_colorFront: rgba(p.front as string, t),
      u_shape: DitheringShapes[p.shape as keyof typeof DitheringShapes],
      u_type: DitheringTypes[p.type as keyof typeof DitheringTypes],
      u_pxSize: p.pixel as number,
      ...sizing(p),
    }),
  },
  'liquid-metal': {
    id: 'liquid-metal',
    label: 'Liquid metal',
    hint: 'Chrome that flows, filling the space or poured into a shape',
    params: {
      back: color('Behind', 'surface'),
      tint: color('Tint', 'primary'),
      shape: choice('Shape', METAL_SHAPES, { none: 'Everywhere', circle: 'Circle', daisy: 'Daisy', diamond: 'Diamond', metaballs: 'Metaballs' }, 'none'),
      repetition: { kind: 'slider', label: 'Bands', min: 1, max: 10, step: 0.5, default: 2 },
      distortion: unit('Ripple', 0.07),
      contour: unit('Contour', 0.4),
      softness: unit('Softness', 0.1),
      shift: unit('Rainbow', 0.3),
      angle: { kind: 'slider', label: 'Angle', min: 0, max: 360, step: 5, unit: '°', default: 70 },
      scale: scale(0.6),
      speed: speed(0.6),
    },
    presets: [
      { id: 'chrome', label: 'Chrome', values: { shape: 'none', tint: 'bg', shift: 0.3 } },
      { id: 'drop', label: 'Drop', values: { shape: 'circle', tint: 'primary', scale: 0.6 } },
      { id: 'blobs', label: 'Blobs', values: { shape: 'metaballs', tint: 'accent', repetition: 3 } },
    ],
    uniforms: (p, t) => ({
      u_colorBack: rgba(p.back as string, t),
      u_colorTint: rgba(p.tint as string, t),
      u_repetition: p.repetition as number,
      u_shiftRed: p.shift as number,
      u_shiftBlue: p.shift as number,
      u_contour: p.contour as number,
      u_softness: p.softness as number,
      u_distortion: p.distortion as number,
      u_angle: p.angle as number,
      u_shape: LiquidMetalShapes[p.shape as keyof typeof LiquidMetalShapes],
      u_isImage: false,
      ...sizing(p),
    }),
  },
  'fluted-glass': {
    id: 'fluted-glass',
    label: 'Fluted glass',
    hint: 'Your palette seen through ribbed glass',
    params: {
      behind: choice('Behind the glass', BEHIND_GLASS, { mesh: 'Mesh', waves: 'Waves', shapes: 'Shapes', arch: 'Arch' }, 'mesh'),
      grid: choice('Ribs', GLASS_GRIDS, { lines: 'Lines', linesIrregular: 'Uneven lines', wave: 'Wave', zigzag: 'Zigzag', pattern: 'Pattern' }, 'lines'),
      shape: choice('Profile', GLASS_SHAPES, { prism: 'Prism', lens: 'Lens', contour: 'Contour', cascade: 'Cascade', flat: 'Flat' }, 'prism'),
      size: unit('Rib size', 0.5),
      distortion: unit('Distortion', 0.5),
      angle: { kind: 'slider', label: 'Angle', min: 0, max: 180, step: 5, unit: '°', default: 0 },
      blur: unit('Blur', 0),
      highlights: unit('Highlights', 0.1),
      shadows: unit('Shadows', 0.25),
      highlight: color('Highlight', 'bg'),
      shadow: color('Shadow', 'text'),
    },
    presets: [
      { id: 'reeded', label: 'Reeded', values: { grid: 'lines', shape: 'prism', size: 0.5 } },
      { id: 'lens', label: 'Lens', values: { grid: 'lines', shape: 'lens', size: 0.75, blur: 0.2, behind: 'shapes' } },
      { id: 'wave', label: 'Wave', values: { grid: 'wave', shape: 'cascade', angle: 90, behind: 'waves' } },
    ],
    uniforms: (p, t) => ({
      u_colorBack: [0, 0, 0, 0],
      u_colorShadow: rgba(p.shadow as string, t),
      u_colorHighlight: rgba(p.highlight as string, t),
      u_shadows: p.shadows as number,
      u_size: p.size as number,
      u_angle: p.angle as number,
      u_distortion: p.distortion as number,
      u_shift: 0,
      u_blur: p.blur as number,
      u_edges: 0.25,
      u_stretch: 0,
      u_distortionShape: GlassDistortionShapes[p.shape as keyof typeof GlassDistortionShapes],
      u_highlights: p.highlights as number,
      u_shape: GlassGridShapes[p.grid as keyof typeof GlassGridShapes],
      u_marginLeft: 0,
      u_marginRight: 0,
      u_marginTop: 0,
      u_marginBottom: 0,
      u_grainMixer: 0,
      u_grainOverlay: 0,
      ...sizing(p, { scale: 1 }),
    }),
    image: (p) => p.behind as PlaceholderStyle,
  },
  'god-rays': {
    id: 'god-rays',
    label: 'God rays',
    hint: 'Shafts of light pouring from above',
    params: {
      back: color('Behind', 'text'),
      bloom: color('Bloom', 'primary'),
      colors: { kind: 'stops', label: 'Rays', min: 1, max: 5, default: ['accent', 'primary', 'bg'] },
      density: unit('Density', 0.3),
      spotty: unit('Spotty', 0.3),
      midSize: unit('Glow size', 0.2),
      midIntensity: unit('Glow', 0.4),
      intensity: unit('Intensity', 0.8),
      bloomAmount: unit('Bloom', 0.4),
      from: { kind: 'slider', label: 'From', min: -1, max: 1, step: 0.05, default: -0.55 },
      speed: speed(0.75),
    },
    presets: [
      { id: 'dawn', label: 'Dawn', values: { back: 'text', bloom: 'primary', colors: ['accent', 'primary', 'bg'] } },
      { id: 'stage', label: 'Stage', values: { back: 'text', bloom: 'accent', colors: ['bg'], density: 0.15, spotty: 0, intensity: 0.6 } },
      { id: 'halo', label: 'Halo', values: { back: 'primary', bloom: 'accent', colors: ['onPrimary', 'accent'], from: 0, midSize: 0.4, midIntensity: 0.7 } },
    ],
    uniforms: (p, t) => {
      const colors = (p.colors as string[]).map((c) => rgba(c, t))
      return {
        u_colorBack: rgba(p.back as string, t),
        u_colorBloom: rgba(p.bloom as string, t),
        u_colors: colors,
        u_colorsCount: colors.length,
        u_density: p.density as number,
        u_spotty: p.spotty as number,
        u_midSize: p.midSize as number,
        u_midIntensity: p.midIntensity as number,
        u_intensity: p.intensity as number,
        u_bloom: p.bloomAmount as number,
        ...sizing(p, { offsetY: p.from as number }),
      }
    },
    noise: true,
  },
}

export function isShaderId(id: string): id is ShaderId {
  return (SHADER_IDS as readonly string[]).includes(id)
}

/** Shuffling a shader starts it somewhere else in its loop (frames are milliseconds). */
export function shaderFrame(seed: number): number {
  return ((Math.max(1, seed) - 1) * 7919) % 120000
}

/**
 * A shader's dials as what the runtime takes. `picture` draws the palette
 * placeholder fluted glass looks through (core/media.ts passes placeholderSvg),
 * so this module doesn't depend on the picture code.
 */
export function shaderSpec(id: ShaderId, params: ParamValues | undefined, seed: number, tokens: TokenSet, picture?: (style: PlaceholderStyle) => string): ShaderSpec {
  const s = SHADERS[id]
  const p = clampParams(s.params, params)
  const spec: ShaderSpec = { id, u: s.uniforms(p, tokens), speed: typeof p.speed === 'number' ? p.speed : 0, frame: shaderFrame(seed) }
  if (s.image && picture) spec.image = picture(s.image(p))
  return spec
}

/** The colors a shader paints with, for the poster drawn without WebGL. */
export function shaderColors(spec: ShaderSpec): number[][] {
  const u = spec.u
  const one = (k: string) => (Array.isArray(u[k]) && typeof (u[k] as number[])[0] === 'number' ? [u[k] as number[]] : [])
  const many = Array.isArray(u.u_colors) ? (u.u_colors as number[][]) : []
  return [...one('u_colorBack'), ...one('u_colorShadow'), ...many, ...one('u_colorFront'), ...one('u_colorTint'), ...one('u_colorBloom'), ...one('u_colorHighlight')].filter((c) => c[3] > 0)
}

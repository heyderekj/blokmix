// Section backdrops: a gradient, mesh, grain, pattern or glow behind a whole
// section, as background layers on its root in @layer effects (after the clip,
// before block looks). Colors are palette roles, so they re-theme live.
// Live (WebGL) backdrops are shaders.ts: a canvas layered behind the content,
// with these declarations as what shows before it runs.

import type { TokenSet } from '../types'
import { clampParams, mixHex, cssColor, hexColor, n2, rng, tint, type ColorValue, type ParamSpecs, type ParamValues, type Preset, type TreatmentValue } from './params'
import { contourPaths, grainSvg, noise2, svgUrl } from './noise'
import { gradientCss } from './effects'
import { SHADERS, SHADER_IDS, isShaderId, shaderColors, shaderSpec, type ShaderId } from './shaders'

export const CSS_BACKDROP_IDS = ['gradient', 'mesh', 'grain', 'dots', 'grid', 'lines', 'topo', 'halftone', 'stripes', 'spotlight', 'orb'] as const
export type CssBackdropId = (typeof CSS_BACKDROP_IDS)[number]
/** Every backdrop: the CSS ones, then the live shaders. */
export const BACKDROP_IDS = [...CSS_BACKDROP_IDS, ...SHADER_IDS] as const
export type BackdropId = (typeof BACKDROP_IDS)[number]

export interface Backdrop {
  id: CssBackdropId
  label: string
  hint: string
  params: ParamSpecs
  presets: Preset[]
  /** Background declarations for the section root. */
  render: (p: ParamValues, tokens: TokenSet, seed: number) => { image: string[]; size?: string[]; position?: string[]; repeat?: string[]; blend?: string }
}

const strength = (d: number) => ({ kind: 'slider', label: 'Strength', min: 0, max: 100, unit: '%', default: d }) as const
const color = (label: string, d: ColorValue) => ({ kind: 'color', label, default: d }) as const
const COMMON: ParamSpecs = {
  fill: { kind: 'toggle', label: 'Fill behind', default: false },
  base: color('Behind', 'surface'),
  inverse: { kind: 'toggle', label: 'Inverse', default: false },
}

export const BACKDROPS: Record<CssBackdropId, Backdrop> = {
  gradient: {
    id: 'gradient',
    label: 'Gradient',
    hint: 'The style guide’s gradient, or its own',
    params: {
      guide: { kind: 'toggle', label: 'Use the guide’s gradient', default: true },
      shape: { kind: 'choice', label: 'Shape', options: [{ id: 'linear', label: 'Linear' }, { id: 'radial', label: 'Radial' }, { id: 'conic', label: 'Conic' }], default: 'linear' },
      angle: { kind: 'slider', label: 'Angle', min: 0, max: 360, step: 5, unit: '°', default: 160 },
      stops: { kind: 'stops', label: 'Colors', min: 2, max: 5, default: ['surface', 'primary'] },
      strength: strength(100),
    },
    presets: [
      { id: 'guide', label: 'Guide', values: { guide: true } },
      { id: 'wash', label: 'Wash', values: { guide: false, stops: ['bg', 'surface', 'accent'], angle: 180, strength: 45 } },
      { id: 'dusk', label: 'Dusk', values: { guide: false, stops: ['primary', 'accent'], angle: 200 } },
    ],
    render: (p) => {
      const own = gradientCss({ shape: p.shape, angle: p.angle, stops: (p.stops as string[]).map((c) => c), smooth: true })
      const g = p.guide ? `var(--mx-gradient, ${own})` : own
      return { image: [veil(p), g] }
    },
  },
  mesh: {
    id: 'mesh',
    label: 'Mesh',
    hint: 'Soft blobs of color melting into each other',
    params: {
      stops: { kind: 'stops', label: 'Colors', min: 2, max: 5, default: ['primary', 'accent', 'surface'] },
      spread: { kind: 'slider', label: 'Spread', min: 20, max: 90, unit: '%', default: 55 },
      strength: strength(70),
    },
    presets: [
      { id: 'aurora', label: 'Aurora', values: { stops: ['primary', 'accent', 'surface'], spread: 60, strength: 70 } },
      { id: 'pastel', label: 'Pastel', values: { stops: ['accent', 'surface', 'primary'], spread: 75, strength: 35 } },
      { id: 'deep', label: 'Deep', values: { stops: ['primary', 'text', 'accent'], spread: 50, strength: 90 } },
    ],
    render: (p, _t, seed) => {
      const r = rng(seed)
      const image = (p.stops as string[]).map((c) => `radial-gradient(at ${Math.round(r() * 100)}% ${Math.round(r() * 100)}%, ${tint(c, p.strength as number)} 0, transparent ${p.spread}%)`)
      return { image }
    },
  },
  grain: {
    id: 'grain',
    label: 'Grain',
    hint: 'Film grain over the section’s color',
    params: {
      guide: { kind: 'toggle', label: 'Use the guide’s grain', default: true },
      amount: { kind: 'slider', label: 'Amount', min: 0, max: 60, unit: '%', default: 18 },
      size: { kind: 'slider', label: 'Size', min: 0.5, max: 3, step: 0.1, default: 1 },
      color: color('Color', 'text'),
    },
    presets: [
      { id: 'film', label: 'Film', values: { guide: false, amount: 22, size: 1.1 } },
      { id: 'riso', label: 'Riso', values: { guide: false, amount: 36, size: 1.8, color: 'primary' } },
    ],
    render: (p, tokens) => {
      const own = svgUrl(grainSvg(hexColor(p.color as string, tokens), { amount: p.amount as number, size: p.size as number }))
      return { image: [p.guide ? `var(--mx-grain, ${own})` : own], size: ['180px 180px'], repeat: ['repeat'] }
    },
  },
  dots: {
    id: 'dots',
    label: 'Dots',
    hint: 'A dot grid, like graph paper',
    params: { color: color('Color', 'text'), size: { kind: 'slider', label: 'Dot', min: 0.5, max: 4, step: 0.25, unit: 'px', default: 1.25 }, gap: { kind: 'slider', label: 'Gap', min: 8, max: 64, unit: 'px', default: 22 }, strength: strength(22) },
    presets: [
      { id: 'paper', label: 'Paper', values: { size: 1, gap: 18, strength: 18 } },
      { id: 'bold', label: 'Bold', values: { size: 2.5, gap: 28, strength: 30, color: 'primary' } },
    ],
    render: (p) => ({
      image: [`radial-gradient(circle, ${tint(p.color as string, p.strength as number)} ${p.size}px, transparent ${n2((p.size as number) + 0.6)}px)`],
      size: [`${p.gap}px ${p.gap}px`],
      position: ['center'],
      repeat: ['repeat'],
    }),
  },
  grid: {
    id: 'grid',
    label: 'Grid',
    hint: 'Fine lines in a square grid',
    params: { color: color('Color', 'text'), gap: { kind: 'slider', label: 'Cell', min: 12, max: 120, unit: 'px', default: 48 }, weight: { kind: 'slider', label: 'Line', min: 0.5, max: 3, step: 0.5, unit: 'px', default: 1 }, strength: strength(12) },
    presets: [
      { id: 'blueprint', label: 'Blueprint', values: { gap: 32, strength: 18, color: 'onPrimary', fill: true, base: 'primary' } },
      { id: 'ledger', label: 'Ledger', values: { gap: 64, strength: 10 } },
    ],
    render: (p) => {
      const c = tint(p.color as string, p.strength as number)
      const w = `${p.weight}px`
      return {
        image: [`linear-gradient(${c} ${w}, transparent ${w})`, `linear-gradient(90deg, ${c} ${w}, transparent ${w})`],
        size: [`${p.gap}px ${p.gap}px`, `${p.gap}px ${p.gap}px`],
        position: ['-1px -1px', '-1px -1px'],
        repeat: ['repeat', 'repeat'],
      }
    },
  },
  lines: {
    id: 'lines',
    label: 'Lines',
    hint: 'Diagonal hatching',
    params: { color: color('Color', 'text'), angle: { kind: 'slider', label: 'Angle', min: 0, max: 180, step: 5, unit: '°', default: 45 }, gap: { kind: 'slider', label: 'Gap', min: 4, max: 40, unit: 'px', default: 12 }, weight: { kind: 'slider', label: 'Line', min: 0.5, max: 6, step: 0.5, unit: 'px', default: 1 }, strength: strength(12) },
    presets: [
      { id: 'hatch', label: 'Hatch', values: { angle: 45, gap: 10, strength: 12 } },
      { id: 'pinstripe', label: 'Pinstripe', values: { angle: 90, gap: 18, weight: 1, strength: 10 } },
    ],
    render: (p) => {
      const c = tint(p.color as string, p.strength as number)
      return { image: [`repeating-linear-gradient(${p.angle}deg, ${c} 0 ${p.weight}px, transparent ${p.weight}px ${p.gap}px)`] }
    },
  },
  topo: {
    id: 'topo',
    label: 'Topo',
    hint: 'Contour lines, like a map',
    params: { color: color('Color', 'text'), levels: { kind: 'slider', label: 'Lines', min: 4, max: 24, default: 12 }, scale: { kind: 'slider', label: 'Scale', min: 1, max: 6, step: 0.5, default: 2.5 }, weight: { kind: 'slider', label: 'Line', min: 0.5, max: 3, step: 0.25, unit: 'px', default: 1 }, strength: strength(18) },
    presets: [
      { id: 'map', label: 'Map', values: { levels: 12, scale: 2.5, strength: 18 } },
      { id: 'dense', label: 'Dense', values: { levels: 22, scale: 4, strength: 14, weight: 0.75 } },
    ],
    render: (p, tokens, seed) => {
      const [W, H] = [1440, 900]
      const paths = contourPaths(seed, W, H, { levels: p.levels as number, scale: p.scale as number, detail: 3 })
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="${hexColor(p.color as string, tokens)}" stroke-opacity="${n2((p.strength as number) / 100)}" stroke-width="${p.weight}" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`
      return { image: [svgUrl(svg)], size: ['cover'], position: ['center'] }
    },
  },
  halftone: {
    id: 'halftone',
    label: 'Halftone',
    hint: 'Dots that grow toward one side, like print',
    params: {
      color: color('Color', 'primary'),
      gap: { kind: 'slider', label: 'Grid', min: 10, max: 40, unit: 'px', default: 18 },
      angle: { kind: 'slider', label: 'Toward', min: 0, max: 360, step: 15, unit: '°', default: 135 },
      noise: { kind: 'slider', label: 'Noise', min: 0, max: 100, unit: '%', default: 30 },
      strength: strength(55),
    },
    presets: [
      { id: 'print', label: 'Print', values: { gap: 16, noise: 20, strength: 55 } },
      { id: 'pop', label: 'Pop', values: { gap: 26, noise: 0, strength: 90, color: 'accent' } },
    ],
    render: (p, tokens, seed) => {
      const [W, H] = [1200, 720]
      const gap = p.gap as number
      const a = ((p.angle as number) * Math.PI) / 180
      const n = noise2(seed)
      let dots = ''
      for (let y = gap / 2; y < H; y += gap)
        for (let x = gap / 2; x < W; x += gap) {
          const t = (((x / W - 0.5) * Math.cos(a) + (y / H - 0.5) * Math.sin(a)) + 0.5) * 1 + (n(x / 220, y / 220) * (p.noise as number)) / 200
          const rad = Math.max(0, Math.min(1, t)) * gap * 0.5
          if (rad > 0.4) dots += `<circle cx="${x}" cy="${y}" r="${rad.toFixed(1)}"/>`
        }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="${hexColor(p.color as string, tokens)}" fill-opacity="${n2((p.strength as number) / 100)}">${dots}</g></svg>`
      return { image: [svgUrl(svg)], size: ['cover'], position: ['center'] }
    },
  },
  stripes: {
    id: 'stripes',
    label: 'Op art',
    hint: 'Bold optical stripes in two colors',
    params: { a: color('First', 'primary'), b: color('Second', 'bg'), angle: { kind: 'slider', label: 'Angle', min: 0, max: 180, step: 5, unit: '°', default: 90 }, width: { kind: 'slider', label: 'Stripe', min: 2, max: 60, unit: 'px', default: 14 }, strength: strength(100) },
    presets: [
      { id: 'vibrate', label: 'Vibrate', values: { width: 6, angle: 90 } },
      { id: 'awning', label: 'Awning', values: { width: 40, angle: 90, b: 'surface' } },
    ],
    render: (p) => {
      const w = p.width as number
      return { image: [`repeating-linear-gradient(${p.angle}deg, ${tint(p.a as string, p.strength as number)} 0 ${w}px, ${tint(p.b as string, p.strength as number)} ${w}px ${w * 2}px)`] }
    },
  },
  spotlight: {
    id: 'spotlight',
    label: 'Spotlight',
    hint: 'A pool of light from above',
    params: { color: color('Light', 'accent'), x: { kind: 'slider', label: 'Across', min: 0, max: 100, unit: '%', default: 50 }, size: { kind: 'slider', label: 'Size', min: 20, max: 120, unit: '%', default: 70 }, strength: strength(35) },
    presets: [
      { id: 'stage', label: 'Stage', values: { x: 50, size: 70, strength: 35 } },
      { id: 'corner', label: 'Corner', values: { x: 10, size: 60, strength: 45, color: 'primary' } },
    ],
    render: (p) => ({ image: [`radial-gradient(ellipse ${p.size}% ${n2((p.size as number) * 0.7)}% at ${p.x}% 0%, ${tint(p.color as string, p.strength as number)}, transparent 100%)`] }),
  },
  orb: {
    id: 'orb',
    label: 'Glow orb',
    hint: 'A soft glowing orb behind the content',
    params: { color: color('Color', 'accent'), second: color('Second', 'primary'), size: { kind: 'slider', label: 'Size', min: 10, max: 80, unit: '%', default: 40 }, strength: strength(45) },
    presets: [
      { id: 'sun', label: 'Sun', values: { size: 40, strength: 45 } },
      { id: 'twin', label: 'Twin', values: { size: 30, strength: 60, second: 'accent', color: 'primary' } },
    ],
    render: (p, _t, seed) => {
      const r = rng(seed)
      const s = p.size as number
      const at = () => `${Math.round(20 + r() * 60)}% ${Math.round(15 + r() * 55)}%`
      return {
        image: [
          `radial-gradient(circle at ${at()}, ${tint(p.color as string, p.strength as number)} 0, transparent ${s}%)`,
          `radial-gradient(circle at ${at()}, ${tint(p.second as string, (p.strength as number) * 0.7)} 0, transparent ${n2(s * 0.8)}%)`,
        ],
      }
    },
  },
}

/** The strength dial on a gradient: a veil of the base color over it. */
function veil(p: ParamValues): string {
  const s = p.strength as number
  return s >= 100 ? 'none' : `linear-gradient(${tint('surface', 100 - s)}, ${tint('surface', 100 - s)})`
}

/** A live backdrop covers the whole section, so instead of a fill behind it has a strength (its opacity over the section). */
const SHADER_COMMON: ParamSpecs = { strength: strength(100), inverse: COMMON.inverse }

/** Every backdrop's dials, its own plus the common ones (fill behind, inverse). */
export function backdropParams(id: BackdropId): ParamSpecs {
  return isShaderId(id) ? { ...SHADERS[id].params, ...SHADER_COMMON } : { ...BACKDROPS[id].params, ...COMMON }
}

/** A backdrop's name, hint and presets, CSS or live. */
export function backdropInfo(id: BackdropId): { label: string; hint: string; presets: Preset[]; live: boolean } {
  const b = isShaderId(id) ? SHADERS[id] : BACKDROPS[id]
  return { label: b.label, hint: b.hint, presets: b.presets, live: isShaderId(id) }
}

/** The live backdrop a section runs, if it has one. */
export function backdropShaderId(v: TreatmentValue | undefined): ShaderId | null {
  return v && isShaderId(v.id) ? v.id : null
}

export function isBackdropId(id: string): id is BackdropId {
  return (BACKDROP_IDS as readonly string[]).includes(id)
}

/**
 * A section's backdrop as declarations for its root. Inverse flips the section's
 * palette to the primary color (the way .band.inverse does), with hex values so
 * the swap can't refer to itself.
 */
export function backdropDecls(v: TreatmentValue | undefined, tokens: TokenSet): Record<string, string> {
  if (!v || !isBackdropId(v.id)) return {}
  const p = clampParams(backdropParams(v.id), v.params)
  const out = isShaderId(v.id) ? shaderStandIn(v.id, p, tokens, v.seed ?? 1) : BACKDROPS[v.id].render(p, tokens, v.seed ?? 1)
  const decl: Record<string, string> = {}
  if (p.inverse) {
    const pr = tokens['color.primary']
    const on = tokens['color.onPrimary']
    Object.assign(decl, {
      '--mx-color-bg': pr,
      '--mx-color-surface': mixHex(on, pr, 0.08),
      '--mx-color-text': on,
      '--mx-color-muted': mixHex(on, pr, 0.72),
      '--mx-color-border': mixHex(on, pr, 0.22),
      '--mx-color-primary': on,
      '--mx-color-on-primary': pr,
      'background-color': pr,
      color: on,
    })
  } else if (p.fill) decl['background-color'] = cssColor(p.base as string)
  const kept = out.image.map((x, i) => [x, i] as const).filter(([x]) => x !== 'none')
  if (kept.length) {
    const list = (xs: string[] | undefined, d: string) => kept.map(([, i]) => xs?.[i] ?? d).join(', ')
    decl['background-image'] = kept.map(([x]) => x).join(', ')
    decl['background-size'] = list(out.size, 'auto')
    decl['background-position'] = list(out.position, '0 0')
    decl['background-repeat'] = list(out.repeat, 'no-repeat')
  }
  return decl
}

/**
 * A section's backdrop as CSS for its root, in @layer effects (after the clip, before block looks).
 * A live one also lifts the root into its own stacking context, so the shader's layer
 * (`.mx-backdrop`, z-index -1) sits above the section's color and under its content; its
 * position goes in the clip layer under :where(), so a clip that positions its root keeps it.
 */
export function backdropCss(v: TreatmentValue | undefined, tokens: TokenSet, root: string): string {
  const decl = backdropDecls(v, tokens)
  const live = backdropShaderId(v)
  if (live) decl.isolation = 'isolate'
  const body = Object.entries(decl)
    .map(([k, x]) => `${k}: ${x};`)
    .join(' ')
  if (!body) return ''
  if (!live) return `@layer effects {\n${root} { ${body} }\n}`
  const strength = clampParams(backdropParams(live), v!.params).strength as number
  return `@layer effects {\n${root} { ${body} }\n${root} > .mx-backdrop { opacity: ${n2(strength / 100)}; }\n}\n@layer clip { :where(${root}) { position: relative; } }`
}

/** What a live backdrop shows until its shader runs (and if it can't): its colors as soft glows over its first. */
function shaderStandIn(id: ShaderId, p: ParamValues, tokens: TokenSet, seed: number): ReturnType<Backdrop['render']> {
  const [back, ...rest] = shaderColors(shaderSpec(id, p, seed, tokens)).map(([r, g, b, a]) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${n2(a)})`)
  const r = rng(seed)
  const image = rest.slice(0, 4).map((c) => `radial-gradient(at ${Math.round(r() * 100)}% ${Math.round(r() * 100)}%, ${c} 0, transparent 60%)`)
  return { image: [...image, `linear-gradient(${back ?? 'transparent'}, ${back ?? 'transparent'})`] }
}

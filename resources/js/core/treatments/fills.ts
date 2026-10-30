// Generative pictures for image blocks: dither, halftone, topo, flow lines,
// blocks, ASCII, op art, marble and grain gradients, drawn as SVG from your
// palette (so they re-theme with the style guide) and tuned with dials.

import type { TokenSet } from '../types'
import { clampParams, mixHex, hexColor, n2, rng, type ColorValue, type ParamSpecs, type ParamValues, type Preset } from './params'
import { BAYER4, contourBands, fbm, noise2 } from './noise'

export const FILL_IDS = ['grain-gradient', 'dither', 'halftone', 'topo', 'flow', 'blocks', 'ascii', 'op-art', 'marble'] as const
export type FillId = (typeof FILL_IDS)[number]

export interface Fill {
  id: FillId
  label: string
  hint: string
  params: ParamSpecs
  presets: Preset[]
  /** The SVG's body (inside <svg viewBox="0 0 W H">). */
  draw: (p: ParamValues, tokens: TokenSet, seed: number, W: number, H: number) => string
}

const color = (label: string, d: ColorValue) => ({ kind: 'color', label, default: d }) as const
const ink = color('Ink', 'primary')
const paper = color('Paper', 'surface')
const scale = { kind: 'slider', label: 'Scale', min: 0.5, max: 6, step: 0.25, default: 2 } as const

const rect = (fill: string) => `<rect width="100%" height="100%" fill="${fill}"/>`

/** A noise field with a tilt, so dither and halftone shade from one side. */
function shadeField(seed: number, p: ParamValues) {
  const f = fbm(seed, 3)
  const a = ((p.angle as number) * Math.PI) / 180
  const sc = p.scale as number
  const mix = (p.noise as number) / 100
  return (x: number, y: number) => (1 - mix) * ((x - 0.5) * Math.cos(a) + (y - 0.5) * Math.sin(a)) + mix * f(x * sc, y * sc)
}

export const FILLS: Record<FillId, Fill> = {
  'grain-gradient': {
    id: 'grain-gradient',
    label: 'Grain gradient',
    hint: 'A soft gradient with film grain',
    params: {
      a: color('From', 'primary'),
      b: color('To', 'accent'),
      c: color('Glow', 'surface'),
      angle: { kind: 'slider', label: 'Angle', min: 0, max: 360, step: 5, unit: '°', default: 135 },
      grain: { kind: 'slider', label: 'Grain', min: 0, max: 80, unit: '%', default: 35 },
    },
    presets: [
      { id: 'dawn', label: 'Dawn', values: { a: 'accent', b: 'primary', c: 'surface', angle: 160 } },
      { id: 'ink', label: 'Ink', values: { a: 'text', b: 'primary', c: 'accent', grain: 50 } },
    ],
    draw: (p, t, seed, W, H) => {
      const r = rng(seed)
      const a = ((p.angle as number) * Math.PI) / 180
      const [x1, y1, x2, y2] = [0.5 - Math.cos(a) / 2, 0.5 - Math.sin(a) / 2, 0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2].map(n2)
      return `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${hexColor(p.a as string, t)}"/><stop offset="1" stop-color="${hexColor(p.b as string, t)}"/></linearGradient><radialGradient id="h" cx="${n2(0.2 + r() * 0.6)}" cy="${n2(0.2 + r() * 0.6)}" r="0.6"><stop offset="0" stop-color="${hexColor(p.c as string, t)}" stop-opacity="0.75"/><stop offset="1" stop-color="${hexColor(p.c as string, t)}" stop-opacity="0"/></radialGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${n2((p.grain as number) / 100)}"/></feComponentTransfer></filter></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#h)"/><rect width="${W}" height="${H}" filter="url(#n)" style="mix-blend-mode:overlay"/>`
    },
  },
  dither: {
    id: 'dither',
    label: 'Dither',
    hint: 'Ordered (Bayer) dithering, like an old screen',
    params: {
      ink,
      paper,
      pixel: { kind: 'slider', label: 'Pixel', min: 2, max: 12, unit: 'px', default: 4 },
      angle: { kind: 'slider', label: 'Light from', min: 0, max: 360, step: 15, unit: '°', default: 45 },
      noise: { kind: 'slider', label: 'Noise', min: 0, max: 100, unit: '%', default: 55 },
      scale,
    },
    presets: [
      { id: 'mac', label: 'Classic', values: { ink: 'text', paper: 'bg', pixel: 3, noise: 40 } },
      { id: 'brand', label: 'Brand', values: { ink: 'primary', paper: 'surface', pixel: 5, noise: 65 } },
    ],
    draw: (p, t, seed, W, H) => {
      const px = p.pixel as number
      const levels = 15
      // One pattern per level; each level's dots are a superset of the last, so nested regions just stack.
      const inkHex = hexColor(p.ink as string, t)
      const pats = Array.from({ length: levels }, (_, k) => {
        const on = BAYER4.map((v, i) => (v <= k ? `<rect x="${(i % 4) * px}" y="${Math.floor(i / 4) * px}" width="${px}" height="${px}" fill="${inkHex}"/>` : '')).join('')
        return `<pattern id="d${k}" width="${px * 4}" height="${px * 4}" patternUnits="userSpaceOnUse">${on}</pattern>`
      }).join('')
      const bands = contourBands(shadeField(seed, p), W, H, levels)
      return `<defs>${pats}</defs>${rect(hexColor(p.paper as string, t))}${bands.map((d, k) => `<path d="${d}" fill="url(#d${k})"/>`).join('')}`
    },
  },
  halftone: {
    id: 'halftone',
    label: 'Halftone',
    hint: 'Print dots that swell with the shade',
    params: {
      ink,
      paper,
      grid: { kind: 'slider', label: 'Grid', min: 6, max: 32, unit: 'px', default: 14 },
      angle: { kind: 'slider', label: 'Light from', min: 0, max: 360, step: 15, unit: '°', default: 135 },
      noise: { kind: 'slider', label: 'Noise', min: 0, max: 100, unit: '%', default: 50 },
      scale,
    },
    presets: [
      { id: 'comic', label: 'Comic', values: { ink: 'accent', paper: 'bg', grid: 18, noise: 30 } },
      { id: 'newsprint', label: 'Newsprint', values: { ink: 'text', paper: 'surface', grid: 9, noise: 60 } },
    ],
    draw: (p, t, seed, W, H) => {
      const g = p.grid as number
      const levels = 10
      const inkHex = hexColor(p.ink as string, t)
      const pats = Array.from(
        { length: levels },
        (_, k) => `<pattern id="h${k}" width="${g}" height="${g}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="${g / 2}" cy="${g / 2}" r="${n2(((k + 1) / levels) * g * 0.62)}" fill="${inkHex}"/></pattern>`,
      ).join('')
      const bands = contourBands(shadeField(seed, p), W, H, levels)
      return `<defs>${pats}</defs>${rect(hexColor(p.paper as string, t))}${bands.map((d, k) => `<path d="${d}" fill="url(#h${k})"/>`).join('')}`
    },
  },
  topo: {
    id: 'topo',
    label: 'Topo',
    hint: 'Contour lines, with tinted bands',
    params: {
      ink,
      paper,
      levels: { kind: 'slider', label: 'Lines', min: 4, max: 24, default: 12 },
      scale,
      bands: { kind: 'toggle', label: 'Tinted bands', default: true },
    },
    presets: [
      { id: 'survey', label: 'Survey', values: { ink: 'text', paper: 'bg', levels: 14, bands: false } },
      { id: 'terrain', label: 'Terrain', values: { ink: 'primary', paper: 'surface', levels: 10, bands: true } },
    ],
    draw: (p, t, seed, W, H) => {
      const f = fbm(seed, 3)
      const sc = p.scale as number
      const levels = p.levels as number
      const inkHex = hexColor(p.ink as string, t)
      const paperHex = hexColor(p.paper as string, t)
      const bands = contourBands((x, y) => f(x * sc, y * sc), W, H, levels)
      const fills = p.bands ? bands.map((d, k) => `<path d="${d}" fill="${mixHex(inkHex, paperHex, 0.04 + (k / levels) * 0.22)}"/>`).join('') : ''
      return `${rect(paperHex)}${fills}<g fill="none" stroke="${inkHex}" stroke-opacity="0.55" stroke-width="${n2(Math.max(W, H) / 700)}">${bands.map((d) => `<path d="${d}"/>`).join('')}</g>`
    },
  },
  flow: {
    id: 'flow',
    label: 'Flow lines',
    hint: 'Pen lines following a current, like a plotter',
    params: {
      ink,
      paper,
      lines: { kind: 'slider', label: 'Lines', min: 40, max: 260, step: 10, default: 140 },
      length: { kind: 'slider', label: 'Length', min: 10, max: 60, default: 32 },
      scale,
      weight: { kind: 'slider', label: 'Pen', min: 0.5, max: 4, step: 0.25, unit: 'px', default: 1.25 },
    },
    presets: [
      { id: 'plotter', label: 'Plotter', values: { ink: 'text', paper: 'bg', lines: 200, length: 40, weight: 1 } },
      { id: 'current', label: 'Current', values: { ink: 'primary', paper: 'surface', lines: 120, length: 50, scale: 1.25 } },
    ],
    draw: (p, t, seed, W, H) => {
      const r = rng(seed)
      const n = noise2(seed + 1)
      const sc = (p.scale as number) / Math.max(W, H)
      const step = Math.max(W, H) / 160
      let d = ''
      for (let i = 0; i < (p.lines as number); i++) {
        let x = r() * W
        let y = r() * H
        d += `M${Math.round(x)} ${Math.round(y)}`
        for (let s = 0; s < (p.length as number); s++) {
          const a = n(x * sc, y * sc) * Math.PI * 2
          x += Math.cos(a) * step
          y += Math.sin(a) * step
          if (x < 0 || y < 0 || x > W || y > H) break
          d += `L${Math.round(x)} ${Math.round(y)}`
        }
      }
      return `${rect(hexColor(p.paper as string, t))}<path d="${d}" fill="none" stroke="${hexColor(p.ink as string, t)}" stroke-width="${p.weight}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.8"/>`
    },
  },
  blocks: {
    id: 'blocks',
    label: 'Blocks',
    hint: 'A grid of bold shapes, Bauhaus style',
    params: {
      cols: { kind: 'slider', label: 'Columns', min: 2, max: 10, default: 5 },
      palette: { kind: 'stops', label: 'Colors', min: 2, max: 5, default: ['primary', 'accent', 'surface', 'text'] },
      round: { kind: 'slider', label: 'Curves', min: 0, max: 100, unit: '%', default: 60 },
    },
    presets: [
      { id: 'bauhaus', label: 'Bauhaus', values: { cols: 4, palette: ['primary', 'accent', 'text', 'surface'], round: 70 } },
      { id: 'quilt', label: 'Quilt', values: { cols: 8, palette: ['surface', 'primary', 'muted'], round: 30 } },
    ],
    draw: (p, t, seed, W, H) => {
      const r = rng(seed)
      const cols = p.cols as number
      const s = W / cols
      const rows = Math.ceil(H / s)
      const pal = (p.palette as string[]).map((c) => hexColor(c, t))
      const pick = () => pal[Math.floor(r() * pal.length)]
      let out = ''
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = i * s
          const y = j * s
          const bg = pick()
          const fg = pal.length > 1 && pick() === bg ? pal[(pal.indexOf(bg) + 1) % pal.length] : pick()
          out += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(s + 0.5)}" height="${n2(s + 0.5)}" fill="${bg}"/>`
          if (r() * 100 < (p.round as number)) {
            const corner = Math.floor(r() * 5)
            // A quarter circle from one corner of the cell, or a circle in the middle.
            const arcs: [number, number, number, number, number, number][] = [
              [x, y, x + s, y, x, y + s],
              [x + s, y, x + s, y + s, x, y],
              [x, y + s, x, y, x + s, y + s],
              [x + s, y + s, x, y + s, x + s, y],
            ]
            if (corner === 4) out += `<circle cx="${n2(x + s / 2)}" cy="${n2(y + s / 2)}" r="${n2(s * 0.42)}" fill="${fg}"/>`
            else {
              const [cx, cy, ax, ay, bx, by] = arcs[corner]
              out += `<path d="M${n2(cx)} ${n2(cy)}L${n2(ax)} ${n2(ay)}A${n2(s)} ${n2(s)} 0 0 1 ${n2(bx)} ${n2(by)}Z" fill="${fg}"/>`
            }
          } else if (r() > 0.5) out += `<rect x="${n2(x)}" y="${n2(y + s / 2)}" width="${n2(s)}" height="${n2(s / 2)}" fill="${fg}"/>`
        }
      return out
    },
  },
  ascii: {
    id: 'ascii',
    label: 'ASCII',
    hint: 'A noise field drawn in characters',
    params: {
      ink,
      paper,
      cols: { kind: 'slider', label: 'Columns', min: 24, max: 96, step: 4, default: 56 },
      scale,
      charset: { kind: 'choice', label: 'Characters', options: [{ id: 'classic', label: ' .:-=+*#%@' }, { id: 'blocks', label: '░▒▓█' }, { id: 'binary', label: '01' }], default: 'classic' },
    },
    presets: [
      { id: 'terminal', label: 'Terminal', values: { ink: 'accent', paper: 'text', cols: 64 } },
      { id: 'paper', label: 'Paper', values: { ink: 'text', paper: 'bg', cols: 48 } },
    ],
    draw: (p, t, seed, W, H) => {
      const chars = p.charset === 'blocks' ? ' ░▒▓█' : p.charset === 'binary' ? ' 01' : ' .:-=+*#%@'
      const f = fbm(seed, 3)
      const cols = p.cols as number
      const cw = W / cols
      const ch = cw * 1.7
      const rows = Math.ceil(H / ch)
      const sc = p.scale as number
      let lines = ''
      for (let j = 0; j < rows; j++) {
        let row = ''
        for (let i = 0; i < cols; i++) {
          const v = (f((i / cols) * sc, (j / rows) * sc * (H / W)) + 1) / 2
          row += chars[Math.max(0, Math.min(chars.length - 1, Math.floor(v * chars.length)))]
        }
        lines += `<text x="0" y="${n2((j + 0.8) * ch)}" textLength="${W}">${row.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
      }
      return `${rect(hexColor(p.paper as string, t))}<g fill="${hexColor(p.ink as string, t)}" font-family="${t['font.mono'].replace(/"/g, "'")}" font-size="${n2(ch * 0.9)}" xml:space="preserve">${lines}</g>`
    },
  },
  'op-art': {
    id: 'op-art',
    label: 'Op art',
    hint: '60s optical rings that seem to vibrate',
    params: {
      a: color('First', 'text'),
      b: color('Second', 'accent'),
      shape: { kind: 'choice', label: 'Shape', options: [{ id: 'circle', label: 'Circle' }, { id: 'diamond', label: 'Diamond' }, { id: 'square', label: 'Square' }], default: 'diamond' },
      rings: { kind: 'slider', label: 'Rings', min: 6, max: 60, default: 24 },
      taper: { kind: 'slider', label: 'Taper', min: 0, max: 90, unit: '%', default: 40 },
    },
    presets: [
      { id: 'classic', label: 'Classic yellow', values: { a: 'text', b: 'accent', shape: 'diamond', rings: 28 } },
      { id: 'target', label: 'Target', values: { a: 'primary', b: 'bg', shape: 'circle', rings: 18, taper: 20 } },
    ],
    draw: (p, t, seed, W, H) => {
      const r = rng(seed)
      const cx = W * (0.35 + r() * 0.3)
      const cy = H * (0.35 + r() * 0.3)
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * (p.shape === 'diamond' ? 1.42 : 1.05)
      const n = p.rings as number
      const A = hexColor(p.a as string, t)
      const B = hexColor(p.b as string, t)
      let out = rect(B)
      // Rings thin out toward the middle (taper), so the eye reads motion.
      for (let k = n; k > 0; k--) {
        const f = (k / n) ** (1 + (p.taper as number) / 50)
        const s = R * f
        const fill = k % 2 ? A : B
        if (p.shape === 'circle') out += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(s)}" fill="${fill}"/>`
        else if (p.shape === 'square') out += `<rect x="${n2(cx - s)}" y="${n2(cy - s)}" width="${n2(s * 2)}" height="${n2(s * 2)}" fill="${fill}"/>`
        else out += `<path d="M${n2(cx)} ${n2(cy - s)}L${n2(cx + s)} ${n2(cy)}L${n2(cx)} ${n2(cy + s)}L${n2(cx - s)} ${n2(cy)}Z" fill="${fill}"/>`
      }
      return out
    },
  },
  marble: {
    id: 'marble',
    label: 'Marble',
    hint: 'Warped bands of color, like marbled paper',
    params: {
      palette: { kind: 'stops', label: 'Colors', min: 2, max: 5, default: ['surface', 'primary', 'accent'] },
      bands: { kind: 'slider', label: 'Bands', min: 4, max: 20, default: 10 },
      warp: { kind: 'slider', label: 'Warp', min: 0, max: 100, unit: '%', default: 60 },
      scale,
    },
    presets: [
      { id: 'endpaper', label: 'Endpaper', values: { palette: ['surface', 'primary', 'accent', 'text'], bands: 14, warp: 75 } },
      { id: 'calm', label: 'Calm', values: { palette: ['bg', 'surface', 'primary'], bands: 7, warp: 35 } },
    ],
    draw: (p, t, seed, W, H) => {
      const f = fbm(seed, 3)
      const g = fbm(seed + 9, 2)
      const sc = p.scale as number
      const w = ((p.warp as number) / 100) * 1.6
      const field = (x: number, y: number) => {
        const qx = g(x * sc, y * sc)
        const qy = g(x * sc + 5.2, y * sc + 1.3)
        return f(x * sc + w * qx, y * sc + w * qy) + y * 0.4
      }
      const pal = (p.palette as string[]).map((c) => hexColor(c, t))
      const bands = contourBands(field, W, H, p.bands as number, 96)
      return `${rect(pal[0])}${bands.map((d, k) => `<path d="${d}" fill="${pal[(k + 1) % pal.length]}"/>`).join('')}`
    },
  },
}

export function isFillId(id: string): id is FillId {
  return (FILL_IDS as readonly string[]).includes(id)
}

/** A generative picture as a whole SVG. */
export function fillSvg(id: FillId, params: ParamValues | undefined, seed: number, tokens: TokenSet, W: number, H: number): string {
  const f = FILLS[id]
  const body = f.draw(clampParams(f.params, params), tokens, seed, W, H)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`
}

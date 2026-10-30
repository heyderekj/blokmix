// Seeded noise and the small geometry the generative treatments share.

import { createNoise2D } from 'simplex-noise'
import { contours } from 'd3-contour'
import { rng } from './params'

/** Seeded 2D simplex noise in -1…1. */
export function noise2(seed: number): (x: number, y: number) => number {
  return createNoise2D(rng(seed))
}

/** Fractal noise (octaves of simplex), in about -1…1. */
export function fbm(seed: number, octaves = 3): (x: number, y: number) => number {
  const n = noise2(seed)
  return (x, y) => {
    let sum = 0
    let amp = 0.5
    let f = 1
    for (let o = 0; o < octaves; o++) {
      sum += amp * n(x * f, y * f)
      f *= 2
      amp *= 0.5
    }
    return sum
  }
}

/** A field sampled on a coarse grid, cut into nested regions at evenly spaced levels: SVG path data, one per level, scaled to W×H. */
export function contourBands(field: (x: number, y: number) => number, W: number, H: number, levels: number, gw = 72): string[] {
  // A coarse grid keeps the SVG small; the shapes are smooth enough at this size.
  const gh = Math.max(8, Math.round((gw * H) / W))
  const values = new Array<number>(gw * gh)
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) values[j * gw + i] = field(i / (gw - 1), (j / (gh - 1)) * (H / W))
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const thresholds = Array.from({ length: levels }, (_, k) => lo + ((k + 1) * (hi - lo)) / (levels + 1))
  const sx = W / (gw - 1)
  const sy = H / (gh - 1)
  return contours().size([gw, gh]).thresholds(thresholds)(values).map((mp) =>
    mp.coordinates
      .flatMap((poly) => poly.map((ring) => 'M' + ring.map(([x, y]) => `${Math.round(x * sx)} ${Math.round(y * sy)}`).join('L') + 'Z'))
      .join(''),
  )
}

/** Contour lines of a noise field, like a map. */
export function contourPaths(seed: number, W: number, H: number, opts: { levels: number; scale: number; detail: number }): string[] {
  const field = fbm(seed, opts.detail)
  return contourBands((x, y) => field(x * opts.scale, y * opts.scale), W, H, opts.levels)
}

/** The 4×4 Bayer matrix, 0…15, for ordered dithering. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Film grain as an SVG: fractal noise in one color with alpha, tiled. */
export function grainSvg(color: string, opts: { amount: number; size: number }): string {
  const [r, g, b] = rgb01(color)
  const freq = (0.9 / opts.size).toFixed(3)
  const a = (opts.amount / 100).toFixed(3)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${a} 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
}

function rgb01(hex: string): [string, string, string] {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex)
  const v = m ? parseInt(m[1], 16) : 0
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => (c / 255).toFixed(3)) as [string, string, string]
}

/** An SVG as a CSS url(), for background layers. */
export function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')}")`
}

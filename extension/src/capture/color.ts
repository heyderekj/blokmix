// Colour maths for capture: parse the snapshot's rgba() values, compare them in
// OKLab, and write a colour as Blokmix tokens: a token, a color-mix() of two
// tokens, or either at an alpha.

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export const COLOR_RE = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b/gi

export function parseColor(v: string | undefined): Rgba | null {
  if (!v) return null
  const s = v.trim()
  if (/^transparent$/i.test(s)) return { r: 0, g: 0, b: 0, a: 0 }
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(s)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4] }
  let h = /^#([0-9a-f]{3,8})$/i.exec(s)?.[1]
  if (!h) return null
  if (h.length <= 4) h = h.split('').map((c) => c + c).join('')
  const n = (i: number) => parseInt(h!.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
}

export const toHex = ({ r, g, b }: Rgba) => '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')

/** A colour composited over an opaque one. */
export function over(top: Rgba, under: Rgba): Rgba {
  const a = top.a
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 }
}

type Lab = [number, number, number]

export function oklab({ r, g, b }: Rgba): Lab {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

export function fromOklab([L, A, B]: Lab): Rgba {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3)
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3)
  const enc = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
  return {
    r: enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: 1,
  }
}

export function dist(a: Rgba, b: Rgba): number {
  const [x, y] = [oklab(a), oklab(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

export const chroma = (c: Rgba) => {
  const [, a, b] = oklab(c)
  return Math.hypot(a, b)
}

export const lightness = (c: Rgba) => oklab(c)[0]

/** Mix in OKLab, `t` of `a` (as color-mix(in oklab, a t%, b) does). */
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const [x, y] = [oklab(a), oklab(b)]
  return fromOklab([x[0] * t + y[0] * (1 - t), x[1] * t + y[1] * (1 - t), x[2] * t + y[2] * (1 - t)])
}

export const COLOR_TOKENS = ['bg', 'surface', 'text', 'muted', 'border', 'primary', 'on-primary', 'accent'] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]
export type Palette = Record<ColorToken, Rgba>

const PREFERENCE: ColorToken[] = ['text', 'bg', 'primary', 'on-primary', 'accent', 'muted', 'surface', 'border']

const v = (t: ColorToken) => `var(--mx-color-${t})`

/**
 * A colour written in tokens. Close to a token: that token. Otherwise the
 * closest mix of two tokens (in 5% steps). Alpha mixes with transparent.
 */
export class ColorMapper {
  private cache = new Map<string, string>()
  /** How many colours only roughly matched a token. */
  approximated = 0

  constructor(private palette: Palette) {}

  map(value: string): string {
    const hit = this.cache.get(value)
    if (hit) return hit
    const c = parseColor(value)
    let out = 'currentColor'
    if (c) out = c.a < 0.02 ? 'transparent' : this.alpha(this.solid({ ...c, a: 1 }), c.a)
    this.cache.set(value, out)
    return out
  }

  /** Every colour inside a value (a gradient, a shadow) written in tokens. */
  mapIn(value: string): string {
    return value.replace(COLOR_RE, (c) => this.map(c))
  }

  private alpha(expr: string, a: number) {
    if (a >= 0.98) return expr
    return `color-mix(in oklab, ${expr} ${Math.max(1, Math.round(a * 100))}%, transparent)`
  }

  private solid(c: Rgba): string {
    let best = { d: Infinity, expr: '' }
    // On a tie (primary and border can be the same colour) the meaning that travels best wins.
    for (const t of PREFERENCE) {
      const d = dist(c, this.palette[t])
      if (d < best.d) best = { d, expr: v(t) }
    }
    if (best.d < 0.02) return best.expr
    const nearest = best
    for (let i = 0; i < COLOR_TOKENS.length; i++)
      for (let j = i + 1; j < COLOR_TOKENS.length; j++) {
        const [A, B] = [COLOR_TOKENS[i], COLOR_TOKENS[j]]
        for (let p = 5; p <= 95; p += 5) {
          const d = dist(c, mix(this.palette[A], this.palette[B], p / 100)) + 0.004 // a single token beats a near-equal mix
          if (d < best.d) best = { d, expr: `color-mix(in oklab, ${v(A)} ${p}%, ${v(B)})` }
        }
      }
    if (best.d > 0.06) {
      this.approximated++
      // Nothing close: a tint of the nearest token reads better than a muddy mix.
      return nearest.expr
    }
    return best.expr
  }
}

// One brand color → a whole palette, light or dark. Built in OKLCH so the greys
// lean towards the brand's hue and every step keeps the same feel, then checked
// against CONTRAST_PAIRS: text, muted text and button labels always read (AA).

import type { TokenKey } from './types'
import { contrastRatio, hexToRgb } from './tokens'

export type Mode = 'light' | 'dark'
type ColorKey = Extract<TokenKey, `color.${string}`>
export type Palette = Record<ColorKey, string>

/** WCAG AA for body text. */
export const AA = 4.5

// ---- OKLab / OKLCH (Björn Ottosson's matrices) ----

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function hexToOklch(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => toLinear(v / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return [L, C, h]
}

function oklchToRgb(L: number, C: number, h: number): [number, number, number] {
  const A = C * Math.cos((h * Math.PI) / 180)
  const B = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: number[]) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)

/** An OKLCH color as hex, pulling chroma in until it fits sRGB. */
export function oklchToHex(L: number, C: number, h: number): string {
  const l = Math.min(1, Math.max(0, L))
  let c = Math.max(0, C)
  let rgb = oklchToRgb(l, c, h)
  while (!inGamut(rgb) && c > 0.001) {
    c *= 0.94
    rgb = oklchToRgb(l, c, h)
  }
  const hex = rgb.map((v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, '0'))
  return `#${hex.join('')}`
}

/** Darken (or lighten) `fg` along its own hue until it reads on `bg`. */
function readable(fg: [number, number, number], bg: string, step: number, min = AA): string {
  let [L, C, h] = fg
  let hex = oklchToHex(L, C, h)
  for (let i = 0; i < 60 && (contrastRatio(hex, bg) ?? 0) < min; i++) {
    L = Math.min(1, Math.max(0, L + step))
    hex = oklchToHex(L, C, h)
  }
  return hex
}

/** Black-ish or white-ish ink for a fill, whichever reads better, tinted to the fill's hue. */
function inkOn(fill: string, h: number): string {
  const dark = oklchToHex(0.18, 0.02, h)
  const light = oklchToHex(0.99, 0.005, h)
  return (contrastRatio(dark, fill) ?? 0) >= (contrastRatio(light, fill) ?? 0) ? dark : light
}

/**
 * The eight colors from one brand color. The brand stays the primary (nudged only
 * if a label can't read on it), greys carry a trace of its hue, and the accent sits
 * a third of the way round the wheel.
 */
export function paletteFrom(brand: string, mode: Mode = 'light'): Palette {
  const lch = hexToOklch(brand) ?? [0.55, 0.15, 260]
  const [, C, h] = lch
  const tint = Math.min(C, 0.12) // how much of the hue the greys carry
  const dark = mode === 'dark'

  const bg = dark ? oklchToHex(0.17, tint * 0.12, h) : oklchToHex(0.992, tint * 0.05, h)
  const surface = dark ? oklchToHex(0.22, tint * 0.15, h) : oklchToHex(0.962, tint * 0.12, h)
  const border = dark ? oklchToHex(0.3, tint * 0.15, h) : oklchToHex(0.905, tint * 0.12, h)
  const text = readable(dark ? [0.95, tint * 0.06, h] : [0.22, tint * 0.15, h], bg, dark ? 0.02 : -0.02, 7)
  const muted = readable(dark ? [0.72, tint * 0.1, h] : [0.52, tint * 0.15, h], bg, dark ? 0.02 : -0.02)

  // On a dark ground a deep brand color would sink: lift it until it stands off the background.
  let [pL, pC] = lch
  if (dark && pL < 0.62) pL = 0.68
  let primary = oklchToHex(pL, pC, h)
  let onPrimary = inkOn(primary, h)
  for (let i = 0; i < 40 && (contrastRatio(onPrimary, primary) ?? 0) < AA; i++) {
    // Move away from the ink: darker under light ink, lighter under dark ink.
    const inkIsLight = (hexToOklch(onPrimary)?.[0] ?? 0) > 0.6
    pL = Math.min(0.97, Math.max(0.05, pL + (inkIsLight ? -0.02 : 0.02)))
    primary = oklchToHex(pL, pC, h)
    onPrimary = inkOn(primary, h)
  }

  const accent = oklchToHex(dark ? 0.74 : 0.62, Math.max(0.1, Math.min(C, 0.18)), (h + 120) % 360)

  return {
    'color.bg': bg,
    'color.surface': surface,
    'color.text': text,
    'color.muted': muted,
    'color.border': border,
    'color.primary': primary,
    'color.onPrimary': onPrimary,
    'color.accent': accent,
  }
}

/** Quiet greys with no color at all: the Sketch look, for deciding the layout first. */
export function greyPalette(mode: Mode = 'light'): Palette {
  return mode === 'dark'
    ? { 'color.bg': '#1c1c1e', 'color.surface': '#2a2a2d', 'color.text': '#ececee', 'color.muted': '#a1a1a6', 'color.border': '#3a3a3e', 'color.primary': '#d4d4d8', 'color.onPrimary': '#18181b', 'color.accent': '#8e8e93' }
    : { 'color.bg': '#fafafa', 'color.surface': '#ededed', 'color.text': '#262626', 'color.muted': '#6b6b6b', 'color.border': '#d4d4d4', 'color.primary': '#404040', 'color.onPrimary': '#fafafa', 'color.accent': '#8a8a8a' }
}

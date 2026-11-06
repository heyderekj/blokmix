// Colors in words. Jev reads names far better than hex ("deep teal", not #0f5e63), so code
// names every color it shows Jev, and the same names go in what people read.

import { hexToOklch, type Palette } from '../palette'

const HUES: [number, string][] = [
  [15, 'pink'],
  [42, 'red'],
  [68, 'orange'],
  [88, 'amber'],
  [112, 'yellow'],
  [137, 'lime'],
  [165, 'green'],
  [196, 'teal'],
  [228, 'cyan'],
  [262, 'blue'],
  [290, 'indigo'],
  [335, 'violet'],
  [360, 'pink'],
]

/** A color's plain name: "deep teal", "pale warm grey", "vivid orange", "near-black". */
export function colorName(hex: string): string {
  const lch = hexToOklch(hex)
  if (!lch) return hex
  const [L, C, h] = lch
  if (C < 0.025) {
    if (L > 0.97) return 'white'
    if (L < 0.2) return 'near-black'
    const warm = C > 0.008 && ((h >= 30 && h <= 110) ? 'warm ' : h >= 200 && h <= 290 ? 'cool ' : '')
    // A warm off-white is what people call cream.
    if (warm === 'warm ' && L > 0.88 && C > 0.012) return 'cream'
    const tone = L > 0.9 ? 'off-white' : L > 0.75 ? 'light grey' : L > 0.5 ? 'grey' : 'dark grey'
    return `${warm || ''}${tone}`
  }
  const hue = HUES.find(([to]) => h < to)?.[1] ?? 'pink'
  // Light, low-chroma oranges and ambers read as cream and sand; dark ones as brown.
  if ((hue === 'orange' || hue === 'amber' || hue === 'yellow') && L > 0.88 && C < 0.08) return 'cream'
  if ((hue === 'orange' || hue === 'amber' || hue === 'red') && L < 0.5 && C < 0.12) return L < 0.32 ? 'dark brown' : 'brown'
  const light = L > 0.9 ? 'pale ' : L > 0.75 ? 'light ' : L < 0.32 ? 'deep ' : L < 0.45 ? 'dark ' : ''
  const strength = C > 0.17 ? 'vivid ' : C < 0.07 ? 'muted ' : ''
  return `${light}${strength}${hue}`.trim()
}

/** A palette in words, the way a person would describe it. */
export function describePalette(p: Palette): string {
  return [
    `${colorName(p['color.bg'])} background`,
    `${colorName(p['color.text'])} text`,
    `${colorName(p['color.primary'])} buttons`,
    `${colorName(p['color.accent'])} accent`,
  ].join(', ')
}

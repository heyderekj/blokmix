import { describe, expect, it } from 'vitest'
import { AA, greyPalette, hexToOklch, oklchToHex, paletteFrom } from '@/core/palette'
import { CONTRAST_PAIRS, contrastRatio } from '@/core/tokens'

// A spread of brand colors: every hue at a few lightnesses, plus the awkward ones (pure yellow, near-white, near-black, grey).
const brands = [
  ...Array.from({ length: 12 }, (_, i) => [0.45, 0.65, 0.85].map((l) => oklchToHex(l, 0.16, i * 30))).flat(),
  '#ffe600', '#ffffff', '#fafafa', '#000000', '#111111', '#808080', '#3dff8f', '#7c5cff', '#7a1f1f', '#ff3b00', '#00ffff', '#0000ff',
]

describe('paletteFrom', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`every ${mode} palette passes AA on text, muted text and button labels`, () => {
      for (const brand of brands) {
        const p = paletteFrom(brand, mode)
        for (const [fg, bg, label] of CONTRAST_PAIRS) {
          const ratio = contrastRatio(p[fg as keyof typeof p], p[bg as keyof typeof p])
          expect(ratio, `${brand} ${mode} ${label}: ${p[fg as keyof typeof p]} on ${p[bg as keyof typeof p]}`).toBeGreaterThanOrEqual(AA)
        }
      }
    })
  }

  it('keeps the brand as the primary when a label can read on it', () => {
    expect(paletteFrom('#2563eb', 'light')['color.primary']).toBe('#2563eb')
    expect(paletteFrom('#7a1f1f', 'light')['color.primary']).toBe('#7a1f1f')
  })

  it('makes dark grounds for dark mode and light ones for light', () => {
    expect(hexToOklch(paletteFrom('#2563eb', 'dark')['color.bg'])![0]).toBeLessThan(0.3)
    expect(hexToOklch(paletteFrom('#2563eb', 'light')['color.bg'])![0]).toBeGreaterThan(0.95)
  })

  it('round-trips through OKLCH', () => {
    for (const hex of ['#7c5cff', '#18181b', '#ffe600', '#3dff8f']) {
      const [l, c, h] = hexToOklch(hex)!
      expect(oklchToHex(l, c, h)).toBe(hex)
    }
  })

  it('has readable grey palettes for Sketch', () => {
    for (const mode of ['light', 'dark'] as const) {
      const p = greyPalette(mode)
      for (const [fg, bg] of CONTRAST_PAIRS) expect(contrastRatio(p[fg as keyof typeof p], p[bg as keyof typeof p])).toBeGreaterThanOrEqual(AA)
    }
  })
})

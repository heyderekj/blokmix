import { describe, expect, it } from 'vitest'
import { DIAL_NAMES, DIALS, readDials, setTone, toneOfGuide } from '@/core/dials'
import { BASE_TOKENS, contrastRatio, mixHex } from '@/core/tokens'
import { library } from '@/data/library'
import type { TokenSet } from '@/core/types'

describe('dials', () => {
  it('writes inside the knobs’ ranges and reads back where it was set', () => {
    for (const d of DIAL_NAMES) {
      for (const v of [0, 25, 50, 75, 100]) {
        const t = { ...BASE_TOKENS, ...DIALS[d].write(v) } as TokenSet
        expect(Math.abs(DIALS[d].read(t) - v), `${d} at ${v}`).toBeLessThanOrEqual(10)
      }
    }
    const lo = { ...BASE_TOKENS, ...DIALS.spacing.write(0) }
    const hi = { ...BASE_TOKENS, ...DIALS.spacing.write(100) }
    expect([lo['space.base'], lo['space.section'], hi['space.base'], hi['space.section']]).toEqual(['3px', '56px', '6px', '160px'])
    expect(DIALS.type.write(100)['type.ratio']).toBe('1.333')
    expect(DIALS.weight.write(0)['type.displayWeight']).toBe('300')
  })

  it('reads the neutral guide somewhere in the middle', () => {
    for (const v of Object.values(readDials(BASE_TOKENS))) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('mixes hex', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#ffffff', '#000000', 0)).toBe('#ffffff')
  })

  it('turns a palette dark and back, keeping text and labels readable', () => {
    for (const t of [BASE_TOKENS, ...Object.values(library.sources).map((s) => s.tokens)]) {
      const other = toneOfGuide(t) === 'light' ? 'dark' : 'light'
      const flipped = { ...t, ...setTone(t, other) } as TokenSet
      expect(toneOfGuide(flipped)).toBe(other)
      expect(contrastRatio(flipped['color.text'], flipped['color.bg'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(flipped['color.onPrimary'], flipped['color.primary'])).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(flipped['color.primary'], flipped['color.bg']), 'primary stands out').toBeGreaterThanOrEqual(3)
      expect(setTone(flipped, other)).toEqual({})
    }
  })

  it('a near-black primary follows the text color', () => {
    const dark = setTone(BASE_TOKENS, 'dark')
    expect(dark['color.primary']).toBe(dark['color.text'])
  })
})

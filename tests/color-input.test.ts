import { describe, expect, it } from 'vitest'
import { NAMED_COLORS, parseColor } from '@/core/colorInput'

describe('pasting a color', () => {
  it('takes hex with or without #, short or with alpha, and rgb()', () => {
    expect(parseColor('#A83607')).toBe('#a83607')
    expect(parseColor('a83607')).toBe('#a83607')
    expect(parseColor(' #abc ')).toBe('#aabbcc')
    expect(parseColor('#a83607ff')).toBe('#a83607')
    expect(parseColor('rgb(168, 54, 7)')).toBe('#a83607')
    expect(parseColor('rgb(168 54 7)')).toBe('#a83607')
    expect(parseColor('tomato')).toBeNull()
    expect(parseColor('#12')).toBeNull()
  })
  it('names real colors', () => {
    for (const c of NAMED_COLORS) expect(parseColor(c.hex)).toBe(c.hex)
  })
})

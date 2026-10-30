import { describe, expect, it } from 'vitest'
import { scorePage, SCREENS, type PageMeasure } from '@/core/score'

const laptop = (m: Partial<PageMeasure> = {}): PageMeasure => ({ ...SCREENS.laptop, scrollWidth: 1280, docHeight: 4000, navBottom: 72, headline: { top: 200, bottom: 320, lines: 2 }, button: { top: 380, bottom: 430 }, ...m })
const phone = (m: Partial<PageMeasure> = {}): PageMeasure => ({ ...SCREENS.phone, scrollWidth: 390, docHeight: 8440, navBottom: 64, headline: { top: 160, bottom: 340, lines: 3 }, button: { top: 420, bottom: 468 }, ...m })
const wide = (w: number, spill = 0): PageMeasure => ({ width: w, height: 900, scrollWidth: w + spill, docHeight: 4000, navBottom: 72 })

describe('scorePage', () => {
  it('passes a page whose headline and button show on both screens', () => {
    const s = scorePage({ 1280: laptop(), 390: phone(), 360: wide(360), 1440: wide(1440) })
    expect(s.score).toBe(100)
    expect(s.checks.find((c) => c.id === 'first-phone')?.words).toBe('Headline and button show on a phone without scrolling')
    expect(s.phoneScreens).toBe(10)
  })

  it('notices a button below the fold on a phone', () => {
    const s = scorePage({ 1280: laptop(), 390: phone({ button: { top: 900, bottom: 950 } }) })
    const c = s.checks.find((c) => c.id === 'first-phone')!
    expect(c.ok).toBe(false)
    expect(c.words).toMatch(/button sits below the first screen/)
    expect(s.score).toBeLessThan(100)
  })

  it('names the widths where something spills sideways', () => {
    const s = scorePage({ 1280: laptop(), 390: phone(), 360: wide(360, 40), 768: wide(768) })
    expect(s.checks.find((c) => c.id === 'no-spill')).toMatchObject({ ok: false, words: 'Something spills off the side at 360px' })
  })

  it('flags a tall nav and a long headline', () => {
    const s = scorePage({ 1280: laptop({ navBottom: 240 }), 390: phone({ headline: { top: 100, bottom: 600, lines: 7 } }) })
    expect(s.checks.find((c) => c.id === 'nav-laptop')?.ok).toBe(false)
    expect(s.checks.find((c) => c.id === 'headline-lines')?.words).toMatch(/7 lines/)
  })

  it('scores nothing without measurements', () => {
    expect(scorePage({})).toEqual({ score: 0, checks: [], phoneScreens: null })
  })
})

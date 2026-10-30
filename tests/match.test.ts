import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { matchLayouts, signatureOf, similarity, MATCH_THRESHOLD } from '@/core/match'

const layouts = Object.values(library.clips).filter((c) => c.origin === 'layout' && !c.status)

describe('matching sections to layouts', () => {
  it('reads a signature off a layout', () => {
    const s = signatureOf(library.clips['features.layout-grid'])
    expect(s.type).toBe('features')
    expect(s.items).toBeGreaterThanOrEqual(3)
    expect(s.columns).toBe(3)
    const faq = signatureOf(library.clips['faq.layout-accordion'])
    expect(faq.details).toBe(true)
    const row = signatureOf(library.clips['blog.layout-row'])
    expect(row.scroller).toBe(true)
  })

  it('every built-in layout matches itself first, at full score', () => {
    for (const c of layouts) {
      const top = matchLayouts(signatureOf(c), library, { limit: 3 })
      expect(top[0].score, c.id).toBe(1)
      expect(top.filter((m) => m.score === 1).map((m) => m.layoutId), c.id).toContain(c.id)
    }
  })

  it('tells most layouts of a type apart', () => {
    let twins = 0
    for (const c of layouts) {
      const top = matchLayouts(signatureOf(c), library, { limit: 2 })
      if (top[1] && top[1].score === 1) twins++
    }
    // A few layouts may share a structure exactly; most must be distinguishable.
    expect(twins / layouts.length).toBeLessThan(0.25)
  })

  it('scores and explains differences', () => {
    const a = signatureOf(library.clips['hero.layout-centered'])
    const b = signatureOf(library.clips['hero.layout-split'])
    const s = similarity(a, b)
    expect(s.score).toBeLessThan(1)
    expect(s.misses.length).toBeGreaterThan(0)
    expect(MATCH_THRESHOLD).toBeGreaterThan(0.5)
  })
})

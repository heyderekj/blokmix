import { describe, expect, it } from 'vitest'
import { library, starters } from '@/data/library'
import { buildStarter, describeStarter, missingClips, StarterError, type Starter } from '@/core/starters'
import { buildSeed } from '@/state/seed'
import { allSlots } from '@/core/site'

describe('starter mixes', () => {
  it('has a few, each built only from clips in the library', () => {
    expect(starters.length).toBeGreaterThanOrEqual(4)
    for (const s of starters) {
      expect(missingClips(library, s), s.id).toEqual([])
      const { site, guide, mixName } = buildStarter(library, s)
      expect(mixName).toBe(s.name)
      expect(site.pages[0].path).toBe('/')
      expect(site.shared.nav, s.id).toBeTruthy()
      expect(site.shared.footer, s.id).toBeTruthy()
      expect(Object.keys(guide.choices).length, s.id).toBeGreaterThan(0)
      const ids = allSlots(site).map((x) => x.id)
      expect(new Set(ids).size, s.id).toBe(ids.length)
      expect(new Set(site.pages.map((p) => p.path)).size, s.id).toBe(site.pages.length)
    }
  })

  it('describes what each holds', () => {
    const d = describeStarter(library, starters.find((s) => s.id === 'product-launch')!)
    expect(d.pages[0].sections[0]).toBe('nav')
  })

  it('refuses a clip the library doesn’t have', () => {
    const bad: Starter = { id: 'x', name: 'X', description: '', pages: [{ path: '/', title: 'Home', sections: ['hero.nope'] }] }
    expect(() => buildStarter(library, bad)).toThrow(StarterError)
  })

  it('still builds the demo mix with its own ids', () => {
    const seed = buildSeed(library)
    expect(seed.site.pages.map((p) => p.id)).toEqual(['page_home', 'page_about'])
    expect(seed.site.shared.nav?.id).toBe('slot_seed0')
    expect(seed.site.pages[1].slots[0].id).toBe('slot_about0')
  })
})

import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { facetCounts, facetsOf, hueOf, matchesFacets, searchClips, toneOf } from '@/core/browse'
import { DENSITIES } from '@/core/types'

const all = Object.keys(library.clips)

describe('browsing the library', () => {
  it('tags every sample clip with a density; built-in layouts leave style to the skin', () => {
    for (const clip of Object.values(library.clips)) {
      if (clip.origin === 'layout') expect(clip.style, clip.id).toBeUndefined()
      expect(DENSITIES, clip.id).toContain(clip.density)
    }
  })

  it('reads tone and color family off hex', () => {
    expect(toneOf('#ffffff')).toBe('light')
    expect(toneOf('#0b0d0e')).toBe('dark')
    expect(hueOf('#18181b')).toBe('mono')
    expect(hueOf('#2563eb')).toBe('blue')
    expect(hueOf('#e2508d')).toBe('pink')
    expect(hueOf('#16a34a')).toBe('green')
    expect(hueOf('#f97316')).toBe('orange')
    expect(hueOf('not a color')).toBe('mono')
  })

  it('reads facets off a clip', () => {
    const f = facetsOf({ ...library.clips['hero.layout-centered'], tokens: { ...library.clips['hero.layout-centered'].tokens, 'color.bg': '#0b0d0e' } })
    expect(f.type).toBe('hero')
    expect(f.tone).toBe('dark')
    expect(facetsOf({ ...library.clips['pricing.layout-tiers'], style: 'bold' }).style).toBe('bold')
    expect(facetsOf(library.clips['hero.layout-backdrop']).pictures).toBe(true)
  })

  it('searches every word across title, pattern, type and source', () => {
    const pricing = searchClips(library, all, { query: 'pricing' })
    expect(pricing.length).toBeGreaterThan(5)
    expect(pricing.every((id) => library.clips[id].type === 'pricing' || /pricing/i.test(library.clips[id].title + library.clips[id].layoutPattern))).toBe(true)
    expect(searchClips(library, all, { query: 'terminal zebra' })).toEqual([])
    expect(searchClips(library, all, { query: 'centered statement hero' })).toContain('hero.layout-centered')
    expect(searchClips(library, all, { query: '   ' })).toEqual(all)
  })

  it('combines facets: OR within a group, AND across groups', () => {
    const either = searchClips(library, all, { facets: { rhythm: ['band', 'split'] } })
    expect(either.length).toBeGreaterThan(0)
    expect(either.every((id) => ['band', 'split'].includes(library.clips[id].rhythm!))).toBe(true)
    const both = searchClips(library, all, { facets: { rhythm: ['split'], density: ['airy'] } })
    expect(both.length).toBeGreaterThan(0)
    expect(both.every((id) => library.clips[id].rhythm === 'split' && library.clips[id].density === 'airy')).toBe(true)
    // A captured clip may still carry a style.
    expect(matchesFacets({ ...library.clips['hero.layout-backdrop'], style: 'bold' }, { style: ['bold'] })).toBe(true)
    expect(matchesFacets(library.clips['hero.layout-backdrop'], { style: ['bold'] })).toBe(false)
    expect(matchesFacets(library.clips['hero.layout-backdrop'], { pictures: ['without'] })).toBe(false)
    expect(matchesFacets(library.clips['hero.layout-backdrop'], { style: [] })).toBe(true)
  })

  it('counts each facet value, and the built-in layouts are all light', () => {
    const layouts = all.filter((id) => library.clips[id].origin === 'layout')
    const counts = facetCounts(library, layouts)
    expect(Object.keys(counts.tone)).toEqual(['light'])
    expect(counts.style ?? {}).toEqual({})
  })
})

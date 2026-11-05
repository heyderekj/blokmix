import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { checkStarters, contentFor, guideFor, RECIPES, startCandidates, startersFor } from '@/core/start'
import { suggestTypes } from '@/core/suggest'
import { allSlots } from '@/core/site'
import { resolveGuide } from '@/core/guide'
import { expandTokens } from '@/core/tokens'
import { skinList } from '@/core/skins'
import { filterClips, shelfOf, toneOf } from '@/core/library'
import { DENSITIES, KINDS, type SectionType } from '@/core/types'
import { FIELD_SCHEMA } from '@/core/content'
import { KIND_WORDS, SHARED_WORDS } from '@/core/startWords'

describe('library tags', () => {
  it('tags every built-in clip with a density, and no feel: that’s the skin’s', () => {
    for (const c of Object.values(library.clips)) {
      expect(DENSITIES, c.id).toContain(c.density)
      expect(c.feel, c.id).toBeUndefined()
    }
  })

  it('filters by shelf, feel, tone, density and rhythm', () => {
    const plain = filterClips(library, { shelf: 'plain' })
    // Drafted layouts wait for review before anyone can pick them.
    expect(plain.length).toBe(Object.values(library.clips).filter((c) => c.origin === 'layout' && !c.status).length)
    expect(plain.every((id) => shelfOf(library.clips[id]) === 'plain')).toBe(true)
    const heroes = filterClips(library, { type: 'hero' })
    expect(heroes.length).toBeGreaterThan(0)
    expect(heroes.every((id) => library.clips[id].type === 'hero')).toBe(true)
    expect(filterClips(library, { type: 'hero', feel: 'editorial' })).toEqual([])
    expect(filterClips(library, { density: 'dense', rhythm: 'grid' }).every((id) => library.clips[id].density === 'dense' && library.clips[id].rhythm === 'grid')).toBe(true)
  })

  it('reads a clip’s tone from its own colors', () => {
    const base = library.clips['hero.layout-split']
    expect(toneOf({ tokens: { ...base.tokens, 'color.bg': '#0b0d12' } })).toBe('dark')
    expect(toneOf({ tokens: { ...base.tokens, 'color.primary': '#ff3d7f' } })).toBe('vivid')
    expect(toneOf(base)).toBe('light')
  })
})

describe('starter mixes', () => {
  it('load, and only use clips that exist in places a page can have them', () => {
    expect(library.starters.length).toBeGreaterThanOrEqual(6)
    expect(checkStarters(library)).toEqual([])
  })

  it('cover every kind of site', () => {
    for (const k of KINDS) expect(startersFor(library, k).length, k).toBeGreaterThan(0)
  })
})

describe('guided start', () => {
  it('has recipes a page allows, section by section', () => {
    for (const [kind, r] of Object.entries(RECIPES)) {
      for (const types of [r.home, ...(r.about ? [r.about] : [])]) {
        const slots: { type: SectionType; clipId: string }[] = []
        for (const type of types) {
          const fit = suggestTypes(slots, slots.length).find((t) => t.type === type)!
          expect(fit.allowed, `${kind}: ${type} after ${slots.map((s) => s.type).join(',')}`).toBe(true)
          slots.push({ type, clipId: '' })
        }
      }
    }
  })

  it('makes three different starts for every kind and seed, from clips that exist', () => {
    for (const kind of KINDS)
      for (const seed of [0, 1, 2]) {
        const starts = startCandidates({ kind, name: 'Fern & Co', seed }, library)
        expect(starts.length, `${kind}/${seed}`).toBe(3)
        const sigs = new Set(starts.map((s) => allSlots(s.site).map((x) => x.clipId).join(',')))
        expect(sigs.size, `${kind}/${seed}`).toBe(3)
        for (const s of starts) {
          for (const slot of allSlots(s.site)) expect(library.clips[slot.clipId], slot.clipId).toBeTruthy()
          expect(s.site.shared.nav).toBeTruthy()
          expect(s.site.shared.footer).toBeTruthy()
          expect(s.site.pages[0].slots.some((x) => x.type === 'hero')).toBe(true)
        }
      }
  })

  it('puts matching starter mixes first, raw in Wireframe', () => {
    const starts = startCandidates({ kind: 'studio', name: 'Fern' }, library)
    expect(starts[0].from).toBe('starter')
    expect(starts[0].guide.skin?.id).toBe('wireframe')
    expect(starts.some((s) => s.from === 'library')).toBe(true)
  })

  it('is the same for the same answers, and different for another seed', () => {
    const input = { kind: 'product' as const, name: 'Tally' }
    const sig = (seed?: number) => startCandidates({ ...input, seed }, library).map((s) => allSlots(s.site).map((x) => x.clipId).join(',')).join('|')
    expect(sig()).toBe(sig())
    expect(sig(1)).not.toBe(sig())
  })

  it('makes a style guide every skin can resolve, in light and dark, with or without a brand color', () => {
    for (const skin of skinList())
      for (const mode of ['light', 'dark'] as const)
        for (const brand of [undefined, '#e2508d']) {
          const g = resolveGuide(guideFor({ skin: skin.id, brand, mode }))
          expect(g.conflicts).toEqual([])
          expect(expandTokens(g.tokens)['--mx-color-bg']).toMatch(/^#/)
        }
  })

  it('has its own words for every field of every section, for every kind of site', () => {
    for (const kind of KINDS)
      for (const [type, keys] of Object.entries(FIELD_SCHEMA) as [SectionType, string[]][]) {
        const words = { ...SHARED_WORDS[type], ...KIND_WORDS[kind][type] }
        const missing = keys.filter((k) => !words[k])
        expect(missing, `${kind} ${type}`).toEqual([])
      }
  })

  it('never reads like Blokmix’s own demo', () => {
    const blokmixy = /blokmix|\bclip|\bmix\b|\bagents?\b|astro|next\.js|\bmcp\b|packet|\btokens?\b|screenshot|extension|inspo|tinkerer/i
    for (const kind of KINDS) {
      const c = contentFor({ kind, name: 'Fern & Co' }, 2026)
      for (const [type, fields] of Object.entries(c.fields))
        for (const [k, v] of Object.entries(fields!)) {
          expect(v, `${kind} ${type}.${k}`).not.toMatch(blokmixy)
          expect(v, `${kind} ${type}.${k}`).not.toMatch(/[{}]/)
        }
    }
  })

  it('fills in an email and the year', () => {
    const c = contentFor({ kind: 'studio', name: 'Fern & Co' }, 2026)
    expect(c.fields.contact?.email).toBe('hello@fernco.com')
    expect(c.fields.footer?.legal).toBe('© 2026 Fern & Co. All rights reserved.')
    expect(c.fields.footer?.brand).toBe('Fern & Co')
  })

  it('writes your name and headline into the words', () => {
    const c = contentFor({ kind: 'local', name: 'Fern Café', oneLiner: 'Slow coffee on Elm Street' })
    expect(c.brand).toBe('Fern Café')
    expect(c.fields.nav?.brand).toBe('Fern Café')
    expect(c.fields.hero?.headline).toBe('Slow coffee on Elm Street')
    expect(c.fields.nav?.cta).toBe('Book a table')
    expect(JSON.stringify(c)).not.toContain('Blokmix')
  })
})

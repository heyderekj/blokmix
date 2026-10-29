import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { checkStarters, contentFor, guideFor, RECIPES, startCandidates, startersFor } from '@/core/start'
import { suggestTypes } from '@/core/suggest'
import { allSlots } from '@/core/site'
import { resolveGuide } from '@/core/guide'
import { expandTokens } from '@/core/tokens'
import { VIBES } from '@/core/vibes'
import { filterClips, shelfOf, toneOf } from '@/core/library'
import { DENSITIES, FEELS, KINDS, type SectionType } from '@/core/types'
import { FIELD_SCHEMA } from '@/core/content'
import { KIND_WORDS, SHARED_WORDS } from '@/core/startWords'

describe('library tags', () => {
  it('tags every built-in clip with a feel and a density', () => {
    for (const c of Object.values(library.clips)) {
      expect(c.feel?.length, c.id).toBeGreaterThan(0)
      for (const f of c.feel!) expect(FEELS, c.id).toContain(f)
      expect(DENSITIES, c.id).toContain(c.density)
    }
  })

  it('filters by shelf, feel, tone, density and rhythm', () => {
    const plain = filterClips(library, { shelf: 'plain' })
    expect(plain.length).toBe(Object.values(library.clips).filter((c) => c.origin === 'layout').length)
    expect(plain.every((id) => shelfOf(library.clips[id]) === 'plain')).toBe(true)
    const editorialHeroes = filterClips(library, { type: 'hero', feel: 'editorial' })
    expect(editorialHeroes).toContain('hero.layout-editorial')
    expect(editorialHeroes.every((id) => library.clips[id].type === 'hero')).toBe(true)
    expect(filterClips(library, { density: 'dense', rhythm: 'grid' }).every((id) => library.clips[id].density === 'dense' && library.clips[id].rhythm === 'grid')).toBe(true)
  })

  it('reads a clip’s tone from its own colors', () => {
    expect(toneOf(library.clips['hero.nightowl-terminal'])).toBe('dark')
    expect(toneOf(library.clips['hero.puffin-gradient'])).toBe('vivid')
    expect(toneOf(library.clips['hero.layout-split'])).toBe('light')
  })
})

describe('starter mixes', () => {
  it('load, and only use clips that exist in places a page can have them', () => {
    expect(library.starters.length).toBeGreaterThanOrEqual(6)
    expect(checkStarters(library)).toEqual([])
  })

  it('cover every kind of site', () => {
    for (const k of KINDS) expect(startersFor(library, k, 'calm').length, k).toBeGreaterThan(0)
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

  it('makes three different starts for every kind and feel, from clips that exist', () => {
    for (const kind of KINDS)
      for (const vibe of VIBES) {
        const starts = startCandidates({ kind, name: 'Fern & Co', vibe: vibe.id }, library)
        expect(starts.length, `${kind}/${vibe.id}`).toBe(3)
        const sigs = new Set(starts.map((s) => allSlots(s.site).map((x) => x.clipId).join(',')))
        expect(sigs.size, `${kind}/${vibe.id}`).toBe(3)
        for (const s of starts) {
          for (const slot of allSlots(s.site)) expect(library.clips[slot.clipId], slot.clipId).toBeTruthy()
          expect(s.site.shared.nav).toBeTruthy()
          expect(s.site.shared.footer).toBeTruthy()
          expect(s.site.pages[0].slots.some((x) => x.type === 'hero')).toBe(true)
        }
      }
  })

  it('puts matching starter mixes first, the chosen feel’s ahead', () => {
    const starts = startCandidates({ kind: 'studio', name: 'Fern', vibe: 'editorial' }, library)
    expect(starts[0].starterId).toBe('studio-editorial')
    expect(starts.some((s) => s.from === 'library')).toBe(true)
  })

  it('is the same for the same answers, and different for another seed', () => {
    const input = { kind: 'product' as const, name: 'Tally', vibe: 'calm' }
    const sig = (seed?: number) => startCandidates({ ...input, seed }, library).map((s) => allSlots(s.site).map((x) => x.clipId).join(',')).join('|')
    expect(sig()).toBe(sig())
    expect(sig(1)).not.toBe(sig())
  })

  it('makes a style guide every vibe can resolve, in light and dark, with or without a brand color', () => {
    for (const vibe of VIBES)
      for (const mode of ['light', 'dark'] as const)
        for (const brand of [undefined, '#e2508d']) {
          const g = resolveGuide(guideFor({ vibe: vibe.id, brand, mode }))
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

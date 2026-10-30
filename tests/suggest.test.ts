import { describe, expect, it } from 'vitest'
import type { Clip, Library, Rhythm, SectionType } from '@/core/types'
import { SECTION_TYPES } from '@/core/types'
import { suggestClip, suggestTypes } from '@/core/suggest'

const page = (...types: SectionType[]) => types.map((type) => ({ type, clipId: `${type}.x` }))
const top = (slots: ReturnType<typeof page>, at: number) => suggestTypes(slots, at).filter((s) => s.allowed)
const rank = (slots: ReturnType<typeof page>, at: number, t: SectionType) => top(slots, at).findIndex((s) => s.type === t)
const find = (slots: ReturnType<typeof page>, at: number, t: SectionType) => suggestTypes(slots, at).find((s) => s.type === t)!

describe('suggestTypes', () => {
  const landing = page('nav', 'hero', 'features', 'footer')

  it('enforces hard constraints', () => {
    expect(find(landing, 2, 'nav').allowed).toBe(false)
    expect(find(landing, 2, 'footer').allowed).toBe(false)
    expect(find(landing, 2, 'hero').allowed).toBe(false)
    expect(find(landing, 4, 'cta').allowed).toBe(false) // below the footer
    expect(find(page('hero', 'footer'), 0, 'nav').allowed).toBe(true)
    expect(find(page('nav', 'features'), 2, 'footer').allowed).toBe(true)
  })

  it('offers a missing nav or footer from any gap, and suggests it first', () => {
    const bare = page('hero', 'features', 'pricing')
    expect(find(bare, 2, 'nav').allowed).toBe(true)
    expect(find(bare, 1, 'footer').allowed).toBe(true)
    expect(top(bare, 3).slice(0, 3).map((s) => s.type)).toEqual(expect.arrayContaining(['footer', 'nav']))
    // Below an existing footer, only the missing nav still fits.
    const ended = page('hero', 'footer')
    expect(find(ended, 2, 'nav').allowed).toBe(true)
    expect(find(ended, 2, 'cta').allowed).toBe(false)
  })

  it('suggests logos or features after the hero', () => {
    const picks = top(landing, 2).slice(0, 2).map((s) => s.type)
    expect(picks).toContain('logos')
    expect(find(landing, 2, 'logos').reason).toMatch(/hero/i)
  })

  it('suggests a CTA above the footer when the page has none', () => {
    expect(top(landing, 3)[0].type).toBe('cta')
    expect(find(landing, 3, 'cta').reason).toMatch(/before the footer/)
  })

  it('suggests FAQ after pricing', () => {
    expect(top(page('nav', 'hero', 'pricing', 'cta', 'footer'), 3)[0].type).toBe('faq')
    // Right above the footer with no CTA yet, both are good calls.
    expect(rank(page('nav', 'hero', 'pricing', 'footer'), 3, 'faq')).toBeLessThan(2)
  })

  it('leans towards inner-page sections under a page header', () => {
    const inner = page('nav', 'header', 'footer')
    const picks = top(inner, 2).slice(0, 3).map((s) => s.type)
    expect(picks).toContain('content')
    expect(picks).not.toContain('pricing')
  })

  it('penalises repeats', () => {
    expect(rank(landing, 3, 'features')).toBeGreaterThan(rank(landing, 3, 'testimonials'))
    expect(find(landing, 3, 'features').score).toBeLessThan(0)
  })

  it('always explains itself', () => {
    for (const s of suggestTypes(landing, 2)) expect(s.reason.length, s.type).toBeGreaterThan(0)
  })
})

describe('suggestClip', () => {
  const clip = (id: string, origin: 'clip' | 'layout', rhythm: Rhythm, sourceId = id.split('.')[1]): Clip =>
    ({ id, type: id.split('.')[0] as SectionType, sourceId, origin, rhythm, title: id }) as Clip
  const clips = [
    clip('hero.split', 'clip', 'split'),
    clip('cta.mine', 'clip', 'split'),
    clip('cta.layout-band', 'layout', 'band', 'layout'),
    clip('cta.layout-split', 'layout', 'split', 'layout'),
    clip('cta.layout-centered', 'layout', 'centered', 'layout'),
  ]
  const byType = Object.fromEntries(SECTION_TYPES.map((t) => [t, clips.filter((c) => c.type === t).map((c) => c.id)]))
  const lib = { clips: Object.fromEntries(clips.map((c) => [c.id, c])), byType, layoutsByType: byType, sources: {}, warnings: [] } as unknown as Library
  const slots = [{ type: 'hero' as const, clipId: 'hero.split' }]

  it('puts layouts first and keeps your clips after them', () => {
    const ranked = suggestClip('cta', slots, 1, lib)
    expect(ranked[0].clipId).toMatch(/layout/)
    expect(ranked.at(-1)).toMatchObject({ clipId: 'cta.mine', reason: 'From your clips' })
  })

  it('orders layouts by rhythm contrast with the section above', () => {
    const layouts = suggestClip('cta', slots, 1, lib).filter((s) => s.clipId.includes('layout'))
    expect(layouts.at(-1)!.clipId).toBe('cta.layout-split')
    expect(layouts[0].reason).toMatch(/to contrast the split hero above/)
  })

  it('uses the neighbours of the replaced section', () => {
    const withCta = [...slots, { type: 'cta' as const, clipId: 'cta.layout-split' }]
    const layouts = suggestClip('cta', withCta, 1, lib, true).filter((s) => s.clipId.includes('layout'))
    expect(layouts.at(-1)!.clipId).toBe('cta.layout-split')
  })
})

import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { directions } from '@/data/directions'
import { INDUSTRIES, FORMATS } from '@/core/brief'
import { checkDirections, directionById, directionPage, directionStart, rankDirections } from '@/core/directions'
import { resolveGuide } from '@/core/guide'
import { heroFamily } from '@/core/heroLayouts'
import { RECIPES } from '@/core/start'
import { KINDS } from '@/core/types'
import { noteTaste } from '@/core/taste'

const input = { kind: 'local' as const, name: 'Mill', brief: { industry: 'food' as const, format: 'business' as const } }

describe('the directions', () => {
  it('all resolve: themes, parts and layouts that are offered', () => {
    expect(checkDirections(library)).toEqual([])
    expect(directions.length).toBeGreaterThanOrEqual(30)
  })
  it('cover every industry and format', () => {
    for (const i of INDUSTRIES) expect(directions.some((d) => d.industries?.includes(i)), i).toBe(true)
    for (const f of FORMATS) expect(directions.some((d) => d.formats?.includes(f)), f).toBe(true)
  })
  it('dress any section list with their own layouts where they have them', () => {
    const d = directionById('corner-bakery')!
    for (const kind of KINDS) {
      const page = directionPage(d, RECIPES[kind].home, library)
      expect(page.map((id) => library.clips[id].type)).toEqual(RECIPES[kind].home)
    }
    expect(directionPage(d, ['nav', 'hero', 'pricing', 'footer'], library)).toContain('hero.layout-backdrop')
  })
  it('a start in a direction wears its look and keeps your brand color', () => {
    const start = directionStart(directionById('ledger')!, { ...input, kind: 'product', brand: '#0a7d4f' }, library)
    expect(start.direction).toBe('ledger')
    expect(start.guide.skin?.id).toBe('mastered')
    expect(resolveGuide(start.guide).tokens['color.primary'].toLowerCase()).toBe('#0a7d4f')
    expect(start.site.pages[0].slots.some((s) => s.clipId === 'hero.layout-product')).toBe(true)
  })
  it('a starter keeps its own theme as a direction', () => {
    const d = directions.find((x) => x.starterId === 'local-friendly')!
    expect(d.theme).toBe('lofi')
    expect(directionStart(d, input, library).guide.skin?.id).toBe('lofi')
  })
})

describe('rankDirections', () => {
  it('puts the industry’s own first, never two alike, the same every time', () => {
    const row = rankDirections({ input, lib: library })
    expect(row).toHaveLength(3)
    expect(row[0].direction.industries).toContain('food')
    expect(new Set(row.map((r) => r.direction.theme.split('/')[0])).size).toBe(3)
    const heroes = row.map((r) => directionStart(r.direction, input, library).site.pages[0].slots.find((s) => s.type === 'hero')!.clipId)
    expect(new Set(heroes.map((h) => heroFamily(h, library))).size).toBe(3)
    expect(rankDirections({ input, lib: library }).map((r) => r.direction.id)).toEqual(row.map((r) => r.direction.id))
  })
  it('keeps strange ones back until someone leans that way', () => {
    const plain = rankDirections({ input: { kind: 'event', brief: { industry: 'events' } }, lib: library, count: 4 })
    expect(plain.every((r) => (r.direction.odd ?? 0) < 2)).toBe(true)
    const taste = noteTaste(undefined, { kind: 'more', traits: ['odd', 'bold', 'dark'], source: 'you' })
    const odd = rankDirections({ input: { kind: 'event', brief: { industry: 'events' } }, lib: library, taste, count: 4 })
    expect(odd.some((r) => r.direction.odd === 2)).toBe(true)
  })
  it('leaves out what was just passed on, and puts some together when the curated ones run out', () => {
    const row = rankDirections({ input, lib: library })
    const taste = noteTaste(undefined, ...row.map((r) => ({ kind: 'passed' as const, traits: [], ref: r.direction.id, source: 'you' as const })))
    const next = rankDirections({ input, lib: library, taste })
    expect(next.some((r) => row.some((x) => x.direction.id === r.direction.id))).toBe(false)
    const all = directions.map((d) => d.id)
    const composed = rankDirections({ input, lib: library, exclude: all })
    expect(composed).toHaveLength(3)
    expect(composed.every((r) => !r.direction.curated)).toBe(true)
  })
  it('pins: the same look on other layouts, or the same layouts in other looks', () => {
    const look = rankDirections({ input, lib: library, pin: { look: 'lofi' } })
    expect(look.every((r) => r.direction.theme === 'lofi')).toBe(true)
    const layout = rankDirections({ input, lib: library, pin: { layout: 'corner-bakery' } })
    expect(layout.every((r) => r.direction.layouts.hero?.[0] === 'hero.layout-backdrop')).toBe(true)
    expect(new Set(layout.map((r) => r.direction.theme)).size).toBe(3)
  })
})

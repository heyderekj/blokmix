import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import '@/data/directions'
import { baseDirection, briefTaste, startVersions } from '@/core/startVersions'
import { heroFamily } from '@/core/heroLayouts'
import { leanOf, noteTaste } from '@/core/taste'
import { mixFromStart } from '@/lib/start'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

const input = { kind: 'local' as const, name: 'Mill', sections: undefined, brief: { industry: 'food' as const, format: 'business' as const } }
const opener = (v: { start: { site: { pages: { slots: { type: string; clipId: string }[] }[] } } }) => {
  const hero = v.start.site.pages[0].slots.find((s) => s.type === 'hero')!.clipId
  return heroFamily(hero, library)
}

describe('the start’s row of versions', () => {
  it('differ in layout and look, each saying what it is', () => {
    const row = startVersions(input, library, { count: 4 })
    expect(row).toHaveLength(4)
    expect(new Set(row.map((v) => v.theme)).size).toBe(4)
    expect(new Set(row.map(opener)).size).toBeGreaterThanOrEqual(3)
    for (const v of row) {
      expect(v.why.length).toBeGreaterThan(10)
      expect(v.direction).toBeTruthy()
      expect(v.traits.length).toBeGreaterThan(0)
    }
    expect(new Set(row.map((v) => v.start.id)).size).toBe(4)
  })

  it('keeps the old layouts-only row for agents that ask for it', () => {
    const row = startVersions({ ...input, skin: 'lofi' }, library, { count: 3, vary: 'layout' })
    expect(row.every((v) => v.start.guide.skin && v.theme === 'lofi')).toBe(true)
  })

  it('holds the look you keep and changes the layouts', () => {
    const [first] = startVersions(input, library, { count: 4 })
    const row = startVersions(input, library, { count: 4, pin: { look: first.theme }, keep: first })
    expect(row[0].start.id).toBe(first.start.id)
    expect(row.every((v) => v.theme === first.theme)).toBe(true)
    expect(new Set(row.map((v) => baseDirection(v.direction!))).size).toBe(4)
  })

  it('holds the layout you keep and changes the look', () => {
    const [first] = startVersions(input, library, { count: 4 })
    const row = startVersions(input, library, { count: 4, pin: { layout: first.direction }, keep: first })
    expect(row[0].start.id).toBe(first.start.id)
    expect(row.slice(1).every((v) => baseDirection(v.direction!) === baseDirection(first.direction!))).toBe(true)
    expect(new Set(row.map((v) => v.theme)).size).toBe(4)
  })

  it('leaves out what was passed on', () => {
    const row = startVersions(input, library, { count: 4 })
    const taste = noteTaste(undefined, ...row.map((v) => ({ kind: 'passed' as const, traits: v.traits, ref: v.direction, source: 'you' as const })))
    const next = startVersions(input, library, { count: 4, taste })
    expect(next.some((v) => row.some((r) => r.direction === v.direction))).toBe(false)
  })

  it('leans away from what the brief says to avoid, and toward its own feel words', () => {
    const lean = leanOf(briefTaste({ brief: { avoid: ['serious'], feelWords: ['warm and handmade'] } }))
    expect(lean.serious).toBeLessThan(0)
    expect(lean.warm).toBeGreaterThan(0)
    expect(briefTaste({ brief: {} })).toBeUndefined()
  })

  it('makes the pages that were asked for, in the direction’s look', () => {
    const [v] = startVersions({ ...input, sections: ['nav', 'hero', 'features', 'footer'], pages: [{ template: 'about' }, { template: 'contact' }, { template: 'blank', purpose: 'our classes' }] }, library, { count: 1 })
    const pages = v.start.site.pages
    expect(pages.map((p) => p.path)).toEqual(['/', '/about', '/contact', '/our-classes'])
    expect(pages.slice(1).every((p) => p.slots.length > 0 && p.slots.every((s) => s.type !== 'nav' && s.type !== 'footer'))).toBe(true)
  })

  it('opens as one draft that remembers what you picked', () => {
    const row = startVersions(input, library, { count: 3 })
    const taste = noteTaste(undefined, { kind: 'picked', traits: row[1].traits, ref: row[1].direction, source: 'you' })
    const starts = row.map((v, i) => (i === 1 ? { ...v.start, content: { ...v.start.content, taste } } : v.start))
    const mix = mixFromStart({ name: 'Mill' }, starts, row[1].start.id)
    expect(Object.keys(mix.drafts)).toHaveLength(1)
    expect(mix.site).toBe(row[1].start.site)
    expect(mix.content.taste?.events[0].ref).toBe(row[1].direction)
  })
})

describe('suggest_starts and apply_start', () => {
  it('read a description, vary layout and look, and make the pages asked for', async () => {
    const out = (await runCommand('suggest_starts', { text: 'A bakery called Fern & Co with our menu, not fancy', name: 'Fern & Co', count: 4, vary: 'both', pages: [{ template: 'about' }] }, 'agent')) as {
      heard: { by: string; kind: string; sections: string[]; avoid: string[] }
      starts: { why?: string; direction?: string; pages: { path: string }[] }[]
    }
    expect(out.heard.by).toBe('keywords')
    expect(out.heard.kind).toBe('local')
    expect(out.heard.sections).toContain('pricing')
    expect(out.heard.avoid).toEqual(['classic'])
    expect(out.starts).toHaveLength(4)
    expect(out.starts.every((s) => s.direction && s.why && s.pages.some((p) => p.path === '/about'))).toBe(true)
    const applied = (await runCommand('apply_start', { kind: 'local', name: 'Fern & Co', count: 4, vary: 'both', start: 2 }, 'agent')) as { start: number; direction?: string }
    expect(applied.start).toBe(2)
    expect(useStore.getState().guide.skin).toBeTruthy()
  })
})

describe('suggest_starts keeps what it heard', () => {
  it('when an answer is left out', async () => {
    const out = (await runCommand('suggest_starts', { text: 'A bakery that takes pre-orders', name: 'Mill', vary: 'both' }, 'agent')) as { heard: { format: string | null; industry: string | null; goals: string[] } }
    expect(out.heard.industry).toBe('food')
    expect(out.heard.goals).toContain('orders')
  })
})

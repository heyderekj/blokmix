import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCommand } from '@/state/commands'
import { currentSlots, useStore } from '@/state/store'
import { allSlots } from '@/core/site'
import { fitsFor, readsAs } from '@/state/wordsFit'
import { retypeSection, sectionLines } from '@/state/retype'
import { fakeJev, realJev } from './helpers/fakeJev'

const st = () => useStore.getState()
const view = () => currentSlots(st())

beforeEach(() => {
  st().resetDemo()
  useStore.temporal.getState().clear()
})
afterEach(() => realJev())

describe('layouts that fit your words', () => {
  it('lists each section’s fits, the current one first and every one holding its items', () => {
    for (const f of fitsFor(view())) {
      expect(f.fits[0]?.current).toBe(true)
      for (const x of f.fits.slice(1)) if (f.items.count && Number.isFinite(x.holds)) expect(x.holds).toBeGreaterThanOrEqual(f.items.count)
      expect(f.fits.length).toBeLessThanOrEqual(4)
    }
    expect(fitsFor(view()).some((f) => f.slot.type === 'nav')).toBe(false)
  })

  it('asks once per page what the words read as, and says only what differs, sure and agreed', async () => {
    const faq = view().find((s) => s.type === 'features')!
    const fake = fakeJev((name) => (name.startsWith(`as_${faq.id}`) ? { option: 'faq', p: 0.8 } : name.startsWith('as_') ? { option: 'hero', p: 0.2 } : undefined))
    const r1 = await readsAs(view())
    expect(r1?.[faq.id]?.type).toBe('faq')
    expect(Object.keys(r1!)).toEqual([faq.id])
    await readsAs(view())
    expect(fake.requests).toHaveLength(1)
  })

  it('answers suggest_layouts_for_words for agents', async () => {
    const out = (await runCommand('suggest_layouts_for_words', { read: false }, 'agent')) as { type: string; fits: { current: boolean }[] }[]
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((s) => s.fits.some((f) => f.current))).toBe(true)
  })
})

describe('turning a section into another kind', () => {
  it('keeps its place, its id and its words, as one undo step', async () => {
    // History takes one step per 400ms (store.ts `leading`).
    await new Promise((r) => setTimeout(r, 450))
    const f = view().find((s) => s.type === 'features')!
    const before = sectionLines(f).lines.map((l) => l.text)
    const ids = view().map((s) => s.id)
    useStore.temporal.getState().clear()
    const out = retypeSection(f.id, 'faq')!
    expect(out).toBeTruthy()
    const after = view().find((s) => s.id === f.id)!
    expect(after.type).toBe('faq')
    expect(view().map((s) => s.id)).toEqual(ids)
    const now = sectionLines(after).lines.map((l) => l.text)
    const tray = (st().content.tray ?? []).map((t) => t.text)
    for (const line of before) expect([...now, ...tray]).toContain(line)
    useStore.temporal.getState().undo()
    expect(allSlots(st().site).find((s) => s.id === f.id)!.type).toBe('features')
  })

  it('runs as retype_section', () => {
    const f = view().find((s) => s.type === 'features')!
    const out = runCommand('retype_section', { section: f.id, type: 'faq' }) as { type: string }
    expect(out.type).toBe('faq')
    expect(() => runCommand('retype_section', { section: f.id, type: 'pricing', layout: 'hero.layout-split' })).toThrow()
  })
})

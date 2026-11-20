import { describe, expect, it } from 'vitest'
import { dismissStep, landedSteps, nextSteps, shortMiss, type NextStepsInput } from '@/core/nextSteps'
import { firstSample } from '@/core/ownWords'
import { library } from '@/data/library'
import type { ProjectContent, Slot } from '@/core/types'

const slots = [
  { id: 's1', type: 'nav', clipId: 'nav/a' },
  { id: 's2', type: 'hero', clipId: 'hero/a' },
  { id: 's3', type: 'features', clipId: 'features/a' },
]
const input = (patch: Partial<NextStepsInput> = {}): NextStepsInput => ({
  state: landedSteps(slots, 'lofi'),
  slots,
  sample: { left: 12, total: 20 },
  skin: 'lofi',
  openerLayouts: 9,
  themes: 26,
  ...patch,
})

describe('next steps after a start', () => {
  it('offers words, another opener and a look, each with why', () => {
    const steps = nextSteps(input())
    expect(steps.map((s) => s.id)).toEqual(['words', 'layout', 'look'])
    expect(steps[0].why).toBe('12 spots still show sample text')
    expect(steps[1].why).toBe('8 more ways to start the page')
    expect(steps[1].action).toEqual({ kind: 'layouts', slotId: 's2' })
    for (const s of steps) expect(s.why.length).toBeLessThan(45)
  })

  it('says what the first screen got wrong when it was measured', () => {
    const checks = [{ id: 'first-phone', ok: false, words: 'On a phone, the headline continues below the first screen', weight: 2 }]
    expect(nextSteps(input({ checks }))[1].why).toBe('Headline runs past a phone’s first screen')
    expect(shortMiss('On a laptop, the button sits below the first screen')).toBe('Button runs past a laptop’s first screen')
    expect(shortMiss('The nav takes 24% of a phone’s first screen')).toBe('Nav takes 24% of a phone’s first screen')
    expect(shortMiss('Part of the headline is clipped on a phone')).toBe('Headline is clipped on a phone')
  })

  it('retires each hint once it’s done', () => {
    expect(nextSteps(input({ sample: { left: 0, total: 20 } })).map((s) => s.id)).toEqual(['layout', 'look'])
    const changed = slots.map((s) => (s.id === 's2' ? { ...s, clipId: 'hero/b' } : s))
    expect(nextSteps(input({ slots: changed })).map((s) => s.id)).toEqual(['words', 'look'])
    expect(nextSteps(input({ skin: 'studio' })).map((s) => s.id)).toEqual(['words', 'layout'])
  })

  it('keeps what you set aside out, and shows nothing without a start', () => {
    const state = dismissStep(dismissStep(landedSteps(slots, 'lofi'), 'words'), 'look')
    expect(nextSteps(input({ state })).map((s) => s.id)).toEqual(['layout'])
    expect(dismissStep(state, 'look')).toBe(state)
    expect(nextSteps(input({ state: null }))).toEqual([])
  })
})

describe('firstSample', () => {
  it('finds the first spot on the page still holding sample words', () => {
    const hero = Object.values(library.clips).find((c) => c.type === 'hero' && c.fields.headline)!
    const slot = { id: 'x1', type: 'hero', clipId: hero.id, keep: {}, words: {} } as unknown as Slot
    const content: ProjectContent = { brand: 'Fern', fields: {} }
    const spot = firstSample([slot], (s) => library.clips[s.clipId], content)
    expect(spot?.slotId).toBe('x1')
    const all = Object.fromEntries(hero.blocks.filter((b) => b.field).map((b) => [b.field!, 'Mine']))
    expect(firstSample([{ ...slot, words: all }], (s) => library.clips[s.clipId], content)).toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { slotClip } from '@/data/library'
import { firstScreenWords, fiveSecondRequest, readFiveSecond } from '@/core/jev/fiveSecond'
import type { JevResponse } from '@/core/jev'
import { answerFor, fakeJev, realJev } from './helpers/fakeJev'

// No frames in Node: the first screen "shows" the nav and the hero, at both widths.
vi.mock('@/lib/measure', async (orig) => {
  const real = await orig<typeof import('@/lib/measure')>()
  return {
    ...real,
    measureFirstScreen: vi.fn(async (_data: unknown, width: number, height: number) => {
      const { useStore, currentSlots } = await import('@/state/store')
      const { slotClip } = await import('@/data/library')
      const top = currentSlots(useStore.getState()).filter((s) => s.type === 'nav' || s.type === 'hero')
      const shown = top.flatMap((s) => slotClip(s).blocks.map((b) => ({ slot: s.id, block: b.id })))
      return { width, height, scrollWidth: width, docHeight: height * 4, navBottom: 64, headline: { top: 200, bottom: 300, lines: 2 }, button: { top: 400, bottom: 448 }, shown }
    }),
  }
})

beforeEach(() => {
  useStore.getState().resetDemo()
})
afterEach(() => realJev())

const said = (kind: string | { option: string; p: number }, agree = true, nouls: Record<string, number> = {}): JevResponse => {
  const fs = { nav: [], buttons: ['Start'], other: [], headline: 'x' }
  const q = fiveSecondRequest(fs).questions
  const answers = Object.fromEntries(
    Object.entries(q).map(([name, qq]) => [name, answerFor(qq, name === 'kind' ? kind : name === 'kind__r' ? (agree ? kind : { option: 'unclear', p: 0.6 }) : (nouls[name] ?? 0.9))]),
  )
  return { model: 'fake', answers, usage: { input_tokens: 0, output_tokens: 0 } }
}

describe('the five-second test', () => {
  it('sorts what a visitor sees into brand, nav, headline, intro and buttons', () => {
    const slots = currentSlots(useStore.getState())
    const nav = slots.find((s) => s.type === 'nav')!
    const hero = slots.find((s) => s.type === 'hero')!
    const fs = firstScreenWords([
      ...slotClip(nav).blocks.filter((b) => b.kind === 'link').map((b) => ({ block: b, words: b.label, sectionType: 'nav' })),
      { block: { id: 'h', kind: 'heading', label: 'Headline', field: 'headline' } as never, words: 'Bread worth getting up for', sectionType: 'hero' },
      { block: { id: 'l', kind: 'text', label: 'Intro', field: 'intro' } as never, words: 'Order by 8, pick up by 10.', sectionType: 'hero' },
      { block: { id: 'b', kind: 'button', label: 'Button' } as never, words: 'See the menu', sectionType: 'hero' },
    ])
    expect(fs.headline).toBe('Bread worth getting up for')
    expect(fs.intro).toBe('Order by 8, pick up by 10.')
    expect(fs.buttons).toEqual(['See the menu'])
    expect(fs.nav.length).toBeGreaterThan(0)
    void hero
  })

  it('says a visitor is sure only when both option orders agree', () => {
    const fs = { nav: [], buttons: ['Order'], other: [], headline: 'Bread' }
    expect(readFiveSecond(said({ option: 'local', p: 0.9 }), fs)?.words).toBe('A visitor would guess a local business, and be sure of it.')
    expect(readFiveSecond(said({ option: 'local', p: 0.9 }, false), fs)?.kind).toBeNull()
  })

  it('names the two kinds a visitor is torn between', () => {
    const torn: JevResponse = said('x')
    const probs = { product: 0.42, studio: 0.38, local: 0.05, event: 0.05, personal: 0.05, writing: 0.03, unclear: 0.02 }
    torn.answers.kind = { type: 'choice', choice: 'product', confidence: 0.3, probabilities: probs }
    torn.answers.kind__r = { type: 'choice', choice: 'product', confidence: 0.3, probabilities: probs }
    const r = readFiveSecond(torn, { nav: [], buttons: [], other: [], headline: 'Make it' })!
    expect(r.torn).toEqual(['product', 'studio'])
    expect(r.words).toBe('A visitor could take this for a product or app or a studio or service.')
  })

  it('compares a visitor’s guess with what you said the site is', () => {
    const r = readFiveSecond(said({ option: 'studio', p: 0.9 }), { nav: [], buttons: ['Hire us'], other: [], headline: 'We design' }, 'product')!
    expect(r.mismatch).toBe('product')
    expect(r.checks[0]).toMatchObject({ id: 'five-second', ok: false, words: 'A visitor would guess a studio or service, and be sure of it, not a product or app' })
  })

  it('fails a vague headline or button and leaves a maybe uncounted', () => {
    const r = readFiveSecond(said({ option: 'product', p: 0.9 }, true, { offer: 0.2, button: 0.5 }), { nav: [], buttons: ['Learn more'], other: [], headline: 'Dream bigger' })!
    expect(r.checks.find((c) => c.id === 'says-what')).toMatchObject({ ok: false, weight: 1, words: 'The headline could be anyone’s: say what you offer' })
    expect(r.checks.find((c) => c.id === 'button-says')).toMatchObject({ ok: false, weight: 0 })
  })

  it('runs as a command that sends only the first screen’s words and joins the page score', async () => {
    const fake = fakeJev((name) => (name.startsWith('kind') ? { option: 'product', p: 0.88 } : 0.9))
    const out = (await runCommand('five_second_test', {})) as { visitor: string; score: number; checks: string[]; first_screen: { headline?: string } }
    expect(out.visitor).toBe('A visitor would guess a product or app, and be sure of it.')
    expect(out.checks.some((c) => c.includes('without scrolling'))).toBe(true)
    expect(out.checks.some((c) => c.includes('says what you offer'))).toBe(true)
    const state = JSON.stringify(fake.requests[0].state)
    const pricing = currentSlots(useStore.getState()).find((s) => s.type === 'pricing')!
    // Nothing below the fold goes: no pricing words.
    expect(state).not.toContain(slotClip(pricing).title)
    expect(out.first_screen.headline).toBeTruthy()
  })
})

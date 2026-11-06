import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { deadLinks, useJevLinks } from '@/state/jevLinks'
import { advise } from '@/core/advise'
import { slotClip } from '@/data/library'
import { wordsFor } from '@/state/commands/refs'
import type { ChoiceQuestion, JevRequest } from '@/core/jev'
import { fakeJev, realJev } from './helpers/fakeJev'

/** Which link a question is about, from its name (to_3 / to_3__r) and the state. */
const linkOf = (name: string, req: JevRequest) => (req.questions[name].instructions as { words: string })

/** The option key for a section of this type on the open page. */
const sectionKey = (q: ChoiceQuestion, type: string) => {
  const slot = currentSlots(useStore.getState()).find((s) => s.type === type)!
  return Object.keys(q.criteria).find((k) => k === `s_${slot.id}`)!
}

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
  useJevLinks.setState({ guesses: {} })
})
afterEach(() => realJev())

describe('smart links', () => {
  it('asks only about links that lead nowhere, and never the section they sit in', () => {
    const fake = fakeJev()
    const dead = deadLinks(currentSlots(useStore.getState()))
    expect(dead.map((d) => d.words)).toContain('Start a mix')
    expect(dead.map((d) => d.words)).not.toContain('Pricing')
    return (runCommand('place_links', { section: 'hero' }) as Promise<unknown>).then(() => {
      const req = fake.requests[0]
      const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
      const q = req.questions.to_0 as ChoiceQuestion
      expect(Object.keys(q.criteria)).not.toContain(`s_${hero.id}`)
      expect(Object.keys(q.criteria)).toContain('stay')
      // Asked in both option orders.
      expect(Object.keys((req.questions.to_0__r as ChoiceQuestion).criteria)[0]).toBe('stay')
    })
  })

  it('sets the sure ones as one undo step and offers the rest', async () => {
    fakeJev((name, q, req) => {
      if (q.type !== 'choice') return undefined
      const words = linkOf(name, req).words
      if (words === 'Start a mix') return { option: sectionKey(q, 'pricing'), p: 0.93 }
      if (words === 'Watch the demo') return { option: sectionKey(q, 'features'), p: 0.62 }
      return { option: 'stay', p: 0.8 }
    })
    const out = (await runCommand('place_links', { section: 'hero' })) as { set: { words: string; goes_to: string }[]; suggestions: { words: string }[] }
    expect(out.set).toEqual([expect.objectContaining({ words: 'Start a mix', goes_to: 'Pricing section' })])
    expect(out.suggestions.map((s) => s.words)).toEqual(['Watch the demo'])
    const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
    const pricing = currentSlots(useStore.getState()).find((s) => s.type === 'pricing')!
    expect(hero.edits?.[hero.clipId]?.b3?.link).toEqual({ to: 'section', slotId: pricing.id })
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)

    // The checklist offers the unsure one as a one-click fix.
    const clip = slotClip(hero)
    const g = useJevLinks.getState().guesses[`${hero.id}:b4`]
    const advice = advise({ blocks: clip.blocks, edits: hero.edits?.[hero.clipId], tokens: useStore.getState().guide.base as never, fields: wordsFor(hero), links: { b4: { href: '#' } }, linkGuesses: { b4: { target: g.target!, label: g.label } } })
    expect(advice.find((a) => a.blockId === 'b4' && a.rule === 'dead-link')?.fix).toEqual({ label: 'Point it at Features', edit: { link: { to: 'section', slotId: expect.any(String) } } })
  })

  it('leaves a link alone when the two option orders disagree', async () => {
    fakeJev((name, q, req) => {
      if (q.type !== 'choice' || linkOf(name, req).words !== 'Start a mix') return { option: 'stay', p: 0.9 }
      return name.endsWith('__r') ? { option: sectionKey(q, 'features'), p: 0.9 } : { option: sectionKey(q, 'pricing'), p: 0.9 }
    })
    const out = (await runCommand('place_links', { section: 'hero' })) as { set: unknown[] }
    expect(out.set).toEqual([])
  })

  it('says suggestions are off instead of guessing', async () => {
    fakeJev(() => undefined, { off: true })
    await expect(runCommand('place_links', {}) as Promise<unknown>).rejects.toThrow(/Suggestions (are off|aren’t available)/)
  })
})

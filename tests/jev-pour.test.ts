import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { splitLines, roleOfField } from '@/core/jev/pour'
import { placeFromTray, setTray, trayLines } from '@/state/jevPour'
import { wordsFor } from '@/state/commands/refs'
import type { JevRequest } from '@/core/jev'
import { fakeJev, realJev } from './helpers/fakeJev'

const TEXT = `# Mill Bakery

Bread worth getting up for.
Order by 8, pick up by 10.

What we bake
- Sourdough
- 36 hours, start to finish.
- Rye
- Dark, dense and seeded.
- Croissants
- Butter from the farm down the road.

“Best croissant in town.”
Priya Shah
Regular since 2019`

/** What each line "is" and where it goes, as Jev would say. */
const ROLE: Record<string, string> = {
  'Mill Bakery': 'other',
  'Bread worth getting up for.': 'headline',
  'Order by 8, pick up by 10.': 'lead',
  'What we bake': 'heading',
  Sourdough: 'title',
  '36 hours, start to finish.': 'body',
  Rye: 'title',
  'Dark, dense and seeded.': 'body',
  Croissants: 'title',
  'Butter from the farm down the road.': 'body',
  '“Best croissant in town.”': 'quote',
  'Priya Shah': 'name',
  'Regular since 2019': 'role',
}
const SECTION: Record<string, string> = { headline: 'hero', lead: 'hero', heading: 'features', title: 'features', body: 'features', quote: 'testimonials', name: 'testimonials', role: 'testimonials', other: 'hero' }

const sid = (type: string) => currentSlots(useStore.getState()).find((s) => s.type === type)!.id
/** The line a question carries (each question holds its own words). */
const lineText = (_name: string, _req: JevRequest, q?: { instructions: unknown }) => (q?.instructions as { line: string } | undefined)?.line ?? ''

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
  setTray(() => [])
})
afterEach(() => realJev())

describe('pour in your words', () => {
  it('splits text into lines: bullets, headings, runs, Q/A and contact details', () => {
    const lines = splitLines('# Hello\n\n- one\n- two\n\nQ: Do you deliver?\nA: Yes.\nhello@mill.com\n$12')
    expect(lines.map((l) => l.text)).toEqual(['Hello', 'one', 'two', 'Do you deliver?', 'Yes.', 'hello@mill.com', '$12'])
    expect(lines[0].heading).toBe(true)
    expect(lines.map((l) => l.sure)).toEqual([undefined, undefined, undefined, 'question', 'answer', 'contact', 'price'])
    expect(new Set(lines.map((l) => l.group)).size).toBe(3)
  })

  it('knows what a section’s fields are for', () => {
    expect(roleOfField('hero', 'headline')).toBe('headline')
    expect(roleOfField('hero', 'ctaPrimary')).toBe('button')
    expect(roleOfField('faq', 'faq1Q', 'q')).toBe('question')
    expect(roleOfField('team', 'm1Name', 'name')).toBe('name')
    expect(roleOfField('pricing', 't1Name', 'name')).toBe('title')
    expect(roleOfField('content', 'body2')).toBe('paragraph')
  })

  it('places every line word for word, grows lists to fit, and keeps what it replaced', async () => {
    fakeJev((name, q, req) => {
      const text = lineText(name, req, q)
      if (name.startsWith('role_')) return text === 'Mill Bakery' ? { option: 'other', p: 0.3 } : { option: ROLE[text], p: 0.92 }
      if (name.startsWith('section_')) return { option: `s_${sid(SECTION[ROLE[text]])}`, p: text === 'Mill Bakery' ? 0.4 : 0.9 }
      if (name.startsWith('list_')) return 0.9
      return undefined
    })
    const heroBefore = wordsFor(currentSlots(useStore.getState()).find((s) => s.type === 'hero')!).headline
    const out = (await runCommand('pour_words', { text: TEXT }, 'you')) as { placed: number; message: string; waiting: { text: string }[] }
    const slots = currentSlots(useStore.getState())
    const hero = slots.find((s) => s.type === 'hero')!
    const features = slots.find((s) => s.type === 'features')!
    const testimonials = slots.find((s) => s.type === 'testimonials')!
    expect(wordsFor(hero).headline).toBe('Bread worth getting up for.')
    expect(Object.values(wordsFor(hero))).toContain('Order by 8, pick up by 10.')
    expect(wordsFor(features).heading).toBe('What we bake')
    const fw = Object.values(wordsFor(features))
    for (const w of ['Sourdough', 'Rye', 'Croissants', 'Dark, dense and seeded.']) expect(fw).toContain(w)
    expect(Object.values(wordsFor(testimonials))).toContain('“Best croissant in town.”')
    // Nothing reworded: every placed word is a line of the input.
    const input = new Set(splitLines(TEXT).map((l) => l.text))
    for (const s of [hero, features, testimonials]) for (const w of Object.values(s.words ?? {})) expect(input.has(w), w).toBe(true)
    // What the headline said before is an option now.
    expect(hero.options?.headline?.map((o) => o.text)).toContain(heroBefore)
    // The unsure line waits in the tray; the whole pour is one undo step.
    expect(out.waiting.map((w) => w.text)).toEqual(['Mill Bakery'])
    expect(out.message).toMatch(/^Placed 12 lines in 3 sections\. 1 is waiting/)
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('puts a tray line where you pick', async () => {
    fakeJev((name, q, req) => {
      const text = lineText(name, req, q)
      if (name.startsWith('role_')) return { option: 'heading', p: 0.4 }
      if (name.startsWith('section_')) return { option: `s_${sid('pricing')}`, p: 0.5 }
      void text
      return undefined
    })
    await runCommand('pour_words', { text: 'Simple prices' }, 'you')
    const [line] = trayLines(useStore.getState())
    expect(line.homes[0]).toMatchObject({ slotId: sid('pricing'), role: 'heading', label: 'Pricing · Heading' })
    expect(placeFromTray(line, line.homes[0])).toBe(true)
    expect(wordsFor(currentSlots(useStore.getState()).find((s) => s.type === 'pricing')!).heading).toBe('Simple prices')
    expect(trayLines(useStore.getState())).toHaveLength(0)
  })
})

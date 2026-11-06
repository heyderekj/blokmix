import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { pageView } from '@/core/site'
import { runCommand } from '@/state/commands'
import { chunkLines } from '@/core/jev/pageFromWords'
import { splitLines } from '@/core/jev/pour'
import { setTray } from '@/state/jevPour'
import { wordsFor } from '@/state/commands/refs'
import type { JevRequest } from '@/core/jev'
import { fakeJev, realJev } from './helpers/fakeJev'

const MENU = `Mill Bakery
Bread worth getting up for.

What we bake
Sourdough
$9
Rye
$8
Croissant
$4

Questions
Q: Do you deliver?
A: Within 5 miles, before 10.
Q: Is anything gluten free?
A: The almond cake.

Come say hi
hello@millbakery.com`

/** Jev on this menu: what each run becomes and what each line is. */
const TYPE: Record<string, string> = { '0': 'hero', '1': 'pricing', '2': 'faq', '3': 'contact' }
const ROLE: Record<string, string> = {
  'Mill Bakery': 'eyebrow',
  'Bread worth getting up for.': 'headline',
  'What we bake': 'heading',
  Sourdough: 'title',
  Rye: 'title',
  Croissant: 'title',
  Questions: 'heading',
  'Come say hi': 'heading',
}

const jevOnMenu = () =>
  fakeJev((name, q, req) => {
    void req
    if (name.startsWith('kind')) return { option: 'local', p: 0.9 }
    if (name.startsWith('type_')) return { option: TYPE[name.match(/^type_(\d+)/)![1]], p: 0.88 }
    if (name.startsWith('list_')) return 0.9
    if (name.startsWith('role_')) return { option: ROLE[(q.instructions as { line: string }).line] ?? 'other', p: 0.9 }
    return undefined
  })

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
  setTray(() => [])
})
afterEach(() => realJev())

describe('a page from anything you paste', () => {
  it('cuts text into runs, a lone heading joining the run after it', () => {
    const chunks = chunkLines(splitLines(MENU))
    expect(chunks.map((c) => c.lines[0].text)).toEqual(['Mill Bakery', 'What we bake', 'Questions', 'Come say hi'])
    expect(chunks[1].lines.map((l) => l.text)).toEqual(['What we bake', 'Sourdough', '$9', 'Rye', '$8', 'Croissant', '$4'])
  })

  it('makes a new page of the right sections and places the words as written', async () => {
    const fake = jevOnMenu()
    const out = (await runCommand('page_from_words', { text: MENU }, 'you')) as { page: string; sections: string[]; message: string; kind: string }
    expect(out.sections).toEqual(['Hero', 'Pricing', 'FAQ', 'Contact'])
    expect(out.kind).toBe('local')
    const st = useStore.getState()
    const page = st.site.pages.find((p) => p.id === out.page)!
    expect(page.title).toBe('From your words')
    expect(st.ui.pageId).toBe(page.id)
    const slots = pageView(st.site, page.id).filter((s) => s.type !== 'nav' && s.type !== 'footer')
    const words = (type: string) => Object.values(wordsFor(slots.find((s) => s.type === type)!))
    expect(wordsFor(slots.find((s) => s.type === 'hero')!).headline).toBe('Bread worth getting up for.')
    for (const w of ['Sourdough', 'Rye', 'Croissant', '$9', '$4']) expect(words('pricing')).toContain(w)
    for (const w of ['Do you deliver?', 'The almond cake.']) expect(words('faq')).toContain(w)
    expect(words('contact')).toContain('hello@millbakery.com')
    // The site now knows what it is, and it was one request for the whole page.
    expect(st.content.kind).toBe('local')
    expect(fake.requests).toHaveLength(1)
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('gives another arrangement of the same words at once, without asking again', async () => {
    const fake = jevOnMenu()
    const first = (await runCommand('page_from_words', { text: MENU }, 'you')) as { page: string }
    const layouts = () => pageView(useStore.getState().site, first.page).map((s) => s.clipId)
    const a = layouts()
    await runCommand('page_from_words', { text: MENU, into: 'this_page', arrangement: 2 }, 'you')
    expect(layouts()).not.toEqual(a)
    expect(fake.requests).toHaveLength(1)
    const req: JevRequest = fake.requests[0]
    expect(Object.keys(req.questions)).toContain('type_0__r')
  })
})

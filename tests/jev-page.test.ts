import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { pageView } from '@/core/site'
import { keepPagePreview, runCommand } from '@/state/commands'
import { matchPageSections, paragraphPlan, planPage, revisePageLines, wordsPage } from '@/state/jevPage'
import { packetInputFor } from '@/lib/packet'
import { packetFiles, packetJson, versionBuildPrompt } from '@/core/export/packet'
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
  it('keeps every line past the reading limit for placement after creating a named page', async () => {
    const lines = Array.from({ length: 86 }, (_, i) => `Customer line ${i + 1}`)
    const result = await runCommand('page_from_words', { title: 'Services', text: lines.join('\n'), reading: 'paragraphs' }, 'you') as { page: string; placed: number; waiting: number }
    const st = useStore.getState()
    expect(st.site.pages.find((p) => p.id === result.page)?.path).toBe('/services')
    expect(result.placed + result.waiting).toBe(lines.length)
    expect(st.content.tray?.slice(-6).map((l) => l.text)).toEqual(lines.slice(80))
  })

  it('keeps the selected services layout and carries different length descriptions into the page', async () => {
    const text = 'Our services\nDesign for small teams.\n\nDiscovery\nA short research sprint.\n\nBrand design\nIdentity, typography, and a practical style guide.'
    const input = { text, title: 'Services', reading: 'paragraphs', arrangement: 2 }
    const { page } = await runCommand('page_from_words', input, 'you') as { page: string }
    const slots = pageView(useStore.getState().site, page)
    const section = slots.find((s) => s.type === 'features')
    expect(section).toBeDefined()
    expect(Object.values(section!.words ?? {})).toEqual(expect.arrayContaining(['Discovery', 'Brand design', 'A short research sprint.', 'Identity, typography, and a practical style guide.']))
  })

  it('ships the saved combination of a kept services layout and a different hero', () => {
    const text = 'Our services\nDesign for small teams.\n\nDiscovery\nA short research sprint.\n\nBrand design\nIdentity, typography, and a practical style guide.'
    const plan = paragraphPlan(text)
    const { content } = useStore.getState()
    const first = wordsPage(plan, 1, content)
    const second = wordsPage(plan, 2, content)
    expect(first.slots.map((s) => s.clipId)).not.toContain(second.slots[0].clipId)
    expect(first.slots[1].clipId).not.toBe(second.slots[1].clipId)

    const kept = { 1: { clipId: first.slots[1].clipId, locked: true } }
    const preview = wordsPage(plan, 2, content, (i) => `preview-${i}`, kept)
    const { page } = keepPagePreview({ text, title: 'Services', reading: 'paragraphs', into: 'new_page', arrangement: 2 }, plan, kept)
    const st = useStore.getState()
    expect(st.site.pages.find((p) => p.id === page)?.slots.map(({ clipId, locked, words }) => ({ clipId, locked, words })))
      .toEqual(preview.slots.map(({ clipId, locked, words }) => ({ clipId, locked, words })))
    expect(preview.slots.map((s) => [s.clipId, s.locked])).toEqual([
      [second.slots[0].clipId, false],
      [first.slots[1].clipId, true],
    ])
    expect(preview.placed + preview.tray.length).toBe(plan.lines.length)
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)

    const id = st.pressVersion()
    st.setClip(currentSlots(useStore.getState()).find((s) => s.type === 'hero')!.id, first.slots[0].clipId)
    const saved = useStore.getState().versions[id]
    const input = packetInputFor(useStore.getState(), { version: saved, targets: ['astro'] })
    expect(versionBuildPrompt(saved, 'astro')).toContain(JSON.stringify({ version: id, target: 'astro' }))
    const packet = packetJson(input)
    const exported = packet.site?.pages.find((p) => p.path === '/services')?.sections
    const clips = exported?.map((component) => packet.sections.find((s) => s.component === component)?.clip.id)
    expect(clips).toEqual([second.slots[0].clipId, first.slots[1].clipId])
    const files = packetFiles(input)
    expect(files['reference/services.html']).toContain('A short research sprint.')
    expect(files['astro/src/pages/services.astro']).toBeDefined()
    expect(files['BLOKMIX.md']).toContain('Build it faithfully')
  })

  it('updates a typo in Jev’s original field without reclassifying the page', async () => {
    const jev = jevOnMenu()
    const before = (await planPage(MENU))!
    const next = revisePageLines(before, MENU.replace('Sourdough', 'Country sourdough'))!
    expect(next.read.roles).toEqual(before.read.roles)
    const priced = wordsPage(next, 2, useStore.getState().content).slots.find((s) => s.type === 'pricing')
    expect(Object.values(priced?.words ?? {})).toContain('Country sourdough')
    expect(jev.requests).toHaveLength(1)
    expect(revisePageLines(before, MENU.replace('$9', 'Call for prices'))).toBeNull()
  })

  it('carries layout choices to the same sections after a section is inserted', () => {
    const before = paragraphPlan('Studio\nHello.\n\nHistory\nSince 2015.\n\nPeople\nOur team.')
    const after = paragraphPlan('Studio\nHello.\n\nWork\nRecent projects.\n\nHistory\nSince 2015.\n\nPeople\nOur team.')
    expect([...matchPageSections(before, after)].sort()).toEqual([[0, 0], [1, 2], [2, 3]])
  })

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

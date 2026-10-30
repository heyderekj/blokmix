import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { DEFAULT_CONTENT } from '@/core/content'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { editList, listOrder, sectionClip } from '@/core/lists'
import { contentJson, fieldPointers, outline } from '@/core/outline'
import { keepOption, putBackOption, retireOption, showWords, wordChoices } from '@/core/words'
import { parseHtml } from '@/core/html/parse'
import { astroFiles } from '@/core/export/astro'
import { nextFiles } from '@/core/export/next'
import { packetFiles } from '@/core/export/packet'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'

const slotFor = (clipId: string, extra: Partial<Slot> = {}): Slot => ({ id: 's1', type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP }, ...extra })
const pageFor = (slots: Slot[]) => composePage({ slots, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })

describe('word options', () => {
  const clip = library.clips['hero.layout-centered']
  it('cycles your copy, the clip’s words, then kept options, without repeats', () => {
    let s = slotFor(clip.id)
    s = keepOption(s, 'headline', 'Mix the web.')
    s = keepOption(s, 'headline', DEFAULT_CONTENT.fields.hero!.headline) // already your copy: no repeat in the cycle
    const kinds = wordChoices(clip, s, DEFAULT_CONTENT, 'headline').map((c) => c.kind)
    expect(kinds).toEqual(['copy', 'source', 'kept'])
  })
  it('retires and puts back', () => {
    let s = keepOption(slotFor(clip.id), 'headline', 'Mix the web.')
    s = retireOption(s, 'headline', 'Mix the web.')
    expect(wordChoices(clip, s, DEFAULT_CONTENT, 'headline').some((c) => c.text === 'Mix the web.')).toBe(false)
    s = putBackOption(s, 'headline', 'Mix the web.')
    expect(wordChoices(clip, s, DEFAULT_CONTENT, 'headline').some((c) => c.text === 'Mix the web.')).toBe(true)
    expect(s.options!.headline[0].retiredAt).toBeUndefined()
  })
  it('shows an option as the section’s own words, unless it’s what shows anyway', () => {
    let s = showWords(slotFor(clip.id), clip, DEFAULT_CONTENT, 'headline', 'Mix the web.')
    expect(s.words).toEqual({ headline: 'Mix the web.' })
    s = showWords(s, clip, DEFAULT_CONTENT, 'headline', DEFAULT_CONTENT.fields.hero!.headline)
    expect(s.words).toEqual({})
  })
})

describe('editing lists', () => {
  const id = 'faq.layout-accordion'
  const list = () => sectionClip(library.clips[id]).blocks.find((b) => b.kind === 'list')!
  const run = (s: Slot, op: Parameters<typeof editList>[3]) => editList(s, sectionClip(library.clips[id], s.lists), DEFAULT_CONTENT, op)
  const items = (s: Slot) => sectionClip(library.clips[id], s.lists).blocks.filter((b) => b.parent === list().id)

  it('adds an item copying the first, duplicates with its words, moves and removes', () => {
    let s = run(slotFor(id), { op: 'add', listId: list().id })
    expect(listOrder(sectionClip(library.clips[id], s.lists), list().id)).toEqual([1, 2, 3, 4, 5, 6, 7])
    s = run(s, { op: 'duplicate', itemId: items(s)[1].id })
    expect(s.lists!.faq[2]).toEqual({ n: 8, from: 2 })
    expect(s.words!.faq8Q).toBe(DEFAULT_CONTENT.fields.faq!.faq2Q)
    s = run(s, { op: 'move', itemId: items(s)[2].id, to: 0 })
    expect(s.lists!.faq[0].n).toBe(8)
    s = run(s, { op: 'remove', itemId: items(s)[0].id })
    expect(s.lists!.faq.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('forgets the change once the list is back to the layout’s own items', () => {
    let s = run(slotFor(id), { op: 'move', itemId: items(slotFor(id))[0].id, to: 1 })
    expect(s.lists).toBeDefined()
    s = run(s, { op: 'move', itemId: items(s)[1].id, to: 0 })
    expect(s.lists).toBeUndefined()
  })

  it('keeps lists within what the layout holds, and at least one item', () => {
    let s = slotFor(id)
    for (let n = 0; n < 6; n++) s = run(s, { op: 'add', listId: list().id })
    expect(items(s)).toHaveLength(12)
    expect(() => run(s, { op: 'add', listId: list().id })).toThrow(/up to 12/)
    const one = { ...slotFor(id), lists: { faq: [{ n: 1 }] } }
    expect(() => run(one, { op: 'remove', itemId: items(one)[0].id })).toThrow(/at least one/)
  })

  it('refuses lists whose items the layout sets', () => {
    const c = sectionClip(library.clips['contact.layout-cards'])
    const l = c.blocks.find((b) => b.kind === 'list')!
    expect(() => editList(slotFor('contact.layout-cards'), c, DEFAULT_CONTENT, { op: 'add', listId: l.id })).toThrow(/set by the layout/)
  })

  it('keeps counters (01, 02…) in order when items move', () => {
    const c = sectionClip(library.clips['faq.layout-columns'], { faq: [{ n: 3 }, { n: 1 }, { n: 2 }] })
    expect([...c.html.matchAll(/class="num"[^>]*>(\d+)</g)].map((m) => m[1])).toEqual(['01', '02', '03'])
  })
})

describe('content as files', () => {
  it('reads a section as fields and lists, including words beside a list’s items', () => {
    const c = sectionClip(library.clips['footer.layout-columns'])
    const nodes = outline(parseHtml(c.html))
    const json = contentJson(nodes, c.fields) as Record<string, unknown>
    expect(Object.keys(json)).toEqual(expect.arrayContaining(['brand', 'tagline', 'columns', 'legal']))
    expect((json.columns as { links: string[] }[])[0].links).toHaveLength(4)
    expect(fieldPointers(nodes).col2L3).toBe('columns/1/links/2')
  })

  it('writes a content file per section and components that read it', () => {
    const slot = slotFor('faq.layout-accordion', { lists: { faq: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 7 }] }, words: { faq7Q: 'Can I add my own?', faq7A: 'Yes.' } })
    const page = pageFor([slot])
    const next = nextFiles(page)
    const json = JSON.parse(next['next/content/faq-layout-accordion.json'] as string)
    expect(json.questions).toHaveLength(4)
    expect(json.questions[3]).toEqual({ q: 'Can I add my own?', a: 'Yes.' })
    const tsx = next['next/components/sections/FaqLayoutAccordion.tsx'] as string
    expect(tsx).toContain("import data from '@/content/faq-layout-accordion.json'")
    expect(tsx).toContain('{content.questions.map((item, i) => (')
    expect(tsx).toContain('key={i}')
    expect(tsx).toContain('data-mx-src={`content/faq-layout-accordion.json#questions/${i}/q`}')
    expect(next['next/app/page.tsx']).toContain('<FaqLayoutAccordion content={faqLayoutAccordionContent} />')
    const astro = astroFiles(page)
    expect(astro['astro/src/content/faq-layout-accordion.json']).toBe(next['next/content/faq-layout-accordion.json'])
    expect(astro['astro/src/components/sections/FaqLayoutAccordion.astro']).toContain('const { content = data } = Astro.props')
    expect(astro['astro/src/components/sections/FaqLayoutAccordion.astro']).toContain('data-mx-src="src/content/faq-layout-accordion.json#heading"')
  })

  it('numbers counted items from their position in exported lists', () => {
    const tsx = nextFiles(pageFor([slotFor('faq.layout-columns')]))['next/components/sections/FaqLayoutColumns.tsx'] as string
    expect(tsx).toContain("{String(i + 1).padStart(2, '0')}")
  })

  it('writes items one by one when they differ', () => {
    const c = sectionClip(library.clips['faq.layout-accordion'])
    const q2 = c.blocks.find((b) => b.field === 'faq2Q')!
    const tsx = nextFiles(pageFor([slotFor(c.id, { edits: { [c.id]: { [q2.id]: { style: { ink: 'accent' } } } } })]))['next/components/sections/FaqLayoutAccordion.tsx'] as string
    expect(tsx).not.toContain('.map(')
    expect(tsx).toContain('{content.questions[1].q}')
  })

  it('tells the agent where words live, and the options still in play', () => {
    const slot = slotFor('hero.layout-centered', { options: { headline: [{ text: 'Mix the web.', by: 'you', keptAt: 1 }] } })
    const files = packetFiles({ page: pageFor([slot]), guide: resolveGuide(emptyGuide()), library, mixName: 'T', targets: ['astro'] } as never)
    const md = files['BLOKMIX.md'] as string
    expect(md).toContain('`hero-layout-centered.json`')
    expect(md).toContain('Other ways to say headline')
    expect(md).toContain('Keystatic')
    expect(md).not.toMatch(/\bCMS\b/)
  })
})

describe('banners', () => {
  const id = 'nav.layout-notice'
  it('is a block whose messages are a list in your copy, in their new order when moved', () => {
    const c = sectionClip(library.clips[id])
    const banner = c.blocks.find((b) => b.kind === 'banner')!
    const list = c.blocks.find((b) => b.parent === banner.id)!
    expect(list.listKey).toBe('notice')
    const json = pageFor([slotFor(id)]).sections[0].content as { notices: string[] }
    expect(json.notices[0]).toBe(DEFAULT_CONTENT.fields.nav!.notice1)
    const moved = sectionClip(library.clips[id], { notice: [{ n: 2 }, { n: 1 }] })
    expect([...moved.html.matchAll(/data-mx-field="(notice\d)"/g)].map((m) => m[1])).toEqual(['notice2', 'notice1'])
  })
  it('leaves the export entirely when hidden', () => {
    const banner = library.clips[id].blocks.find((b) => b.kind === 'banner')!
    const s = pageFor([slotFor(id, { edits: { [id]: { [banner.id]: { hidden: true } } } })]).sections[0]
    expect(JSON.stringify(s.tree)).not.toContain('ticker')
    expect(s.content).not.toHaveProperty('notices')
  })
})

describe('added banners', () => {
  const id = 'nav.layout-simple'
  it('goes above any nav as a banner block with a notices list, without shifting its blocks', () => {
    const plain = sectionClip(library.clips[id])
    const c = sectionClip(library.clips[id], undefined, { banner: true })
    expect(c.blocks.find((b) => b.kind === 'banner')!.id).toBe('x0')
    expect(c.blocks.find((b) => b.list === 'notices')!.listKey).toBe('notice')
    for (const b of plain.blocks) expect(c.blocks.find((x) => x.id === b.id)?.label).toBe(b.label)
    expect(c.patches[0]).toMatchObject({ sel: '[data-mx-section]', before: true })
    // A nav clipped with its own ticker keeps just that one.
    expect(sectionClip(library.clips['nav.layout-notice'], undefined, { banner: true }).blocks.filter((b) => b.kind === 'banner')).toHaveLength(1)
  })
  it('exports with its CSS, its words and a fragment in Next.js', async () => {
    const page = pageFor([slotFor(id, { banner: true })])
    const s = page.sections[0]
    expect(s.css).toContain('.mx-banner-group')
    expect(s.motionCss).toContain('mx-banner-marquee')
    expect((s.content as { notices: string[] }).notices).toHaveLength(4)
    const tsx = nextFiles(page)['next/components/sections/NavLayoutSimple.tsx'] as string
    expect(tsx).toContain('    <>')
    const { transformWithOxc } = await import('vite')
    await expect(transformWithOxc(tsx, 'x.tsx', { lang: 'tsx' })).resolves.toBeTruthy()
    expect(pageFor([slotFor(id, { banner: true, motion: { mode: 'none' } })]).sections[0].motionCss ?? '').not.toContain('mx-banner-marquee')
  })
})

describe('content commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('reads content files, lists and options', () => {
    const [features] = runCommand('get_content', { section: 'features' }) as { content: Record<string, unknown>; lists: { name: string; editable: boolean }[] }[]
    expect(features.lists[0]).toMatchObject({ name: 'features', editable: true })
    expect(Array.isArray(features.content.features)).toBe(true)
  })

  it('keeps an agent’s options and shows one', () => {
    const r = runCommand('word_options', { section: 'hero', field: 'headline', keep: ['Mix the web.', 'Your site, remixed.'], use: 'Your site, remixed.' }) as { showing: string; choices: { by?: string }[] }
    expect(r.showing).toBe('Your site, remixed.')
    expect(r.choices.filter((c) => c.by === 'agent')).toHaveLength(2)
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('adds and removes a banner on the nav', () => {
    const nav = currentSlots(useStore.getState()).find((s) => s.type === 'nav')!
    const ownBanner = sectionClip(library.clips[nav.clipId]).blocks.some((b) => b.kind === 'banner')
    const off = runCommand('set_banner', { section: 'nav', on: false }) as { banner: unknown }
    expect(off.banner).toBeNull()
    const on = runCommand('set_banner', { section: 'nav', on: true }) as { banner: { block: string } }
    expect(on.banner.block).toBe(ownBanner ? 'b0' : 'x0')
    expect(() => runCommand('set_banner', { section: 'hero', on: true })).toThrow(/navs/)
  })

  it('edits and writes lists as one undo step each', () => {
    runCommand('edit_list', { section: 'features', list: 'features', op: 'remove', item: 1 })
    const set = runCommand('set_list', { section: 'features', list: 'features', items: [{ title: 'One', body: 'First' }, { title: 'Two', body: 'Second' }] }) as { content: { features: unknown[] } }
    expect(set.content.features).toEqual([
      { title: 'One', body: 'First' },
      { title: 'Two', body: 'Second' },
    ])
    expect(useStore.temporal.getState().pastStates).toHaveLength(2)
    expect(() => runCommand('set_list', { section: 'features', list: 'features', items: [{ heading: 'x' }] })).toThrow(/Its fields: title, body/)
  })
})

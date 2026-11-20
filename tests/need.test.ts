import { beforeEach, describe, expect, it } from 'vitest'
import { keywordNeed } from '@/core/reader/local'
import { needOf } from '@/core/reader/need'
import { verbatim } from '@/core/reader/verbatim'
import { SPANS } from '@/core/reader/schema'
import { pageView } from '@/core/site'
import { runCommand } from '@/state/commands'
import { currentSlots, useStore } from '@/state/store'

describe('reading “I need a … that …” from keywords', () => {
  it('finds the sections its words ask for, in the order they’re said', () => {
    expect(keywordNeed('shows our prices and opening hours', 'section').sections).toEqual(['pricing', 'contact'])
    expect(keywordNeed('answers the questions people ask', 'section').sections[0]).toBe('faq')
    expect(keywordNeed('shows what people say about us', 'section').sections).toEqual(['testimonials'])
  })

  it('leaves out what was said with a “not”', () => {
    expect(keywordNeed('shows the team but not prices', 'section').sections).toEqual(['team'])
  })

  it('points a page at a template, else leaves it blank with its sections', () => {
    expect(keywordNeed('tells our story', 'page').template).toBe('about')
    expect(keywordNeed('lists our prices', 'page').template).toBe('pricing')
    const other = keywordNeed('shows our photos and reviews', 'page')
    expect(other.template).toBe('blank')
    expect(other.sections).toEqual(['gallery', 'testimonials'])
  })

  it('keeps its words as written, so it passes the reader’s own span check', () => {
    const text = 'Shows our prices'
    const read = keywordNeed(text, 'section')
    expect(read.purpose).toBe(text)
    expect(verbatim(read, text, SPANS.need)).not.toBeNull()
  })

  it('says nothing it can act on when no words match', () => {
    expect(needOf(keywordNeed('makes everyone happy', 'section'))).toBeNull()
  })
})

describe('need_section and need_page', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('adds the section asked for before the footer, read by keywords when suggestions are off', async () => {
    const before = currentSlots(useStore.getState()).map((s) => s.type)
    const out = (await runCommand('need_section', { text: 'answers common questions' }, 'agent')) as { added: string; read_by: string }
    expect(out.added).toBe('faq')
    expect(out.read_by).toBe('keywords')
    const after = currentSlots(useStore.getState()).map((s) => s.type)
    expect(after.length).toBe(before.length + 1)
    expect(after.at(-1)).toBe(before.at(-1))
    expect(after.at(-2)).toBe('faq')
  })

  it('adds it where asked', async () => {
    await runCommand('need_section', { text: 'shows our stats', at: 2 }, 'agent')
    expect(currentSlots(useStore.getState())[1].type).toBe('stats')
  })

  it('says so when it can’t tell, and changes nothing', async () => {
    const before = currentSlots(useStore.getState()).length
    await expect((async () => runCommand('need_section', { text: 'makes everyone happy' }, 'agent'))()).rejects.toThrow(/Couldn’t tell/)
    expect(currentSlots(useStore.getState()).length).toBe(before)
  })

  it('adds a page from a template, or of the sections asked for, and opens it', async () => {
    const a = (await runCommand('need_page', { text: 'tells our story' }, 'agent')) as { template: string; title: string }
    expect(a.template).toBe('about')
    expect(a.title).toBe('About')
    const b = (await runCommand('need_page', { text: 'shows our photos and reviews' }, 'agent')) as { sections: string[]; page: string }
    expect(b.sections).toEqual(['header', 'gallery', 'testimonials'])
    const st = useStore.getState()
    const open = st.site.pages.find((p) => p.id === st.ui.pageId)!
    expect(open.path).toBe(b.page)
    expect(pageView(st.site, open.id).map((s) => s.type)).toEqual(expect.arrayContaining(['header', 'gallery', 'testimonials']))
  })
})

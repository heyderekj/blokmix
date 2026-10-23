import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { hrefFor, sectionAnchors, suggestLink } from '@/core/links'
import { serialize } from '@/core/html/serialize'
import { sectionClip } from '@/core/lists'
import { packetFiles } from '@/core/export/packet'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'

const slot = (id: string, clipId: string, extra: Partial<Slot> = {}): Slot => ({ id, type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP }, ...extra })
const page = (slots: Slot[]) => composePage({ slots, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })

describe('links', () => {
  const slots = [slot('n', 'nav.layout-simple'), slot('p', 'pricing.layout-tiers'), slot('f', 'faq.layout-accordion'), slot('p2', 'pricing.layout-single')]

  it('gives every section an anchor', () => {
    expect(sectionAnchors(slots)).toEqual({ n: 'nav', p: 'pricing', f: 'faq', p2: 'pricing-2' })
  })

  it('leads words that name a section there, and emails and phone numbers to mail and calls', () => {
    expect(suggestLink('Pricing', slots, 'n')).toEqual({ to: 'section', slotId: 'p' })
    expect(suggestLink('Questions', slots, 'n')).toEqual({ to: 'section', slotId: 'f' })
    expect(suggestLink('Start a tape', slots, 'n')).toBeNull()
    expect(suggestLink('hello@mixtape.example', slots, 'n')).toEqual({ to: 'email', address: 'hello@mixtape.example' })
    expect(suggestLink('+1 (555) 010-2026', slots, 'n')).toEqual({ to: 'phone', number: '+1 (555) 010-2026' })
    expect(hrefFor({ to: 'phone', number: '+1 (555) 010-2026' }, {})).toBe('tel:+15550102026')
    expect(hrefFor({ to: 'url', url: 'stripe.com' }, {})).toBe('https://stripe.com')
  })

  it('writes anchors and destinations into exports, and lists other pages for the agent', () => {
    const nav = sectionClip(library.clips['nav.layout-simple'])
    const cta = nav.blocks.find((b) => b.kind === 'button' && b.linkable)!
    const p = page([slot('n', 'nav.layout-simple', { edits: { 'nav.layout-simple': { [cta.id]: { link: { to: 'page', path: '/signup' } } } } }), slot('p', 'pricing.layout-tiers')])
    const html = serialize(p.sections[0].tree, 'html')
    expect(serialize(p.sections[1].tree, 'html')).toContain('id="pricing"')
    expect(html).toContain('href="#pricing"') // "Pricing" in the nav
    expect(html).toContain('href="/signup"')
    expect(p.pages).toEqual(['/signup'])
    const md = packetFiles({ page: p, guide: resolveGuide(emptyGuide()), library, tapeName: 'T', targets: ['astro'] } as never)['MIXTAPE.md'] as string
    expect(md).toContain('## Other pages')
    expect(md).toContain('`/signup`')
  })

  it('opens web addresses in a new tab, safely', () => {
    const nav = sectionClip(library.clips['nav.layout-simple'])
    const cta = nav.blocks.find((b) => b.kind === 'button' && b.linkable)!
    const p = page([slot('n', 'nav.layout-simple', { edits: { 'nav.layout-simple': { [cta.id]: { link: { to: 'url', url: 'https://example.com' } } } } })])
    expect(serialize(p.sections[0].tree, 'html')).toContain('href="https://example.com" class')
    expect(serialize(p.sections[0].tree, 'html')).toContain('target="_blank" rel="noopener noreferrer"')
  })

  it('finds links inside other blocks, like a post title in a heading', () => {
    const blog = sectionClip(library.clips['blog.layout-cards'])
    expect(blog.blocks.filter((b) => b.kind === 'heading' && b.linkable).length).toBeGreaterThan(0)
  })
})

describe('link commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })
  it('sets a destination and says where links go', () => {
    const nav = (runCommand('get_page', { section: 'nav' }) as { sections: { blocks: { id: string; kind: string; link?: string }[] }[] }).sections[0]
    const b = nav.blocks.find((x) => x.link !== undefined)!
    const r = runCommand('set_link', { section: 'nav', block: b.id, to: 'url', target: 'example.com' }) as { href: string; newTab: boolean }
    expect(r).toMatchObject({ href: 'https://example.com', newTab: true })
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })
})

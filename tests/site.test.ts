import { beforeEach, describe, expect, it } from 'vitest'
import type { Slot } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { allSlots, freePath, mapSlots, normalizePath, pageOfSlot, pageView, siteFromSlots, updateSlotIn } from '@/core/site'
import { describeLink, hrefFor, sectionLinks, siteScope, suggestLink } from '@/core/links'
import { composeSite } from '@/core/compose'
import { resolveGuide, emptyGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { astroFiles } from '@/core/export/astro'
import { nextFiles } from '@/core/export/next'
import { packetFiles } from '@/core/export/packet'
import { referenceHtml } from '@/core/export/reference-html'
import { library, slotClip } from '@/data/library'
import { currentSlots, siteState, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'

const slot = (id: string, clipId: string): Slot => ({ id, type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP } })

const home = [slot('n', 'nav.layout-simple'), slot('h', 'hero.layout-centered'), slot('p', 'pricing.layout-tiers'), slot('f', 'footer.layout-columns')]
const twoPages = () => {
  const s = siteFromSlots(home)
  return { ...s, pages: [...s.pages, { id: 'page_about', path: '/about', title: 'About', slots: [slot('t', 'team.layout-grid')], show: { nav: true, footer: false } }] }
}

describe('site model', () => {
  it('turns one page of sections into a site: the nav and footer shared, the rest Home', () => {
    const site = siteFromSlots(home)
    expect(site.shared.nav?.id).toBe('n')
    expect(site.shared.footer?.id).toBe('f')
    expect(site.pages).toHaveLength(1)
    expect(site.pages[0]).toMatchObject({ path: '/', title: 'Home', show: { nav: true, footer: true } })
    expect(site.pages[0].slots.map((s) => s.id)).toEqual(['h', 'p'])
  })

  it('reads each page top to bottom, with the shared nav and footer only where shown', () => {
    const site = twoPages()
    expect(pageView(site, 'page_home').map((s) => s.id)).toEqual(['n', 'h', 'p', 'f'])
    expect(pageView(site, 'page_about').map((s) => s.id)).toEqual(['n', 't'])
    expect(pageView(site, 'page_about')).toBe(pageView(site, 'page_about'))
    expect(allSlots(site).map((s) => s.id)).toEqual(['n', 'h', 'p', 't', 'f'])
    expect(pageOfSlot(site, 't')?.id).toBe('page_about')
    expect(pageOfSlot(site, 'n')).toBeNull()
  })

  it('changes a section wherever it is, keeping untouched pages as they were', () => {
    const site = twoPages()
    const next = updateSlotIn(site, 'n', (s) => ({ ...s, locked: true }))
    expect(next.shared.nav?.locked).toBe(true)
    expect(next.pages).toBe(site.pages)
    const dropped = mapSlots(site, (s) => (s.id === 'p' ? null : s))
    expect(allSlots(dropped).map((s) => s.id)).toEqual(['n', 'h', 't', 'f'])
  })

  it('keeps paths tidy and unique', () => {
    expect(normalizePath('About Us/')).toBe('/about-us')
    expect(normalizePath('home')).toBe('/')
    expect(freePath(twoPages(), 'about')).toBe('/about-2')
  })

  it('moves older saves and every version’s snapshot onto a site', () => {
    const migrated = siteState({ slots: home, versions: { v1: { id: 'v1', snapshot: { slots: home, guide: {}, content: {} } } } }) as {
      site: ReturnType<typeof twoPages>
      slots?: unknown
      versions: Record<string, { snapshot: { site: ReturnType<typeof twoPages>; slots?: unknown } }>
    }
    expect(migrated.slots).toBeUndefined()
    expect(migrated.site.shared.nav?.id).toBe('n')
    expect(migrated.versions.v1.snapshot.site.pages[0].slots.map((s) => s.id)).toEqual(['h', 'p'])
    expect(migrated.versions.v1.snapshot.slots).toBeUndefined()
    // Already a site: left alone.
    const site = twoPages()
    expect((siteState({ site }) as { site: unknown }).site).toBe(site)
  })
})

describe('links across pages', () => {
  it('uses #anchor on the same page and /path#anchor on another, and page titles name pages', () => {
    const site = twoPages()
    const fromHome = siteScope(site, 'page_home')
    expect(fromHome.hrefs.p).toBe('#pricing')
    expect(fromHome.hrefs.t).toBe('/about#team')
    expect(describeLink({ to: 'section', slotId: 't' }, fromHome)).toBe('Team section on About')
    expect(suggestLink('About', fromHome, 'h')).toMatchObject({ to: 'page', path: '/about' })
    expect(hrefFor({ to: 'page', path: '/about', pageId: 'page_about' }, fromHome)).toBe('/about')
    const fromAbout = siteScope(site, 'page_about')
    expect(fromAbout.hrefs.p).toBe('/#pricing')
    expect(fromAbout.hrefs.t).toBe('#team')
  })

  it('keeps plain #anchors on a site of one page', () => {
    const site = siteFromSlots(home)
    expect(siteScope(site, 'page_home').hrefs.p).toBe('#pricing')
    expect(siteScope(site, null).hrefs.p).toBe('#pricing')
  })

  it('leads the shared nav’s links across pages', () => {
    const site = twoPages()
    const nav = site.shared.nav!
    const clip = slotClip(nav)
    const links = sectionLinks(clip.blocks, undefined, { ...DEFAULT_CONTENT.fields.nav }, siteScope(site, null), nav.id)
    expect(Object.values(links).some((l) => l.href === '/#pricing')).toBe(true)
  })
})

describe('exporting a site', () => {
  const site = twoPages()
  const composed = composeSite({ site, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })

  it('composes the shared sections once and each page’s own', () => {
    expect(composed.site?.shared.nav).toBeTruthy()
    expect(composed.site?.pages.map((p) => [p.path, p.sections.length])).toEqual([
      ['/', 2],
      ['/about', 1],
    ])
    // Class names never collide across pages.
    const roots = composed.sections.map((s) => s.component)
    expect(new Set(roots).size).toBe(roots.length)
    expect(composed.pages).not.toContain('/about')
  })

  it('writes a route per page for Astro and Next.js, with the nav and footer around them', () => {
    const astro = astroFiles(composed)
    expect(Object.keys(astro)).toEqual(expect.arrayContaining(['astro/src/pages/index.astro', 'astro/src/pages/about.astro']))
    expect(astro['astro/src/pages/about.astro']).toContain('footer={false}')
    const next = nextFiles(composed)
    expect(Object.keys(next)).toEqual(expect.arrayContaining(['next/app/page.tsx', 'next/app/about/page.tsx']))
  })

  it('shows one page at a time in the reference build, and lists pages in the packet', () => {
    expect(referenceHtml(composed, { pageId: 'page_about', tagSlots: true })).not.toContain('data-mx-slot="f"')
    expect(referenceHtml(composed, { pageId: 'page_home', tagSlots: true })).toContain('data-mx-slot="f"')
    const files = packetFiles({ page: composed, guide: resolveGuide(emptyGuide()), guideState: emptyGuide(), library, mixName: 'Test', targets: ['astro'] })
    const json = JSON.parse(String(files['blokmix.json']))
    expect(json.site.pages.map((p: { path: string }) => p.path)).toEqual(['/', '/about'])
    expect(String(files['BLOKMIX.md'])).toContain('## Pages')
    expect(Object.keys(files)).toContain('reference/about.html')
  })
})

describe('page commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('renames the mix', () => {
    expect(runCommand('rename_mix', { name: 'blokmix.com' })).toEqual({ name: 'blokmix.com' })
    expect(useStore.getState().mixName).toBe('blokmix.com')
    expect(() => runCommand('rename_mix', { name: '  ' })).toThrow()
  })

  it('lists the demo’s pages and reads another page by path', () => {
    const { pages } = runCommand('list_pages', {}) as { pages: { path: string; open: boolean }[] }
    expect(pages.map((p) => p.path)).toEqual(['/', '/about'])
    expect(pages[0].open).toBe(true)
    const about = runCommand('get_page', { page: '/about' }) as { page: { path: string }; sections: { type: string }[] }
    expect(about.page.path).toBe('/about')
    expect(about.sections.map((s) => s.type)).toEqual(['nav', 'header', 'team', 'cta', 'footer'])
  })

  it('adds a page from a template in one undo step, under the shared nav and footer', () => {
    const added = runCommand('add_page', { path: '/pricing', template: 'pricing', footer: false }) as { path: string; title: string; sections: number; footer: boolean }
    expect(added).toMatchObject({ path: '/pricing', title: 'Pricing', footer: false })
    const st = useStore.getState()
    expect(currentSlots(st).map((s) => s.type)).toEqual(['nav', 'header', 'pricing', 'faq', 'cta'])
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('finds sections by page and anchor, and edits the shared nav from any page', () => {
    const team = runCommand('get_page', { section: '/about#team' }) as { sections: { type: string }[] }
    expect(team.sections[0].type).toBe('team')
    runCommand('show', { page: '/about' })
    runCommand('set_keep', { section: 'nav', style: false })
    const st = useStore.getState()
    expect(st.site.shared.nav?.keep.style).toBe(false)
    expect(pageView(st.site, 'page_home')[0].keep.style).toBe(false)
  })

  it('shows the shared nav instead of adding a second one, and hides the footer per page', () => {
    runCommand('update_page', { page: '/about', nav: false })
    expect(currentSlots({ ...useStore.getState(), ui: { ...useStore.getState().ui, pageId: 'page_about' } })[0].type).toBe('header')
    const res = runCommand('add_section', { page: '/about', type: 'nav' }) as { shared: boolean }
    expect(res.shared).toBe(true)
    expect(useStore.getState().site.pages[1].show.nav).toBe(true)
    expect(allSlots(useStore.getState().site).filter((s) => s.type === 'nav')).toHaveLength(1)
  })

  it('renames, moves and removes pages, never the last one', () => {
    runCommand('update_page', { page: 'About', title: 'Our team', path: '/team' })
    expect(useStore.getState().site.pages[1]).toMatchObject({ title: 'Our team', path: '/team' })
    runCommand('move_page', { page: '/team', to: 1 })
    expect(useStore.getState().site.pages[0].path).toBe('/team')
    runCommand('remove_page', { page: '/team' })
    expect(useStore.getState().site.pages.map((p) => p.path)).toEqual(['/'])
    expect(() => runCommand('remove_page', { page: '/' })).toThrow(/at least one page/)
  })
})

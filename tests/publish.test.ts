import { describe, expect, it } from 'vitest'
import type { Slot } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { siteFromSlots } from '@/core/site'
import { composeSite } from '@/core/compose'
import { resolveGuide, emptyGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { PUBLISH_BASE, publishFiles, publishedPath } from '@/core/export/publish'
import { referenceHtml, underBase } from '@/core/export/reference-html'
import { buildNotes, packetFiles } from '@/core/export/packet'
import { library } from '@/data/library'

const slot = (id: string, clipId: string): Slot => ({ id, type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP } })

const site = () => {
  const s = siteFromSlots([slot('n', 'nav.layout-simple'), slot('h', 'hero.layout-centered'), slot('p', 'pricing.layout-tiers'), slot('f', 'footer.layout-columns')])
  return { ...s, pages: [...s.pages, { id: 'page_about', path: '/about', title: 'About', slots: [slot('t', 'team.layout-grid')], show: { nav: true, footer: false } }] }
}

describe('publishing to blok.page', () => {
  const composed = composeSite({ site: site(), guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })
  const files = publishFiles(composed)

  it('names a file per page', () => {
    expect(publishedPath('/')).toBe('index.html')
    expect(publishedPath('/about')).toBe('about.html')
    expect(publishedPath('/work/fern/')).toBe('work/fern.html')
    expect(publishedPath('/../x')).toBe('--/x.html')
    expect(Object.keys(files).filter((p) => p.endsWith('.html'))).toEqual(['index.html', 'about.html'])
  })

  it('writes every page under the base, noindex, with nothing inlined', () => {
    const home = files['index.html'] as string
    expect(home).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(home).not.toMatch(/(?:href|src)="\/(?!_)/)
    // The shared nav leads to the other page under the base.
    expect(home).toContain(`href="${PUBLISH_BASE}/about`)
    expect(home).not.toContain('src="data:image/png')
    // Pictures are files beside the pages.
    for (const p of Object.keys(files).filter((x) => !x.endsWith('.html'))) expect(p.startsWith('media/')).toBe(true)
  })

  it('leaves the reference build as it was', () => {
    const ref = referenceHtml(composed, { pageId: 'page_about' })
    expect(ref).not.toContain('noindex')
    expect(ref).not.toContain(PUBLISH_BASE)
  })

  it('moves only root-absolute addresses under the base', () => {
    const html = '<a href="/about#team">A</a><a href="#top">T</a><a href="https://x.com/">X</a><a href="//cdn.x/y">C</a><img src="/media/a.svg"><video poster="/media/p.webp"></video><div data-lottie="/media/l.json"></div>'
    const out = underBase(html, '/k3x9/fern-co/')
    expect(out).toContain('href="/k3x9/fern-co/about#team"')
    expect(out).toContain('href="#top"')
    expect(out).toContain('href="https://x.com/"')
    expect(out).toContain('href="//cdn.x/y"')
    expect(out).toContain('src="/k3x9/fern-co/media/a.svg"')
    expect(out).toContain('poster="/k3x9/fern-co/media/p.webp"')
    expect(out).toContain('data-lottie="/k3x9/fern-co/media/l.json"')
  })

  it('lists the published address in BLOKMIX.md when there is one', () => {
    const input = { page: composed, guide: resolveGuide(emptyGuide()), guideState: emptyGuide(), library, mixName: 'Fern', targets: ['astro' as const] }
    expect(buildNotes(input)).not.toContain('Published')
    expect(buildNotes({ ...input, publishedUrl: 'https://blok.page/k3x9/fern/' })).toContain('**Published:** https://blok.page/k3x9/fern/')
    expect(Object.keys(packetFiles(input))).toContain('BLOKMIX.md')
  })
})

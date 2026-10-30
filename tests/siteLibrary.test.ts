import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { library } from '@/data/library'
import { pageView } from '@/core/site'
import { candidateSource, candidateSourceName, resolveGuide } from '@/core/guide'
import { composePage } from '@/core/compose'
import { packetJson, buildNotes } from '@/core/export/packet'
import { SAMPLE_SITES, SAMPLE_SUMMARIES } from '@/data/librarySample'
import { mixFromSitePage, planClip, setSiteLibraryBackend, sourceFromSite } from '@/lib/siteLibrary'
import { packetInputFor } from '@/lib/packet'

beforeEach(() => {
  setSiteLibraryBackend({ list: async () => SAMPLE_SUMMARIES, site: async (slug) => SAMPLE_SITES.find((s) => s.slug === slug) ?? null })
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

const fern = SAMPLE_SITES[0]
const openView = () => {
  const st = useStore.getState()
  return pageView(st.site, st.ui.pageId)
}

describe('site library', () => {
  it('turns a site’s flat tokens into a site Source, neutral where it says nothing', () => {
    const src = sourceFromSite({ ...fern, tokens: { ...fern.tokens, 'not.a.token': 'x', 'color.muted': '  ' } })
    expect(src.id).toBe('site:fernway')
    expect(src.kind).toBe('site')
    expect(src.tokens['color.primary']).toBe('#1f6f4a')
    expect(src.tokens['font.display']).toContain('Fraunces')
    expect(src.tokens['motion.ease']).toBeTruthy() // not set by the site: the neutral default
    expect(src.tokens['color.muted']).not.toBe('  ')
    expect((src.tokens as Record<string, string>)['not.a.token']).toBeUndefined()
    expect(src.fonts.map((f) => f.family)).toContain('Fraunces')
  })

  it('plans a page in order, skipping sections with no layout or a layout this build lacks', () => {
    const plan = planClip(library, fern.pages[0], 'all')
    expect(plan.slots.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10, 11])
    expect(plan.skipped).toEqual([{ order: 7, type: 'content', reason: 'No layout yet' }])
    const harbor = planClip(library, SAMPLE_SITES[1].pages[0], 'all')
    expect(harbor.skipped.find((s) => s.order === 8)?.reason).toMatch(/isn’t in this version/)
  })

  it('clip_from_site adds the matched layouts in page order with credit, as one undo step', async () => {
    const st = useStore.getState()
    st.focusSlot(null)
    const before = openView().length
    const r = (await runCommand('clip_from_site', { site: 'fernway', sections: [6, 3, 7, 4] })) as { added: { layout: string; position: number }[]; skipped: { order: number }[] }
    expect(r.added.map((a) => a.layout)).toEqual(['logos.layout-row', 'features.layout-grid', 'testimonials.layout-cards'])
    expect(r.skipped.map((s) => s.order)).toEqual([7])
    const view = openView()
    expect(view.length).toBe(before + 3)
    const positions = r.added.map((a) => a.position)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const added = view.filter((s) => s.inspiredBy)
    expect(added.map((s) => s.clipId)).toEqual(['logos.layout-row', 'features.layout-grid', 'testimonials.layout-cards'])
    expect(added[0].inspiredBy).toEqual({ site: 'Fernway', url: 'https://fernway.example/' })
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
    useStore.temporal.getState().undo()
    expect(openView().length).toBe(before)
  })

  it('clips a whole page onto a new page, keeping the mix’s own nav and footer', async () => {
    const pages = useStore.getState().site.pages.length
    const r = (await runCommand('clip_from_site', { site: 'Fernway', page: '/pricing', all: true, newPage: true })) as { page: string; skipped: { reason: string }[] }
    const st = useStore.getState()
    expect(st.site.pages.length).toBe(pages + 1)
    expect(r.page).toBe('/pricing')
    const own = st.site.pages.at(-1)!.slots
    expect(own.map((s) => s.clipId)).toEqual(['header.layout-centered', 'pricing.layout-table', 'faq.layout-columns'])
    expect(own.every((s) => s.inspiredBy?.url === 'https://fernway.example/pricing')).toBe(true)
    expect(r.skipped.some((s) => /Kept this mix’s nav/.test(s.reason))).toBe(true)
  })

  it('refuses a pick with nothing to clip, and an unknown site', async () => {
    await expect(runCommand('clip_from_site', { site: 'fernway', sections: [7] })).rejects.toThrow(/No layout yet/)
    await expect(runCommand('clip_from_site', { site: 'nowhere', all: true })).rejects.toThrow(/No site/)
  })

  it('use_site_style adds the site’s look as candidates that resolve to the site', async () => {
    await runCommand('use_site_style', { site: 'fernway', adopt: true })
    const g = useStore.getState().guide
    const ids = g.candidates.filter((c) => c.id.startsWith('src:site:fernway#')).map((c) => c.id)
    expect(ids).toContain('src:site:fernway#color')
    expect(candidateSource(library, 'src:site:fernway#color')?.name).toBe('Fernway')
    expect(candidateSourceName(library, 'src:site:gone-site#type')).toBe('Gone site')
    expect(resolveGuide(g).tokens['color.primary']).toBe('#1f6f4a')
    expect(resolveGuide(g).provenance['color.primary']).toBe('src:site:fernway#color')
  })

  it('lists and describes sites for agents', async () => {
    const list = (await runCommand('list_library_sites', { industry: 'architecture' })) as { sites: { slug: string }[] }
    expect(list.sites.map((s) => s.slug)).toEqual(['harbor-and-pine'])
    const site = (await runCommand('get_library_site', { site: 'fernway' })) as { pages: { sections: { order: number; clippable: boolean; layout: string | null }[] }[] }
    expect(site.pages[0].sections.find((s) => s.order === 7)).toMatchObject({ clippable: false, layout: null })
    expect(site.pages[0].sections[1].layout).toBe('hero.layout-split')
  })

  it('a mix from a site page holds its layouts under its look', () => {
    const m = mixFromSitePage(library, fern, fern.pages[0])
    expect(m.site.shared.nav?.clipId).toBe('nav.layout-simple')
    expect(m.site.shared.footer?.clipId).toBe('footer.layout-columns')
    expect(m.site.pages[0].slots.map((s) => s.clipId)[0]).toBe('hero.layout-split')
    expect(resolveGuide(m.guide).tokens['color.primary']).toBe('#1f6f4a')
  })

  it('puts the credit in the packet: blokmix.json and BLOKMIX.md', async () => {
    await runCommand('clip_from_site', { site: 'fernway', sections: [4] })
    await runCommand('use_site_style', { site: 'fernway' })
    const input = packetInputFor(useStore.getState(), { version: null, targets: ['astro'] })
    const json = packetJson(input)
    const sec = json.sections.find((s) => s.clip.id === 'features.layout-grid' && s.inspiredBy)
    expect(sec?.inspiredBy).toEqual({ site: 'Fernway', url: 'https://fernway.example/' })
    expect(buildNotes(input)).toContain('Layout inspired by:** Fernway (https://fernway.example/)')
    expect(json.provenance['color.primary']).toBe('Fernway (https://fernway.example/)')
  })

  it('a section without its own credit falls back to its clip’s', () => {
    const clip = library.clips['features.layout-grid']
    const slot = { id: 's1', type: clip.type, clipId: clip.id, locked: false, keep: { layout: true, style: false, content: false, motion: true } }
    const lib = { ...library, clips: { ...library.clips, [clip.id]: { ...clip, inspiredBy: { site: 'Somewhere', url: 'https://somewhere.example/' } } } }
    const page = composePage({ slots: [slot], library: lib, guide: resolveGuide(useStore.getState().guide), content: useStore.getState().content })
    expect(page.sections[0].inspiredBy?.site).toBe('Somewhere')
  })
})

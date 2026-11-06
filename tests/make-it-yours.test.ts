import { describe, expect, it } from 'vitest'
import '@/data/skins'
import { library } from '@/data/library'
import { renameBrand } from '@/core/words'
import { applySkin, contrastFailures, skinList } from '@/core/skins'
import { emptyContract } from '@/core/contract'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { paletteFrom } from '@/core/palette'
import { carryEdits, withClip } from '@/core/library'
import { isSiteLogo, pictureFor } from '@/core/sectionDefaults'
import { siteFromSlots } from '@/core/site'
import { DEFAULT_KEEP, type MediaFill, type ProjectContent, type Slot } from '@/core/types'

const photo: MediaFill = { source: 'upload', asset: 'a1' }

describe('your site’s name', () => {
  const content: ProjectContent = { brand: 'Fern', fields: { nav: { brand: 'Fern' }, hero: { headline: 'Fern bakes bread', subhead: 'Fernando, our baker' }, footer: { legal: '© 2026 Fern.' } } }
  const slot: Slot = {
    id: 's1',
    type: 'hero',
    clipId: library.layoutsByType.hero[0],
    locked: false,
    keep: { ...DEFAULT_KEEP },
    words: { headline: 'Why Fern?' },
    options: { headline: [{ text: 'Fern, since 1990', by: 'you', keptAt: 1 }] },
  }
  const site = siteFromSlots([slot])

  it('changes everywhere it’s written, whole words only', () => {
    const out = renameBrand(content, site, 'Fern', 'Clay & Co')
    expect(out.content.brand).toBe('Clay & Co')
    expect(out.content.fields.nav?.brand).toBe('Clay & Co')
    expect(out.content.fields.hero?.headline).toBe('Clay & Co bakes bread')
    expect(out.content.fields.hero?.subhead).toBe('Fernando, our baker')
    expect(out.content.fields.footer?.legal).toBe('© 2026 Clay & Co.')
    const s = out.site.pages[0].slots[0]
    expect(s.words?.headline).toBe('Why Clay & Co?')
    expect(s.options?.headline[0].text).toBe('Clay & Co, since 1990')
    expect(out.count).toBe(5)
  })

  it('never swaps to or from nothing', () => {
    expect(renameBrand(content, site, '', 'Clay').count).toBe(0)
    expect(renameBrand(content, site, 'Fern', '  ').count).toBe(0)
    expect(renameBrand(content, site, 'Fern', '  ').site).toBe(site)
  })
})

describe('one brand color', () => {
  const brand = '#e2508d'
  const guide = { ...emptyGuide(), brand: { color: brand } }

  it.each(skinList().map((s) => s.id))('stays, and reads at AA, under %s', (id) => {
    const skin = skinList().find((s) => s.id === id)!
    const t = resolveGuide(applySkin(guide, skin)).tokens
    expect(t['color.primary']).toBe(paletteFrom(brand, skin.mode)['color.primary'])
    expect(contrastFailures(t)).toEqual([])
  })

  it('gives way to the theme’s own colors when color is set to Surprise', () => {
    const skin = skinList().find((s) => s.id !== 'wireframe')!
    const t = resolveGuide(applySkin(guide, skin, { ...emptyContract(), areas: { color: 'surprise' } })).tokens
    expect(t['color.primary']).not.toBe(paletteFrom(brand, skin.mode)['color.primary'])
  })
})

describe('trying another layout', () => {
  const heroes = library.layoutsByType.hero.filter((id) => library.clips[id].blocks.some((b) => b.kind === 'image' && b.media))
  const [a, b] = heroes
  const pic = (id: string) => library.clips[id].blocks.find((x) => x.kind === 'image' && x.media)!
  const linked = (id: string) => library.clips[id].blocks.find((x) => x.field === 'ctaPrimary')

  it('keeps your picture and your links', () => {
    const edits = { [a]: { [pic(a).id]: { media: photo }, ...(linked(a) ? { [linked(a)!.id]: { link: { kind: 'url' as const, url: 'https://fern.example' } } } : {}) } }
    const slot = { id: 's', clipId: a, keep: { ...DEFAULT_KEEP }, edits }
    const next = withClip(slot, b, library)
    expect(next.edits?.[b]?.[pic(b).id]?.media).toEqual(photo)
    if (linked(a) && linked(b)) expect(next.edits?.[b]?.[linked(b)!.id]?.link).toEqual({ kind: 'url', url: 'https://fern.example' })
    // and back again: the first layout still has its own
    expect(withClip(next, a, library).edits?.[a]).toEqual(edits[a])
  })

  it('leaves what the new layout already has alone', () => {
    const other: MediaFill = { source: 'upload', asset: 'b2' }
    const edits = { [a]: { [pic(a).id]: { media: photo } }, [b]: { [pic(b).id]: { media: other } } }
    const out = carryEdits(edits, library.clips[a], library.clips[b])
    expect(out?.[b]?.[pic(b).id]?.media).toEqual(other)
    expect(out?.[a]).toBe(edits[a])
  })
})

describe('your logo', () => {
  const logo: MediaFill = { source: 'upload', asset: 'logo', fit: 'contain' }
  it('fills the nav’s and footer’s logo, not a logo strip’s', () => {
    const navLogo = { id: 'b1', kind: 'image' as const, media: 'logo' }
    expect(isSiteLogo(navLogo, 'nav')).toBe(true)
    expect(pictureFor(undefined, navLogo, undefined, 'layout', false, { type: 'nav', logo })).toEqual(logo)
    expect(pictureFor(undefined, { ...navLogo, media: 'logo3' }, undefined, 'layout', false, { type: 'logos', logo })).toBeUndefined()
    // a picture of its own wins
    expect(pictureFor(photo, navLogo, undefined, 'layout', false, { type: 'nav', logo })).toEqual(photo)
  })
})

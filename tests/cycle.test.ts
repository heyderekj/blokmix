import { describe, expect, it } from 'vitest'
import { cycleIds, extendLibrary, pickable, rawClipsFromFiles, withClip } from '@/core/library'
import { library } from '@/data/library'
import type { Library } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { effectiveEdit, ORIGINAL } from '@/core/blocks/style'
import { blankMix } from '@/state/seed'
import { DEFAULT_CONTENT } from '@/core/content'

// Two captured heroes, as the extension saves them: one in this mix, one from another mix.
const layoutId = library.layoutsByType.hero[0]
const base = library.clips[layoutId]
const folder = base.id.split('.')[1]
const files = (src: string) => ({
  [`samples/clips/hero/${src}-split/clip.html`]: base.html.split(`mx-hero-${folder}`).join(`mx-hero-${src}-split`),
  [`samples/clips/hero/${src}-split/clip.css`]: base.css.split(`mx-hero-${folder}`).join(`mx-hero-${src}-split`),
  [`samples/clips/hero/${src}-split/clip.json`]: JSON.stringify({ title: 'Split hero', layoutPattern: 'split', rhythm: 'split', capture: { capturedAt: '2026-11-05', viewport: { w: 1440, h: 900 } } }),
})

function libWithClips() {
  // A copy of the built-in library, so adding clips here leaves the shared one alone.
  const copy = (m: Record<string, string[]>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]))
  const lib = { ...library, clips: { ...library.clips }, sources: { ...library.sources }, byType: copy(library.byType), layoutsByType: copy(library.layoutsByType), warnings: [] } as unknown as Library
  const src = (id: string) => ({ ...library.sources[base.sourceId], id, name: id, url: `https://${id}.com`, kind: 'site' as const })
  extendLibrary(lib, [src('acme'), src('other')], rawClipsFromFiles({ ...files('acme'), ...files('other') }))
  return lib
}

describe("a section's arrows", () => {
  it('step through the layouts and this mix’s clips, never another mix’s', () => {
    const lib = libWithClips()
    expect(pickable(lib, 'hero')).toContain('hero.other-split')
    const ids = cycleIds(lib, 'hero', ['hero.acme-split'])
    expect(ids).toContain('hero.acme-split')
    expect(ids).not.toContain('hero.other-split')
    expect(ids.filter((id) => lib.clips[id].origin === 'layout')).toEqual(pickable(lib, 'hero').filter((id) => lib.clips[id].origin === 'layout'))
  })

  it('always include the clip the section shows, in its place, so it never reads "0 of n"', () => {
    const lib = libWithClips()
    const ids = cycleIds(lib, 'hero', [], 'hero.other-split')
    expect(ids).toContain('hero.other-split')
    expect(ids.indexOf('hero.other-split')).toBeGreaterThan(0)
    // A clip of another type isn't slipped in.
    expect(cycleIds(lib, 'hero', [], library.layoutsByType.footer[0])).not.toContain(library.layoutsByType.footer[0])
  })
})

describe('stepping onto a layout', () => {
  const slot = { id: 's', clipId: 'hero.acme-split', keep: { ...DEFAULT_KEEP, style: true, content: true } }
  it('turns off a captured clip’s own words and look, so the layout shows yours', () => {
    const lib = libWithClips()
    const next = withClip(slot, layoutId, lib)
    expect(next.clipId).toBe(layoutId)
    expect(next.keep).toEqual({ ...DEFAULT_KEEP, style: false, content: false })
  })
  it('leaves them alone between captured clips', () => {
    const lib = libWithClips()
    expect(withClip(slot, 'hero.other-split', lib).keep).toEqual(slot.keep)
    expect(withClip(slot, slot.clipId, lib)).toBe(slot)
  })
})

describe('Original over a skin’s default look', () => {
  const def = { variant: 'pill', style: { radius: 'lg' as const } }
  it('is reachable, and drops the default’s look', () => {
    expect(effectiveEdit(undefined, def)?.variant).toBe('pill')
    const own = effectiveEdit({ variant: ORIGINAL }, def)
    expect(own?.variant).toBe(ORIGINAL)
    expect(own?.style).toBeUndefined()
  })
})

describe('a new mix', () => {
  it('starts with plain starter words, not Blokmix’s own demo copy', () => {
    const words = JSON.stringify(blankMix().content.fields)
    expect(words).not.toContain(DEFAULT_CONTENT.fields.hero?.headline ?? '∅')
    expect(words).not.toMatch(/Blokmix/)
  })
})

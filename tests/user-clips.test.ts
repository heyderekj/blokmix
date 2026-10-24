import { describe, expect, it } from 'vitest'
import { buildLibrary, extendLibrary, rawClipsFromFiles } from '@/core/library'
import { library } from '@/data/library'

// A captured clip as the extension saves it: one built-in layout, re-sourced to a new site.
const layoutId = library.layoutsByType.hero[0]
const base = library.clips[layoutId]
const folder = base.id.split('.')[1]
const files = (src: string) => {
  const html = base.html.split(`mx-hero-${folder}`).join(`mx-hero-${src}-split`)
  const css = base.css.split(`mx-hero-${folder}`).join(`mx-hero-${src}-split`)
  return {
    [`samples/clips/hero/${src}-split/clip.html`]: html,
    [`samples/clips/hero/${src}-split/clip.css`]: css,
    [`samples/clips/hero/${src}-split/clip.json`]: JSON.stringify({ title: 'Split hero', layoutPattern: 'split', rhythm: 'split', capture: { capturedAt: '2026-10-24', viewport: { w: 1440, h: 900 } } }),
  }
}

describe('captured clips joining the library', () => {
  it('adds them after the samples, ahead of the layouts, and leaves existing clips alone', () => {
    const lib = buildLibrary(Object.values(library.sources), [])
    const source = { ...library.sources[base.sourceId], id: 'acme', name: 'Acme', kind: 'site' as const }
    const added = extendLibrary(lib, [source], rawClipsFromFiles(files('acme')))
    expect(added).toEqual(['hero.acme-split'])
    expect(lib.sources.acme.name).toBe('Acme')
    expect(lib.byType.hero[0]).toBe('hero.acme-split')
    expect(extendLibrary(lib, [source], rawClipsFromFiles(files('acme')))).toEqual([])
  })
})

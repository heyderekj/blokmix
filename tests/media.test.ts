import { describe, expect, it } from 'vitest'
import { BASE_TOKENS } from '@/core/tokens'
import type { TokenSet } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { dataUrlBytes, parseUnsplash, placeholderSvg, renderMedia, sizeForRatio, stockUrl } from '@/core/media'
import { library } from '@/data/library'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { packetFiles } from '@/core/export/packet'
import { advise } from '@/core/advise'

const tokens = { ...BASE_TOKENS, 'color.primary': '#e2508d', 'color.accent': '#ffd400', 'color.surface': '#f4f4f5' } as TokenSet
const PNG = 'data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAEX/I/of'

describe('placeholders', () => {
  it('are deterministic, sized to the block, and drawn from the palette', () => {
    const a = placeholderSvg('arch', 3, tokens, '4/5')
    expect(placeholderSvg('arch', 3, tokens, '4/5')).toBe(a)
    expect(placeholderSvg('arch', 4, tokens, '4/5')).not.toBe(a)
    expect(a).toContain('#e2508d')
    expect(a).toContain(`viewBox="0 0 ${sizeForRatio('4/5').join(' ')}"`)
  })
})

describe('stock and uploads', () => {
  it('reads Unsplash results with credit and download tracking, and hotlinks sized URLs', () => {
    const [p] = parseUnsplash({
      results: [{ id: 'x', width: 4000, height: 3000, description: null, alt_description: 'a desk', urls: { raw: 'https://images.unsplash.com/photo-1', small: 's' }, links: { html: 'h', download_location: 'd' }, user: { name: 'Ana', links: { html: 'https://unsplash.com/@ana' } } }],
    })
    expect(p).toMatchObject({ author: 'Ana', track: 'd', description: 'a desk' })
    expect(stockUrl(p, 1600)).toContain('w=1600')
  })

  it('turns an uploaded data URL into bytes for the export', () => {
    expect(dataUrlBytes(PNG)).toMatchObject({ ext: 'webp' })
    expect(renderMedia({ source: 'upload', asset: 'a' }, tokens, '1/1', () => PNG)?.src).toBe(PNG)
    expect(renderMedia({ source: 'upload', asset: 'gone' }, tokens, '1/1', () => undefined)).toBeNull()
  })
})

describe('pictures in exports', () => {
  const clip = library.clips['team.layout-grid']
  const img = clip.blocks.find((b) => b.kind === 'image')!
  const img2 = clip.blocks.filter((b) => b.kind === 'image')[1]
  const page = composePage({
    slots: [{ id: 's', type: 'team', clipId: clip.id, locked: false, keep: { ...DEFAULT_KEEP }, edits: { [clip.id]: { [img.id]: { media: { source: 'placeholder', style: 'portrait', seed: 2, alt: 'Ada' } }, [img2.id]: { media: { source: 'upload', asset: 'a1', alt: 'Bo' } } } } }],
    guide: resolveGuide(emptyGuide()),
    content: DEFAULT_CONTENT,
    library,
    uploads: () => PNG,
  })
  const s = page.sections[0]

  it('writes files, adds an <img> over the placeholder art, and layers the CSS', () => {
    expect(Object.keys(page.mediaFiles).sort()).toEqual([`media/s1-${img.id}.svg`, `media/s1-${img2.id}.webp`])
    const html = JSON.stringify(s.tree)
    expect(html).toContain(`/media/s1-${img.id}.svg`)
    expect(html).toContain('"alt","Ada"')
    expect(s.css).toContain('> .mx-media { position: absolute')
    expect(s.css).toContain(':where(')
  })

  it('ships them into both projects and lists them in the packet', () => {
    const files = packetFiles({ page, guide: resolveGuide(emptyGuide()), guideState: emptyGuide(), library, tapeName: 'T', targets: ['astro', 'next'] })
    expect(files[`astro/public/media/s1-${img2.id}.webp`]).toBeInstanceOf(Uint8Array)
    expect(files[`next/public/media/s1-${img.id}.svg`]).toContain('<svg')
    expect(files['MIXTAPE.md']).toContain('## Images')
    expect(files['MIXTAPE.md']).toContain('dinky compress-image')
  })

  it('asks for alt text on real pictures', () => {
    const blocks = [{ id: 'b0', kind: 'image' as const, parent: null, children: [], label: 'Team · Image' }]
    expect(advise({ blocks, edits: { b0: { media: { source: 'upload', asset: 'x' } } }, tokens, fields: {} }).find((a) => a.rule === 'alt')?.level).toBe('problem')
    expect(advise({ blocks, edits: { b0: { media: { source: 'upload', asset: 'x', alt: 'A desk' } } }, tokens, fields: {} }).some((a) => a.rule === 'alt')).toBe(false)
  })
})

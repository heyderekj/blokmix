import { describe, expect, it } from 'vitest'
import { transformWithOxc } from 'vite'
import { transform as astroTransform } from '@astrojs/compiler'
import { library } from '@/data/library'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { astroFiles } from '@/core/export/astro'
import { nextFiles } from '@/core/export/next'
import { packetFiles } from '@/core/export/packet'
import { parseHtml } from '@/core/html/parse'
import { serialize } from '@/core/html/serialize'

const clips = Object.values(library.clips)

function pageFor(slots: Slot[]) {
  return composePage({ slots, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })
}

describe('serializer', () => {
  it('keeps inline whitespace and escapes braces', () => {
    const tree = parseHtml('<p class="a">Hello <strong>world</strong> {x}</p>')
    expect(serialize(tree, 'jsx')).toBe('<p className="a">Hello <strong>world</strong> &#123;x&#125;</p>')
  })
  it('emits pre text as JS strings in JSX', () => {
    const tree = parseHtml('<pre><code>$ a\n$ b</code></pre>')
    expect(serialize(tree, 'jsx')).toBe('<pre><code>{"$ a\\n$ b"}</code></pre>')
  })
  it('renames JSX attributes', () => {
    const tree = parseHtml('<label for="x"><input type="radio" checked id="x"><svg viewBox="0 0 1 1"><path stroke-width="2" fill-rule="evenodd"/></svg></label>')
    const out = serialize(tree, 'jsx')
    expect(out).toContain('htmlFor="x"')
    expect(out).toContain('defaultChecked')
    expect(out).toContain('viewBox="0 0 1 1"')
    expect(out).toContain('strokeWidth="2" fillRule="evenodd"')
  })
})

describe.each(clips.map((c) => [c.id, c] as const))('exporters: %s', (_id, clip) => {
  for (const keep of [DEFAULT_KEEP, { layout: true, style: true, content: true, motion: false }]) {
    const page = pageFor([{ id: 's1', type: clip.type, clipId: clip.id, locked: false, keep }])
    const tag = `style=${keep.style} content=${keep.content}`

    it(`TSX parses (${tag})`, async () => {
      const files = nextFiles(page)
      for (const [path, code] of Object.entries(files)) {
        if (!path.endsWith('.tsx')) continue
        await expect(transformWithOxc(code, path, { lang: 'tsx' })).resolves.toBeTruthy()
      }
    })

    it(`Astro compiles (${tag})`, async () => {
      const files = astroFiles(page)
      for (const [path, code] of Object.entries(files)) {
        if (!path.endsWith('.astro')) continue
        const r = await astroTransform(code, { filename: path })
        expect(r.diagnostics.filter((d) => d.severity === 1).map((d) => d.text), path).toEqual([])
      }
    })
  }

  it('swaps in your copy when content is off', () => {
    const page = pageFor([{ id: 's1', type: clip.type, clipId: clip.id, locked: false, keep: DEFAULT_KEEP }])
    const html = serialize(page.sections[0].tree, 'html')
    const mine = DEFAULT_CONTENT.fields[clip.type] ?? {}
    for (const f of Object.keys(clip.fields)) if (mine[f]) expect(html, f).toContain(mine[f].replace(/&/g, '&amp;'))
  })
})

describe('packet', () => {
  it('produces the full file set', () => {
    const slots: Slot[] = Object.values(library.byType)
      .filter((ids) => ids.length)
      .map((ids, i) => ({ id: `s${i}`, type: library.clips[ids[0]].type, clipId: ids[0], locked: false, keep: DEFAULT_KEEP }))
    const guideState = emptyGuide()
    const files = packetFiles({
      page: pageFor(slots),
      guide: resolveGuide(guideState),
      guideState,
      library,
      tapeName: 'Test tape',
      targets: ['astro', 'next'],
    })
    for (const f of ['mixtape.json', 'MIXTAPE.md', 'tokens.css', 'tokens.json', 'reference.html', 'astro/src/pages/index.astro', 'next/app/page.tsx', 'next/app/layout.tsx'])
      expect(Object.keys(files)).toContain(f)
    const json = JSON.parse(files['mixtape.json'])
    expect(json.schema).toBe('mixtape.packet/v1')
    expect(json.sections).toHaveLength(slots.length)
  })
})

describe('jsx attributes', () => {
  it('writes numeric attributes as numbers, so React’s types accept them', () => {
    const tsx = nextFiles(
      composePage({
        slots: [{ id: 's', type: 'contact', clipId: 'contact.layout-split', locked: false, keep: { ...DEFAULT_KEEP } }],
        guide: resolveGuide(emptyGuide()),
        content: DEFAULT_CONTENT,
        library,
      }),
    )
    const src = Object.entries(tsx).find(([p]) => p.endsWith('ContactLayoutSplit.tsx'))![1]
    expect(src).toMatch(/rows=\{\d+\}/)
    expect(src).not.toMatch(/rows="/)
  })
})

describe('block looks', () => {
  it('exports restyled blocks with a class, layered CSS and packet notes', () => {
    const clip = library.clips['cta.layout-band']
    const btn = clip.blocks.find((b) => b.kind === 'button')!
    const page = composePage({
      slots: [{ id: 's', type: 'cta', clipId: clip.id, locked: false, keep: { ...DEFAULT_KEEP }, edits: { [clip.id]: { [btn.id]: { variant: 'outline', style: { fill: 'accent' } } } }, words: { heading: 'Mine' } }],
      guide: resolveGuide(emptyGuide()),
      content: DEFAULT_CONTENT,
      library,
      page: { components: { badge: { variant: 'dot' } } },
    })
    const s = page.sections[0]
    expect(s.css).toMatch(/^@layer base, clip, motion, blocks;/)
    expect(s.css).toContain(`.mx-s1-${btn.id}`)
    expect(s.css).toContain('@layer blocks')
    expect(s.blocks.map((b) => b.kind).sort()).toEqual(['badge', 'button'])
    const html = JSON.stringify(s.tree)
    expect(html).toContain(`mx-s1-${btn.id}`)
    expect(html).toContain('Mine')
  })
})

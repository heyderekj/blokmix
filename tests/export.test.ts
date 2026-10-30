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
import { describeEdit } from '@/core/export/describe'
import { referenceHtml } from '@/core/export/reference-html'

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
        await expect(transformWithOxc(code as string, path, { lang: 'tsx' })).resolves.toBeTruthy()
      }
    })

    it(`Astro compiles (${tag})`, async () => {
      const files = astroFiles(page)
      for (const [path, code] of Object.entries(files)) {
        if (!path.endsWith('.astro')) continue
        const r = await astroTransform(code as string, { filename: path })
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
      mixName: 'Test mix',
      targets: ['astro', 'next'],
    })
    for (const f of ['blokmix.json', 'BLOKMIX.md', 'tokens.css', 'tokens.json', 'reference.html', 'astro/src/pages/index.astro', 'next/app/page.tsx', 'next/app/layout.tsx'])
      expect(Object.keys(files)).toContain(f)
    const json = JSON.parse(files['blokmix.json'] as string)
    expect(json.schema).toBe('blokmix.packet/v1')
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
    expect(s.css).toMatch(/^@layer base, clip, effects, motion, blocks;/)
    expect(s.css).toContain(`.mx-s1-${btn.id}`)
    expect(s.css).toContain('@layer blocks')
    expect(s.blocks.map((b) => b.kind).sort()).toEqual(['badge', 'button'])
    const html = JSON.stringify(s.tree)
    expect(html).toContain(`mx-s1-${btn.id}`)
    expect(html).toContain('Mine')
  })
})

describe('spacing', () => {
  it('exports block spacing on the scale and section spacing on the root', () => {
    const clip = library.clips['cta.layout-band']
    const card = clip.blocks.find((b) => b.kind === 'card')!
    const page = composePage({
      slots: [{ id: 's', type: 'cta', clipId: clip.id, locked: false, keep: { ...DEFAULT_KEEP }, edits: { [clip.id]: { [card.id]: { style: { padding: 8, gap: 2, above: 4 } } } }, spacing: { top: 'tight', bottom: 'none' } }],
      guide: resolveGuide(emptyGuide()),
      content: DEFAULT_CONTENT,
      library,
    })
    const s = page.sections[0]
    expect(s.css).toContain('padding: var(--mx-space-8);')
    expect(s.css).toContain('gap: var(--mx-space-2);')
    expect(s.css).toContain('margin-block-start: var(--mx-space-4);')
    expect(s.css).toContain(`.${clip.rootClass}.mx-s1 { padding-top: calc(var(--mx-space-section) * 0.5); padding-bottom: 0px; }`)
    expect(JSON.stringify(s.tree)).toContain(`${clip.rootClass} mx-s1`)
  })
})

describe('mobile editing', () => {
  const clip = Object.values(library.clips).find((c) => c.sourceId === 'layout' && c.blocks.some((b) => b.kind === 'badge' && b.field) && c.blocks.some((b) => b.kind === 'button'))!
  const badge = clip.blocks.find((b) => b.kind === 'badge' && b.field)!
  const btn = clip.blocks.find((b) => b.kind === 'button')!
  const page = composePage({
    slots: [
      {
        id: 's',
        type: clip.type,
        clipId: clip.id,
        locked: false,
        keep: { ...DEFAULT_KEEP },
        edits: { [clip.id]: { [badge.id]: { mobile: { hidden: true } }, [btn.id]: { style: { padding: 4 }, mobile: { style: { padding: 2 } } } } },
        spacing: { mobile: { top: 'tight' } },
      },
    ],
    guide: resolveGuide(emptyGuide()),
    content: DEFAULT_CONTENT,
    library,
  })
  const s = page.sections[0]

  it('puts phone rules in a media query inside @layer blocks, after the desktop ones', () => {
    const layer = s.css.slice(s.css.indexOf('/* Blocks you restyled */'))
    expect(layer).toMatch(/@layer blocks \{[^]*@media \(max-width: 760px\) \{[^]*display: none;/)
    expect(layer.indexOf('padding: var(--mx-space-4);')).toBeLessThan(layer.indexOf('padding: var(--mx-space-2);'))
    expect(layer.indexOf('@media (max-width: 760px)')).toBeGreaterThan(layer.indexOf('@layer blocks'))
    // Section spacing on phones only still gets its root class.
    expect(s.css).toContain(`.${clip.rootClass}.mx-s1 { padding-top: calc(var(--mx-space-section) * 0.5); }`)
    expect(JSON.stringify(s.tree)).toContain(`${clip.rootClass} mx-s1`)
  })

  it('keeps a block hidden on phones in the markup and its content file', () => {
    expect(JSON.stringify(s.tree)).toContain(`mx-s1-${badge.id}`)
    expect(s.content[badge.field!]).toBeTruthy()
    expect(s.blocks.find((b) => b.id === badge.id)?.edit.mobile).toEqual({ hidden: true })
  })

  it('describes phone changes for the builder', () => {
    expect(describeEdit({ style: { padding: 4 }, mobile: { style: { padding: 2 } } })).toContain('on phones (≤760px): padding 2')
    expect(describeEdit({ mobile: { hidden: true } })).toContain('on phones (≤760px): hidden')
  })

  it('keeps block ids only when asked, so the page can be measured', () => {
    expect(referenceHtml(page)).not.toContain('data-mx-b=')
    const measured = composePage({ slots: [{ id: 's', type: clip.type, clipId: clip.id, locked: false, keep: { ...DEFAULT_KEEP } }], guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library, keepBlockIds: true })
    const html = referenceHtml(measured, { tagSlots: true })
    expect(html).toContain(`data-mx-b="${btn.id}"`)
    expect(html).toContain('data-mx-slot="s"')
    expect(html).not.toContain('data-mx-field=')
  })
})

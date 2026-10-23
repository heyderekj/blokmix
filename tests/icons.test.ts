import { describe, expect, it } from 'vitest'
import { ICON_NAMES, ICON_SETS, blockIconName, iconSvg, identifyIconSet, swapIcons } from '@/core/icons'
import { parseHtml } from '@/core/html/parse'
import { serialize } from '@/core/html/serialize'
import { library } from '@/data/library'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP } from '@/core/types'

describe('icon packs', () => {
  it('draws every icon in every set', () => {
    for (const set of ICON_SETS) for (const n of ICON_NAMES) expect(iconSvg(n, set.id), `${set.id} ${n}`).toMatch(/^<svg[\s\S]+<\/svg>$/)
  })

  it('keeps the clip’s sizing and accessibility attributes but uses the set’s drawing rules', () => {
    const svg = iconSvg('star', 'lucide:bold', [['class', 'ico'], ['width', '14'], ['stroke-width', '3'], ['aria-hidden', 'true']])!
    expect(svg).toContain('class="ico"')
    expect(svg).toContain('stroke-width="2.5"')
    expect(svg).not.toContain('stroke-width="3"')
    expect(iconSvg('star', 'phosphor:fill')).toContain('viewBox="0 0 256 256"')
  })

  it('identifies a source’s set from its icons', () => {
    const round = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1"/></svg>'
    const sharpHeavy = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M1 1"/></svg>'
    const solid = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M1 1"/></svg>'
    expect(identifyIconSet([round, round])?.set).toBe('lucide:regular')
    expect(identifyIconSet([sharpHeavy])?.set).toBe('tabler:bold')
    expect(identifyIconSet([solid, solid])?.set).toBe('heroicons:solid')
    expect(identifyIconSet([])).toBeNull()
  })

  it('redraws named icons, swaps an icon block’s icon, and leaves animated mechanisms alone', () => {
    const html = '<div data-mx-block="icon"><svg data-mx-icon="star" class="i" viewBox="0 0 16 16"><path d="M0 0"/></svg></div><svg data-mx-icon="plus" viewBox="0 0 24 24"><path class="v" d="M0 0"/></svg>'
    const out = serialize(swapIcons(parseHtml(html), 'heroicons:solid', { b0: 'heart' }), 'html')
    expect(out).toContain('data-mx-icon="heart"')
    expect(out).toContain('fill="currentColor"')
    expect(out).toContain('class="v"') // the animated plus keeps its own drawing
    expect(blockIconName(html, 'b0')).toBe('star')
  })

  it('identifies the sample sources and redraws icons in exports', () => {
    expect(library.sources.puffin.tokens['icon.set']).toMatch(/^phosphor:/)
    expect(library.sources.layout.tokens['icon.set']).toBe('lucide:regular')
    const guide = resolveGuide({ ...emptyGuide(), choices: { 'icon.set': { kind: 'custom', value: 'heroicons:solid' } } })
    const page = composePage({ slots: [{ id: 's', type: 'contact', clipId: 'contact.layout-cards', locked: false, keep: { ...DEFAULT_KEEP } }], guide, content: DEFAULT_CONTENT, library })
    const html = serialize(page.sections[0].tree, 'html')
    expect(html).toMatch(/<svg[^>]*fill="currentColor"/)
    const keepOwn = composePage({ slots: [{ id: 's', type: 'contact', clipId: 'contact.layout-cards', locked: false, keep: { ...DEFAULT_KEEP, style: true } }], guide, content: DEFAULT_CONTENT, library })
    expect(serialize(keepOwn.sections[0].tree, 'html')).not.toMatch(/<svg[^>]*fill="currentColor"[^>]*data-mx-icon/)
  })
})

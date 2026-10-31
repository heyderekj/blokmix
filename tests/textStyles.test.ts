import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { allSlots } from '@/core/site'
import { library } from '@/data/library'
import { autoTextStyle, blockTextStyle, editedTextStyles, phoneStep, resolveTextStyles, textDecl } from '@/core/textStyles'
import { blockCss } from '@/core/blocks/style'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP } from '@/core/types'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

const hero = library.clips['hero.layout-split']
const select = (b: { id: string }) => `[data-mx-b="${b.id}"]`
const headline = hero.blocks.find((b) => b.field === 'headline')!

describe('text styles', () => {
  it('reads each block as a style: headlines Display, section headings Heading 2, item titles Heading 4, eyebrows Label', () => {
    expect(autoTextStyle(headline, hero.blocks)).toBe('display')
    const features = library.clips['features.layout-grid']
    expect(autoTextStyle(features.blocks.find((b) => b.field === 'heading')!, features.blocks)).toBe('h2')
    expect(autoTextStyle(features.blocks.find((b) => b.field === 'f1Title')!, features.blocks)).toBe('h4')
    expect(autoTextStyle(features.blocks.find((b) => b.field === 'intro')!, features.blocks)).toBe('bodyLarge')
    expect(autoTextStyle(features.blocks.find((b) => b.kind === 'badge')!, features.blocks)).toBe('label')
  })

  it('leaves every layout as authored until a style is edited or picked', () => {
    expect(blockCss({ blocks: hero.blocks, edits: undefined, select })).toBe('')
    expect(blockTextStyle(headline, hero.blocks, undefined, {})).toBeUndefined()
    // Editing Display restyles the headline, not the body.
    const edited = { textStyles: { display: { size: '5xl' as const } } }
    expect(blockTextStyle(headline, hero.blocks, undefined, edited)).toBe('display')
    const css = blockCss({ blocks: hero.blocks, edits: undefined, textStyles: edited.textStyles, select })
    expect(css).toContain(`[data-mx-b="${headline.id}"] {`)
    expect(css).toContain('font-size: var(--mx-text-5xl);')
    // 'none' opts a block out.
    expect(blockTextStyle(headline, hero.blocks, 'none', edited)).toBeUndefined()
  })

  it('a picked style and a size, with smaller big sizes on phones', () => {
    const t = textDecl(resolveTextStyles(undefined).h2, undefined)
    expect(t.desktop).toContain('font-size: var(--mx-text-4xl);')
    expect(t.phone).toEqual(['font-size: var(--mx-text-2xl);'])
    const sized = textDecl(undefined, '5xl')
    expect(sized.desktop).toEqual(['font-size: var(--mx-text-5xl);', 'line-height: 1.08;'])
    expect(sized.phone).toEqual([`font-size: var(--mx-text-${phoneStep('5xl')});`])
    expect(textDecl(undefined, 'sm').phone).toEqual([])
    const css = blockCss({ blocks: hero.blocks, edits: { [headline.id]: { style: { text: 'label' } } }, select })
    expect(css).toContain('text-transform: uppercase;')
  })

  it('reaches exports through the guide', () => {
    const slot = { id: 's', type: 'hero' as const, clipId: hero.id, locked: false, keep: { ...DEFAULT_KEEP } }
    const guide = { ...emptyGuide(), textStyles: { display: { tracking: -0.05 } } }
    const page = composePage({ slots: [slot], guide: resolveGuide(guide), content: DEFAULT_CONTENT, library, page: guide })
    expect(page.sections[0].css).toContain('letter-spacing: -0.05em;')
  })

  it('commands: edit a style, pick one for a block, size a block', () => {
    const list = runCommand('list_text_styles', {}) as { styles: { id: string; edited: boolean; size: string }[] }
    expect(list.styles).toHaveLength(10)
    expect(list.styles.every((s) => !s.edited)).toBe(true)
    runCommand('update_text_style', { style: 'h2', size: '3xl', weight: 500 })
    expect(editedTextStyles(useStore.getState().guide.textStyles).has('h2')).toBe(true)
    expect((runCommand('list_text_styles', {}) as typeof list).styles.find((s) => s.id === 'h2')).toMatchObject({ edited: true, size: '3xl' })
    runCommand('update_text_style', { style: 'h2', reset: true })
    expect(useStore.getState().guide.textStyles).toBeUndefined()

    const slot = allSlots(useStore.getState().site).find((s) => s.type === 'hero')!
    const block = library.clips[slot.clipId].blocks.find((b) => b.kind === 'heading')!
    const r = runCommand('set_text_style', { section: slot.id, block: block.id, style: 'h3', size: '4xl' }) as { style: string; size: string }
    expect(r).toMatchObject({ style: 'h3', size: '4xl' })
    runCommand('set_text_style', { section: slot.id, block: block.id, style: null, size: null })
    expect(allSlots(useStore.getState().site).find((s) => s.id === slot.id)!.edits?.[slot.clipId]?.[block.id]).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { indexBlocks } from '@/core/blocks'
import { lintClip, wordsWithoutField } from '@/core/lint'
import { parseHtml } from '@/core/html/parse'
import { contentFor } from '@/core/start'
import { sectionClip } from '@/core/lists'

const layouts = Object.values(library.clips).filter((c) => c.origin === 'layout')

describe('small fixed words', () => {
  it('every word a built-in layout shows can be changed', () => {
    for (const c of layouts) expect(wordsWithoutField(parseHtml(c.html)), c.id).toEqual([])
  })

  it('a plan’s “/ month”, “Popular” and billing words are its own fields, and blocks you can click', () => {
    const toggle = library.clips['pricing.layout-toggle']
    for (const f of ['monthly', 'yearly', 't1Per', 't2Flag', 't2Billed', 't3BilledYearly']) expect(Object.keys(toggle.fields), f).toContain(f)
    const flag = toggle.blocks.find((b) => b.field === 't2Flag')!
    expect(flag.kind).toBe('badge')
    expect(flag.id).toMatch(/^l\d+$/)
    // Each sits in its plan, so adding or copying a plan carries it along.
    expect(toggle.blocks.find((b) => b.id === flag.parent)?.kind).toBe('item')
    const rows = library.clips['pricing.layout-rows']
    expect(rows.fields.t1Per).toBe('/ session')
  })

  it('blocks a layout gave its own ids take no number, so the blocks after them keep theirs', () => {
    for (const c of layouts.filter((x) => /data-mx-b="l\d+"/.test(x.html))) {
      // As the layout was before: without the late blocks.
      const before = c.html.replace(/ data-mx-block="[a-z]+" data-mx-b="l\d+"/g, '')
      const was = indexBlocks(parseHtml(before), c.type).filter((b) => b.kind !== 'group')
      const now = c.blocks.filter((b) => b.kind !== 'group' && !/^l\d+$/.test(b.id))
      expect(now.map((b) => [b.id, b.field ?? b.kind]), c.id).toEqual(was.map((b) => [b.id, b.field ?? b.kind]))
      // The section stamps the same ids.
      expect(sectionClip(c).blocks.map((b) => b.id), c.id).toEqual(c.blocks.map((b) => b.id))
    }
  })

  it('lint holds own ids to l1, l2… and once each', () => {
    const lint = (inner: string) =>
      lintClip({ id: 'features.x', type: 'features', rootClass: 'mx-features-x', html: `<section class="mx-features-x" data-mx-section="features">${inner}</section>`, css: '.mx-features-x { }', motionCss: null }).filter((i) => i.level === 'error').map((i) => i.message)
    expect(lint('<p data-mx-block="text" data-mx-b="b3" data-mx-field="intro">Hi</p>').join()).toMatch(/numbered id/)
    expect(lint('<p data-mx-block="text" data-mx-b="l1" data-mx-field="intro">Hi</p><p data-mx-block="text" data-mx-b="l1" data-mx-field="heading">Yo</p>').join()).toMatch(/used twice/)
    expect(lint('<p data-mx-block="text" data-mx-b="l1" data-mx-field="intro">Hi</p>')).toEqual([])
  })

  it('a start has its own words for them, a fixed label stays as the layout has it unless marked', () => {
    const c = contentFor({ kind: 'local', name: 'Fern & Co' }, 2026)
    expect(c.fields.pricing?.t2Flag).toBe('Popular')
    expect(c.fields.contact?.emailTitle).toBe('Email')
    expect(wordsWithoutField(parseHtml('<p><span data-mx-static>New</span><span class="sr">Menu</span><button data-nav-toggle>Menu</button>Fixed</p>'))).toEqual(['Fixed'])
  })
})

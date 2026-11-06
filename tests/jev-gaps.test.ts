import { describe, expect, it } from 'vitest'
import { ELEMENTS, gapMarkdown, gapQuestions, gapReport, readSection, type Have } from '@/core/jev/gaps'
import { SECTION_TYPES } from '@/core/types'
import { library } from '@/data/library'
import { treatmentList } from '@/core/treatments'
import { metrics } from '../scripts/jev/metrics'
import type { JevResponse } from '@/core/jev'
import { answerFor } from './helpers/fakeJev'

const have: Have = { clips: new Set(Object.keys(library.clips)), treatments: new Set(treatmentList().map((t) => `${t.surface}:${t.id}`)) }

/** What Jev "said" about one screenshot: its type, shape and the elements it saw. */
function said(type: string, archetype: string, seen: string[]): JevResponse {
  const qs = gapQuestions()
  const answers = Object.fromEntries(
    Object.entries(qs).map(([name, q]) => [
      name,
      answerFor(q, name === 'type' ? { option: type, p: 0.92 } : name === 'archetype' ? { option: archetype, p: 0.8 } : seen.some((s) => name === `el_${s.replace(/-/g, '_')}`) ? 0.9 : 0.1),
    ]),
  )
  return { model: 'fake', answers, usage: { input_tokens: 900, output_tokens: 0 } }
}

const base = (site: string, storedType: (typeof SECTION_TYPES)[number], status = 'matched', shot = 's1.webp') => ({ site, page: '/', order: 1, screenshot: shot, storedType, status })

describe('the gap finder', () => {
  it('asks the same questions of every screenshot: type, shape and each element', () => {
    const q = gapQuestions()
    expect(q.type.type).toBe('choice')
    expect(Object.keys((q.type as { criteria: object }).criteria)).toEqual([...SECTION_TYPES, 'none_of_these'])
    expect(Object.keys(q).filter((k) => k.startsWith('el_'))).toHaveLength(ELEMENTS.length)
  })

  it('every element it says Blokmix has exists in the library or the treatments', () => {
    const known = new Set([...have.clips, ...have.treatments, 'look:heading.scribble', 'placeholder:shapes', ...treatmentList().filter((t) => t.surface === 'mock').map((t) => `mock:${t.id}`)])
    for (const e of ELEMENTS) for (const id of e.have ?? []) expect(known.has(id), `${e.id} → ${id}`).toBe(true)
  })

  it('counts what recurs across sites and lacks a layout, element or treatment', () => {
    const reads = [
      readSection(base('cafe', 'pricing', 'needs_layout', 'menu.webp'), said('pricing', 'list', ['menu', 'hours'])),
      readSection(base('bistro', 'pricing', 'needs_layout', 'menu2.webp'), said('pricing', 'list', ['menu'])),
      readSection(base('studio', 'hero'), said('hero', 'full-bleed', ['grain', '3d'])),
      readSection(base('shop', 'hero'), said('hero', 'split', ['3d', 'map'])),
      readSection(base('conf', 'content', 'needs_layout', 'agenda.webp'), said('none_of_these', 'timeline', ['schedule'])),
      readSection(base('saas', 'features'), said('testimonials', 'grid', [])),
    ].filter((r) => !!r)
    const r = gapReport(reads, have)
    expect(r.layouts[0]).toMatchObject({ type: 'pricing', archetype: 'list', count: 2, sites: ['cafe', 'bistro'] })
    const el = (id: string) => r.elements.find((e) => e.id === id)!
    expect(el('menu')).toMatchObject({ have: false, count: 2 })
    expect(el('3d')).toMatchObject({ have: false, sites: ['studio', 'shop'] })
    expect(el('map').have).toBe(true)
    expect(el('grain').have).toBe(true)
    expect(r.newTypes.map((n) => n.screenshot)).toEqual(['agenda.webp'])
    expect(r.retype).toEqual([{ site: 'saas', screenshot: 's1.webp', stored: 'features', jev: 'testimonials', p: 0.92 }])
    const md = gapMarkdown(r)
    expect(md).toContain('**pricing · list**: 2 on 2 sites')
    expect(md).toContain('**Menu with prices**')
    expect(md).toContain('**3D render**')
    expect(md).not.toMatch(/Elements to make[\s\S]*\*\*Map\*\*[\s\S]*Treatments to make/)
  })
})

describe('bench metrics', () => {
  it('scores accuracy, coverage at thresholds, calibration and flips', () => {
    const m = metrics([
      { truth: 'a', jev: 'a', p: 0.95, agree: true, baseline: 'a' },
      { truth: 'a', jev: 'a', p: 0.85, agree: true, baseline: 'b' },
      { truth: 'b', jev: 'a', p: 0.55, agree: false, baseline: 'b' },
      { truth: 'b', jev: 'b', p: 0.65, agree: true, baseline: null },
    ])
    expect(m.accuracy).toBe(0.75)
    expect(m.baseline).toBe(0.5)
    expect(m.thresholds.find((t) => t.t === 0.8)).toEqual({ t: 0.8, coverage: 0.5, precision: 1 })
    expect(m.flip).toBe(0.25)
    expect(m.ece).toBeGreaterThan(0)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { library } from '@/data/library'
import { mocks, looks } from '@/data/treatments'
import { BASE_TOKENS } from '@/core/tokens'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, PLACEHOLDER_STYLES, type Slot, type TokenSet } from '@/core/types'
import { composePage } from '@/core/compose'
import { packetFiles } from '@/core/export/packet'
import { astroFiles } from '@/core/export/astro'
import { lintMock } from '@/core/lint'
import { placeholderSvg } from '@/core/media'
import {
  BACKDROP_IDS,
  EFFECT_IDS,
  FILL_IDS,
  MOCK_IDS,
  backdropCss,
  clampParams,
  effectsVars,
  fillSvg,
  mockRender,
  randomParams,
  treatmentList,
  zodFor,
} from '@/core/treatments'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'

const dark: TokenSet = { ...BASE_TOKENS, ...library.sources.nightowl?.tokens }

describe('treatment specs', () => {
  it('every preset and random set of dials is valid for its spec', () => {
    for (const t of treatmentList()) {
      const schema = zodFor(t.params)
      for (const p of t.presets) expect(schema.safeParse(p.values).success, `${t.surface} ${t.id} preset ${p.id}`).toBe(true)
      for (const seed of [1, 2, 3]) expect(schema.safeParse(clampParams(t.params, randomParams(t.params, seed))).success, `${t.id} random`).toBe(true)
    }
  })

  it('clamps dials into range and drops colors that are neither roles nor hex', () => {
    const t = treatmentList('effect').find((x) => x.id === 'shadow')!
    const p = clampParams(t.params, { elevation: 999, tint: 'url(x)' })
    expect(p.elevation).toBe(48)
    expect(p.tint).toBe('text')
  })

  it('every generative placeholder is a placeholder style', () => {
    for (const id of FILL_IDS) expect(PLACEHOLDER_STYLES).toContain(id)
  })
})

describe('effects', () => {
  it('turn into --mx-* variables with palette roles, not hex', () => {
    const vars = effectsVars(Object.fromEntries(EFFECT_IDS.map((id) => [id, { id }])), BASE_TOKENS)
    expect(Object.keys(vars)).toEqual(
      expect.arrayContaining(['--mx-shadow-sm', '--mx-shadow-card', '--mx-shadow-lg', '--mx-gradient', '--mx-grain', '--mx-glass-fill', '--mx-glass-blur', '--mx-glass-edge', '--mx-glow']),
    )
    expect(vars['--mx-gradient']).toBe('linear-gradient(in oklab 120deg, var(--mx-color-primary), var(--mx-color-accent))')
    expect(vars['--mx-shadow-card']).toContain('var(--mx-color-text)')
    expect(vars['--mx-grain']).toMatch(/^url\("data:image\/svg\+xml,/)
    for (const v of Object.values(vars)) expect(v).not.toMatch(/NaN|undefined/)
  })

  it('a flat shadow is none', () => {
    expect(effectsVars({ shadow: { id: 'shadow', params: { elevation: 0 } } }, BASE_TOKENS)['--mx-shadow-card']).toBe('none')
  })

  it('curated looks load with known effects', () => {
    expect(looks.length).toBeGreaterThanOrEqual(5)
    for (const l of looks) {
      expect(Object.keys(l.effects).length, l.id).toBeGreaterThan(0)
      for (const k of Object.keys(l.effects)) expect(EFFECT_IDS).toContain(k)
    }
  })
})

describe('backdrops', () => {
  it('render in @layer effects on the section root, the same every time', () => {
    for (const id of BACKDROP_IDS) {
      const t = treatmentList('backdrop').find((x) => x.id === id)!
      for (const v of [{ id }, ...t.presets.map((p) => ({ id, params: p.values }))]) {
        const css = backdropCss({ ...v, seed: 7 }, BASE_TOKENS, '.root')
        expect(css, id).toMatch(/^@layer effects \{\n\.root \{ /)
        expect(css, id).not.toMatch(/NaN|undefined/)
        expect(css).toBe(backdropCss({ ...v, seed: 7 }, BASE_TOKENS, '.root'))
        expect(css.length, id).toBeLessThan(400_000)
      }
    }
  })

})

describe('generative fills', () => {
  it('draw small, deterministic SVGs in light and dark palettes', () => {
    for (const id of FILL_IDS) {
      const t = treatmentList('fill').find((x) => x.id === id)!
      for (const tokens of [BASE_TOKENS, dark])
        for (const params of [undefined, ...t.presets.map((p) => p.values)]) {
          const svg = fillSvg(id, params, 3, tokens, 800, 450)
          expect(svg, id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
          expect(svg, id).not.toMatch(/NaN|undefined/)
          expect(svg.length, `${id} ${JSON.stringify(params)}`).toBeLessThan(120_000)
          expect(svg).toBe(fillSvg(id, params, 3, tokens, 800, 450))
        }
      expect(fillSvg(id, undefined, 3, BASE_TOKENS, 800, 450)).not.toBe(fillSvg(id, undefined, 4, BASE_TOKENS, 800, 450))
    }
  })

  it('go through placeholderSvg with their dials', () => {
    const a = placeholderSvg('op-art', 2, BASE_TOKENS, '4/3', { rings: 10 })
    const b = placeholderSvg('op-art', 2, BASE_TOKENS, '4/3', { rings: 40 })
    expect(a).not.toBe(b)
  })
})

describe('mockups', () => {
  it('every one ships, and follows the mockup rules', () => {
    expect(mocks.map((m) => m.id).sort()).toEqual([...MOCK_IDS].sort())
    // Read from disk: Vitest hands CSS imports over empty.
    for (const id of MOCK_IDS) {
      const read = (f: string) => readFileSync(`samples/mocks/${id}/${f}`, 'utf8')
      const issues = lintMock({ id, html: read('mock.html'), css: read('mock.css') })
      expect(issues.filter((x) => x.level === 'error'), id).toEqual([])
      expect(read('mock.css').length, id).toBeGreaterThan(200)
    }
  })

  it('render in a frame with seeded numbers and their own scoped CSS', () => {
    const a = mockRender('dashboard', { chrome: 'browser', tilt: 10 }, 1, BASE_TOKENS)!
    const b = mockRender('dashboard', { chrome: 'browser', tilt: 10 }, 2, BASE_TOKENS)!
    expect(a.html).toMatch(/^<div class="mx-media mx-mock mx-mk-\w+" data-chrome="browser" data-shadow/)
    expect(a.html).toContain('class="mx-mock-bar"')
    expect(a.css).toContain('--mk-tilt: 10;')
    expect(a.html).not.toBe(b.html)
    // Dark on a light guide swaps the frame's page and ink.
    expect(mockRender('chat', { surface: 'dark' }, 1, BASE_TOKENS)!.css).toContain(`--mx-color-bg: ${BASE_TOKENS['color.text']}`)
  })
})

describe('exports', () => {
  const hero = Object.values(library.clips).find((c) => c.type === 'hero' && c.blocks.some((b) => b.kind === 'image'))!
  const image = hero.blocks.find((b) => b.kind === 'image')!
  const slot: Slot = {
    id: 's1',
    type: 'hero',
    clipId: hero.id,
    locked: false,
    keep: { ...DEFAULT_KEEP, style: false, content: false },
    backdrop: { id: 'grid', params: { gap: 32 } },
    edits: { [hero.id]: { [image.id]: { media: { source: 'mock', mock: 'analytics', seed: 1 } } } },
  }
  const guide = { ...emptyGuide(), effects: { gradient: { id: 'gradient' }, shadow: { id: 'shadow', params: { elevation: 24 } } } }
  const page = composePage({ slots: [slot], guide: resolveGuide(guide), content: DEFAULT_CONTENT, library, page: guide })

  it('write effect variables, the backdrop and the mockup', () => {
    expect(page.vars['--mx-gradient']).toContain('var(--mx-color-primary)')
    expect(page.vars['--mx-shadow-lg']).toBeTruthy()
    const s = page.sections[0]
    expect(s.css).toMatch(/^@layer base, clip, effects, motion, blocks;/)
    expect(s.css).toContain('/* Backdrop */\n@layer effects {')
    expect(s.css).toContain('/* Mockups */')
    expect(s.backdrop?.label).toBe('Grid')
    expect(s.media[0]).toMatchObject({ source: 'mock', kind: 'mock', mock: 'analytics' })
    expect(page.moving).toBe(false)
  })

  it('carry the mockup as markup into Astro and the packet', () => {
    const files = astroFiles(page)
    const component = Object.entries(files).find(([k]) => k.endsWith('.astro') && k.includes('components'))![1] as string
    expect(component).toContain('mx-mock-analytics')
    const packet = packetFiles({ page, guide: resolveGuide(guide), library, mixName: 'Test', targets: ['astro'] } as Parameters<typeof packetFiles>[0])
    const notes = packet['BLOKMIX.md'] as string
    expect(notes).toContain('**Backdrop:** Grid')
    expect(notes).toContain('UI mockup “analytics”')
    expect(notes).toContain('## Effects')
  })
})

describe('commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('lists treatments with their dials as JSON schema', () => {
    const r = runCommand('list_treatments', { surface: 'backdrop' }) as { treatments: { id: string; dials: { type: string } }[] }
    expect(r.treatments.map((t) => t.id)).toEqual([...BACKDROP_IDS])
    expect(r.treatments[0].dials.type).toBe('object')
  })

  it('sets an effect as one undo step, and the shadow is the card shadow token', () => {
    const before = resolveGuide(useStore.getState().guide).tokens['shadow.card']
    runCommand('set_effect', { effect: 'shadow', preset: 'floating', params: { tint: 'primary' } })
    const g = useStore.getState().guide
    expect(g.effects?.shadow).toMatchObject({ id: 'shadow', preset: 'floating', params: { tint: 'primary', elevation: 36 } })
    expect(resolveGuide(g).tokens['shadow.card']).toContain('var(--mx-color-primary)')
    expect(useStore.temporal.getState().pastStates.length).toBe(1)
    runCommand('set_effect', { effect: 'shadow', remove: true })
    expect(useStore.getState().guide.effects).toBeUndefined()
    expect(resolveGuide(useStore.getState().guide).tokens['shadow.card']).toBe(before)
  })

  it('refuses dials that don’t fit', () => {
    expect(() => runCommand('set_effect', { effect: 'glass', params: { blur: 400 } })).toThrow(/Glass/)
    expect(() => runCommand('set_effect', { effect: 'glass', params: { wobble: 1 } })).toThrow()
  })

  it('applies a curated look, replacing the effects it doesn’t set', () => {
    runCommand('set_effect', { effect: 'glow' })
    runCommand('apply_look', { look: 'soft-glass' })
    expect(Object.keys(useStore.getState().guide.effects ?? {}).sort()).toEqual(['glass', 'gradient', 'shadow'])
  })

  it('puts a backdrop behind a section and a mockup in an image block', () => {
    const slots = currentSlots(useStore.getState())
    const hero = slots.find((s) => s.type === 'hero')!
    runCommand('set_section_backdrop', { section: 'hero', backdrop: 'mesh', preset: 'aurora', seed: 4 })
    expect(currentSlots(useStore.getState()).find((s) => s.id === hero.id)!.backdrop).toMatchObject({ id: 'mesh', preset: 'aurora', seed: 4 })
    runCommand('set_section_backdrop', { section: 'hero', backdrop: null })
    expect(currentSlots(useStore.getState()).find((s) => s.id === hero.id)!.backdrop).toBeUndefined()

    const withImage = slots.find((s) => library.clips[s.clipId].blocks.some((b) => b.kind === 'image'))
    if (withImage) {
      const img = library.clips[withImage.clipId].blocks.find((b) => b.kind === 'image')!
      const r = runCommand('set_mock', { section: withImage.id, block: img.id, mock: 'chat', preset: 'tilted' }) as { media: { source: string; mock: string; params: Record<string, unknown> } }
      expect(r.media).toMatchObject({ source: 'mock', mock: 'chat', params: { tilt: 14 } })
      runCommand('set_image', { section: withImage.id, block: img.id, placeholder: 'topo', params: { levels: 20 } })
      const fill = currentSlots(useStore.getState()).find((s) => s.id === withImage.id)!.edits![withImage.clipId][img.id].media!
      expect(fill).toMatchObject({ source: 'placeholder', style: 'topo', params: { levels: 20 } })
    }
  })
})

describe('capture', () => {
  type El = import('../extension/src/capture/tree').WEl
  const el = (s: Record<string, string>, kids: El[] = [], rect: [number, number, number, number] = [0, 0, 400, 300]): El =>
    ({ t: 'el', id: Math.random(), tag: 'div', ns: 'html', hints: [], s, def: {}, rect, parent: null, kids }) as El

  it('reads a section’s shadow, gradient, glass and glow as effects', async () => {
    const { detectEffects, parseShadow } = await import('../extension/src/capture/effects')
    expect(parseShadow('rgba(0, 0, 0, 0.1) 0px 4px 12px 0px, rgba(0, 0, 0, 0.08) 0px 1px 2px 0px')).toHaveLength(2)
    const t: TokenSet = { ...BASE_TOKENS, 'color.primary': '#2255ff', 'color.accent': '#ff3399' }
    const root = el({ 'background-image': 'linear-gradient(135deg, rgb(34, 85, 255), rgb(255, 51, 153))' }, [
      el({ 'box-shadow': 'rgba(0, 0, 0, 0.12) 0px 8px 24px -4px' }, [], [0, 0, 100, 80]),
      el({ 'box-shadow': 'rgba(0, 0, 0, 0.12) 0px 8px 24px -4px' }, [], [0, 0, 100, 80]),
      el({ 'backdrop-filter': 'blur(12px) saturate(1.6)', 'background-color': 'rgba(255, 255, 255, 0.5)' }),
      el({ 'box-shadow': 'rgba(255, 51, 153, 0.6) 0px 0px 30px 0px' }),
    ])
    const fx = detectEffects(root, t)
    expect(fx.gradient).toMatchObject({ id: 'gradient', params: { stops: ['primary', 'accent'], angle: 135 } })
    expect(fx.shadow).toMatchObject({ id: 'shadow', params: { elevation: 8, layers: 1 } })
    expect(fx.glass).toMatchObject({ id: 'glass', params: { blur: 12, saturate: 160, fill: 50 } })
    expect(fx.glow).toMatchObject({ id: 'glow', params: { color: 'accent', size: 30 } })
  })
})

describe('frames', () => {
  it('the frame’s scripts parse (they live in template literals, where a stray \\n breaks them)', async () => {
    const { buildSrcdoc } = await import('@/frame/srcdoc')
    const doc = buildSrcdoc({ html: '<section></section>', css: '', tokensCss: '', fontHrefs: [] } as Parameters<typeof buildSrcdoc>[0])
    const scripts = [...doc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(scripts.length).toBeGreaterThan(0)
    for (const s of scripts) expect(() => new Function(s)).not.toThrow()
  })
})

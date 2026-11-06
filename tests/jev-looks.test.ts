import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { COMMANDS, type CommandName } from '@/core/commands/schema'
import { AA } from '@/core/palette'
import { CONTRAST_PAIRS, contrastRatio } from '@/core/tokens'
import { colorName, describePalette } from '@/core/jev/colors'
import { swatchSvg } from '@/core/jev/swatch'
import { hueCandidates, variantCandidates } from '@/core/jev/palettes'
import { backdropCandidates, readDress } from '@/core/jev/dress'
import { treatmentList } from '@/core/treatments'
import type { JevRequest } from '@/core/jev'
import { answerFor, fakeJev, realJev } from './helpers/fakeJev'

// No canvas in Node: every drawing "converts" to a small JPEG.
vi.mock('@/lib/jevImage', async (orig) => {
  const real = await orig<typeof import('@/lib/jevImage')>()
  const img = { asset: { type: 'image', format: 'jpg', data_base64: '/9j/' }, inner: { left: 0, top: 0, width: 1, height: 1 } }
  return { ...real, toJevJpeg: vi.fn(async () => img), svgToJpeg: vi.fn(async () => img) }
})

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})
afterEach(() => realJev())

describe('colors by feel', () => {
  it('only ever offers palettes that pass AA, in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const all = [...hueCandidates(mode), ...variantCandidates('#c2410c', mode), ...variantCandidates('#0f766e', mode), ...variantCandidates('#ffe600', mode)]
      for (const c of all)
        for (const [fg, bg, label] of CONTRAST_PAIRS)
          expect(contrastRatio(c.palette[fg as keyof typeof c.palette], c.palette[bg as keyof typeof c.palette]), `${c.from} ${mode} ${label}`).toBeGreaterThanOrEqual(AA)
    }
  })

  it('names colors the way people do, since Jev reads words better than hex', () => {
    expect(colorName('#ffffff')).toBe('white')
    expect(colorName('#0b0b0c')).toBe('near-black')
    expect(colorName('#0f5e63')).toMatch(/teal|cyan/)
    expect(colorName('#e2508d')).toMatch(/pink/)
    expect(colorName('#f7efe0')).toBe('cream')
    expect(describePalette(hueCandidates('light')[0].palette)).toMatch(/background, .* text, .* buttons, .* accent$/)
  })

  it('draws a palette as a little page using every color', () => {
    const p = variantCandidates('#c2410c', 'light')[0].palette
    const svg = swatchSvg(p)
    for (const v of Object.values(p)) expect(svg).toContain(v)
  })

  it('finds three palettes in two rounds, best first, and puts one on as one step', async () => {
    const fake = fakeJev((name, q, req) => {
      const st = req.state as { palettes: { colors: string }[] }
      const i = Number(name.split('_')[1])
      if (name.startsWith('fit_')) return { level: /orange|amber|brown|cream/.test(st.palettes[i].colors) ? 4 : 1 }
      if (name.startsWith('harmony_')) return 0.8
      void q
      return undefined
    })
    const out = (await runCommand('suggest_palettes', { feel: 'a cozy bakery' })) as { colors: Record<string, string>; words: string; fit: number }[]
    expect(fake.requests).toHaveLength(2)
    expect(out).toHaveLength(3)
    expect(out[0].words).toMatch(/orange|amber|brown|cream/)
    expect(out[0].fit).toBeGreaterThanOrEqual(out[2].fit)
    expect((fake.requests[0].state as { brief: { feel: string } }).brief.feel).toBe('a cozy bakery')
    runCommand('set_palette', { colors: out[0].colors }, 'you')
    expect(useStore.getState().guide.choices?.['color.primary']).toMatchObject({ kind: 'custom', value: out[0].colors['color.primary'] })
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })
})

describe('dress it up', () => {
  it('offers each backdrop’s presets, and no live shader when another section runs one', () => {
    const all = backdropCandidates(treatmentList(), false)
    expect(all.some((c) => c.live)).toBe(true)
    expect(backdropCandidates(treatmentList(), true).some((c) => c.live)).toBe(false)
  })

  it('keeps three different ideas, not three presets of one', () => {
    const cands = backdropCandidates(treatmentList(), false)
    const answers = Object.fromEntries(cands.map((c, i) => [`fit_${i}`, answerFor({ type: 'score', instructions: '', criteria: ['a', 'b', 'c', 'd', 'e'] }, { level: c.treatment === 'grain' ? 4 : c.treatment === 'mesh' ? 3 : 1 })]))
    const d = readDress({ model: 'x', answers, usage: { input_tokens: 0, output_tokens: 0 } }, cands)
    expect(d.backdrops.map((b) => b.treatment)).toEqual(['grain', 'mesh'])
  })

  it('hands back ordinary commands that pass their schema', async () => {
    fakeJev((name, _q, req) => {
      const st = req.state as { backgrounds: string[] }
      if (name.startsWith('fit_')) return { level: /grain|mesh|gradient/i.test(st.backgrounds[Number(name.slice(4))]) ? 4 : 1 }
      if (name === 'mock') return { option: 'dashboard', p: 0.8 }
      return undefined
    })
    const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
    const ideas = (await runCommand('suggest_treatments', { section: hero.id, feel: 'more premium' })) as { command: string; input: Record<string, unknown>; needs_pack: boolean }[]
    expect(ideas.length).toBeGreaterThan(0)
    for (const i of ideas) expect(COMMANDS[i.command as CommandName].input.safeParse(i.input).success, i.command).toBe(true)
    const req: JevRequest | undefined = undefined
    void req
  })
})

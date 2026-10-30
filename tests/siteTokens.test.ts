import { describe, expect, it } from 'vitest'
import type { SectionType, TokenSet } from '@/core/types'
import { siteTokens, spaceUnit, type SectionStyle } from '../extension/src/capture/siteTokens'

const light: Partial<TokenSet> = {
  'color.bg': '#ffffff',
  'color.text': '#111111',
  'color.muted': '#666666',
  'color.surface': '#f2f2f2',
  'color.border': '#e0e0e0',
  'color.primary': '#111111',
  'color.accent': '#ff4400',
  'font.display': "'Fraunces', serif",
  'font.body': "'Inter', system-ui, sans-serif",
  'type.base': '16px',
  'radius.base': '8px',
  'space.section': '96px',
}
const dark: Partial<TokenSet> = { ...light, 'color.bg': '#0a0a0a', 'color.text': '#fafafa', 'color.muted': '#999999', 'font.display': "'Inter', system-ui, sans-serif", 'radius.base': '0px' }
const section = (type: SectionType, h: number, tokens: Partial<TokenSet>): SectionStyle => ({ type, area: 1440 * h, tokens, fonts: [] })

describe('site tokens', () => {
  it('takes the ground from the body and light sections, not one big dark band', () => {
    const sections = [section('nav', 80, light), section('hero', 800, light), section('features', 1200, dark), section('faq', 700, light), section('cta', 400, light), section('footer', 400, dark)]
    const { source } = siteTokens({ id: 'acme', name: 'Acme', url: 'https://acme.example/', sections, facts: { bodyBg: 'rgb(255, 255, 255)', bodyColor: 'rgb(17, 17, 17)' } })
    expect(source.kind).toBe('site')
    expect(source.tokens['color.bg']).toBe('#ffffff')
    expect(source.tokens['color.text']).toBe('#111111')
    // The hero counts extra for the display face.
    expect(source.tokens['font.display']).toContain('Fraunces')
    expect(source.tokens['radius.base']).toBe('8px')
    expect(source.personality).toMatch(/^Light ground/)
  })

  it('a dark site stays dark', () => {
    const sections = [section('hero', 900, dark), section('features', 1400, dark), section('cta', 300, light)]
    const { source } = siteTokens({ id: 'x', name: 'X', url: 'https://x.example/', sections, facts: { bodyBg: 'rgb(10, 10, 10)', bodyColor: 'rgb(250, 250, 250)' } })
    expect(source.tokens['color.bg']).toBe('#0a0a0a')
    expect(source.tokens['color.text']).toBe('#fafafa')
  })

  it('takes the primary from the page’s buttons, preferring a brand color to a neutral one', () => {
    const sections = [section('hero', 800, light)]
    const { source } = siteTokens({
      id: 'x',
      name: 'X',
      url: 'https://x.example/',
      sections,
      facts: {
        bodyBg: 'rgb(255, 255, 255)',
        bodyColor: 'rgb(17, 17, 17)',
        buttons: [
          { bg: 'rgba(255, 255, 255, 1)', color: 'rgb(17, 17, 17)', count: 20 },
          { bg: 'rgb(17, 17, 17)', color: 'rgb(255, 255, 255)', count: 6 },
          { bg: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)', count: 4 },
        ],
      },
    })
    expect(source.tokens['color.primary']).toBe('#2563eb')
    expect(source.tokens['color.onPrimary']).toBe('#ffffff')
  })

  it('falls back to a :root brand variable when there are no buttons', () => {
    const { source, vars } = siteTokens({
      id: 'x',
      name: 'X',
      url: 'https://x.example/',
      sections: [section('hero', 800, light)],
      facts: { bodyBg: 'rgb(255, 255, 255)', bodyColor: 'rgb(17, 17, 17)', vars: { '--color-brand': '#16a34a', '--gap': '8px' } },
    })
    expect(vars).toEqual({ '--color-brand': '#16a34a' })
    expect(source.tokens['color.primary']).toBe('#16a34a')
  })

  it('measures the space unit from repeated gaps', () => {
    expect(spaceUnit([8, 16, 24, 32, 48, 64, 16, 8])).toBe(8)
    expect(spaceUnit([4, 12, 20, 8, 16, 12, 4, 28])).toBe(4)
    expect(spaceUnit([10, 20])).toBe(4)
  })
})

describe('site tokens: reading size', () => {
  it('takes type.base from the page’s paragraphs over tiny mock-up text', () => {
    const small = { ...light, 'type.base': '12px' }
    const { source } = siteTokens({
      id: 'x',
      name: 'X',
      url: 'https://x.example/',
      sections: [section('features', 2000, small)],
      facts: { bodyBg: 'rgb(255, 255, 255)', bodyColor: 'rgb(17, 17, 17)', bodySizes: { '16': 1800, '13': 300 } },
    })
    expect(source.tokens['type.base']).toBe('16px')
  })
})

describe('site tokens: soft buttons', () => {
  it('takes the ink for the primary when every button is a soft fill', () => {
    const { source } = siteTokens({
      id: 'x',
      name: 'X',
      url: 'https://x.example/',
      sections: [section('hero', 800, light)],
      facts: { bodyBg: 'rgb(255, 255, 255)', bodyColor: 'rgb(17, 17, 17)', buttons: [{ bg: 'rgb(237, 237, 237)', color: 'rgb(17, 17, 17)', count: 12 }] },
    })
    expect(source.tokens['color.primary']).toBe('#111111')
    expect(source.tokens['color.onPrimary']).toBe('#ffffff')
  })
})

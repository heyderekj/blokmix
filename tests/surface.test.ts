import { describe, expect, it } from 'vitest'
import { SURFACES, surfaceTokens } from '@/core/surface'
import { BASE_TOKENS, contrastRatio } from '@/core/tokens'
import { library, starters } from '@/data/library'
import { buildStarter } from '@/core/starters'
import { resolveGuide } from '@/core/guide'
import { composeSite } from '@/core/compose'
import { siteFromSlots } from '@/core/site'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type TokenSet } from '@/core/types'
import { toneOfGuide } from '@/core/dials'

const palettes: TokenSet[] = [BASE_TOKENS, ...starters.map((s) => resolveGuide(buildStarter(library, s).guide).tokens)]

describe('section surfaces', () => {
  it('keeps text and buttons readable on every band, under every starter’s guide', () => {
    for (const t of palettes)
      for (const sf of SURFACES) {
        const b = surfaceTokens(t, sf)
        expect(contrastRatio(b['color.text'], b['color.bg']), `${sf} text`).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(b['color.onPrimary'], b['color.primary']), `${sf} button`).toBeGreaterThanOrEqual(3)
      }
  })

  it('soft swaps page and surface, inverse flips the tone, page changes nothing', () => {
    expect(surfaceTokens(BASE_TOKENS, 'page')).toBe(BASE_TOKENS)
    expect(surfaceTokens(BASE_TOKENS, 'soft')['color.bg']).toBe(BASE_TOKENS['color.surface'])
    expect(toneOfGuide(surfaceTokens(BASE_TOKENS, 'inverse'))).toBe('dark')
    expect(surfaceTokens(BASE_TOKENS, 'brand')['color.bg']).toBe(BASE_TOKENS['color.primary'])
  })

  it('exports a band as variables on that section only', () => {
    const slot = { id: 's', type: 'cta' as const, clipId: 'cta.layout-band', locked: false, keep: { ...DEFAULT_KEEP }, surface: 'inverse' as const }
    const site = composeSite({ site: siteFromSlots([slot]), guide: resolveGuide({ base: BASE_TOKENS, candidates: [], choices: {} }), content: DEFAULT_CONTENT, library })
    const css = site.site!.pages[0].sections[0].css
    expect(css).toMatch(/\.mx-cta-layout-band\.mx-[a-z]+1 \{[^}]*--mx-color-bg: #18181b/)
  })
})

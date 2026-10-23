import { beforeEach, describe, expect, it } from 'vitest'
import { FONT_LIBRARY, VIBES, fontSource, fontStack, searchFonts } from '@/core/fonts'
import { fontHrefs, fontLinkTags, fontsForTokens } from '@/core/tokens'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP } from '@/core/types'
import { library } from '@/data/library'
import { astroFiles } from '@/core/export/astro'
import { nextFiles } from '@/core/export/next'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'

describe('font library', () => {
  it('fills every vibe, with unique families and both sources', () => {
    expect(new Set(FONT_LIBRARY.map((f) => f.family)).size).toBe(FONT_LIBRARY.length)
    for (const v of VIBES) expect(searchFonts({ vibe: v.id }).length, v.id).toBeGreaterThanOrEqual(5)
    expect(searchFonts({ provider: 'fontshare' }).length).toBeGreaterThanOrEqual(20)
  })

  it('suggests body faces for body text and anything for headings', () => {
    expect(searchFonts({ role: 'body' }).some((f) => f.family === 'Pacifico')).toBe(false)
    expect(searchFonts({ role: 'display' }).some((f) => f.family === 'Pacifico')).toBe(true)
    expect(searchFonts({ role: 'mono' }).every((f) => f.vibes.includes('mono'))).toBe(true)
  })

  it('loads Google and Fontshare fonts from their own stylesheets', () => {
    const t = { ...resolveGuide(emptyGuide()).tokens, 'font.display': fontStack('Clash Display', 'display'), 'font.body': fontStack('Newsreader', 'body') }
    const hrefs = fontHrefs(fontsForTokens(t, []))
    expect(hrefs.some((h) => h.startsWith('https://fonts.googleapis.com/css2?') && h.includes('family=Newsreader:wght@400;500;600'))).toBe(true)
    expect(hrefs).toContain('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap')
    expect(fontLinkTags(hrefs).join('\n')).toContain('https://cdn.fontshare.com')
    expect(fontSource(FONT_LIBRARY.find((f) => f.family === 'Anton')!).css2).toBe('Anton')
  })

  it('includes the open-source families studios publish, credited, and loads Fontsource ones per weight', () => {
    const studio = searchFonts({ vibe: 'studio' })
    expect(studio.find((f) => f.family === 'Geist')?.maker).toBe('Vercel')
    expect(studio.find((f) => f.family === 'Monaspace Neon')?.provider).toBe('fontsource')
    const hrefs = fontHrefs([fontSource(FONT_LIBRARY.find((f) => f.family === 'Commit Mono')!)])
    expect(hrefs).toEqual(['https://cdn.jsdelivr.net/npm/@fontsource/commit-mono/400.css', 'https://cdn.jsdelivr.net/npm/@fontsource/commit-mono/700.css'])
    expect(fontLinkTags(hrefs).join('\n')).toContain('preconnect" href="https://cdn.jsdelivr.net"')
  })

  it('exports link both stylesheets', () => {
    const base = resolveGuide(emptyGuide())
    const guide = { ...base, tokens: { ...base.tokens, 'font.display': fontStack('Satoshi', 'display') } }
    const page = composePage({ slots: [{ id: 's', type: 'hero', clipId: 'hero.layout-centered', locked: false, keep: DEFAULT_KEEP }], guide, content: DEFAULT_CONTENT, library })
    expect(astroFiles(page)['astro/src/layouts/Base.astro']).toContain('api.fontshare.com/v2/css?f[]=satoshi')
    expect(nextFiles(page)['next/app/layout.tsx']).toContain('crossOrigin=""')
  })
})

describe('font commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })
  it('lists fonts and sets one by its family name', () => {
    const r = runCommand('list_fonts', { vibe: 'serif', source: 'fontshare' }) as { fonts: { family: string }[] }
    expect(r.fonts.map((f) => f.family)).toContain('Erode')
    const set = runCommand('set_token', { key: 'font.body', value: 'Erode' }) as { value: string }
    expect(set.value).toBe("'Erode', Georgia, serif")
  })
})

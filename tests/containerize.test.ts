import { describe, expect, it } from 'vitest'
import { roundTrip, toContainerQueries, viewportWidthRules } from '@/core/containerize'
import { library } from '@/data/library'
import { lintClip } from '@/core/lint'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP } from '@/core/types'
import { serialize } from '@/core/html/serialize'
import { expandTokens, BASE_TOKENS } from '@/core/tokens'
import { sectionTokens } from '@/core/surface'
import { DIALS } from '@/core/dials'

const css = `.mx-hero-x {
  padding: var(--mx-space-10) var(--mx-space-8);
  & .grid { display: grid; }

  @media (max-width: 760px) {
    /* phones; one column */
    padding-inline: var(--mx-space-5);
    &.reverse .grid { order: 2; }
    & .grid { grid-template-columns: 1fr; }
  }
  & .card {
    @media (max-width: 1080px) { padding: var(--mx-space-4); }
  }
  &::before {
    @media (max-width: 760px) { display: none; }
  }
  @media (hover: hover) and (pointer: fine) { & .btn:hover { opacity: 0.9; } }
}
@keyframes mx-hero-x-rise { from { opacity: 0; } }
`

describe('container queries', () => {
  it('prints back exactly what it read', () => {
    expect(roundTrip(css)).toBe(css)
    for (const c of Object.values(library.clips)) expect(roundTrip(c.css)).toBe(c.css)
  })

  it('moves what is inside the section to the section, keeps what styles the root on the viewport', () => {
    const out = toContainerQueries(css)
    // The root's own padding stays a media query; descendants move.
    expect(out).toMatch(/@media \(max-width: 760px\) \{\s*\/\* phones; one column \*\/\s*padding-inline: var\(--mx-space-5\);\s*\}/)
    expect(out).toMatch(/@container \(max-width: 616px\) \{\s*&\.reverse \.grid \{ order: 2; \}\s*& \.grid \{ grid-template-columns: 1fr; \}\s*\}/)
    // Nested inside a descendant rule: a container query.
    expect(out).toContain('& .card {\n    @container (max-width: 936px)')
    // Inside a rule on the root itself (its ::before): still the viewport.
    expect(out).toContain('&::before {\n    @media (max-width: 760px)')
    // Hover queries and keyframes are left alone.
    expect(out).toContain('@media (hover: hover) and (pointer: fine)')
    expect(out).toContain('@keyframes mx-hero-x-rise')
    expect(toContainerQueries(out)).toBe(out)
    expect(viewportWidthRules(css)).toBe(2)
    expect(viewportWidthRules(out)).toBe(0)
  })

  it('sees a breakpoint (and a rule on the root) past the comment above it', () => {
    const out = toContainerQueries('.mx-x {\n  /* Phones */\n  @media (max-width: 760px) {\n    /* the root */ &.flip .a { order: 1; }\n    /* itself */ &::after { content: none; }\n  }\n}\n')
    expect(out).toContain('/* Phones */\n  @media (max-width: 760px) {\n    /* itself */ &::after')
    expect(out).toContain('@container (max-width: 616px) {\n    /* the root */ &.flip .a')
  })

  it('every built-in layout answers to its section and uses the width tokens', () => {
    for (const c of Object.values(library.clips).filter((x) => x.origin === 'layout')) {
      expect(viewportWidthRules(c.css), c.id).toBe(0)
      const issues = lintClip({ id: c.id, type: c.type, rootClass: c.rootClass, html: c.html, css: c.css, motionCss: c.motionCss })
      expect(issues.filter((i) => /viewport|fixed content width/.test(i.message)).map((i) => i.message), c.id).toEqual([])
    }
  })

  it('makes every exported section a size container', () => {
    const page = composePage({ slots: [{ id: 's', type: 'hero', clipId: 'hero.layout-split', locked: false, keep: { ...DEFAULT_KEEP } }], guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })
    expect(serialize(page.sections[0].tree, 'html')).toMatch(/^<section[^>]*class="[^"]*\bmx-section\b/)
  })
})

describe('widths', () => {
  it('turns the width tokens into the content and reading columns', () => {
    const v = expandTokens(BASE_TOKENS)
    expect(v['--mx-width-content']).toBe('1200px')
    expect(v['--mx-width-text']).toBe('760px')
    // A guide saved before the tokens existed still gets them.
    const { ['space.content']: _c, ['space.text']: _t, ...old } = BASE_TOKENS
    expect(expandTokens(old as typeof BASE_TOKENS)['--mx-width-content']).toBe('1200px')
  })

  it('a section can run narrow, wide or full', () => {
    expect(sectionTokens(BASE_TOKENS, {})['space.content']).toBe('1200px')
    expect(sectionTokens(BASE_TOKENS, { width: 'wide' })['space.content']).toBe('1440px')
    expect(sectionTokens(BASE_TOKENS, { width: 'full' })['space.content']).toBe('100%')
    const narrow = sectionTokens(BASE_TOKENS, { width: 'narrow' })
    expect(parseFloat(narrow['space.content'])).toBeLessThan(1200)
    expect(parseFloat(narrow['space.text'])).toBeLessThanOrEqual(760)
    // Surface and width together.
    expect(sectionTokens(BASE_TOKENS, { surface: 'soft', width: 'wide' })['color.bg']).toBe(BASE_TOKENS['color.surface'])
  })

  it('the Width dial moves both columns together', () => {
    const narrow = DIALS.width.write(0)
    const wide = DIALS.width.write(100)
    expect(narrow).toEqual({ 'space.content': '1040px', 'space.text': '680px' })
    expect(wide).toEqual({ 'space.content': '1440px', 'space.text': '840px' })
    expect(DIALS.width.read({ ...BASE_TOKENS, ...wide })).toBe(100)
  })
})

import { describe, expect, it } from 'vitest'
import type { BlockInfo } from '@/core/types'
import { motionCss } from '@/core/motion'
import { library } from '@/data/library'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP } from '@/core/types'
import { advise } from '@/core/advise'
import { BASE_TOKENS } from '@/core/tokens'

const b = (id: string, kind: BlockInfo['kind'], parent: string | null = null): BlockInfo => ({ id, kind, parent, children: [], label: kind })
const blocks = [b('b0', 'heading'), b('b1', 'text'), b('b2', 'button'), b('b3', 'image')]
const base = { blocks, select: (x: BlockInfo) => `[data-mx-b="${x.id}"]`, root: '[data-mx-section]', prefix: 'mx-m' }

describe('motion presets', () => {
  it('staggers a section’s blocks with ease-out, inside no-preference, with a fade for reduced motion', () => {
    const css = motionCss({ ...base, edits: () => undefined, section: { mode: 'preset', enter: 'rise', stagger: true } })
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)')
    expect(css).toContain('cubic-bezier(0.23, 1, 0.32, 1) 120ms both')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).not.toMatch(/ease-in[^-]/)
    expect(css).not.toMatch(/scale: 0[;\s]/)
  })

  it('a block can opt out of the stagger, and hover only applies where hover is real', () => {
    const css = motionCss({ ...base, edits: (x) => (x.id === 'b0' ? { motion: { enter: 'none' } } : x.id === 'b2' ? { motion: { hover: 'lift' } } : undefined), section: { mode: 'preset', stagger: true } })
    expect(css).not.toContain('[data-mx-b="b0"] { animation')
    expect(css).toContain('@media (hover: hover) and (pointer: fine) { [data-mx-b="b2"]:hover')
  })

  it('uses real scroll timelines in exports and plays on load on the canvas', () => {
    const edits = () => ({ motion: { scroll: 'reveal' as const } })
    expect(motionCss({ ...base, edits, canvas: false })).toContain('animation-timeline: view()')
    expect(motionCss({ ...base, edits, canvas: true })).not.toContain('animation-timeline')
  })

  it('exports a preset instead of the clip’s own motion', () => {
    const slots = [{ id: 's', type: 'cta' as const, clipId: 'cta.layout-band', locked: false, keep: { ...DEFAULT_KEEP }, motion: { mode: 'preset' as const, enter: 'pop' as const, stagger: true } }]
    const s = composePage({ slots, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library }).sections[0]
    expect(s.motionCss).toContain('Motion presets')
    expect(s.motionCss).not.toContain('@layer motion')
    expect(s.motionCss).toContain('mx-s1-m-pop')
  })

  it('suggests restraint: one loop, no hover on static text, no entrance on the nav', () => {
    const a = advise({
      blocks,
      edits: { b0: { motion: { hover: 'lift' } }, b2: { motion: { loop: 'float', enter: 'rise' } }, b3: { motion: { loop: 'spin' } } },
      tokens: BASE_TOKENS,
      fields: {},
      sectionType: 'nav',
    })
    expect(a.find((x) => x.rule === 'loops')?.blockId).toBe('b3')
    expect(a.find((x) => x.rule === 'hover-static')?.blockId).toBe('b0')
    expect(a.find((x) => x.rule === 'nav-motion')?.blockId).toBe('b2')
  })
})

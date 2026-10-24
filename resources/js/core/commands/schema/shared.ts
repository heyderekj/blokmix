import { z } from 'zod'
import { ENTER_PRESETS, HOVER_PRESETS, LOOP_PRESETS, SCROLL_PRESETS } from '../../types'

/** Building blocks the command schemas share. */
export const section = z.union([z.string(), z.number().int().min(1)]).describe('A section: its id, its position from the top of the page (1 = first), its type such as "hero", its anchor ("team"), or a page and anchor ("/about#team"). "nav" and "footer" are the shared ones')
export const block = z.string().describe('A block in that section: its id ("b3") or its label ("Pricing · Plan 2 · Button")')
export const space = z.number().int().min(0).max(10).describe('A step on the spacing scale: 0, 1 (XS), 2 (S), 4 (M), 6 (L), 8 (XL), up to 10')
export const color = z
  .string()
  .describe('A palette color: primary, accent, text, muted, surface, bg, border, onPrimary, a brand color as "x:<name>", optionally a tint like "primary/20"')

export const style = z
  .object({
    fill: color.nullable().optional(),
    ink: color.nullable().optional().describe('Text color'),
    radius: z.enum(['none', 'sm', 'md', 'lg', 'pill']).nullable().optional(),
    shadow: z.enum(['none', 'soft', 'lifted', 'offset']).nullable().optional(),
    padding: space.nullable().optional(),
    above: space.nullable().optional().describe('Space above the block'),
    below: space.nullable().optional().describe('Space below the block'),
    gap: space.nullable().optional().describe('Space between the block’s children (lists, cards, items)'),
  })
  .describe('Only the properties you set change; null clears one back to the clip’s own')

export const speed = z.enum(['quick', 'normal', 'slow'])
export const blockMotion = z
  .object({
    enter: z.enum([...ENTER_PRESETS, 'none']).nullable().optional().describe('How it arrives; "none" opts out of the section’s stagger'),
    hover: z.enum(HOVER_PRESETS).nullable().optional().describe('Only on things you can click'),
    scroll: z.enum(SCROLL_PRESETS).nullable().optional(),
    loop: z.enum(LOOP_PRESETS).nullable().optional().describe('Use sparingly: one loop per section at most'),
    speed: speed.nullable().optional(),
  })
  .describe('Motion presets; null clears one. They follow the craft rules: ease-out, transform and opacity, reduced motion keeps fades only.')

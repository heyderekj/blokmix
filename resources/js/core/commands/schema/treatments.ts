import { z } from 'zod'
import { BACKDROP_IDS, EFFECT_IDS, MOCK_IDS } from '../../treatments'
import { section, block } from './shared'

const params = z
  .record(z.string(), z.any())
  .describe('Dials by name, as list_treatments describes them (only the ones to change). Colors are palette roles (primary, accent, surface, text, muted, bg, border, onPrimary) so they re-theme, or hex.')
const preset = z.string().describe('A preset id from list_treatments; dials given alongside override it')
const seed = z.number().int().min(1).describe('Another seed draws another variation with the same dials')

/** Effects, backdrops, generative pictures and UI mockups: the visual layer, each a set of dials. */
export const TREATMENT_COMMANDS = {
  list_treatments: {
    description:
      'The visual treatments and their dials: style guide effects (shadow, gradient, grain, glass, glow, which become --mx-* variables every section can use), section backdrops (gradient, mesh, grain, dots, grid, lines, topo, halftone, op-art stripes, spotlight, glow orb), generative pictures for image blocks (dither, halftone, topo, flow lines, blocks, ASCII, op art, marble, grain gradient) and UI mockups (dashboard, chat, table…). Each lists its dials as a JSON schema and its presets, plus the curated looks (sets of effects that work together).',
    input: z.object({ surface: z.enum(['effect', 'backdrop', 'fill', 'mock']).optional() }),
    write: false,
  },
  set_effect: {
    description:
      'Set one of the style guide’s effects from a preset and/or dials, or remove it. Shadow is also the card shadow token; gradient restyles gradient buttons and headings; glass the glass card; grain and glow their looks and backdrops.',
    input: z.object({ effect: z.enum(EFFECT_IDS), preset: preset.optional(), params: params.optional(), remove: z.boolean().optional() }),
    write: true,
  },
  apply_look: {
    description:
      'Apply a set of effects at once, as one undo step: a curated look by id (from list_treatments), or effects you pass (for example a library site’s detected effects: { shadow: { id: "shadow", params: {…} }, … }). replace (default true) clears effects the look doesn’t set.',
    input: z.object({
      look: z.string().optional(),
      effects: z.record(z.string(), z.object({ id: z.string().optional(), params: z.record(z.string(), z.any()).optional() })).optional(),
      replace: z.boolean().optional(),
    }),
    write: true,
  },
  set_section_backdrop: {
    description:
      'Put a backdrop behind a section (a gradient, mesh, grain, pattern or glow), from a preset and/or dials, or null for as clipped. inverse: true flips the section to the primary color. Keep text readable over it; review checks contrast.',
    input: z.object({ section, backdrop: z.enum(BACKDROP_IDS).nullable(), preset: preset.optional(), params: params.optional(), seed: seed.optional() }),
    write: true,
  },
  set_mock: {
    description:
      'Fill an image block with a UI mockup: a small screen (dashboard, analytics, chat, cards, phone, table, form, toasts, calendar, code) drawn in HTML with the style guide’s fonts and colors, in a browser or phone frame, optionally tilted. It exports as real markup.',
    input: z.object({ section, block, mock: z.enum(MOCK_IDS), preset: preset.optional(), params: params.optional(), seed: seed.optional(), alt: z.string().optional() }),
    write: true,
  },
} as const

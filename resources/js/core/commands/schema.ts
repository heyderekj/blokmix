// The commands anyone can run on a tape: the app's own controls, a prompt, or an
// agent over MCP. Pure zod, so the MCP bridge can list them without the app.
//
// Sections are referred to by id, by position (1 = top) or by type ("pricing").
// Blocks are referred to by id ("b3") or by label ("Pricing · Plan 2 · Button").

import { z } from 'zod'
import { BLOCK_KINDS, NOTE_KINDS, NOTE_STATUSES, SECTION_TYPES, TOKEN_KEYS } from '../types'

const section = z.union([z.string(), z.number().int().min(1)]).describe('A section: its id, its position from the top (1 = first), or its type such as "hero"')
const block = z.string().describe('A block in that section: its id ("b3") or its label ("Pricing · Plan 2 · Button")')
const space = z.number().int().min(0).max(10).describe('A step on the spacing scale: 0, 1 (XS), 2 (S), 4 (M), 6 (L), 8 (XL), up to 10')
const color = z
  .string()
  .describe('A palette colour: primary, accent, text, muted, surface, bg, border, onPrimary, a brand colour as "x:<name>", optionally a tint like "primary/20"')

const style = z
  .object({
    fill: color.nullable().optional(),
    ink: color.nullable().optional().describe('Text colour'),
    radius: z.enum(['none', 'sm', 'md', 'lg', 'pill']).nullable().optional(),
    shadow: z.enum(['none', 'soft', 'lifted', 'offset']).nullable().optional(),
    padding: space.nullable().optional(),
    above: space.nullable().optional().describe('Space above the block'),
    below: space.nullable().optional().describe('Space below the block'),
    gap: space.nullable().optional().describe('Space between the block’s children (lists, cards, items)'),
  })
  .describe('Only the properties you set change; null clears one back to the clip’s own')

export const COMMANDS = {
  get_page: {
    description:
      'Read the page: every section in order with its clip, keep settings, spacing, its words and its blocks (id, label, kind, words, look). Start here.',
    input: z.object({ section: section.optional().describe('Only this section') }),
    write: false,
  },
  get_options: {
    description:
      'What could go somewhere. With "section", the clips and layouts that could replace it, ranked with reasons. With "at", the section types that fit a new section at that position, ranked with reasons. With "block", the looks for that block (suggested first) and the checklist’s advice.',
    input: z.object({ section: section.optional(), block: block.optional(), at: z.number().int().min(0).optional().describe('Insert position: 0 = top') }),
    write: false,
  },
  review: {
    description: 'Run the design checklist (one main action, contrast, tap targets, clear labels, heading length, consistency) over the page or one section.',
    input: z.object({ section: section.optional() }),
    write: false,
  },
  add_section: {
    description: 'Insert a section. Without clip_id, the clip or layout that suits that spot best is used.',
    input: z.object({ type: z.enum(SECTION_TYPES), at: z.number().int().min(0).optional().describe('Insert position: 0 = top; default = where it usually goes'), clip_id: z.string().optional() }),
    write: true,
  },
  remove_section: { description: 'Remove a section.', input: z.object({ section }), write: true },
  move_section: { description: 'Move a section to a new position (1 = top).', input: z.object({ section, to: z.number().int().min(1) }), write: true },
  swap_section: {
    description: 'Swap a section to another clip or layout of the same type (see get_options).',
    input: z.object({ section, clip_id: z.string() }),
    write: true,
  },
  set_keep: {
    description: 'What a section keeps from its source: layout (reproduce the structure), style (its own captured look instead of the style guide), copy (source words), motion.',
    input: z.object({ section, layout: z.boolean().optional(), style: z.boolean().optional(), copy: z.boolean().optional(), motion: z.boolean().optional() }),
    write: true,
  },
  set_words: {
    description: 'Change the words in a section, by field name (from get_page). Empty string resets a field to the shared copy.',
    input: z.object({ section, words: z.record(z.string(), z.string()) }),
    write: true,
  },
  set_block: {
    description: 'Change one block: its look (a variant id from get_options, or null for the original), its style and spacing, or hide it. reset clears all changes.',
    input: z.object({ section, block, look: z.string().nullable().optional(), style: style.optional(), hidden: z.boolean().optional(), reset: z.boolean().optional() }),
    write: true,
  },
  use_look_for_all: {
    description: 'Make a block’s current look and style the default for every block of its kind on the page (e.g. all buttons).',
    input: z.object({ section, block }),
    write: true,
  },
  set_look_for_all: {
    description: 'Set or clear the page-wide default look for a kind of block directly.',
    input: z.object({ kind: z.enum(BLOCK_KINDS), look: z.string().nullable().optional(), style: style.optional(), clear: z.boolean().optional() }),
    write: true,
  },
  set_section_spacing: {
    description: 'A section’s top and bottom padding relative to the style guide.',
    input: z.object({ section, top: z.enum(['none', 'tight', 'default', 'roomy']).optional(), bottom: z.enum(['none', 'tight', 'default', 'roomy']).optional() }),
    write: true,
  },
  set_token: {
    description: 'Set a style guide token to your own value (e.g. color.primary "#e2508d", font.display "\'Fraunces\', serif", radius.base "12px"), or null to go back to automatic.',
    input: z.object({ key: z.enum(TOKEN_KEYS), value: z.string().nullable() }),
    write: true,
  },
  add_brand_colour: {
    description: 'Add a named brand colour to the palette; use it as "x:<name>" in styles.',
    input: z.object({ name: z.string().min(1), value: z.string().regex(/^#[0-9a-f]{3,8}$/i) }),
    write: true,
  },
  show: {
    description: 'Point the person at something: focus a section (and select a block) on the canvas.',
    input: z.object({ section, block: block.optional() }),
    write: false,
  },
  save_version: { description: 'Save the current mix as a version.', input: z.object({ title: z.string().optional() }), write: true },
  list_notes: {
    description:
      'The marks (feedback pinned to blocks, areas or the page), most important first: number (N1…), kind (must-fix, nit, question, keep), status, who left it, what it’s on, suggested copy and replies. Never change anything marked keep.',
    input: z.object({ status: z.enum(NOTE_STATUSES).optional(), kind: z.enum(NOTE_KINDS).optional(), section: section.optional() }),
    write: false,
  },
  add_note: {
    description: 'Leave a mark on a block, a section or the page. Use it to flag something for the person rather than changing it yourself.',
    input: z.object({
      kind: z.enum(NOTE_KINDS),
      text: z.string().min(1),
      section: section.optional().describe('Omit for a note on the whole page'),
      block: block.optional(),
      suggested_copy: z.string().optional().describe('The exact words you propose'),
    }),
    write: true,
  },
  update_note: {
    description: 'Move a mark along: in_progress when you start on it, resolved with a short note when it’s done. Only a person can verify.',
    input: z.object({
      note: z.union([z.string(), z.number().int()]).describe('The mark: its id, "N3" or 3'),
      status: z.enum(['in_progress', 'resolved']),
      resolution: z.string().optional().describe('What you did'),
    }),
    write: true,
  },
  reply_note: {
    description: 'Reply on a mark, e.g. to answer a question or explain a choice.',
    input: z.object({ note: z.union([z.string(), z.number().int()]), text: z.string().min(1) }),
    write: true,
  },
} as const

export type CommandName = keyof typeof COMMANDS
export type CommandInput<N extends CommandName> = z.infer<(typeof COMMANDS)[N]['input']>

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** The commands as tool definitions (MCP and the Claude API use the same shape). */
export function toolDefinitions(): ToolDefinition[] {
  return (Object.entries(COMMANDS) as [CommandName, (typeof COMMANDS)[CommandName]][]).map(([name, c]) => ({
    name,
    description: c.description,
    input_schema: z.toJSONSchema(c.input) as Record<string, unknown>,
  }))
}

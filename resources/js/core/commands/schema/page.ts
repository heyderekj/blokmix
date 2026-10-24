import { z } from 'zod'
import { SECTION_TYPES, TOKEN_KEYS } from '../../types'
import { section, block } from './shared'
import { page } from './site'

/** The page, its sections, words, lists, style guide and reads. */
export const PAGE_COMMANDS = {
  get_page: {
    description:
      'Read a page (the open one unless `page` says): every section in order with its clip, keep settings, spacing, its words and its blocks (id, label, kind, words, look). Start here.',
    input: z.object({ page: page.optional(), section: section.optional().describe('Only this section') }),
    write: false,
  },
  get_options: {
    description:
      'What could go somewhere. With "section", the clips and layouts that could replace it, ranked with reasons. With "at", the section types that fit a new section at that position, ranked with reasons. With "block", the looks for that block (suggested first) and the checklist’s advice.',
    input: z.object({ page: page.optional(), section: section.optional(), block: block.optional(), at: z.number().int().min(0).optional().describe('Insert position: 0 = top') }),
    write: false,
  },
  review: {
    description:
      'Run the design checklist (one main action, contrast, tap targets, clear labels, heading and line length, consistency) over the page or one section. It measures the page at desktop (1280px) and mobile (390px) widths; each item says which (at).',
    input: z.object({
      page: page.optional(),
      section: section.optional(),
      widths: z.array(z.enum(['desktop', 'mobile'])).min(1).optional().describe('Which widths to check; default both'),
    }),
    write: false,
  },
  add_section: {
    description:
      'Insert a section on a page. Without clip_id, the clip or layout that suits that spot best is used. A nav or footer is shared by every page: adding one shows the site’s on this page.',
    input: z.object({ page: page.optional(), type: z.enum(SECTION_TYPES), at: z.number().int().min(0).optional().describe('Insert position: 0 = top; default = where it usually goes'), clip_id: z.string().optional() }),
    write: true,
  },
  remove_section: { description: 'Remove a section. Removing the shared nav or footer takes it off every page.', input: z.object({ section }), write: true },
  move_section: { description: 'Move a section to a new position on its page (1 = top).', input: z.object({ page: page.optional(), section, to: z.number().int().min(1) }), write: true },
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
  get_content: {
    description:
      'Read the words as content: each section’s content file (fields, and lists as arrays, as exported to src/content/<section>.json), its lists (id, items, whether you can add or remove items and how many fit), and each field’s word options (kept, retired, by whom).',
    input: z.object({ page: page.optional(), section: section.optional() }),
    write: false,
  },
  word_options: {
    description:
      'Options for one field’s words, Koati style: keep offers other ways to say it (the person cycles through them on the page), use shows one, retire takes options out of the cycle, put_back returns retired ones. Offer 2–3 genuinely different options rather than rewording silently.',
    input: z.object({
      section,
      field: z.string().describe('Field name from get_page or get_content'),
      keep: z.array(z.string().min(1)).optional().describe('New options to keep'),
      use: z.string().optional().describe('Words to show now (kept as an option if they aren’t one yet)'),
      retire: z.array(z.string()).optional(),
      put_back: z.array(z.string()).optional(),
    }),
    write: true,
  },
  edit_list: {
    description:
      'Change a list’s items (features, questions, plans, logos…): add one (it copies the first item’s structure), duplicate, remove or move an item, or reset to the layout’s own items.',
    input: z.object({
      section,
      list: z.string().describe('The list: its block id, label or name ("questions") from get_content'),
      op: z.enum(['add', 'duplicate', 'remove', 'move', 'reset']),
      item: z.number().int().min(1).optional().describe('Which item, 1 = first (duplicate, remove, move)'),
      to: z.number().int().min(1).optional().describe('Move: the new position, 1 = first'),
    }),
    write: true,
  },
  set_list: {
    description:
      'Write a whole list at once: its items in order, each as an object of the item’s fields (keys as in get_content, e.g. {"q": …, "a": …}) or a string for one-field items (logos, links). Items are added or removed to match. Nested lists (a plan’s features) are separate lists: set them by their own id.',
    input: z.object({
      section,
      list: z.string().describe('The list: its block id, label or name from get_content'),
      items: z.array(z.union([z.string(), z.record(z.string(), z.string())])).min(1),
    }),
    write: true,
  },
  list_fonts: {
    description:
      'Browse the free font library (Google Fonts, Fontshare and Fontsource, all free for commercial use), organised by vibe: studio (open-source families from studios and tool makers), display, sans, serif, humanist, rounded, mono, script, hand, retro. Filter by role to get faces that suit headings, body text or code. Then set one with set_token.',
    input: z.object({
      query: z.string().optional(),
      vibe: z.enum(['studio', 'display', 'sans', 'serif', 'humanist', 'rounded', 'mono', 'script', 'hand', 'retro']).optional().describe('"studio": open-source families from studios and tool makers (Geist, Mona Sans, Plex, iA Writer…)'),
      role: z.enum(['display', 'body', 'mono']).optional(),
      source: z.enum(['google', 'fontshare', 'fontsource']).optional(),
    }),
    write: false,
  },
  set_token: {
    description: 'Set a style guide token to your own value (e.g. color.primary "#e2508d", font.display "Satoshi" or a full stack, radius.base "12px"), or null to go back to automatic. Fonts from list_fonts load by themselves, in the canvas and in exports.',
    input: z.object({ key: z.enum(TOKEN_KEYS), value: z.string().nullable() }),
    write: true,
  },
  add_brand_colour: {
    description: 'Add a named brand colour to the palette; use it as "x:<name>" in styles.',
    input: z.object({ name: z.string().min(1), value: z.string().regex(/^#[0-9a-f]{3,8}$/i) }),
    write: true,
  },
  show: {
    description: 'Point the person at something: open a page, focus a section on it (and select a block) on the canvas.',
    input: z.object({ page: page.optional(), section: section.optional(), block: block.optional() }),
    write: false,
  },
} as const

import { z } from 'zod'
import { DIAL_NAMES } from '../../dials'
import { FORMATS, GOALS, INDUSTRIES } from '../../brief'
import { SECTION_TYPES, TOKEN_KEYS } from '../../types'
import { TEXT_STYLES, TYPE_STEPS } from '../../textStyles'
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
    description: 'What a section keeps from its source: layout (reproduce the structure), style (its own captured look instead of the style guide), copy (source words), motion. A section its owner locked refuses this and every other change except marks.',
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
      'Change a list’s items (features, questions, plans, logos…): add one (it copies the first item’s structure; with item, right after that one), duplicate, remove or move an item, swap two items (they trade places, nothing else moves), or reset to the layout’s own items.',
    input: z.object({
      section,
      list: z.string().describe('The list: its block id, label or name ("questions") from get_content'),
      op: z.enum(['add', 'duplicate', 'remove', 'move', 'swap', 'reset']),
      item: z.number().int().min(1).optional().describe('Which item, 1 = first (duplicate, remove, move, swap; add puts the new one after it)'),
      to: z.number().int().min(1).optional().describe('Move: the new position; swap: the other item’s position (1 = first)'),
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
      'Browse the free font library (Google Fonts, Fontshare and Fontsource, all free for commercial use), organized by vibe: studio (open-source families from studios and tool makers), display, sans, serif, humanist, rounded, mono, script, hand, retro. Filter by role to get faces that suit headings, body text or code. Then set one with set_token.',
    input: z.object({
      query: z.string().optional(),
      vibe: z.enum(['studio', 'display', 'sans', 'serif', 'humanist', 'rounded', 'mono', 'script', 'hand', 'retro']).optional().describe('"studio": open-source families from studios and tool makers (Geist, Mona Sans, Plex, iA Writer…)'),
      role: z.enum(['display', 'body', 'mono']).optional(),
      source: z.enum(['google', 'fontshare', 'fontsource']).optional(),
    }),
    write: false,
  },
  list_text_styles: {
    description:
      'The style guide’s text styles (Display, Heading 1–4, Body large, Body, Small, Caption, Label): font, size on the type scale and on phones, weight, line height, letter spacing, case, and whether you’ve edited each. An edited style restyles every block that reads as it (headlines are Display, section headings Heading 2, item titles Heading 4, intros Body large, eyebrows Label…).',
    input: z.object({}),
    write: false,
  },
  update_text_style: {
    description:
      'Edit a text style; every block using it changes, and once edited it also restyles the blocks that read as it. size and phone are type scale steps (xs…6xl); weight a number or "display" (the display weight token); tracking in em. reset puts the style back to its default.',
    input: z.object({
      style: z.enum(TEXT_STYLES),
      font: z.enum(['display', 'body', 'mono']).optional(),
      size: z.enum(TYPE_STEPS).optional(),
      phone: z.enum(TYPE_STEPS).optional(),
      weight: z.union([z.number().int().min(100).max(900), z.literal('display')]).optional(),
      leading: z.number().min(0.8).max(2.4).optional(),
      tracking: z.number().min(-0.1).max(0.3).optional(),
      upper: z.boolean().optional(),
      reset: z.boolean().optional(),
    }),
    write: true,
  },
  set_token: {
    description: 'Set a style guide token to your own value (e.g. color.primary "#e2508d", font.display "Satoshi" or a full stack, radius.base "12px"), or null to go back to automatic. Fonts from list_fonts load by themselves, in the canvas and in exports.',
    input: z.object({ key: z.enum(TOKEN_KEYS), value: z.string().nullable() }),
    write: true,
  },
  set_dial: {
    description:
      'Tune the style guide by feel, 0–100: spacing (tight → airy: space unit and section padding), type (small → large: base size and scale ratio), roundness (square → round: radius), weight (light → heavy: display weight and line weight). get_page shows where each sits.',
    input: z.object({ dial: z.enum(DIAL_NAMES), value: z.number().min(0).max(100) }),
    write: true,
  },
  set_tone: {
    description: 'Make the style guide light or dark: background and text trade places and the surface, border and muted colors follow. Accent stays.',
    input: z.object({ tone: z.enum(['light', 'dark']) }),
    write: true,
  },
  set_brand: {
    description:
      'Change the site’s name everywhere it’s written: the nav and footer, headlines, the copyright line, each section’s own words and kept word options (whole words only). One undo step; says how many places changed.',
    input: z.object({ name: z.string().trim().min(1).max(80) }),
    write: true,
  },
  get_brief: {
    description:
      'What the site is for: its format (landing page, business site, portfolio, blog, event page), industry, goals, who it’s for, what it is in the owner’s words, and the main button’s words. Context for choosing sections, layouts, colors and pictures. Never put these words on the page unless they’re already in a section.',
    input: z.object({}),
    write: false,
  },
  set_brief: {
    description:
      'Change what the site is for (only the fields given; an empty string or empty list clears one). The kind of site follows the format and industry. It steers suggestions and goes to the agent in BLOKMIX.md; it never changes the page’s words. One undo step.',
    input: z.object({
      format: z.enum(FORMATS).optional(),
      industry: z.enum(INDUSTRIES).optional(),
      industry_words: z.string().max(80).optional().describe('The industry as the owner put it, when more specific than the list'),
      goals: z.array(z.enum(GOALS)).max(4).optional(),
      goals_other: z.string().max(120).optional(),
      who: z.string().max(200).optional(),
      what: z.string().max(600).optional(),
      main_action: z.string().max(40).optional().describe('The main button’s words; set_words puts them on the page'),
    }),
    write: true,
  },
  set_brand_color: {
    description:
      'Set the brand color: a whole readable palette is made from it (text, muted, borders, buttons and the text on them all pass AA), and trying another skin keeps it unless the contract sets color to Surprise. null forgets it (the colors stay as they are).',
    input: z.object({ color: z.string().regex(/^#[0-9a-f]{3,8}$/i).nullable() }),
    write: true,
  },
  set_logo: {
    description:
      'Use one picture as the site’s logo: it fills the nav’s and footer’s logo wherever they have no picture of their own. Give the section and block of a picture already on the page (one you or the person put there), or remove to go back to the logo as words.',
    input: z.object({ section: section.optional(), block: block.optional(), remove: z.boolean().optional() }),
    write: true,
  },
  add_brand_colour: {
    description: 'Add a named brand color to the palette; use it as "x:<name>" in styles.',
    input: z.object({ name: z.string().min(1), value: z.string().regex(/^#[0-9a-f]{3,8}$/i) }),
    write: true,
  },
  show: {
    description: 'Point the person at something: open a page, focus a section on it (and select a block) on the canvas.',
    input: z.object({ page: page.optional(), section: section.optional(), block: block.optional() }),
    write: false,
  },
} as const

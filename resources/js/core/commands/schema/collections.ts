import { z } from 'zod'
import { FIELD_TYPES } from '../../collections'
import { section } from './shared'

const collection = z.string().describe('A collection: its slug ("blog-posts") or name')
const entry = z.string().describe('An entry: its id or slug')
const value = z.union([z.string(), z.number(), z.array(z.string()), z.null(), z.object({ source: z.enum(['upload', 'stock', 'placeholder']), asset: z.string().optional(), alt: z.string().optional() }).passthrough()])
const data = z.record(z.string(), value).describe('Field key → value. Dates as YYYY-MM-DD, rich text as Markdown, lists as arrays of strings')

/**
 * Your collections: content apart from any section (blog posts, team, products), with a schema, shared by every mix
 * you bind them in. A list in a section can show a collection's entries, one item per entry.
 */
export const COLLECTION_COMMANDS = {
  list_collections: { description: 'Your collections: name, slug, fields, how many entries, and which lists in this mix show them.', input: z.object({}), write: false },
  get_collection: {
    description: 'A collection’s schema (fields and types) and its entries in order.',
    input: z.object({ collection, limit: z.number().int().min(1).optional().describe('Only the first N entries') }),
    write: false,
  },
  create_collection: {
    description:
      'Create a collection. With `from`, it learns its fields from a list in a section (a blog section’s posts: title, excerpt, cover…), turns the list’s items into entries, and binds the list to it, so the section shows the collection from now on.',
    input: z.object({ name: z.string().trim().min(1).max(80), from: z.object({ section, list: z.string().describe('The list: its block id, label or name ("posts")') }).optional() }),
    write: true,
  },
  update_schema: {
    description: 'Change a collection’s fields: add one, rename one, change its type (values convert where they can), or remove one. One change per call.',
    input: z.object({
      collection,
      add: z.object({ label: z.string().min(1), type: z.enum(FIELD_TYPES) }).optional(),
      rename: z.object({ field: z.string(), label: z.string().min(1) }).optional(),
      retype: z.object({ field: z.string(), type: z.enum(FIELD_TYPES) }).optional(),
      remove: z.string().optional().describe('A field key'),
    }),
    write: true,
  },
  add_entry: { description: 'Add an entry to a collection. Its slug comes from its title.', input: z.object({ collection, data }), write: true },
  update_entry: {
    description: 'Change an entry’s fields (only those you name), its slug, or whether it is a draft (drafts don’t show in sections or exports).',
    input: z.object({ collection, entry, data: data.optional(), slug: z.string().optional(), draft: z.boolean().optional() }),
    write: true,
  },
  remove_entry: { description: 'Delete an entry from a collection.', input: z.object({ collection, entry }), write: true },
  reorder_entries: { description: 'Put a collection’s entries in this order (others keep their place after them).', input: z.object({ collection, entries: z.array(entry).min(1) }), write: true },
  bind_list: {
    description:
      'Show a collection in a list: one item per entry. Fields map by name and type unless you give `map` (item key → field key, item keys as in get_content). Optionally sort, filter (field equals a value) and limit.',
    input: z.object({
      section,
      list: z.string(),
      collection,
      map: z.record(z.string(), z.string()).optional(),
      image: z.string().optional().describe('The image field that fills each item’s picture'),
      sort: z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) }).optional(),
      filter: z.object({ field: z.string(), equals: z.string() }).optional(),
      limit: z.number().int().min(1).optional(),
    }),
    write: true,
  },
  add_collection_page: {
    description:
      'Add a collection’s template page (/<collection>/[slug]): a header showing each entry’s title, summary and picture, and a prose section showing its rich-text body. Exports make one page per entry, and lists showing the collection link each item to its page.',
    input: z.object({ collection }),
    write: true,
  },
  preview_entry: { description: 'Which entry a collection’s template page shows on the canvas.', input: z.object({ page: z.string().describe('The template page: its path or title'), entry }), write: false },
  bind_field: {
    description:
      'On a collection’s template page: show an entry field in a section’s field (heading ← title), or in a picture (media name ← image field). `body#2` is a rich-text field’s second paragraph. null stops showing it.',
    input: z.object({ section, field: z.string().optional(), media: z.string().optional(), entry_field: z.string().nullable() }),
    write: true,
  },
  unbind_list: {
    description: 'Stop a list showing a collection. The section keeps the words it was showing as its own.',
    input: z.object({ section, list: z.string() }),
    write: true,
  },
} as const

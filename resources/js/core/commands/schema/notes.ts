import { z } from 'zod'
import { NOTE_KINDS, NOTE_STATUSES } from '../../types'
import { section, block } from './shared'

/** Feedback marks. */
export const NOTE_COMMANDS = {
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
  import_review_marks: {
    description:
      'Bring a ReviseMy review’s marks back onto a build as notes. Pass the version the review is of, the review (id, url, status) and its marks (work_packets.pins, mapped: id, kind from severity, status, body, x/y as fractions of the screenshot (an area’s top-left, with w/h, when the pin has an area), its CSS width, and the section anchor under the point when you can tell). Safe to run again: marks are matched by their ReviseMy id. list_notes and update_note then show each mark’s ReviseMy id, so mirror fixes back with resolve_marks / reply_to_marks.',
    input: z.object({
      version: z.string().min(1).describe('The version or build reviewed: its letter or id'),
      review: z.object({ id: z.string().min(1), url: z.string().url(), status: z.string().default('pending') }),
      marks: z
        .array(
          z.object({
            id: z.union([z.string().min(1), z.number().int()]),
            kind: z.enum(NOTE_KINDS),
            status: z.enum(NOTE_STATUSES).default('open'),
            verified_by_person: z.boolean().optional().describe('True only when ReviseMy says a person verified it'),
            body: z.string(),
            suggested_copy: z.string().nullish(),
            resolution: z.string().nullish(),
            author: z.string().nullish(),
            section: z.string().nullish().describe('The section’s anchor on the page ("pricing")'),
            x: z.number().min(0).max(1).nullish(),
            y: z.number().min(0).max(1).nullish(),
            w: z.number().min(0).max(1).nullish(),
            h: z.number().min(0).max(1).nullish(),
            width: z.number().int().positive().nullish().describe('The screenshot’s CSS width'),
            page: z.string().nullish(),
          }),
        )
        .max(200),
    }),
    write: true,
  },
  reply_note: {
    description: 'Reply on a mark, e.g. to answer a question or explain a choice.',
    input: z.object({ note: z.union([z.string(), z.number().int()]), text: z.string().min(1) }),
    write: true,
  },
} as const

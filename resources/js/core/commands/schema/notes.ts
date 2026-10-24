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
  reply_note: {
    description: 'Reply on a mark, e.g. to answer a question or explain a choice.',
    input: z.object({ note: z.union([z.string(), z.number().int()]), text: z.string().min(1) }),
    write: true,
  },
} as const

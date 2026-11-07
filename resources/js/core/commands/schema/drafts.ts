import { z } from 'zod'
import { STATUSES } from '../../types'

const draft = z.string().min(1).describe('A draft: its letter ("B"), its name ("Draft B") or id')

/** Drafts of the mix: a few, side by side, each one you can work on. Commands edit the open one. */
export const DRAFT_COMMANDS = {
  list_drafts: {
    description:
      'The mix’s drafts, side by side: letter, name, which is open (every other command edits the open one), status, pages, how many sections and saved versions each has, and what it was made from.',
    input: z.object({}),
    write: false,
  },
  switch_draft: {
    description: 'Open another draft: the open one keeps its own copy, and every command after this edits the one you opened. One undo step.',
    input: z.object({ draft }),
    write: true,
  },
  new_draft: {
    description:
      'Make a new draft beside the others: a copy of a draft (the open one unless from_draft says) or of a saved version (from_version, a letter like "A2"), to try another direction without touching the original. Opens it unless open is false. A mix holds up to 6 drafts.',
    input: z.object({
      from_draft: draft.optional(),
      from_version: z.string().min(1).optional().describe('A saved version’s letter ("A2") or id'),
      name: z.string().trim().min(1).max(60).optional(),
      open: z.boolean().optional(),
    }),
    write: true,
  },
  update_draft: {
    description: 'Rename a draft or set its status.',
    input: z.object({ draft, name: z.string().trim().min(1).max(60).optional(), status: z.enum(STATUSES).optional() }),
    write: true,
  },
  delete_draft: {
    description: 'Delete a draft and its saved versions (never the last one). Deleting the open one opens its neighbour. One undo step.',
    input: z.object({ draft }),
    write: true,
  },
} as const

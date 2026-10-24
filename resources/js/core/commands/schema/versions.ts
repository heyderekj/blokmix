import { z } from 'zod'

/** Versions of the mix. */
export const VERSION_COMMANDS = {
  save_version: { description: 'Save the current mix as a version.', input: z.object({ title: z.string().optional() }), write: true },
} as const

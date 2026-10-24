import { z } from 'zod'
import { STATUSES } from '../../types'

const version = z.string().min(1).describe('A version: its letter ("B", "B.1") or id')
const url = z.string().regex(/^https?:\/\/\S+$/, 'an http(s) URL')

/** Versions of the mix, and building them with an agent. */
export const VERSION_COMMANDS = {
  save_version: { description: 'Save the current mix as a version.', input: z.object({ title: z.string().optional() }), write: true },
  list_versions: {
    description:
      'The saved versions as a tree: letter, title, status, parent, and for builds the target, steps, preview URL and the folder their packet was written to; plus any ReviseMy review and how many marks are still open on each.',
    input: z.object({}),
    write: false,
  },
  prepare_build: {
    description:
      'Start building a version for real. Composes its packet (BLOKMIX.md, blokmix.json, tokens, the Astro or Next.js reference project) and writes it to builds/<mix>-<letter>/ next to the bridge, opens a build frame on the canvas, and returns the folder and the prompt to follow. Then build and run it there, and report progress with report_build.',
    input: z.object({
      version: version,
      target: z.enum(['astro', 'next']).default('astro'),
      agent_name: z.string().min(1).max(40).optional().describe('How you appear on the canvas (default "Claude")'),
    }),
    write: true,
  },
  report_build: {
    description:
      'Report on a build started with prepare_build: a step you just did ("Installing", "Fixing the pricing grid"), its preview URL once the dev server runs (it shows on the build’s frame), the page’s height at a width, and done when it’s ready.',
    input: z.object({
      build: version.describe('The build: the letter or id prepare_build returned'),
      step: z.string().min(1).max(120).optional(),
      status: z.enum(STATUSES).optional(),
      preview_url: url.optional(),
      preview_height: z
        .union([z.number().positive(), z.record(z.string().regex(/^\d+$/), z.number().positive())])
        .optional()
        .describe('The full page height in CSS px: one number, or by width ({"1440": 5200, "390": 9800})'),
      done: z.boolean().optional(),
    }),
    write: true,
  },
} as const

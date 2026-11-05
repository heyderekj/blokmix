import { z } from 'zod'
import { KINDS } from '../../types'

const startInput = {
  kind: z.enum(KINDS).describe('What the site is for: product (an app or product), studio (a studio or service), local (a local business), event (an event or launch), personal, writing (writing or a newsletter)'),
  name: z.string().trim().min(1).max(80).describe('The site’s name, used as the brand in the nav and footer'),
  one_liner: z.string().trim().max(160).optional().describe('What it is, in one line: becomes the main headline'),
  skin: z.string().optional().describe('A skin id from list_skins, once you know the look; left out, starts come in Wireframe, the raw structure'),
  brand: z.string().regex(/^#[0-9a-f]{6}$/i).optional().describe('One brand color as #rrggbb; the whole palette is made from it'),
  mode: z.enum(['light', 'dark']).optional().describe('Light or dark; default: the skin’s own'),
  seed: z.number().int().min(0).optional().describe('Change it for different picks'),
}

/** The guided start: three light answers become three real starting mixes, measured before anyone sees them. */
export const START_COMMANDS = {
  suggest_starts: {
    description:
      'Suggest three starting mixes for a kind of site, raw in Wireframe unless you name a skin: matching starter mixes first, then mixes put together from the library. Each is laid out at a laptop, a phone and widths between, and comes back with a score and plain checks (does the headline and button show without scrolling, does anything spill sideways). Changes nothing; apply_start uses one.',
    input: z.object(startInput),
    write: false,
  },
  apply_start: {
    description:
      'Replace the open mix’s pages, style guide and words with one of suggest_starts’ starts (same answers, plus which one). One undo step; versions and notes stay.',
    input: z.object({ ...startInput, start: z.number().int().min(1).max(3).describe('Which start, 1–3, in suggest_starts’ order') }),
    write: true,
  },
} as const

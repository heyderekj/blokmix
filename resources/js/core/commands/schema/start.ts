import { z } from 'zod'
import { KINDS, SECTION_TYPES } from '../../types'
import { FORMATS, GOALS, INDUSTRIES } from '../../brief'

const startInput = {
  text: z
    .string()
    .max(20000)
    .optional()
    .describe(
      'What the person typed in the start box. One or two short lines describe the site (“a bakery on Elm Street, pre-orders, a menu and our hours”): Jev picks the kind, the sections and the looks. Anything longer is their own copy, placed word for word in three arrangements. Never reworded. Needs Jev.',
    ),
  kind: z.enum(KINDS).optional().describe('What the site is for: product (an app or product), studio (a studio or service), local (a local business), event (an event or launch), personal, writing (writing or a newsletter). Required without text; with text it overrides what Jev heard'),
  sections: z.array(z.enum(SECTION_TYPES)).max(16).optional().describe('Home’s sections top to bottom, in place of the kind’s usual page (described starts only)'),
  name: z.string().trim().min(1).max(80).describe('The site’s name, used as the brand in the nav and footer'),
  one_liner: z.string().trim().max(160).optional().describe('What it is, in one line: becomes the main headline'),
  skin: z.string().optional().describe('A skin id from list_skins, once you know the look; left out, starts come in Wireframe, the raw structure'),
  brand: z.string().regex(/^#[0-9a-f]{6}$/i).optional().describe('One brand color as #rrggbb; the whole palette is made from it'),
  mode: z.enum(['light', 'dark']).optional().describe('Light or dark; default: the skin’s own'),
  seed: z.number().int().min(0).optional().describe('Change it for different picks'),
  format: z.enum(FORMATS).optional().describe('What kind of site: landing (one page that sells one thing), business (a small business or service), portfolio, blog (or newsletter), event. With kind left out, it decides the kind'),
  industry: z.enum(INDUSTRIES).optional().describe('The industry; ranks starters and themes'),
  goals: z.array(z.enum(GOALS)).max(4).optional().describe('What the site should do; each adds the section it leans on'),
  main_action: z.string().trim().max(40).optional().describe('The main button’s words, put in the page’s main buttons'),
  who: z.string().trim().max(200).optional().describe('Who it’s for, in their words (context, never on the page)'),
}

/** The guided start: three light answers become three real starting mixes, measured before anyone sees them. */
export const START_COMMANDS = {
  suggest_starts: {
    description:
      'Suggest three starting mixes from a kind of site or from what the person typed or pasted (text), raw in Wireframe unless you name a skin. With text it also says what was heard (kind, format, industry, goals, sections, looks). Otherwise: matching starter mixes first, then mixes put together from the library. Each is laid out at a laptop, a phone and widths between, and comes back with a score and plain checks (does the headline and button show without scrolling, does anything spill sideways). Changes nothing; apply_start uses one.',
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

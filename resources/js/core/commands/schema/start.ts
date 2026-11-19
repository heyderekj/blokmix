import { z } from 'zod'
import { KINDS, SECTION_TYPES } from '../../types'
import { FORMATS, GOALS, INDUSTRIES } from '../../brief'
import { FEEL_WORDS } from '../../feel'
import { PAGE_TEMPLATES, type PageTemplate } from '../../site'
import { VARY } from '../../startVersions'

const startInput = {
  text: z
    .string()
    .max(20000)
    .optional()
    .describe(
      'What the person typed or pasted. A description (“a bakery on Elm Street, pre-orders, a menu and our hours, not too fancy”) is read for the kind, the sections, the pages, the feel and what to avoid: by the reader when it’s on, else by keywords. A long paste of their own copy is placed word for word in three arrangements (needs Jev). Never reworded.',
    ),
  kind: z.enum(KINDS).optional().describe('What the site is for: product (an app or product), studio (a studio or service), local (a local business), event (an event or launch), personal, writing (writing or a newsletter). Required without text; with text it overrides what Jev heard'),
  sections: z.array(z.enum(SECTION_TYPES)).max(16).optional().describe('Home’s sections top to bottom, in place of the kind’s usual page (described starts only)'),
  name: z.string().trim().min(1).max(80).describe('The site’s name, used as the brand in the nav and footer'),
  one_liner: z.string().trim().max(320).optional().describe('The main headline as written; wraps to fit each layout'),
  skin: z.string().optional().describe('A skin id from list_skins, once you know the look; left out, starts come in Wireframe, the raw structure'),
  brand: z.string().regex(/^#[0-9a-f]{6}$/i).optional().describe('One brand color as #rrggbb; the whole palette is made from it'),
  mode: z.enum(['light', 'dark']).optional().describe('Light or dark; default: the skin’s own'),
  seed: z.number().int().min(0).optional().describe('Change it for different picks'),
  format: z.enum(FORMATS).optional().describe('What kind of site: landing (one page that sells one thing), business (a small business or service), portfolio, blog (or newsletter), event. With kind left out, it decides the kind'),
  industry: z.enum(INDUSTRIES).optional().describe('The industry; ranks starters and themes'),
  goals: z.array(z.enum(GOALS)).max(4).optional().describe('What the site should do; each adds the section it leans on'),
  main_action: z.string().trim().max(40).optional().describe('The main button’s words, put in the page’s main buttons'),
  who: z.string().trim().max(200).optional().describe('Who it’s for, in their words (context, never on the page)'),
  count: z.number().int().min(2).max(6).optional().describe('How many starts (default 3)'),
  vary: z.enum(VARY).optional().describe('What differs between starts: layout (the default: the same look, in skin), look, or both (whole directions, each a theme with its own layouts)'),
  pages: z
    .array(z.object({ template: z.enum(Object.keys(PAGE_TEMPLATES) as [PageTemplate, ...PageTemplate[]]), purpose: z.string().trim().max(120).optional() }))
    .max(6)
    .optional()
    .describe('Pages besides home, from the page templates (blank needs a purpose, its title)'),
  feel: z.array(z.enum(FEEL_WORDS)).max(3).optional().describe('How it should feel; ranks the looks'),
  avoid: z.array(z.enum(FEEL_WORDS)).max(3).optional().describe('Feelings to steer the looks away from'),
}

/** The guided start: light answers become real starting sites, measured before anyone sees them. */
export const START_COMMANDS = {
  suggest_starts: {
    description:
      'Suggest starting sites (3 unless count says) from a kind of site or from what the person typed or pasted (text). vary layout (the default) keeps one look, raw in Wireframe unless you name a skin; look or both give whole directions, each with a line on what it is and why it works. With text it also says what was heard (kind, format, industry, goals, sections, pages, looks). Each is laid out at a laptop, a phone and widths between, and comes back with a score and plain checks (does the headline and button show without scrolling, does anything spill sideways). Changes nothing; apply_start uses one.',
    input: z.object(startInput),
    write: false,
  },
  apply_start: {
    description:
      'Replace the open site’s pages, style guide and words with one of suggest_starts’ starts (same answers, plus which one). One undo step; versions and notes stay.',
    input: z.object({ ...startInput, start: z.number().int().min(1).max(6).describe('Which start, 1–6, in suggest_starts’ order') }),
    write: true,
  },
} as const

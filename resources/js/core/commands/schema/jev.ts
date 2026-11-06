import { z } from 'zod'
import { block, section } from './shared'

/**
 * What Jev (TypeSafe's System One model) does on the board: it places, picks and checks real things (your words,
 * the page's sections, Blokmix's layouts and treatments) and never writes words. Each needs Jev on (the server has
 * a TypeSafe key and "Let Jev help" is on); when it's off they say so.
 */
export const JEV_COMMANDS = {
  place_links: {
    description:
      'Point buttons and links that lead nowhere at the section or page their words mean ("See plans" → Pricing, "Book a table" → Contact), using Jev. Only links with no destination set and words the built-in rule can’t place are asked about. Sets the ones Jev is sure of (both option orders agree, 85%+) as one undo step and returns the rest as suggestions; with sure_only false it sets every suggestion.',
    input: z.object({
      page: z.string().optional().describe('A page path or id; default the open page (its sections plus the shared nav and footer)'),
      section: section.optional().describe('Only this section'),
      sure_only: z.boolean().default(true),
    }),
    write: true,
  },
  five_second_test: {
    description:
      'Show the first screen (what a laptop shows before scrolling) to Jev as a visitor who has never seen the site, and hear what it would say the site is for and how sure it is, whether the headline says what’s offered, whether the first button says what happens next, and whether it says who it’s for. Also measures the first screen at a laptop and a phone, so the answer comes with the page score’s checks. Changes nothing.',
    input: z.object({ page: z.string().optional().describe('A page path or id; default the open page') }),
    write: false,
  },
  understand: {
    description:
      'What Say it would do with these words ("roomier", "make pricing dark", "FAQ above pricing", "add a team section"): Jev picks one of Blokmix’s own commands and fills its arguments from this page’s real sections, dials and skins. Returns the command and input it would run (action, when sure) and what else the words might mean (options). Changes nothing: run the action yourself if it’s right.',
    input: z.object({ text: z.string().trim().min(1).max(200) }),
    write: false,
  },
  find_subject: {
    description:
      'Find the subject of a photo or upload in an image block (a person, a product, a dish) with Jev, and set the crop to keep it in frame at every width and on phones (the fill’s focus). A person’s focus sits near their face. Does nothing for placeholders, mockups or moving media, or when the photo has no single subject. One undo step.',
    input: z.object({ section, block }),
    write: true,
  },
} as const

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
  pour_words: {
    description:
      'Pour your own words into the open page: paste notes, an About page or an old site’s copy, and Jev says what each line is (a headline, a question and its answer, a plan’s price, a person’s name…) and which section it belongs in; code places each line word for word, growing or trimming lists to fit. Nothing is reworded. Words it replaces stay as options; lines it isn’t sure of wait in the Words to place tray. Skips the shared nav and footer, locked sections and sections keeping their source’s words. One undo step.',
    input: z.object({ text: z.string().min(1).max(20_000), page: z.string().optional() }),
    write: true,
  },
  page_from_words: {
    description:
      'Make a page from anything pasted (an old site’s copy, a menu, a CV, event notes): Jev says what kind of section each run of lines is (questions and answers → FAQ, names with roles → team, prices → pricing) and what each line is; built-in layouts that hold each run’s items are picked, a hero leads with the most headline-like line, and every line is placed word for word. arrangement 1–3 gives the same words in contrasting layouts (the reading is cached, so 2 and 3 come at once). into new_page adds a page; this_page replaces the open page’s own sections. One undo step.',
    input: z.object({
      text: z.string().min(1).max(20_000),
      into: z.enum(['new_page', 'this_page']).default('new_page'),
      arrangement: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
      page: z.string().optional().describe('With this_page: which page (default the open one)'),
    }),
    write: true,
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

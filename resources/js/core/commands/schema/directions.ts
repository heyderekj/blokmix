import { z } from 'zod'
import { FORMATS, INDUSTRIES } from '../../brief'
import { TRAITS } from '../../traits'

const traits = z.array(z.enum(TRAITS as [string, ...string[]])).max(12)

/**
 * Directions: a theme and the page's arrangement, curated together. Rows of them are ranked by the brief and by what
 * this site's owner has shown they want (the taste), so every row leans their way.
 */
export const DIRECTION_COMMANDS = {
  list_directions: {
    description:
      'List the directions: each is a theme plus its own layouts per section type, curated to suit each other, with a line on what it is and why it works. Filter by industry or format.',
    input: z.object({ industry: z.enum(INDUSTRIES).optional(), format: z.enum(FORMATS).optional() }),
    write: false,
  },
  suggest_directions: {
    description:
      'A row of directions for this site, best first and never two alike, ranked by the saved brief and taste. more and less lean this row only (traits from get_taste); words are read into traits the same way. exclude leaves ids out; odd (0 safe, 2 strange) is how unusual they may be; pin holds a look (theme id) or a layout (direction id) and varies the other half.',
    input: z.object({
      count: z.number().int().min(1).max(6).optional(),
      more: traits.optional(),
      less: traits.optional(),
      words: z.string().trim().max(300).optional(),
      exclude: z.array(z.string()).max(40).optional(),
      odd: z.number().int().min(0).max(2).optional(),
      pin: z.object({ look: z.string().optional(), layout: z.string().optional() }).optional(),
    }),
    write: false,
  },
  get_taste: {
    description:
      'What this site’s owner has shown they want: how much each trait is leaned toward (positive) or away from (negative), the line the board shows, and the events behind it. Traits: ' +
      TRAITS.join(', ') +
      '.',
    input: z.object({}),
    write: false,
  },
  note_taste: {
    description:
      'Record a direction for every later suggestion, one undo step: traits to lean toward (more) or away from (less), the person’s own words (kept verbatim and read into traits), or a reaction to a direction (ref, with reaction more or less). Agents should only pass what the person said or decided.',
    input: z.object({
      more: traits.optional(),
      less: traits.optional(),
      words: z.string().trim().min(1).max(300).optional(),
      ref: z.string().optional(),
      reaction: z.enum(['more', 'less', 'picked', 'passed']).optional(),
    }),
    write: true,
  },
  try_direction: {
    description:
      'A new draft beside the others, opened: the open draft’s pages and words laid out with a direction’s layouts and dressed in its look (ids from suggest_directions). Your words, pictures and links come along; locked sections, and layouts or the look set to Keep, stay as they are. The draft you were in is untouched. Counts as picked toward later suggestions. A site holds up to 6 drafts.',
    input: z.object({ direction: z.string().min(1).describe('A direction id from suggest_directions or list_directions') }),
    write: true,
  },
  drop_taste: {
    description: 'Stop leaning on one trait, toward or away, one undo step.',
    input: z.object({ trait: z.enum(TRAITS as [string, ...string[]]) }),
    write: true,
  },
  clear_taste: {
    description: 'Forget everything recorded about what the owner wants, one undo step. The brief stays.',
    input: z.object({}),
    write: true,
  },
} as const

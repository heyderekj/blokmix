import { z } from 'zod'
import { STYLE_AREAS, CONTRACT_AREAS, CONTRACT_SETTINGS } from '../../contract'
import { FORMATS, INDUSTRIES } from '../../brief'
import { FEEL_WORDS, NUDGES } from '../../feel'

/** Skins: a whole look swapped in one move over the same layouts, and the contract that says what a swap leaves alone. */
export const SKIN_COMMANDS = {
  list_skins: {
    description:
      'List the skins: whole looks (tokens, effects, text styles, block looks, section defaults, a picture style) that go over the same layouts. Says which one is on.',
    input: z.object({}),
    write: false,
  },
  suggest_themes: {
    description:
      'Themes that fit how the person wants the site to feel, best first, as the Look panel shows them. Words: warm, calm, bold, playful, serious, classic, modern, dark. With different, the least similar distinct choices come first. Omitted fields use the saved brief.',
    input: z.object({
      words: z.array(z.enum(FEEL_WORDS)).max(FEEL_WORDS.length).optional(),
      industry: z.enum(INDUSTRIES).optional(),
      format: z.enum(FORMATS).optional(),
      different: z.boolean().optional(),
      count: z.number().int().min(1).max(10).optional(),
    }),
    write: false,
  },
  list_theme_parts: {
    description: 'Available parts of a theme, with the current choice and kept areas.',
    input: z.object({ area: z.enum(STYLE_AREAS).optional() }),
    write: false,
  },
  set_theme_part: {
    description: 'Apply one part from list_theme_parts in one undo step.',
    input: z.object({ area: z.enum(STYLE_AREAS), part: z.string() }),
    write: true,
  },
  set_theme_parts: {
    description: 'Apply parts together. A kept or unknown part cancels the entire change.',
    input: z.object({ parts: z.partialRecord(z.enum(STYLE_AREAS), z.string()).refine((v) => Object.keys(v).length > 0) }),
    write: true,
  },
  rank_themes: {
    description: 'Rank distinct themes for this brief. Uses rendered previews when suggestions are available.',
    input: z.object({ count: z.number().int().min(1).max(10).optional(), flavors: z.boolean().optional() }),
    write: false,
  },
  restyle: {
    description: 'Preview up to three part changes for a written request. Apply a returned parts object with set_theme_parts.',
    input: z.object({ text: z.string().trim().min(1).max(300) }),
    write: false,
  },
  check_look: {
    description: 'Compare this look against its brief and offer one eligible change when it improves the fit.',
    input: z.object({}),
    write: false,
  },
  look_from_words: {
    description:
      'A look from someone’s own words (“warm and handmade, a bit editorial, roomier, not corporate”): the feelings in them pick the best theme (said with “not”, steered away from), nudge words turn the dials (roomier, tighter, rounder, sharper, bolder, quieter), and light or dark sets the tone. The words are kept in the brief as how it should feel. One undo step. Areas set to Keep in the contract stay.',
    input: z.object({ text: z.string().trim().min(2).max(400) }),
    write: true,
  },
  nudge_look: {
    description:
      'Nudge the look in plain words, one undo step: bolder (bigger, heavier type), quieter (smaller, lighter type, more room), rounder, sharper, roomier, tighter, darker, lighter. Each moves the Feel dials a step or turns the page light or dark.',
    input: z.object({ nudge: z.enum(NUDGES) }),
    write: true,
  },
  apply_skin: {
    description:
      'Put a skin on the whole mix, as one undo step. Layouts, words and what each section or block chose for itself stay; areas the contract marks Keep stay too. Your clipped candidates stay on offer in the style guide.',
    input: z.object({ skin: z.string().describe('A theme id from list_skins'), flavor: z.string().optional() }),
    write: true,
  },
  surprise_me: {
    description:
      'Mix up the look: each area the contract marks Surprise (or, with none marked, each one not kept) comes whole from another skin. `keep` names areas to leave as they are this time (what the person likes: color, type, shape, space, motion, looks, sections, pictures). One undo step; says what came from where.',
    input: z.object({
      seed: z.number().int().min(0).optional().describe('Change it for different picks'),
      keep: z.array(z.enum(STYLE_AREAS)).optional(),
      unusual: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('How unusual: 0 from themes close to this look, 1 any (default), 2 from far and odd ones'),
    }),
    write: true,
  },
  get_contract: {
    description:
      'Read the contract: for each area (color, type, shape, space, motion, looks, sections, pictures, layout, words) whether it is Keep, Tweak or Surprise, plus the person’s own lines. Keep means never change it; commands that would are refused. Surprise means propose something new. Also returns it as the Markdown the packet writes (CONTRACT.md).',
    input: z.object({}),
    write: false,
  },
  set_contract: {
    description:
      'Change the contract: set areas to keep, tweak or surprise, and replace either list of lines. Only change what the person asked for; it is their say over your work.',
    input: z.object({
      areas: z.partialRecord(z.enum(CONTRACT_AREAS), z.enum(CONTRACT_SETTINGS)).optional(),
      keep: z.array(z.string().trim().min(1).max(280)).max(40).optional().describe('Their “Always keep” lines'),
      surprise: z.array(z.string().trim().min(1).max(280)).max(40).optional().describe('Their “Surprise me with” lines'),
    }),
    write: true,
  },
} as const

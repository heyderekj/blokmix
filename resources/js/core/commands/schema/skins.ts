import { z } from 'zod'
import { CONTRACT_AREAS, CONTRACT_SETTINGS } from '../../contract'
import { FEEL_WORDS, NUDGES } from '../../feel'

/** Skins: a whole look swapped in one move over the same layouts, and the contract that says what a swap leaves alone. */
export const SKIN_COMMANDS = {
  list_skins: {
    description: 'List the skins: whole looks (tokens, effects, text styles, block looks, section defaults, a picture style) that go over the same layouts. Says which one is on and whether each is free.',
    input: z.object({}),
    write: false,
  },
  suggest_themes: {
    description: 'Themes that fit how the person wants the site to feel, best first, as the Look panel shows them. Words: warm, calm, bold, playful, serious, classic, modern, dark. With different, themes that match none of the words, for something they wouldn’t have asked for.',
    input: z.object({
      words: z.array(z.enum(FEEL_WORDS)).max(FEEL_WORDS.length).default([]),
      different: z.boolean().optional(),
      count: z.number().int().min(1).max(10).optional(),
    }),
    write: false,
  },
  nudge_look: {
    description: 'Nudge the look in plain words, one undo step: bolder (bigger, heavier type), quieter (smaller, lighter type, more room), rounder, sharper, roomier, tighter, darker, lighter. Each moves the Feel dials a step or turns the page light or dark.',
    input: z.object({ nudge: z.enum(NUDGES) }),
    write: true,
  },
  apply_skin: {
    description: 'Put a skin on the whole mix, as one undo step. Layouts, words and what each section or block chose for itself stay; areas the contract marks Keep stay too. Your clipped candidates stay on offer in the style guide.',
    input: z.object({ skin: z.string().describe('A skin id from list_skins') }),
    write: true,
  },
  surprise_me: {
    description: 'Mix up the look: each area the contract marks Surprise (or, with none marked, each one not kept) comes whole from another skin. One undo step; says what came from where.',
    input: z.object({ seed: z.number().int().min(0).optional().describe('Change it for different picks') }),
    write: true,
  },
  get_contract: {
    description: 'Read the contract: for each area (color, type, shape, space, motion, looks, sections, pictures, layout, words) whether it is Keep, Tweak or Surprise, plus the person’s own lines. Keep means never change it; commands that would are refused. Surprise means propose something new. Also returns it as the Markdown the packet writes (CONTRACT.md).',
    input: z.object({}),
    write: false,
  },
  set_contract: {
    description: 'Change the contract: set areas to keep, tweak or surprise, and replace either list of lines. Only change what the person asked for; it is their say over your work.',
    input: z.object({
      areas: z.partialRecord(z.enum(CONTRACT_AREAS), z.enum(CONTRACT_SETTINGS)).optional(),
      keep: z.array(z.string().trim().min(1).max(280)).max(40).optional().describe('Their “Always keep” lines'),
      surprise: z.array(z.string().trim().min(1).max(280)).max(40).optional().describe('Their “Surprise me with” lines'),
    }),
    write: true,
  },
} as const

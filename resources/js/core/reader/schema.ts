// What a read looks like, one zod schema per task. Every field is there every time (null or [] when you didn't say
// it), ids come from closed lists, and the strings are spans of your text (SPANS, checked by verbatim.ts).
// scripts/read/build.ts turns these into the JSON schema the server sends and checks against.

import { z } from 'zod'
import { ACTION_IDS, BUSINESS_IDS, FEEL_IDS, FORMAT_IDS, GOAL_IDS, INDUSTRY_IDS, KIND_IDS, NEED_SECTION_IDS, SHOW_IDS, TEMPLATE_IDS } from './vocab'

const span = (what: string) => z.string().nullable().describe(`${what}. Copied exactly from the text, or null.`)
const spans = (what: string) => z.array(z.string()).describe(`${what}. Each copied exactly from the text.`)

export const readStartSchema = z
  .object({
    business: z
      .object({
        id: z.enum(BUSINESS_IDS).nullable().describe('The closest business, or null when none is close'),
        words: span('What it is, in their words ("a sourdough bakery")'),
      })
      .strict(),
    kind: z.enum(KIND_IDS).nullable().describe('What kind of site'),
    format: z.enum(FORMAT_IDS).nullable(),
    industry: z.enum(INDUSTRY_IDS).nullable(),
    name: span('The name of the business, person, product or event'),
    feel: z
      .object({
        ids: z.array(z.enum(FEEL_IDS)).describe('Feelings they want, strongest first'),
        words: spans('How it should feel, in their words'),
        avoid: z.array(z.enum(FEEL_IDS)).describe('Feelings they said it should not have'),
        avoid_words: spans('What it should not feel like, in their words ("corporate")'),
      })
      .strict(),
    goals: z.array(z.enum(GOAL_IDS)).describe('What the site should do for them, most important first'),
    action: z
      .object({
        id: z.enum(ACTION_IDS).nullable().describe('What the main button asks visitors to do'),
        words: span('The main button’s words, only if they wrote them'),
      })
      .strict(),
    who: span('Who the site is for'),
    show: z.array(z.enum(SHOW_IDS)).describe('What to show on the home page'),
    hide: z.array(z.enum(SHOW_IDS)).describe('What they said not to show'),
    pages: z
      .array(
        z
          .object({
            template: z.enum(TEMPLATE_IDS).describe('The page; blank for any page not in the list'),
            purpose: span('What the page is for, in their words'),
          })
          .strict(),
      )
      .describe('Pages besides the home page that they asked for'),
    tone: z.enum(['light', 'dark']).nullable().describe('Light or dark, only when they said'),
    unsure: spans('Parts of the text you could not place anywhere above'),
  })
  .strict()

export type ReadStart = z.infer<typeof readStartSchema>

export const readNeedSchema = z
  .object({
    what: z.enum(['page', 'section']).nullable().describe('Whether they need a whole page or a section on a page'),
    template: z.enum(TEMPLATE_IDS).nullable().describe('For a page: which one; blank for any page not in the list'),
    sections: z.array(z.enum(NEED_SECTION_IDS)).describe('The sections that would do it, best first'),
    purpose: span('What it should do, in their words'),
    unsure: spans('Parts of the text you could not place'),
  })
  .strict()

export type ReadNeed = z.infer<typeof readNeedSchema>

export const READ_TASKS = ['start', 'need'] as const
export type ReadTask = (typeof READ_TASKS)[number]
export type ReadOf<T extends ReadTask> = T extends 'start' ? ReadStart : ReadNeed

export const READ_SCHEMAS = { start: readStartSchema, need: readNeedSchema } as const

/** The strings in each read that must be spans of the text (verbatim.ts walks these paths). */
export const SPANS: Record<ReadTask, readonly string[]> = {
  start: ['business.words', 'name', 'feel.words[]', 'feel.avoid_words[]', 'action.words', 'who', 'pages[].purpose', 'unsure[]'],
  need: ['purpose', 'unsure[]'],
}

/** What the board may tell the reader it already knows (closed ids only; never words). */
export const readStartContext = z
  .object({ kind: z.enum(KIND_IDS), business: z.enum(BUSINESS_IDS), format: z.enum(FORMAT_IDS), industry: z.enum(INDUSTRY_IDS) })
  .partial()
  .strict()
export const readNeedContext = z
  .object({ kind: z.enum(KIND_IDS), page: z.enum(TEMPLATE_IDS), sections: z.array(z.enum(NEED_SECTION_IDS)) })
  .partial()
  .strict()
export const READ_CONTEXTS = { start: readStartContext, need: readNeedContext } as const
export type ReadContext<T extends ReadTask> = z.infer<(typeof READ_CONTEXTS)[T]>

type JsonSchema = { [k: string]: unknown }

/** zod → the JSON schema structured outputs take: no $schema, nullable as anyOf, every object closed. */
export function jsonSchemaFor(schema: z.ZodType): JsonSchema {
  const fix = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(fix)
    if (!n || typeof n !== 'object') return n
    const o: JsonSchema = {}
    for (const [k, v] of Object.entries(n)) if (k !== '$schema') o[k] = fix(v)
    if (Array.isArray(o.type)) {
      const types = o.type as string[]
      const { type: _t, description, ...rest } = o
      return { anyOf: types.map((t) => (t === 'null' ? { type: 'null' } : { type: t, ...rest })), ...(description ? { description } : {}) }
    }
    return o
  }
  return fix(z.toJSONSchema(schema, { io: 'output' })) as JsonSchema
}

// What the reader may answer with: the same closed lists the start's blanks and the brief already use, each id with
// the words people see. The reader picks from these; anything else it says must be words you wrote (verbatim.ts).

import { BUSINESSES, FEELS, GOALS as ACTIONS, SHOWS } from '../jev/sentence'
import { FORMAT_CRITERIA, GOAL_CRITERIA, INDUSTRY_CRITERIA, KIND_CRITERIA, KIND_WORDS, SECTION_CRITERIA } from '../jev/vocab'
import { FORMATS, GOALS, GOAL_LABEL, INDUSTRIES, INDUSTRY_LABEL, FORMAT_LABEL } from '../brief'
import { PAGE_TEMPLATES, type PageTemplate } from '../site'
import { KINDS, SECTION_TYPES, type SectionType } from '../types'

type Ids = [string, ...string[]]
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id) as Ids

export const BUSINESS_IDS = ids(BUSINESSES)
export const FEEL_IDS = ids(FEELS)
/** What the main button asks people to do (the sentence's "help people [do what]"). */
export const ACTION_IDS = ids(ACTIONS)
/** What to show on the home page (the sentence's "Show [what]"); each becomes a section or a want. */
export const SHOW_IDS = ids(SHOWS)
export const KIND_IDS = KINDS
export const FORMAT_IDS = FORMATS
export const INDUSTRY_IDS = INDUSTRIES
export const GOAL_IDS = GOALS
/** Pages besides home, from the page templates (blank is "a page for something else"). */
export const TEMPLATE_IDS = Object.keys(PAGE_TEMPLATES) as [PageTemplate, ...PageTemplate[]]
/** Sections someone can ask for by name ("I need a section that…"), less the shared nav and footer. */
export const NEED_SECTION_IDS = SECTION_TYPES.filter((t) => t !== 'nav' && t !== 'footer') as [SectionType, ...SectionType[]]

const what = (c: { what: string } | string | null) => (c && typeof c === 'object' ? c.what : String(c ?? ''))

/** One line per id, "id: what it means", for the prompt. */
export const VOCAB_LINES = {
  business: BUSINESSES.map((b) => `${b.id}: ${b.label} (${KIND_WORDS[b.kind]})`),
  kind: KINDS.map((k) => `${k}: ${what(KIND_CRITERIA[k])}`),
  format: FORMATS.map((f) => `${f}: ${FORMAT_LABEL[f]}. ${what(FORMAT_CRITERIA[f])}`),
  industry: INDUSTRIES.map((i) => `${i}: ${INDUSTRY_LABEL[i]}. ${what(INDUSTRY_CRITERIA[i])}`),
  feel: FEELS.map((f) => (f.label === f.id ? f.id : `${f.id}: ${f.label}`)),
  goal: GOALS.map((g) => `${g}: ${GOAL_LABEL[g]} (${GOAL_CRITERIA[g]})`),
  action: ACTIONS.map((a) => `${a.id}: ${a.label} (button “${a.button}”)`),
  show: SHOWS.map((s) => `${s.id}: ${s.label}`),
  template: Object.entries(PAGE_TEMPLATES).map(([id, t]) => (id === 'blank' ? 'blank: any other page' : `${id}: ${t.title} page`)),
  section: NEED_SECTION_IDS.map((t) => `${t}: ${SECTION_CRITERIA[t].what}`),
}

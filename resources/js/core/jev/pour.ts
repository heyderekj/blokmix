// Pour in your words: paste notes, an About page or an old site's copy, and each line
// lands where it belongs on the page, word for word. Code splits the text and does all
// the counting; Jev only says what each line is (a headline, a question, a plan's price…)
// and which section it belongs to. Lines it isn't sure of wait in a tray with its two
// best guesses. Nothing is ever reworded.

import type { SectionType } from '../types'
import { TYPE_LABEL } from '../content'
import type { OutlineNode } from '../outline'
import { choice, noul, at } from './ask'
import { clip } from './state'
import { choiceOf, ranked, yes } from './read'
import type { Criterion, JevRequest, JevResponse } from './types'
import { SECTION_CRITERIA } from './vocab'

export const POUR_THRESHOLDS = {
  /** Place a line when (its role's probability) × (its section's) reaches this; else it waits in the tray. */
  place: 0.4,
  /** A guess worth showing on a tray line. */
  suggest: 0.15,
  /** Lines in a run read as separate items of one kind. */
  list: 0.6,
  /** At most this many lines per pour (two questions each). */
  maxLines: 80,
}

/** What a line of your text can be. */
export const ROLES = {
  headline: { what: 'The page’s main headline: what this is, in one line', examples: ['Bread worth getting up for'] },
  heading: { what: 'A heading that opens a whole section', not_for: 'The name of one item, plan or product in a list', examples: ['What we bake', 'Questions', 'Our team'] },
  eyebrow: { what: 'A short label above a heading, two or three words', examples: ['New', 'How it works', 'Since 1998'] },
  lead: { what: 'One or two sentences introducing a section or the page', examples: ['Small batches, baked at 4am, gone by noon.'] },
  paragraph: { what: 'A paragraph of prose telling a story or explaining something', not_for: 'A short description of one item in a list' },
  button: { what: 'A short command to press, starting with a verb', not_for: 'A sentence that describes a thing, a plan or a service', examples: ['Book a table', 'Start free', 'See the menu'] },
  title: { what: 'The name of one item in a list: a feature, a plan, a product, a dish, a post, a step', not_for: 'A heading over a whole section', examples: ['Sourdough', 'Pro plan', 'Coffee club', 'Fast setup'] },
  body: { what: 'A sentence describing one item, plan or product', not_for: 'A command to press', examples: ['Naturally leavened, 36 hours start to finish.', 'Two bags of coffee a month, delivered.'] },
  question: { what: 'A question a visitor might ask', examples: ['Do you deliver?'] },
  answer: { what: 'The answer to the question before it' },
  quote: { what: 'Something a customer said, a testimonial', examples: ['“Best croissant in town.”'] },
  name: { what: 'A person’s name', examples: ['Ana Ruiz'] },
  role: { what: 'Who a person is: their job, title, company, or how they know you', not_for: 'Their name', examples: ['Head baker', 'Founder, Mill & Co', 'Customer since 2019'] },
  price: { what: 'A price', examples: ['$12', '4.50', '$29/mo'] },
  stat: { what: 'A big number with what it counts', examples: ['12,000 loaves a year'] },
  contact: { what: 'An email, phone number, address or opening hours' },
  other: { what: 'Small print or anything else' },
} satisfies Record<string, Criterion>

export type Role = keyof typeof ROLES

/** One line of what you pasted, with what code could tell on its own. */
export interface Line {
  i: number
  text: string
  /** Lines in the same run (no blank line between) share a group. */
  group: number
  /** Marked as a heading in the text (# Heading, or a short line ending a run of lines with no punctuation). */
  heading: boolean
  /** What code is sure of: a Q:/A: prefix, an email, a phone number, a price. */
  sure?: Role
}

const BULLET = /^\s*(?:[-*•–·▪]|\d+[.)]|[a-z][.)])\s+/i

/** Your text as lines: bullets and numbering stripped, runs grouped by blank lines, headings and Q/A marked. */
export function splitLines(text: string): Line[] {
  const out: Line[] = []
  let group = 0
  let blank = true
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const t = raw.trim()
    if (!t) {
      if (!blank) group++
      blank = true
      continue
    }
    blank = false
    const md = /^#{1,6}\s+(.*)$/.exec(t)
    let text = (md ? md[1] : t).replace(BULLET, '').trim()
    let sure: Role | undefined
    const qa = /^(q|question|a|answer)\s*[:.)-]\s*(.+)$/i.exec(text)
    if (qa) {
      sure = qa[1].toLowerCase().startsWith('q') ? 'question' : 'answer'
      text = qa[2].trim()
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || (/^\+?[\d\s().-]{7,}$/.test(text) && (text.match(/\d/g) ?? []).length >= 7)) sure = 'contact'
    else if (/^(?:[$€£¥]\s?\d[\d,.]*|\d[\d,.]*\s?(?:[$€£¥]|usd|eur|gbp))(?:\s*\/\s*\w+)?$/i.test(text)) sure = 'price'
    if (text) out.push({ i: out.length, text, group, heading: !!md, sure })
  }
  return out.slice(0, POUR_THRESHOLDS.maxLines)
}

/** A place a line can go: one field of one section, with the role it plays there. */
export interface Spot {
  slotId: string
  type: SectionType
  field: string
  role: Role
  /** Inside a list: which list, its item's number and the field's key in the item (title, a, price). */
  list?: { id: string; key: string; listKey: string; n: number; itemKey: string; max: number }
}

/** The role a section's field plays, from its name: the vocabulary Pour and the layouts share (FIELD_SCHEMA). */
export function roleOfField(type: SectionType, field: string, itemKey?: string): Role | null {
  if (itemKey) {
    const k = itemKey.toLowerCase()
    if (k === 'q') return 'question'
    if (k === 'a') return 'answer'
    if (k === 'quote') return 'quote'
    if (k === 'name') return type === 'team' || type === 'testimonials' ? 'name' : 'title'
    if (k === 'role') return 'role'
    if (k === 'title') return 'title'
    if (k === 'price') return 'price'
    if (k === 'priceyearly') return null
    if (k === 'value') return 'stat'
    if (k === 'cta') return 'button'
    if (k === 'meta') return null
    if (/^(body|excerpt|desc|label|caption|text)$/.test(k) || /^f\d+$/.test(k)) return 'body'
    return null
  }
  if (field === 'headline') return 'headline'
  if (field === 'heading' || field === 'ctaHeading') return 'heading'
  if (field === 'eyebrow') return 'eyebrow'
  if (/^(subhead|intro|lead|tagline)$/.test(field) || (type === 'cta' && field === 'body')) return 'lead'
  if (/^body\d$/.test(field)) return 'paragraph'
  if (/^(cta|ctaPrimary|ctaSecondary|ctaButton|submit|contactCta)$/.test(field)) return 'button'
  if (field === 'quote') return 'quote'
  if (/^(email|phone|address)$/.test(field)) return 'contact'
  return null
}

/** Every place a line could go in a section, from its outline (lists with their items and fields). */
export function spotsOf(slotId: string, type: SectionType, nodes: OutlineNode[], maxOf: (listId: string) => number): Spot[] {
  const out: Spot[] = []
  const walk = (ns: OutlineNode[], list?: Spot['list']) => {
    for (const n of ns) {
      if (n.t === 'field') {
        const role = roleOfField(type, n.field, list ? n.key : undefined)
        if (role) out.push({ slotId, type, field: n.field, role, ...(list ? { list: { ...list, itemKey: n.key } } : {}) })
      } else {
        // Nested lists (a plan's features) are left as they are: one level of items is what a pour fills.
        if (list) continue
        for (const it of n.items) walk(it.nodes, { id: n.id, key: n.key, listKey: n.listKey, n: it.n, itemKey: '', max: maxOf(n.id) })
      }
    }
  }
  walk(nodes)
  return out
}

export interface PourSection {
  slotId: string
  type: SectionType
  heading?: string
}

const sectionKey = (id: string) => `s_${id}`

/** One request: each line's role and section, and whether each run of lines is a list. */
export function pourRequest(lines: Line[], sections: PourSection[]): JevRequest {
  // Sections are described by the kind of words they hold, not their current words: those are often placeholders,
  // and Jev reads literally (a bakery's line "belongs" in no section about something else).
  const sectionOptions: Record<string, Criterion> = Object.fromEntries(
    sections.map((s, i) => [sectionKey(s.slotId), { what: `${TYPE_LABEL[s.type]} (section ${i + 1} of ${sections.length}): ${SECTION_CRITERIA[s.type].what}` }]),
  )
  const questions: JevRequest['questions'] = {}
  for (const l of lines) {
    // Only the line itself: given its neighbours too, Jev tends to answer for the next line (indirection).
    // Each question carries its own line: pointing at lines[i] makes Jev count, and it drifts onto a neighbour.
    const line = clip(l.text, 400)
    if (!l.sure) questions[`role_${l.i}`] = choice({ question: 'What is this line on a website?', line }, ROLES)
    questions[`section_${l.i}`] = choice({ question: 'Which of this page’s sections is the best home for this line, going by the kind of words each section holds?', line }, sectionOptions)
  }
  const groups = [...new Set(lines.map((l) => l.group))].filter((g) => lines.filter((l) => l.group === g).length >= 3)
  for (const g of groups) questions[`list_${g}`] = noul(`Are the lines of ${at(`runs.g${g}`)} separate items of the same kind (features, plans, questions, people), rather than one piece of writing?`)
  return {
    state: {
      runs: Object.fromEntries(groups.map((g) => [`g${g}`, lines.filter((l) => l.group === g).map((l) => clip(l.text, 120))])),
    },
    questions,
  }
}

export interface Read {
  line: Line
  role: Role
  pRole: number
  slotId: string | null
  pSection: number
  /** Other roles and sections in order, for the tray. */
  roles: { option: string; p: number }[]
  sections: { option: string; p: number }[]
}

/** Jev's answers per line. */
/**
 * What code can rule out on its face: a price has a digit, a button is a short command (no full stop, six words at
 * most), a name or a title is short. Jev reads literally; these keep an obvious slip from landing.
 */
export function plausible(role: string, text: string): boolean {
  const words = text.trim().split(/\s+/).length
  if (role === 'price' || role === 'stat') return /\d/.test(text)
  if (role === 'button') return words <= 6 && !/[.!?]$/.test(text.trim())
  if (role === 'name') return words <= 5 && !/[.!?]$/.test(text.trim())
  if (role === 'title' || role === 'eyebrow') return words <= 10
  if (role === 'contact') return /@|\d/.test(text)
  return true
}

export function readLines(res: JevResponse | null, lines: Line[]): Read[] {
  return lines.map((line) => {
    const r = line.sure ? null : choiceOf(res, `role_${line.i}`)
    const s = choiceOf(res, `section_${line.i}`)
    const roles = r ? ranked(r).filter((x) => plausible(x.option, line.text)) : line.sure ? [{ option: line.sure, p: 1 }] : []
    if (!roles.length) roles.push({ option: 'other', p: 0 })
    const sections = s ? ranked(s) : []
    const top = sections[0]
    return {
      line,
      role: roles[0].option as Role,
      pRole: roles[0].p,
      slotId: top && top.option.startsWith('s_') ? top.option.slice(2) : null,
      pSection: top && top.option.startsWith('s_') ? top.p : 0,
      roles,
      sections: sections.filter((x) => x.option.startsWith('s_')),
    }
  })
}

/** What to write: each section's single fields, and its lists' items in order. */
export interface PourPlan {
  words: Record<string, Record<string, string>>
  lists: Record<string, Record<string, { listId: string; items: Record<string, string>[]; max: number }>>
  placed: { line: number; slotId: string; field: string }[]
  tray: { line: Line; homes: { slotId: string; role: Role }[] }[]
}

/** Item roles that open a new item when they come round again. */
const LEADS: Role[] = ['title', 'question', 'quote', 'name', 'stat']

/**
 * Where each line goes. Sure lines fill their section's fields in the order they came: single fields first come,
 * first served; list lines build items (a title, then its body; a question, then its answer), starting a new item
 * when a role comes round again, up to the list's max. Code counts; nothing is reworded.
 */
export function composePour(reads: Read[], spots: Spot[], listRuns: (group: number) => boolean | null = () => null): PourPlan {
  const T = POUR_THRESHOLDS
  const plan: PourPlan = { words: {}, lists: {}, placed: [], tray: [] }
  const taken = new Set<string>()
  const toTray = (r: Read) => {
    const homes: { slotId: string; role: Role }[] = []
    for (const s of r.sections.filter((x) => x.p >= T.suggest)) {
      const role = r.roles.find((x) => spots.some((sp) => sp.slotId === s.option.slice(2) && sp.role === x.option))
      if (role) homes.push({ slotId: s.option.slice(2), role: role.option as Role })
      if (homes.length === 2) break
    }
    plan.tray.push({ line: r.line, homes })
  }
  // Items being built per section and list.
  const building = new Map<string, { listId: string; items: Record<string, string>[]; max: number; roles: Set<Role> }>()
  const sure = (r: Read) => r.pRole * r.pSection >= T.place && !!r.slotId
  // Single fields (one headline, one intro) go to the likeliest line when several want the same one.
  const claim = new Map<number, string>()
  const byField = new Map<string, Read>()
  for (const r of [...reads].filter(sure).sort((a, b) => b.pRole * b.pSection - a.pRole * a.pSection)) {
    const contactField = /@/.test(r.line.text) ? 'email' : /^\+?[\d\s().-]{7,}$/.test(r.line.text) ? 'phone' : 'address'
    const free = spots.find((s) => s.slotId === r.slotId && s.role === r.role && (r.role !== 'contact' || s.field === contactField) && !s.list && !byField.has(`${s.slotId}:${s.field}`))
    if (free) {
      byField.set(`${free.slotId}:${free.field}`, r)
      claim.set(r.line.i, free.field)
    }
  }
  for (const r of reads) {
    if (!sure(r)) {
      toTray(r)
      continue
    }
    // Contact details go where their shape says: an email to email, a phone number to phone, the rest to the address.
    const contactField = /@/.test(r.line.text) ? 'email' : /^\+?[\d\s().-]{7,}$/.test(r.line.text) ? 'phone' : 'address'
    const mine = spots.filter((s) => s.slotId === r.slotId && s.role === r.role && (r.role !== 'contact' || s.field === contactField))
    const inList = mine.filter((s) => s.list)
    const single = mine.filter((s) => !s.list && claim.get(r.line.i) === s.field)
    const listy = inList.length > 0 && (LEADS.includes(r.role) || ['body', 'answer', 'role', 'price', 'button'].includes(r.role))
    // A single field wins when nothing in a list fits, for buttons, and when Jev called the run prose rather than a list.
    const preferSingle = single.length > 0 && (!listy || r.role === 'button' || listRuns(r.line.group) === false)
    const asItem = listy && !preferSingle
    if (preferSingle) {
      const s = single[0]
      taken.add(`${s.slotId}:${s.field}`)
      ;(plan.words[s.slotId] ??= {})[s.field] = r.line.text
      plan.placed.push({ line: r.line.i, slotId: s.slotId, field: s.field })
      continue
    }
    if (asItem) {
      const spot = inList[0]
      const key = `${spot.slotId}:${spot.list!.id}`
      const b = building.get(key) ?? { listId: spot.list!.id, items: [], max: spot.list!.max, roles: new Set<Role>() }
      building.set(key, b)
      // A role coming round again starts the next item (title, body, title → two items; quote, name, quote → two).
      const startNew = !b.items.length || b.roles.has(r.role)
      if (startNew) {
        if (b.items.length >= b.max) {
          toTray(r)
          continue
        }
        b.items.push({})
        b.roles = new Set()
      }
      b.items.at(-1)![spot.list!.itemKey] = r.line.text
      b.roles.add(r.role)
      plan.placed.push({ line: r.line.i, slotId: spot.slotId, field: `${spot.list!.key}/${b.items.length}/${spot.list!.itemKey}` })
      continue
    }
    toTray(r)
  }
  for (const [key, b] of building) {
    const slotId = key.split(':')[0]
    ;(plan.lists[slotId] ??= {})[b.listId] = { listId: b.listId, items: b.items, max: b.max }
  }
  return plan
}

/** Whether Jev called each run a list (true), prose (false) or didn't say (null). */
export function listRunsFrom(res: JevResponse | null): (group: number) => boolean | null {
  return (g) => {
    const p = yes(res, `list_${g}`)
    return p === null ? null : p >= POUR_THRESHOLDS.list
  }
}

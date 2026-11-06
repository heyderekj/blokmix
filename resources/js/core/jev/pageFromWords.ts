// A page from anything you paste: an old site's copy, a menu, a CV, event notes. Code
// cuts the text into runs; Jev says what kind of section each run is (questions and
// answers → FAQ, names with roles → team, prices → pricing) and what each line is; code
// picks built-in layouts that fit how many items each run has, and Pour places the words.
// Three arrangements of the same words: the same sections in contrasting layouts.

import { KINDS, type Kind, type Library, type SectionType } from '../types'
import { suggestClip } from '../suggest'
import { TYPE_LABEL } from '../content'
import { choice, noul, at } from './ask'
import { clip } from './state'
import { merged, shuffled } from './shuffle'
import { choiceOf, ranked, yes } from './read'
import { KIND_CRITERIA, SECTION_CRITERIA } from './vocab'
import { ROLES, POUR_THRESHOLDS, type Line, type Read, type Role } from './pour'
import type { Criterion, JevRequest, JevResponse } from './types'

export const PAGE_THRESHOLDS = {
  /** A run is that kind of section at this; below, its lines wait in the tray. */
  type: 0.3,
  /** The kind of site, when sure (both orders agreeing). */
  kind: 0.6,
}

/** A run of lines that becomes one section, its heading line first when it had one. */
export interface Chunk {
  c: number
  lines: Line[]
}

const headingLike = (l: Line) => l.heading || (l.text.split(/\s+/).length <= 6 && !/[.!?:;,]$/.test(l.text) && !l.sure)

/** Runs of lines (blank lines between them); a lone heading-like line joins the run after it. */
export function chunkLines(lines: Line[]): Chunk[] {
  const groups: Line[][] = []
  for (const l of lines) {
    const g = groups.at(-1)
    if (g && g[0].group === l.group) g.push(l)
    else groups.push([l])
  }
  const chunks: Chunk[] = []
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    if (g.length === 1 && headingLike(g[0]) && groups[i + 1]) {
      chunks.push({ c: chunks.length, lines: [g[0], ...groups[i + 1]] })
      i++
    } else chunks.push({ c: chunks.length, lines: g })
  }
  return chunks
}

const PLACEABLE = SECTION_CRITERIA as Record<string, Criterion>
const TYPE_OPTIONS: Record<string, Criterion> = {
  ...Object.fromEntries(Object.entries(PLACEABLE).filter(([k]) => k !== 'nav' && k !== 'footer')),
  skip: { what: 'Not part of a web page: notes to self, instructions, leftovers' },
}

/** One request: each run's section type (both orders), the kind of site, each line's role, and which runs are lists. */
export function pageRequest(lines: Line[], chunks: Chunk[]): JevRequest {
  const questions: JevRequest['questions'] = {
    ...shuffled('kind', choice(`What kind of website is ${at('text')} for?`, KIND_CRITERIA)),
  }
  for (const ch of chunks) {
    // Each question carries its own lines: pointing at runs[i] makes Jev count, and it drifts onto a neighbour.
    const run = ch.lines.map((l) => clip(l.text, 200))
    Object.assign(questions, shuffled(`type_${ch.c}`, choice({ question: 'What kind of website section should these lines become?', lines: run }, TYPE_OPTIONS)))
    if (ch.lines.length >= 3) questions[`list_${ch.c}`] = noul({ question: 'After the first line, are these lines separate items of the same kind (features, plans, questions, people)?', lines: run })
  }
  for (const l of lines) if (!l.sure) questions[`role_${l.i}`] = choice({ question: 'What is this line on a website?', line: clip(l.text, 400) }, ROLES)
  return {
    state: {
      text: chunks.map((ch) => ch.lines.map((l) => clip(l.text, 160)).join('\n')).join('\n\n').slice(0, 6000),
    },
    questions,
  }
}

export interface TypedChunk extends Chunk {
  type: SectionType | null
  p: number
  isList: boolean | null
}

export interface PageRead {
  kind: Kind | null
  chunks: TypedChunk[]
  /** Each line's role, as Pour reads it (its section is filled in once the page exists). */
  roles: Record<number, { role: Role; p: number; all: { option: string; p: number }[] }>
}

export function readPage(res: JevResponse | null, lines: Line[], chunks: Chunk[]): PageRead | null {
  const k = merged(res, 'kind')
  if (!res || !k) return null
  const kind = k.agree && (KINDS as readonly string[]).includes(k.choice) && (k.probabilities[k.choice] ?? 0) >= PAGE_THRESHOLDS.kind ? (k.choice as Kind) : null
  const typed = chunks.map((ch): TypedChunk => {
    const m = merged(res, `type_${ch.c}`)
    const p = m ? (m.probabilities[m.choice] ?? 0) : 0
    const type = m && m.choice !== 'skip' && p >= PAGE_THRESHOLDS.type ? (m.choice as SectionType) : null
    const l = yes(res, `list_${ch.c}`)
    return { ...ch, type, p, isList: l === null ? null : l >= POUR_THRESHOLDS.list }
  })
  const roles: PageRead['roles'] = {}
  for (const l of lines) {
    if (l.sure) roles[l.i] = { role: l.sure, p: 1, all: [{ option: l.sure, p: 1 }] }
    else {
      const a = choiceOf(res, `role_${l.i}`)
      const all = a ? ranked(a) : [{ option: 'other', p: 0 }]
      roles[l.i] = { role: all[0].option as Role, p: all[0].p, all }
    }
  }
  return { kind, chunks: typed, roles }
}

/** The page's sections in order: each typed run, plus a hero up top when no run is one (it takes the most headline-like line). */
export function pageSections(read: PageRead): { type: SectionType; chunk: TypedChunk | null; heroLines?: number[] }[] {
  const out: { type: SectionType; chunk: TypedChunk | null; heroLines?: number[] }[] = read.chunks.filter((c) => c.type).map((c) => ({ type: c.type!, chunk: c }))
  if (!out.some((s) => s.type === 'hero')) {
    const lines = read.chunks.flatMap((c) => c.lines)
    const best = lines
      .map((l) => ({ l, p: read.roles[l.i]?.all.find((x) => x.option === 'headline')?.p ?? 0 }))
      .sort((a, b) => b.p - a.p)[0]
    const heroLines = best && best.p > 0.2 ? [best.l.i, ...lines.filter((l) => l.i === best.l.i + 1 && read.roles[l.i]?.role === 'lead').map((l) => l.i)] : []
    out.unshift({ type: 'hero', chunk: null, heroLines })
  }
  return out
}

/** How many items a run brings, and of what: one per item-opening line (titles, questions, quotes, names, numbers). */
export function itemCount(chunk: TypedChunk | null, read: PageRead): { need: number; lead: Role | null } {
  if (!chunk) return { need: 0, lead: null }
  const opens: Role[] = ['title', 'question', 'quote', 'name', 'stat']
  const counts = new Map<Role, number>()
  for (const l of chunk.lines) {
    const r = read.roles[l.i]?.role
    if (r && opens.includes(r)) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  const [lead, need] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  return { need, lead }
}

/**
 * Built-in layouts for each section, the `pick`th that fits (0, 1, 2 give the three arrangements): one whose main list
 * holds the run's items, ordered the way suggestions are (contrasting rhythm with the section above).
 */
export function chooseLayouts(sections: ReturnType<typeof pageSections>, read: PageRead, library: Library, capacity: (clipId: string, lead: Role | null) => number, pick: number): string[] {
  const placed: { type: SectionType; clipId: string; id: string }[] = []
  return sections.map((s, i) => {
    const { need, lead } = itemCount(s.chunk, read)
    const all = suggestClip(s.type, placed, i, library).map((x) => x.clipId)
    const builtIn = all.filter((id) => library.clips[id]?.sourceId === 'layout')
    const pool = (builtIn.length ? builtIn : all).filter((id) => capacity(id, lead) >= need)
    const options = pool.length ? pool : builtIn.length ? builtIn : all
    const clipId = options[pick % Math.max(1, options.length)] ?? options[0]
    placed.push({ type: s.type, clipId, id: `p${i}` })
    return clipId
  })
}

/** Pour's reads for the built page: each line in its section (sure of the section: the run decided it). */
export function readsFor(read: PageRead, sections: ReturnType<typeof pageSections>, slotIds: string[]): Read[] {
  const reads: Read[] = []
  const lineSection = new Map<number, string>()
  sections.forEach((s, k) => {
    for (const l of s.chunk?.lines ?? []) lineSection.set(l.i, slotIds[k])
    for (const i of s.heroLines ?? []) lineSection.set(i, slotIds[k])
  })
  const lines = read.chunks.flatMap((c) => c.lines).sort((a, b) => a.i - b.i)
  for (const line of lines) {
    const r = read.roles[line.i]
    const slotId = lineSection.get(line.i) ?? null
    reads.push({ line, role: r?.role ?? 'other', pRole: r?.p ?? 0, slotId, pSection: slotId ? 1 : 0, roles: r?.all ?? [], sections: slotId ? [{ option: `s_${slotId}`, p: 1 }] : [] })
  }
  return reads
}

/** "FAQ · Team · Pricing", for what the page holds. */
export const describeSections = (types: SectionType[]) => types.map((t) => TYPE_LABEL[t]).join(' · ')

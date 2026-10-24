// Marks: specific feedback pinned to blocks and areas, with the kinds, statuses
// and hand-off shape ReviseMy and Koati use, so the three read as siblings.

import type { Note, NoteAnchor, NoteKind, NoteSource, NoteStatus } from './types'

export const KIND_LABEL: Record<NoteKind, string> = {
  'must-fix': 'Must fix',
  nit: 'Small fix',
  question: 'Question',
  keep: 'Love this',
}

export const KIND_HINT: Record<NoteKind, string> = {
  'must-fix': 'Blocks shipping',
  nit: 'Nice to have',
  question: 'Needs an answer',
  keep: 'Don’t change this',
}

export const STATUS_LABEL: Record<NoteStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  verified: 'Verified',
}

export const SOURCE_LABEL: Record<NoteSource, string> = { you: 'You', agent: 'Agent', checklist: 'Checklist', review: 'Review' }

/** The section a note is about, if it's about one (a mark on a build's preview may not be). */
export function slotOf(a: NoteAnchor): string | undefined {
  return 'slotId' in a ? a.slotId : undefined
}

/** The section of the working mix a note is pinned to: marks on a build's preview belong to that build instead. */
export function onSection(a: NoteAnchor): string | undefined {
  return a.kind === 'preview' ? undefined : slotOf(a)
}

/** Agents can pick work up and say it's done; only a person verifies. */
export const AGENT_STATUSES: NoteStatus[] = ['in_progress', 'resolved']

export const isMark = (n: Note): n is Note & { kind: NoteKind; status: NoteStatus } => !!n.kind

/** A "keep" needs no work, so it starts out verified. */
export function initialStatus(kind: NoteKind): NoteStatus {
  return kind === 'keep' ? 'verified' : 'open'
}

export function nextNumber(notes: Note[]): number {
  return notes.reduce((m, n) => Math.max(m, n.number ?? 0), 0) + 1
}

/** Still needs someone: open or being worked on (keeps never do). */
export function outstanding(n: Note): boolean {
  return isMark(n) && n.kind !== 'keep' && (n.status === 'open' || n.status === 'in_progress')
}

export const KIND_ORDER: Record<NoteKind, number> = { 'must-fix': 0, nit: 1, question: 2, keep: 3 }

export function sortMarks<T extends Note>(marks: T[]): T[] {
  return [...marks].sort((a, b) => KIND_ORDER[a.kind!] - KIND_ORDER[b.kind!] || (a.number ?? 0) - (b.number ?? 0))
}

/** Plain-language instructions for an agent working through the marks (ReviseMy's guidance, in Blokmix's words). */
export const MARK_GUIDANCE =
  'Work through the marks in order: must-fix first, then small fixes. Answer questions in your summary rather than guessing. Never change anything marked “Love this”. When a mark has suggested copy, use those exact words. Mark each one in progress as you start and resolved with a short note when done; the person verifies.'

export interface WorkItem {
  id: string
  number: string
  kind: NoteKind
  status: NoteStatus
  by: string
  /** Where it is, in words: "Hero (section 2) · Button", never a selector. */
  on: string
  section: { position: number; type: string; component: string } | null
  block: string | null
  /** The words on the block when the mark was made. */
  quote: string | null
  /** Fractions of the section's box, for marks drawn as an area. */
  area: { x: number; y: number; w: number; h: number } | null
  body: string
  suggestedCopy: string | null
  resolution: string | null
  replies: { by: string; text: string }[]
}

/**
 * Marks bucketed for an agent, the way ReviseMy hands off work: must-fix first,
 * then small fixes and questions; keeps are things not to touch. Verified marks
 * are done and left out.
 */
export function workPackets(
  marks: Note[],
  sections: { slotId: string; position: number; type: string; component: string; label: string }[],
): { must_fix: WorkItem[]; nits: WorkItem[]; questions: WorkItem[]; keeps: WorkItem[]; awaiting_verification: WorkItem[] } {
  const item = (n: Note): WorkItem => {
    const a = n.anchor
    const s = 'slotId' in a ? sections.find((x) => x.slotId === a.slotId) : undefined
    const where = s ? `${s.label} (section ${s.position})` : 'The whole page'
    return {
      id: n.id,
      number: `N${n.number}`,
      kind: n.kind!,
      status: n.status!,
      by: n.author ?? SOURCE_LABEL[n.source ?? 'you'],
      on:
        a.kind === 'block' || a.kind === 'words'
          ? `${where} · ${a.label.split(' · ').slice(1).join(' · ') || a.label}${a.kind === 'words' ? `, the words “${a.quote}”` : ''}`
          : a.kind === 'area'
            ? `${where}, an area`
            : where,
      section: s ? { position: s.position, type: s.type, component: s.component } : null,
      block: a.kind === 'block' || a.kind === 'words' ? a.label : null,
      quote: a.kind === 'block' || a.kind === 'words' ? (a.quote ?? null) : null,
      area: a.kind === 'area' ? a.rect : null,
      body: n.text,
      suggestedCopy: n.suggestedCopy ?? null,
      resolution: n.resolution ?? null,
      replies: (n.replies ?? []).map((r) => ({ by: r.author, text: r.text })),
    }
  }
  const list = sortMarks(marks.filter(isMark))
  const live = list.filter((m) => m.status === 'open' || m.status === 'in_progress')
  return {
    must_fix: live.filter((m) => m.kind === 'must-fix').map(item),
    nits: live.filter((m) => m.kind === 'nit').map(item),
    questions: live.filter((m) => m.kind === 'question').map(item),
    keeps: list.filter((m) => m.kind === 'keep').map(item),
    awaiting_verification: list.filter((m) => m.status === 'resolved').map(item),
  }
}

/** Replace a selected phrase in a field's text, ignoring differences in spacing; null when it isn't there. */
export function replaceWords(full: string, quote: string, next: string): string | null {
  const words = quote.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'))
  return re.test(full) ? full.replace(re, next) : null
}

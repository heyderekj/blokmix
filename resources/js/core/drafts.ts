// Drafts: a mix holds a few, side by side, each one you can work on. The open draft's pages, style guide, words and
// rules live where they always have (the mix's top level), so everything that edits a mix edits it; the others keep
// their own copy (`body`) until you open them. Switching stores the open one and loads the other, as one undo step.
// Saved versions belong to a draft: its history (A1, A2…). Pure, so the store, commands and tests share it.

import type { Contract } from './contract'
import type { GuideState, ProjectContent, Site, Status, VersionNode } from './types'
import { letterFor } from './versions'
import { renameBrand } from './words'

/** What on screen a draft is called. */
export const DRAFT_WORD = 'Draft'
/** Free has this many drafts in a mix (a start makes three); a mix pack has up to MAX_DRAFTS. */
export const FREE_DRAFTS = 3
export const MAX_DRAFTS = 6

/** A draft's own copy of what you edit. */
export interface DraftBody {
  site: Site
  guide: GuideState
  content: ProjectContent
  contract?: Contract
}

export interface Draft {
  id: string
  /** A, B, C… in the order they were made. */
  letter: string
  name: string
  createdAt: number
  status?: Status
  /** What it was made from: another draft, or a saved version ("From B2"). */
  from?: { draft?: string; version?: string }
  /** The version last saved or restored in it: what "edited since" compares against. */
  head?: string | null
  /** The page it was on, so opening it again shows that page. */
  pageId?: string | null
  /** Null for the open draft: its body is the mix's own site, guide, content and contract. */
  body: DraftBody | null
}

/** What a mix keeps for its drafts, alongside the open one's body at its top level. */
export interface DraftState extends DraftBody {
  drafts: Record<string, Draft>
  draftId: string
  head: string | null
  versions: Record<string, VersionNode>
}

/** Content every draft shares: the site's name, its logo and what it's for. */
export const SHARED_CONTENT = ['brand', 'logo', 'brief'] as const

/** Drafts in the order they were made (A, B, C). */
export const draftList = (drafts: Record<string, Draft>): Draft[] => Object.values(drafts).sort((a, b) => a.createdAt - b.createdAt || a.letter.localeCompare(b.letter))

/** The next free letter. */
export function nextDraftLetter(drafts: Record<string, Draft>): string {
  const taken = new Set(Object.values(drafts).map((d) => d.letter))
  for (let i = 0; ; i++) if (!taken.has(letterFor(i))) return letterFor(i)
}

/** A draft's body: the open one's from the top level, the others their own. */
export function draftBody(st: DraftState, id: string): DraftBody | null {
  if (id === st.draftId) return { site: st.site, guide: st.guide, content: st.content, contract: st.contract }
  return st.drafts[id]?.body ?? null
}

/** A body brought up to the shared content: the open draft's name (renamed in its words), logo and brief. */
function withShared(body: DraftBody, shared: ProjectContent): DraftBody {
  let { site, content } = body
  if (content.brand !== shared.brand && content.brand && shared.brand) ({ site, content } = renameBrand(content, site, content.brand, shared.brand))
  const next: ProjectContent = { ...content, brand: shared.brand }
  for (const k of ['logo', 'brief'] as const) {
    if (shared[k] === undefined) delete next[k]
    else (next as unknown as Record<string, unknown>)[k] = shared[k]
  }
  return { ...body, site, content: next }
}

/**
 * Open another draft: the open one keeps its body (and where it was), the other's comes to the top level with the shared
 * content brought up to date. `pageId` is where you are now; the result says where to go.
 */
export function swapDraft(st: DraftState, toId: string, pageId: string | null): (Partial<DraftState> & { pageId: string | null }) | null {
  const to = st.drafts[toId]
  if (!to || toId === st.draftId || !to.body) return null
  const from = st.drafts[st.draftId]
  const body = withShared(to.body, st.content)
  const drafts = {
    ...st.drafts,
    ...(from ? { [from.id]: { ...from, head: st.head, pageId, body: { site: st.site, guide: st.guide, content: st.content, contract: st.contract } } } : {}),
    [to.id]: { ...to, body: null },
  }
  return { drafts, draftId: to.id, site: body.site, guide: body.guide, content: body.content, contract: body.contract, head: to.head ?? null, pageId: to.pageId ?? null }
}

/** A new draft made from another draft or a saved version (its body copied, never shared). */
export function forkDraft(st: DraftState, from: { draft?: string; version?: string }, opts: { id: string; name?: string; now?: number }): Draft | null {
  const v = from.version ? st.versions[from.version] : null
  const src = v ? { site: v.snapshot.site, guide: v.snapshot.guide, content: v.snapshot.content, contract: v.snapshot.contract } : draftBody(st, from.draft ?? st.draftId)
  if (!src) return null
  const letter = nextDraftLetter(st.drafts)
  return {
    id: opts.id,
    letter,
    name: opts.name?.trim() || `${DRAFT_WORD} ${letter}`,
    createdAt: opts.now ?? Date.now(),
    status: 'in-progress',
    from: v ? { version: v.id } : { draft: from.draft ?? st.draftId },
    head: v && v.kind === 'snapshot' ? v.id : null,
    body: withShared(structuredClone(src), st.content),
  }
}

/** A draft's saved versions, newest first (builds included). */
export const versionsOf = (versions: Record<string, VersionNode>, draftId: string): VersionNode[] =>
  Object.values(versions)
    .filter((v) => v.draftId === draftId)
    .sort((a, b) => b.createdAt - a.createdAt)

/** The next version's letter in a draft: A1, A2… */
export function nextVersionLetter(versions: Record<string, VersionNode>, draft: Pick<Draft, 'id' | 'letter'>): string {
  const re = new RegExp(`^${draft.letter}(\\d+)$`)
  const n = Object.values(versions).reduce((m, v) => {
    const hit = v.draftId === draft.id ? re.exec(v.letter) : null
    return hit ? Math.max(m, Number(hit[1])) : m
  }, 0)
  return `${draft.letter}${n + 1}`
}

/** The id the one draft of a mix saved before drafts gets. */
export const LEGACY_DRAFT = 'draft_a'

/**
 * A mix saved before drafts: one draft, "Draft A", whose history is every version it had (a guided start's other
 * picks among them, to make drafts from). Where it branched from becomes its head.
 */
export function draftsFromLegacy(p: { versions?: Record<string, VersionNode>; head?: string | null; branchFrom?: string | null; createdAt?: number }): {
  drafts: Record<string, Draft>
  draftId: string
  versions: Record<string, VersionNode>
  head: string | null
} {
  const head = p.head ?? p.branchFrom ?? null
  const versions = Object.fromEntries(Object.entries(p.versions ?? {}).map(([id, v]) => [id, v.draftId ? v : { ...v, draftId: LEGACY_DRAFT }]))
  const draft: Draft = { id: LEGACY_DRAFT, letter: 'A', name: `${DRAFT_WORD} A`, createdAt: p.createdAt ?? 0, status: 'in-progress', head, body: null }
  return { drafts: { [LEGACY_DRAFT]: draft }, draftId: LEGACY_DRAFT, versions, head }
}

/** Every draft's site (the open one's from the top level): for the clips and uploads a mix uses. */
export const draftSites = (st: Pick<DraftState, 'site' | 'drafts' | 'draftId'>): Site[] => [
  st.site,
  ...Object.values(st.drafts ?? {})
    .filter((d) => d.id !== st.draftId && d.body)
    .map((d) => d.body!.site),
]

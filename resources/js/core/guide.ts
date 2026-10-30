import type {
  Candidate,
  Choice,
  Clip,
  Conflict,
  GuideState,
  Library,
  Provenance,
  ResolvedGuide,
  Source,
  TokenGroup,
  TokenKey,
  TokenSet,
} from './types'
import { TOKEN_KEYS } from './types'
import { BASE_TOKENS, keysInGroup, normalizeValue, TOKEN_GROUP_OF } from './tokens'

export function emptyGuide(): GuideState {
  return { base: { ...BASE_TOKENS }, candidates: [], choices: {} }
}

export function candidateId(clipId: string, group: TokenGroup): string {
  return `${clipId}#${group}`
}

/**
 * A whole source's look (a site from the site library) as candidates: ids `src:<sourceId>#<group>`, with
 * `clipId` `src:<sourceId>`. The source joins `library.sources` when it's loaded, so names resolve.
 */
export const SOURCE_PREFIX = 'src:'

/** The source a candidate's values came from: its clip's source, or the source itself for `src:` candidates. */
export function candidateSource(lib: Pick<Library, 'clips' | 'sources'>, candidateId: string): Source | null {
  const head = candidateId.split('#')[0]
  if (head.startsWith(SOURCE_PREFIX)) return lib.sources[head.slice(SOURCE_PREFIX.length)] ?? null
  const clip = lib.clips[head]
  return clip ? (lib.sources[clip.sourceId] ?? null) : null
}

/** A readable name for a candidate's origin, even when its source isn't loaded (a site from another session). */
export function candidateSourceName(lib: Pick<Library, 'clips' | 'sources'>, candidateId: string): string {
  const src = candidateSource(lib, candidateId)
  if (src) return src.name
  const head = candidateId.split('#')[0]
  if (head.startsWith(`${SOURCE_PREFIX}site:`)) return head.slice(`${SOURCE_PREFIX}site:`.length).replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase())
  return head
}

/** Add (or refresh) candidates for the given groups of a source's own tokens (a site's whole look). */
export function promoteSource(state: GuideState, source: Pick<Source, 'id' | 'tokens'>, groups: TokenGroup[], now = Date.now()): GuideState {
  let candidates = [...state.candidates]
  const clipId = `${SOURCE_PREFIX}${source.id}`
  groups.forEach((group, i) => {
    const id = candidateId(clipId, group)
    const values: Partial<TokenSet> = {}
    for (const key of keysInGroup(group)) if (source.tokens[key] != null) values[key] = source.tokens[key]
    candidates = candidates.filter((c) => c.id !== id)
    candidates.push({ id, clipId, group, values, promotedAt: now + i })
  })
  return { ...state, candidates }
}

/**
 * Resolve every token: an explicit choice wins; otherwise a single distinct
 * candidate value wins; several distinct values are a conflict (latest promotion
 * wins until the user picks); no candidates falls back to the base set.
 */
export function resolveGuide(saved: GuideState): ResolvedGuide {
  // A guide from the server may be missing its empty parts (a saved guide, a mix that started from one).
  const state: GuideState = { ...saved, candidates: saved.candidates ?? [], choices: saved.choices ?? {} }
  const tokens = { ...state.base } as TokenSet
  const provenance = {} as Record<TokenKey, Provenance>
  const conflicts: Conflict[] = []

  for (const key of TOKEN_KEYS) {
    const cands = state.candidates
      .filter((c) => c.values[key] != null)
      .sort((a, b) => b.promotedAt - a.promotedAt)

    // Group candidate values by their normalized form.
    const options: { value: string; norm: string; candidateIds: string[] }[] = []
    for (const c of cands) {
      const value = c.values[key]!
      const norm = normalizeValue(key, value)
      const hit = options.find((o) => o.norm === norm)
      if (hit) hit.candidateIds.push(c.id)
      else options.push({ value, norm, candidateIds: [c.id] })
    }

    const choice = state.choices[key]
    const chosen = choice ? applyChoice(choice, state.candidates, key) : null

    if (chosen) {
      tokens[key] = chosen.value
      provenance[key] = chosen.provenance
    } else if (options.length) {
      tokens[key] = options[0].value
      provenance[key] = options[0].candidateIds[0]
    } else {
      provenance[key] = 'base'
    }

    if (options.length > 1) {
      conflicts.push({
        key,
        options: options.map(({ value, candidateIds }) => ({ value, candidateIds })),
        resolved: !!chosen,
        current: tokens[key],
      })
    }
  }

  return { tokens, provenance, conflicts }
}

function applyChoice(choice: Choice, candidates: Candidate[], key: TokenKey) {
  if (choice.kind === 'custom') return { value: choice.value, provenance: 'custom' as Provenance }
  const c = candidates.find((x) => x.id === choice.candidateId)
  if (!c || c.values[key] == null) return null
  return { value: c.values[key]!, provenance: c.id as Provenance }
}

/** Add (or refresh) candidates for the given groups of a clip's tokens. */
export function promote(state: GuideState, clip: Clip, groups: TokenGroup[], now = Date.now()): GuideState {
  let candidates = [...state.candidates]
  groups.forEach((group, i) => {
    const id = candidateId(clip.id, group)
    const values: Partial<TokenSet> = {}
    for (const key of keysInGroup(group)) values[key] = clip.tokens[key]
    candidates = candidates.filter((c) => c.id !== id)
    candidates.push({ id, clipId: clip.id, group, values, promotedAt: now + i })
  })
  return { ...state, candidates }
}

/** Promote and make the clip's values win every token in those groups. */
export function adoptDesign(state: GuideState, clip: Clip, groups: TokenGroup[], now = Date.now()): GuideState {
  const next = promote(state, clip, groups, now)
  const choices = { ...next.choices }
  for (const group of groups) {
    for (const key of keysInGroup(group)) choices[key] = { kind: 'candidate', candidateId: candidateId(clip.id, group) }
  }
  return { ...next, choices }
}

export function removeCandidate(state: GuideState, id: string): GuideState {
  const choices = { ...state.choices }
  for (const key of TOKEN_KEYS) {
    const c = choices[key]
    if (c?.kind === 'candidate' && c.candidateId === id) delete choices[key]
  }
  return { ...state, candidates: state.candidates.filter((c) => c.id !== id), choices }
}

export function choose(state: GuideState, key: TokenKey, choice: Choice | null): GuideState {
  const choices = { ...state.choices }
  if (choice) choices[key] = choice
  else delete choices[key]
  return { ...state, choices }
}

export function unresolvedCount(g: ResolvedGuide): number {
  return g.conflicts.filter((c) => !c.resolved).length
}

export function groupOf(key: TokenKey): TokenGroup {
  return TOKEN_GROUP_OF[key]
}

/** Groups (color, type…) that still have an undecided conflict. This is what the UI counts as "decisions". */
export function openGroups(g: ResolvedGuide): TokenGroup[] {
  const out: TokenGroup[] = []
  for (const c of g.conflicts) {
    const grp = TOKEN_GROUP_OF[c.key]
    if (!c.resolved && !out.includes(grp)) out.push(grp)
  }
  return out
}

/** Pick one candidate for every token in its group: the one-click way to settle a contradiction. */
export function chooseGroup(state: GuideState, candidateId: string): GuideState {
  const cand = state.candidates.find((c) => c.id === candidateId)
  if (!cand) return state
  const choices = { ...state.choices }
  for (const key of keysInGroup(cand.group)) if (cand.values[key] != null) choices[key] = { kind: 'candidate', candidateId }
  return { ...state, choices }
}

/** Which candidate a whole group currently follows, if every token in it points at the same one. */
export function groupWinner(state: GuideState, group: TokenGroup): string | null {
  const ids = keysInGroup(group).map((k) => {
    const c = state.choices[k]
    return c?.kind === 'candidate' ? c.candidateId : null
  })
  return ids.every((id) => id && id === ids[0]) ? ids[0] : null
}

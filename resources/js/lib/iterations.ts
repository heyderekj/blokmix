import { blankMix } from '@/state/seed'
import wireReturnSchema from '../../schemas/agent-return.json'
import { applyChange, difference, fromSavedIteration, inspectChange, returnSchema, type Bundle } from '@/core/iterations'
import { stableStringify } from '@/core/hash'
import { nextVersionLetter } from '@/core/drafts'
import { allSlots } from '@/core/site'
import { library } from '@/data/library'
import type { VersionNode } from '@/core/types'
import { packetFiles } from '@/core/export/packet'
import { packetInputFor } from './packet'
import { canEdit, useAccount } from './account'
import { useStore } from '@/state/store'
import { uid } from '@/state/uid'
import { snapshotOf } from '@/state/snapshot'
import { shipRefusal } from '@/state/shipping'
import { api, flushMix, openMixId } from './mixSync'
import { FIELD_SCHEMA } from '@/core/content'

function editable() {
  const account = useAccount.getState()
  if (!canEdit(account.role) || account.archived) throw Error('This mix is read-only.')
}

/** Bind a submission to the saved snapshot it was built against, regardless of which draft is open. */
export function importInstructions() {
  return [
    'Bring this design into a new Blokmix mix. Give me a downloadable .return.json file matching the schema below. Omit base, mix and draft. On page /, add sections with native fields and controls. Include a working preview link for code-only behavior.',
    'Supported fields: ' + JSON.stringify(FIELD_SCHEMA),
    'Available layouts: ' +
      Object.keys(library.clips)
        .filter((id) => library.clips[id].origin === 'layout')
        .join(', '),
    JSON.stringify(wireReturnSchema),
  ].join('\n\n')
}

export function newMixFromReturn(raw: unknown) {
  const bundle = returnSchema.parse(raw)
  if (bundle.base) throw Error('Import this return from Drafts in its original mix.')
  const mix = blankMix(bundle.summary.slice(0, 100))
  const base = uid('v')
  const snapshot = snapshotOf(mix)
  bundle.changes.reduce((s, c) => applyChange(s, c, library), snapshot)
  const node: VersionNode = {
    id: base,
    letter: 'A1',
    kind: 'snapshot',
    title: 'Starting point',
    parentId: null,
    status: 'in-progress',
    draftId: mix.draftId,
    createdAt: Date.now(),
    snapshot,
    returns: [{ bundle: { ...bundle, base }, at: Date.now(), status: 'pending' }],
  }
  const { versions: _, drafts, mixName, ...data } = mix
  return { name: mixName, versions: { [base]: node }, drafts, data: { ...data, head: base } }
}

export function stageReturn(raw: unknown, allowUnbased = false) {
  editable()
  const parsed = returnSchema.safeParse(raw)
  if (!parsed.success) throw Error('Invalid return: ' + parsed.error.issues[0].path.join('.') + ' ' + parsed.error.issues[0].message)
  const bundle = parsed.data
  if (JSON.stringify(bundle).length > 60000) throw Error('A return can contain up to 60,000 characters.')
  const st = useStore.getState()
  if (bundle.mix && bundle.mix !== openMixId()) throw Error('This return belongs to another mix.')
  if (bundle.base && !bundle.mix && openMixId() !== 'local' && allowUnbased) throw Error('Include the originating mix ID from the handoff.')
  if (!bundle.base && allowUnbased) {
    const previous = Object.values(st.versions).find((v) => v.returns?.some((r) => r.bundle.id === bundle.id))
    if (previous) return stageReturn({ ...bundle, base: previous.id })
    bundle.changes.reduce((s, c) => applyChange(s, c, library), snapshotOf(st))
    bundle.base = st.pressVersion()
    return stageReturn(bundle)
  }
  const base = bundle.base && Object.hasOwn(st.versions, bundle.base) ? st.versions[bundle.base] : null
  if (!base || base.kind !== 'snapshot') throw Error('Open the mix containing the original version.')
  if (bundle.draft && bundle.draft !== base.draftId) throw Error('This return belongs to another draft.')
  const old = base.returns?.find((r) => r.bundle.id === bundle.id)
  if (old) {
    if (stableStringify(fromSavedIteration(old.bundle)) !== stableStringify(bundle))
      throw Error('This return ID already belongs to different changes.')
    return base.letter
  }
  bundle.changes.reduce((s, c) => applyChange(s, c, library), base.snapshot)
  useStore.setState({
    versions: { ...st.versions, [base.id]: { ...base, returns: [...(base.returns ?? []), { bundle, at: Date.now(), status: 'pending' }] } },
  })
  return base.letter
}

/** Check each operation against its base, then apply only the user's selections to the current working copy. */
export function reviewReturn(base: VersionNode, bundle: Bundle, selected?: ReadonlySet<number>, commit = false) {
  const st = useStore.getState()
  if (base.draftId !== st.draftId) throw Error('Open the originating draft to review its changes.')
  let proposed = base.snapshot
  let current = snapshotOf(st)
  const workingKey = stableStringify(current)
  const rows = bundle.changes.map((change, index) => {
    const before = inspectChange(proposed, change, library)
    proposed = applyChange(proposed, change, library)
    const incoming = inspectChange(proposed, change, library)
    let here: unknown
    let issue: string | undefined
    try {
      here = inspectChange(current, change, library)
      if (stableStringify(here) !== stableStringify(incoming)) {
        const next = applyChange(current, change, library)
        if (selected ? selected.has(index) : stableStringify(here) === stableStringify(before)) current = next
      }
    } catch (e) {
      issue = (e as Error).message
    }
    if (commit && issue && selected?.has(index)) throw Error(issue)
    const conflict = stableStringify(here) !== stableStringify(before) && stableStringify(here) !== stableStringify(incoming)
    return { before, here, incoming, conflict, issue }
  })
  return { rows, current, proposed, workingKey }
}

export function decideReturn(baseId: string, id: string, selected: ReadonlySet<number> | null) {
  editable()
  const st = useStore.getState(),
    base = st.versions[baseId]
  const item = base?.returns?.find((r) => r.bundle.id === id)
  if (!item || item.status !== 'pending') throw Error('This return has already been reviewed.')
  const versions = { ...st.versions }
  let next: VersionNode | undefined
  if (selected?.size) {
    const { current } = reviewReturn(base, item.bundle, selected, true)
    current.clipHashes = Object.fromEntries(allSlots(current.site).map((s) => [s.clipId, library.clips[s.clipId]?.hash ?? '']))
    let parentId = st.head ?? base.id
    const working = snapshotOf(st)
    if (stableStringify(versions[parentId]?.snapshot) !== stableStringify(working)) {
      const id = uid('v')
      versions[id] = {
        id,
        parentId,
        draftId: st.draftId,
        letter: nextVersionLetter(versions, st.drafts[st.draftId]),
        title: 'Your edits before the return',
        createdAt: Date.now(),
        status: 'in-progress',
        kind: 'snapshot',
        snapshot: working,
      }
      parentId = id
    }
    next = {
      id: uid('v'),
      letter: nextVersionLetter(versions, st.drafts[st.draftId]),
      draftId: st.draftId,
      parentId,
      createdAt: Date.now(),
      title: item.bundle.summary,
      status: 'in-progress',
      kind: 'snapshot',
      snapshot: current,
      acceptedFrom: { base: base.id, submission: id, agent: item.bundle.agent },
    }
    versions[next.id] = next
  }
  versions[base.id] = {
    ...base,
    returns: base.returns!.map((r) => (r !== item ? r : { ...r, status: next ? 'accepted' : 'dismissed', version: next?.id })),
  }
  const temporal = useStore.temporal.getState()
  temporal.pause()
  try {
    useStore.setState({ versions, ...(next && { site: next.snapshot.site, guide: next.snapshot.guide, head: next.id }) })
  } finally {
    temporal.resume()
  }
  useStore.temporal.setState((t) => ({
    pastStates: [...t.pastStates, { versions: st.versions, site: st.site, guide: st.guide, head: st.head }].slice(-100),
    futureStates: [],
  }))
}

export function handoffPacket(v: VersionNode) {
  const denial = shipRefusal()
  if (denial) throw Error(denial)
  const st = useStore.getState()
  let previous = v.parentId ? st.versions[v.parentId] : undefined
  let accepted = v.acceptedFrom
  const visited = new Set<string>()
  while (previous && !previous.handoff && !visited.has(previous.id)) {
    accepted ??= previous.acceptedFrom
    visited.add(previous.id)
    previous = previous.parentId ? st.versions[previous.parentId] : undefined
  }
  const returns = previous?.returns?.filter((r) => !v.handoff || r.at <= v.handoff.at) ?? []
  const returned = (returns.find((r) => r.bundle.id === accepted?.submission && accepted.base === previous?.id) ?? returns.at(-1))?.bundle
  const baseline = previous && (returned ? returned.changes.reduce((snap, c) => applyChange(snap, c, library), previous.snapshot) : previous.snapshot)
  const files = packetFiles(packetInputFor(st, { version: v, targets: ['astro', 'next'] }))
  return {
    base: v.id,
    mix: openMixId(),
    draft: v.draftId,
    previous: previous?.id,
    previousImplementation: returned?.preview,
    changes: baseline ? difference(baseline, v.snapshot) : [],
    instructions:
      'Apply these changes to the existing implementation. Submit a return with this base ID. Copy mix, draft, and base to your return. Use a preview URL for behavior requiring code. Use page paths and stable section IDs. For a new editable layout, supply rows of native fields.',
    layouts: Object.keys(library.clips).filter((id) => library.clips[id].origin === 'layout'),
    fields: FIELD_SCHEMA,
    returnSchema: wireReturnSchema,
    snapshot: v.snapshot,
    files: Object.fromEntries(Object.entries(files).map(([path, data]) => [path, typeof data === 'string' ? data : { base64: encodeBytes(data) }])),
  }
}

export function readHandoff(v: VersionNode, file?: string, offset = 0) {
  const { snapshot, changes, layouts, fields, returnSchema: schema, files, ...index } = handoffPacket(v)
  const entries: Record<string, string | { base64: string }> = { ...files }
  for (const [name, data] of Object.entries({ snapshot, changes, layouts, fields, returnSchema: schema }))
    entries['handoff/' + name + '.json'] = JSON.stringify(data)
  if (!file) return { ...index, files: Object.keys(entries) }
  if (!Object.hasOwn(entries, file)) throw Error('Unknown file. Read the handoff index first.')
  const data = entries[file]
  const characters = Array.from(typeof data === 'string' ? data : data.base64)
  const end = Math.min(offset + 16000, characters.length)
  return {
    content: characters.slice(offset, end).join(''),
    encoding: typeof data === 'string' ? 'text' : 'base64',
    nextOffset: end < characters.length ? end : null,
  }
}

function encodeBytes(data: Uint8Array) {
  let bytes = ''
  for (let i = 0; i < data.length; i += 32768) bytes += String.fromCharCode(...data.subarray(i, i + 32768))
  return btoa(bytes)
}

export async function sendChanges() {
  editable()
  const denial = shipRefusal()
  if (denial) throw Error(denial)
  const mix = openMixId(),
    st = useStore.getState()
  const head = st.head && st.versions[st.head]
  const snapshot = snapshotOf(st)
  const versionId = head && head.draftId === st.draftId && stableStringify(head.snapshot) === stableStringify(snapshot) ? head.id : st.pressVersion()
  const v = useStore.getState().versions[versionId]
  const packet = handoffPacket(v)
  const by = useAccount.getState().user?.name ?? 'You'
  let id: string | undefined
  if (mix !== 'local') {
    await flushMix()
    const res = await api<{ id: string; message?: string }>('POST', '/api/mixes/' + mix + '/handoffs', {
      version: v.id,
      packet: JSON.stringify(packet),
    })
    if (res.status !== 201) throw Error(res.body?.message ?? 'Save the mix and try sending again.')
    id = res.body.id
  }
  if (openMixId() !== mix || !useStore.getState().versions[v.id]) throw Error('Reopen the original mix to continue.')
  useStore.setState((s) => ({ versions: { ...s.versions, [v.id]: { ...s.versions[v.id], handoff: { at: Date.now(), by, id } } } }))
  return id
    ? 'Use the Blokmix connector at ' +
        location.origin +
        '/api/mcp. Read handoff ' +
        id +
        ' with get_handoff, implement it, then call submit_changes.'
    : 'Use the local Blokmix connector. Call get_handoff with version ' + v.id + ', then submit_changes with your return.'
}

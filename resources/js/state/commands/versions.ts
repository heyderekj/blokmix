import type { BuildTarget, VersionNode } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { buildDirName } from '@/core/commands/bridge'
import { agentPrompt, packetFiles } from '@/core/export/packet'
import { outstanding } from '@/core/notes'
import { dfsOrder, nextLetter } from '@/core/versions'
import { pressVersionAndFly } from '@/lib/actions'
import { bridgeWriter } from '@/lib/agentLink'
import { packetInputFor } from '@/lib/packet'
import { useStore } from '../store'
import { useLayout } from '../layout'
import { CommandError } from './refs'
import type { AsyncCommand } from './index'

/** A version by its letter ("B", "b.1") or id. */
export function findVersion(ref: string): VersionNode {
  const vs = useStore.getState().versions
  const v = vs[ref] ?? Object.values(vs).find((x) => x.letter.toLowerCase() === ref.trim().replace(/^version\s+/i, '').toLowerCase())
  if (!v) {
    const known = dfsOrder(vs).map((x) => x.node.letter)
    throw new CommandError(`No version "${ref}".${known.length ? ` Versions: ${known.join(', ')}` : ' Nothing has been saved yet: save_version first.'}`)
  }
  return v
}

/** Marks still open on a version: pinned to its frame or brought back from a review of its preview. */
function openMarks(id: string): number {
  return useStore.getState().notes.filter((n) => outstanding(n) && ((n.anchor.kind === 'preview' && n.anchor.versionId === id) || (n.anchor.kind === 'frame' && n.anchor.frameId === id))).length
}

function describeVersion(v: VersionNode) {
  const vs = useStore.getState().versions
  const b = v.build
  return {
    id: v.id,
    letter: v.letter,
    title: v.title,
    kind: v.kind,
    status: v.status,
    parent: v.parentId ? (vs[v.parentId]?.letter ?? null) : null,
    sections: v.snapshot.slots.length,
    build: b
      ? { by: b.by, agent: b.agentName, target: b.target, steps: b.steps, done: b.done, preview_url: b.previewUrl ?? null, dir: b.dir ?? null, preview_height: b.previewHeight ?? null }
      : null,
    review: v.review ? { tool: v.review.tool, id: v.review.id, url: v.review.url, status: v.review.status, synced_at: new Date(v.review.syncedAt).toISOString() } : null,
    open_marks: openMarks(v.id),
  }
}

export const read = {
  list_versions: () => {
    const st = useStore.getState()
    return { head: st.head ? st.versions[st.head]?.letter : null, versions: dfsOrder(st.versions).map(({ node, depth }) => ({ ...describeVersion(node), depth })) }
  },
}

export const write = {
  save_version: (i: CommandInput<'save_version'>) => {
    pressVersionAndFly()
    const st = useStore.getState()
    const v = st.head ? st.versions[st.head] : null
    if (v && i.title) st.renameVersion(v.id, i.title)
    return v ? { version: v.letter, title: i.title ?? v.title } : null
  },
  report_build: (i: CommandInput<'report_build'>) => {
    const v = findVersion(i.build)
    if (v.kind !== 'build' || !v.build) throw new CommandError(`${v.letter} isn’t a build. prepare_build starts one.`)
    const st = useStore.getState()
    const b = v.build
    const steps = i.step && b.steps[b.steps.length - 1] !== i.step ? [...b.steps, i.step] : b.steps
    const heights =
      i.preview_height === undefined
        ? b.previewHeight
        : typeof i.preview_height === 'number'
          ? { ...b.previewHeight, '/': Math.round(i.preview_height) }
          : { ...b.previewHeight, ...Object.fromEntries(Object.entries(i.preview_height).map(([w, h]) => [`/@${w}`, Math.round(h)])) }
    const done = i.done ?? b.done
    st.updateBuild(v.id, { by: 'agent', steps, done, previewUrl: i.preview_url ?? b.previewUrl, previewHeight: heights }, i.status ?? (i.done && !b.done ? 'ready' : undefined))
    // The agent's cursor stays on the build while it works, and leaves when it's done.
    if (done) {
      if (st.agent.versionId === v.id) st.setAgent({ versionId: null, step: 0 })
    } else st.setAgent({ versionId: v.id, name: b.agentName, step: steps.length })
    if (i.done && !b.done) st.showFlash(`${v.letter} is ready for review`)
    return describeVersion(useStore.getState().versions[v.id])
  },
}

interface Prepared {
  versionId: string
  target: BuildTarget
  agentName: string
  letter: string
  dir: string
  files: string[]
  prompt: string
}

/** A version's packet, written to disk through the bridge before the build frame opens. */
const prepare_build: AsyncCommand<Prepared> = {
  prepare: (async (i: CommandInput<'prepare_build'>) => {
    // Claim the bridge request now: it's only known while the command starts.
    const writer = bridgeWriter()
    let v = findVersion(i.version)
    const st = useStore.getState()
    if (v.kind === 'build') v = st.versions[v.parentId!] ?? v
    if (v.kind === 'build') throw new CommandError(`${i.version} is a build; build the version it came from instead`)
    if (!writer) throw new CommandError('prepare_build writes the packet through the MCP bridge (npm run mcp), so run it from an agent connected to Blokmix')
    const busy = st.agent.versionId ? st.versions[st.agent.versionId] : null
    if (busy?.build && !busy.build.done) throw new CommandError(`${busy.build.agentName} is still building ${busy.letter}: report_build it done first`)
    const letter = nextLetter(st.versions, v.id)
    const input = packetInputFor(st, { version: v, targets: [i.target], sections: useLayout.getState().sections })
    const files = packetFiles(input)
    const dir = await writer.open(buildDirName(st.mixName, letter))
    for (const [path, data] of Object.entries(files))
      writer.write(typeof data === 'string' ? { path, enc: 'utf8', data } : { path, enc: 'base64', data: toBase64(data) })
    await writer.flush()
    const agentName = i.agent_name ?? 'Claude'
    const prompt = `You’re building ${letter}, a build of version ${v.letter}. The packet is in ${dir}.\n\n${agentPrompt(input, i.target, { build: letter, dir })}`
    return { versionId: v.id, target: i.target, agentName, letter, dir, files: Object.keys(files), prompt }
  }) as AsyncCommand<Prepared>['prepare'],
  apply: ((_: unknown, p: Prepared) => {
    const st = useStore.getState()
    const id = st.startBuild(p.versionId, p.target, p.agentName)
    st.updateBuild(id, { by: 'agent', dir: p.dir })
    const b = useStore.getState().versions[id]
    return { build: b.letter, id, version: st.versions[p.versionId].letter, target: p.target, dir: p.dir, files: p.files, prompt: p.prompt }
  }) as AsyncCommand<Prepared>['apply'],
}

export const later = { prepare_build }

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

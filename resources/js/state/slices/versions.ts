import type { VersionNode } from '@/core/types'
import { autoTitle, descendants, nextLetter, snapshotKey } from '@/core/versions'
import { nextVersionLetter } from '@/core/drafts'
import { emptyContract } from '@/core/contract'
import { library } from '@/data/library'
import { allSlots, mapSlots, pageOf } from '@/core/site'
import { snapshotOf } from '../snapshot'
import { uid } from '../uid'
import type { State } from '../store'

type Set = (partial: Partial<State> | ((st: State) => Partial<State>)) => void
type Get = () => State

/** Versions: saving, remixing, statuses and builds. */
export function versionActions(set: Set, get: Get): Pick<State, 'pressVersion' | 'remix' | 'setStatus' | 'renameVersion' | 'deleteVersion' | 'startBuild' | 'updateBuild' | 'setAgent' | 'moveFrame'> {
  return {
    pressVersion: () => {
      const st = get()
      const id = uid('v')
      // A saved moment of the open draft, in its history (A1, A2…); it follows the one before it.
      const draft = st.drafts[st.draftId]
      const parentId = st.head && st.versions[st.head] ? st.head : null
      const node: VersionNode = {
        id,
        letter: draft ? nextVersionLetter(st.versions, draft) : nextLetter(st.versions, parentId),
        parentId,
        ...(draft ? { draftId: draft.id } : {}),
        title: autoTitle(allSlots(st.site), library),
        status: 'in-progress',
        createdAt: Date.now(),
        kind: 'snapshot',
        snapshot: snapshotOf(st),
      }
      set({ versions: { ...st.versions, [id]: node }, head: id, ui: { ...st.ui, selectedFrameId: id } })
      return id
    },
    // Your mix takes on a version. Unsaved edits are saved as a version first, so nothing is lost; ⌘Z undoes the switch.
    remix: (versionId) => {
      const v = get().versions[versionId]
      if (!v) return null
      const now = get()
      const head = now.head ? now.versions[now.head] : null
      const dirty = allSlots(now.site).length > 0 && (!head || snapshotKey(head.snapshot) !== snapshotKey({ site: now.site, guide: now.guide, content: now.content, contract: now.contract }))
      const saved = dirty ? get().pressVersion() : null
      const snap = structuredClone(v.snapshot)
      const site = mapSlots(snap.site, (s) => (library.clips[s.clipId] ? s : null))
      set((st) => ({
        site,
        guide: snap.guide,
        content: snap.content,
        contract: snap.contract ?? emptyContract(),
        branchFrom: null,
        head: v.kind === 'build' ? v.parentId : v.id,
        // Stay on the same page if the version has it.
        ui: { ...st.ui, selectedFrameId: 'mix', focusedSlotId: null, pageId: pageOf(site, st.ui.pageId).id, mode: 'unified' },
      }))
      return saved ? get().versions[saved]?.letter ?? null : null
    },
    setStatus: (versionId, status) =>
      set((st) => (st.versions[versionId] ? { versions: { ...st.versions, [versionId]: { ...st.versions[versionId], status } } } : {})),
    renameVersion: (versionId, title) =>
      set((st) => (st.versions[versionId] ? { versions: { ...st.versions, [versionId]: { ...st.versions[versionId], title } } } : {})),
    deleteVersion: (versionId) =>
      set((st) => {
        const gone = new Set([versionId, ...descendants(st.versions, versionId)])
        const versions = Object.fromEntries(Object.entries(st.versions).filter(([id]) => !gone.has(id)))
        return {
          versions,
          notes: st.notes.filter((n) => !((n.anchor.kind === 'frame' && gone.has(n.anchor.frameId)) || (n.anchor.kind === 'preview' && gone.has(n.anchor.versionId)))),
          branchFrom: st.branchFrom && gone.has(st.branchFrom) ? null : st.branchFrom,
          head: st.head && gone.has(st.head) ? null : st.head,
          ui: { ...st.ui, selectedFrameId: gone.has(st.ui.selectedFrameId ?? '') ? null : st.ui.selectedFrameId, packetSource: gone.has(st.ui.packetSource) ? 'mix' : st.ui.packetSource },
        }
      }),
    startBuild: (versionId, target, agentName = 'Claude') => {
      const st = get()
      const parent = st.versions[versionId]
      const id = uid('b')
      const node: VersionNode = {
        id,
        letter: nextLetter(st.versions, versionId),
        parentId: versionId,
        title: `${target === 'astro' ? 'Astro' : 'Next.js'} build`,
        status: 'in-progress',
        createdAt: Date.now(),
        kind: 'build',
        ...(parent.draftId ? { draftId: parent.draftId } : {}),
        snapshot: structuredClone(parent.snapshot),
        build: { by: 'reference', agentName, target, steps: [], done: false },
      }
      set({ versions: { ...st.versions, [id]: node }, agent: { versionId: id, name: agentName, step: 0 } })
      return id
    },
    updateBuild: (buildId, patch, status) =>
      set((st) => {
        const v = st.versions[buildId]
        if (!v?.build) return {}
        return { versions: { ...st.versions, [buildId]: { ...v, status: status ?? v.status, build: { ...v.build, ...patch } } } }
      }),
    setAgent: (agent) => set((st) => ({ agent: { ...st.agent, ...agent } })),
    moveFrame: (frameId, x, y) => set((st) => ({ framePos: { ...st.framePos, [frameId]: { x, y } } })),
  }
}

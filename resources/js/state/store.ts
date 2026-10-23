import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import type {
  BuildTarget,
  Choice,
  GuideState,
  Keep,
  Note,
  NoteAnchor,
  NoteColor,
  ProjectContent,
  SectionType,
  Slot,
  Status,
  TokenGroup,
  TokenKey,
  VersionNode,
} from '@/core/types'
import { DEFAULT_KEEP, SECTION_TYPES, TOKEN_GROUPS } from '@/core/types'
import { adoptDesign, choose, chooseGroup, promote, removeCandidate } from '@/core/guide'
import { autoTitle, descendants, nextLetter } from '@/core/versions'
import { library } from '@/data/library'
import { suggestClip } from '@/core/suggest'
import { buildSeed } from './seed'
import { snapshotOf } from './snapshot'

export type Mode = 'captured' | 'unified'
export type Viewport = 'desktop' | 'mobile'
/** The one surface that can be open at a time; each grows out of the control that summons it. */
export type Sheet = 'none' | 'guide' | 'packet' | 'crate' | 'menu'
export type Tool = 'select' | 'hand' | 'sticky'

export interface Camera {
  x: number
  y: number
  z: number
}

export interface AgentState {
  versionId: string | null
  name: string
  step: number
}

export interface UiState {
  mode: Mode
  viewport: Viewport
  sheet: Sheet
  guideTab: 'style' | 'copy'
  crateFilter: SectionType | 'all' | 'auto'
  tool: Tool
  theme: 'light' | 'dark'
  focusedSlotId: string | null
  selectedFrameId: string | null
  previewFrameId: string | null
  packetSource: string // 'mix' or a version id
  packetTargets: BuildTarget[]
  hintDismissed: boolean
  editingNoteId: string | null
  myName: string
}

export interface TapeData {
  tapeName: string
  slots: Slot[]
  guide: GuideState
  content: ProjectContent
  versions: Record<string, VersionNode>
  notes: Note[]
  branchFrom: string | null
  head: string | null
  framePos: Record<string, { x: number; y: number }>
}

export interface State extends TapeData {
  ui: UiState
  camera: Camera | null
  agent: AgentState
  shuffleSeq: number
  flash: { id: number; text: string; undo?: boolean } | null

  // tape
  cycle: (slotId: string, dir: 1 | -1) => void
  setClip: (slotId: string, clipId: string) => void
  shuffle: () => void
  toggleLock: (slotId: string) => void
  toggleKeep: (slotId: string, key: keyof Keep) => void
  focusSlot: (slotId: string | null) => void
  focusNext: (dir: 1 | -1) => void
  moveSlot: (slotId: string, toIndex: number) => void
  addSlot: (type: SectionType, clipId?: string, atIndex?: number) => void
  removeSlot: (slotId: string) => void
  renameTape: (name: string) => void

  // guide + copy
  promoteClip: (clipId: string, groups: TokenGroup[]) => void
  adoptClipDesign: (clipId: string, groups?: TokenGroup[]) => void
  removeCandidate: (id: string) => void
  chooseToken: (key: TokenKey, choice: Choice | null) => void
  chooseGroup: (candidateId: string) => void
  setField: (type: SectionType, key: string, value: string) => void
  setBrand: (brand: string) => void

  // versions
  pressVersion: () => string
  remix: (versionId: string) => void
  setStatus: (versionId: string, status: Status) => void
  renameVersion: (versionId: string, title: string) => void
  deleteVersion: (versionId: string) => void
  startBuild: (versionId: string, target: BuildTarget, agentName?: string) => string
  updateBuild: (buildId: string, patch: Partial<NonNullable<VersionNode['build']>>, status?: Status) => void
  setAgent: (agent: Partial<AgentState>) => void
  moveFrame: (frameId: string, x: number, y: number) => void

  // notes
  addNote: (anchor: NoteAnchor, color?: NoteColor) => string
  updateNote: (id: string, patch: Partial<Pick<Note, 'text' | 'color' | 'anchor'>>) => void
  deleteNote: (id: string) => void

  // ui
  setUi: (patch: Partial<UiState>) => void
  setCamera: (c: Camera) => void
  showFlash: (text: string, opts?: { undo?: boolean }) => void
  resetDemo: () => void
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`

const DEFAULT_UI: UiState = {
  mode: 'unified',
  viewport: 'desktop',
  sheet: 'none',
  guideTab: 'style',
  crateFilter: 'auto',
  tool: 'select',
  theme: 'light',
  focusedSlotId: null,
  selectedFrameId: null,
  previewFrameId: null,
  packetSource: 'mix',
  packetTargets: ['astro'],
  hintDismissed: false,
  editingNoteId: null,
  myName: 'Derek Castelli',
}

function pickDifferent(options: string[], current: string): string {
  if (options.length < 2) return current
  const others = options.filter((o) => o !== current)
  return others[Math.floor(Math.random() * others.length)]
}

/** Leading-edge throttle so a knob drag or typing burst is one undo step. */
function leading<T extends (...a: never[]) => void>(fn: T, ms: number): T {
  let last = 0
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last > ms) fn(...args)
    last = now
  }) as T
}

export const useStore = create<State>()(
  persist(
    temporal(
      (set, get) => {
        const updateSlot = (slotId: string, fn: (s: Slot) => Slot) =>
          set((st) => ({ slots: st.slots.map((s) => (s.id === slotId ? fn(s) : s)) }))

        return {
          ...buildSeed(library),
          ui: DEFAULT_UI,
          camera: null,
          agent: { versionId: null, name: 'Claude', step: 0 },
          shuffleSeq: 0,
          flash: null,

          cycle: (slotId, dir) =>
            updateSlot(slotId, (s) => {
              const ids = library.byType[s.type]
              if (ids.length < 2) return s
              const i = ids.indexOf(s.clipId)
              return { ...s, clipId: ids[(i + dir + ids.length) % ids.length] }
            }),
          setClip: (slotId, clipId) => updateSlot(slotId, (s) => (library.clips[clipId]?.type === s.type ? { ...s, clipId } : s)),
          shuffle: () => {
            const { slots } = get()
            if (slots.every((s) => s.locked)) return get().showFlash('Every section is locked')
            let next = slots
            // Never "shuffle" into the same arrangement.
            for (let tries = 0; tries < 8; tries++) {
              next = slots.map((s) => (s.locked ? s : { ...s, clipId: pickDifferent(library.byType[s.type], s.clipId) }))
              if (next.some((s, i) => s.clipId !== slots[i].clipId)) break
            }
            set((st) => ({ slots: next, shuffleSeq: st.shuffleSeq + 1 }))
          },
          toggleLock: (slotId) => updateSlot(slotId, (s) => ({ ...s, locked: !s.locked })),
          toggleKeep: (slotId, key) => updateSlot(slotId, (s) => ({ ...s, keep: { ...s.keep, [key]: !s.keep[key] } })),
          focusSlot: (slotId) => set((st) => ({ ui: { ...st.ui, focusedSlotId: slotId, ...(slotId ? { selectedFrameId: 'mix' } : {}) } })),
          focusNext: (dir) => {
            const { slots, ui } = get()
            if (!slots.length) return
            const i = slots.findIndex((s) => s.id === ui.focusedSlotId)
            const n = i < 0 ? (dir > 0 ? 0 : slots.length - 1) : Math.min(slots.length - 1, Math.max(0, i + dir))
            get().focusSlot(slots[n].id)
          },
          moveSlot: (slotId, toIndex) =>
            set((st) => {
              const from = st.slots.findIndex((s) => s.id === slotId)
              if (from < 0) return {}
              const slots = [...st.slots]
              const [s] = slots.splice(from, 1)
              slots.splice(Math.max(0, Math.min(slots.length, toIndex)), 0, s)
              return { slots }
            }),
          addSlot: (type, clipId, atIndex) =>
            set((st) => {
              const id = uid('slot')
              const focused = st.slots.findIndex((s) => s.id === st.ui.focusedSlotId)
              const at = atIndex ?? (focused >= 0 ? focused + 1 : defaultIndexFor(type, st.slots))
              // With no clip named, take the one that suits this spot best.
              const slot: Slot = { id, type, clipId: clipId ?? suggestClip(type, st.slots, at, library)[0]?.clipId, locked: false, keep: { ...DEFAULT_KEEP } }
              if (!slot.clipId) return {}
              const slots = [...st.slots]
              slots.splice(at, 0, slot)
              return { slots, ui: { ...st.ui, focusedSlotId: id, selectedFrameId: 'mix' } }
            }),
          removeSlot: (slotId) =>
            set((st) => {
              const i = st.slots.findIndex((s) => s.id === slotId)
              const slots = st.slots.filter((s) => s.id !== slotId)
              const focus = slots[Math.min(i, slots.length - 1)]?.id ?? null
              return { slots, notes: st.notes.filter((n) => !(n.anchor.kind === 'slot' && n.anchor.slotId === slotId)), ui: { ...st.ui, focusedSlotId: focus } }
            }),
          renameTape: (tapeName) => set({ tapeName }),

          promoteClip: (clipId, groups) => {
            const clip = library.clips[clipId]
            if (clip) set((st) => ({ guide: promote(st.guide, clip, groups) }))
          },
          adoptClipDesign: (clipId, groups = [...TOKEN_GROUPS]) => {
            const clip = library.clips[clipId]
            if (clip) set((st) => ({ guide: adoptDesign(st.guide, clip, groups) }))
          },
          removeCandidate: (id) => set((st) => ({ guide: removeCandidate(st.guide, id) })),
          chooseToken: (key, choice) => set((st) => ({ guide: choose(st.guide, key, choice) })),
          chooseGroup: (candidateId) => set((st) => ({ guide: chooseGroup(st.guide, candidateId) })),
          setField: (type, key, value) =>
            set((st) => ({
              content: { ...st.content, fields: { ...st.content.fields, [type]: { ...(st.content.fields[type] ?? {}), [key]: value } } },
            })),
          setBrand: (brand) => set((st) => ({ content: { ...st.content, brand } })),

          pressVersion: () => {
            const st = get()
            const id = uid('v')
            const parentId = st.branchFrom && st.versions[st.branchFrom] ? st.branchFrom : null
            const node: VersionNode = {
              id,
              letter: nextLetter(st.versions, parentId),
              parentId,
              title: autoTitle(st.slots, library),
              status: 'in-progress',
              createdAt: Date.now(),
              kind: 'snapshot',
              snapshot: snapshotOf(st),
            }
            set({ versions: { ...st.versions, [id]: node }, head: id, ui: { ...st.ui, selectedFrameId: id } })
            return id
          },
          remix: (versionId) => {
            const v = get().versions[versionId]
            if (!v) return
            const snap = structuredClone(v.snapshot)
            const slots = snap.slots.filter((s) => library.clips[s.clipId])
            set((st) => ({
              slots,
              guide: snap.guide,
              content: snap.content,
              branchFrom: v.kind === 'build' ? v.parentId : v.id,
              head: v.kind === 'build' ? v.parentId : v.id,
              ui: { ...st.ui, selectedFrameId: 'mix', focusedSlotId: slots[0]?.id ?? null, mode: 'unified' },
            }))
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
                notes: st.notes.filter((n) => !(n.anchor.kind === 'frame' && gone.has(n.anchor.frameId))),
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

          addNote: (anchor, color = 'yellow') => {
            const id = uid('n')
            set((st) => ({ notes: [...st.notes, { id, text: '', color, anchor, createdAt: Date.now() }], ui: { ...st.ui, editingNoteId: id, tool: 'select' } }))
            return id
          },
          updateNote: (id, patch) => set((st) => ({ notes: st.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
          deleteNote: (id) => set((st) => ({ notes: st.notes.filter((n) => n.id !== id) })),

          setUi: (patch) => set((st) => ({ ui: { ...st.ui, ...patch } })),
          setCamera: (camera) => set({ camera }),
          showFlash: (text, opts) => set((st) => ({ flash: { id: (st.flash?.id ?? 0) + 1, text, undo: opts?.undo } })),
          resetDemo: () => {
            set((st) => ({ ...buildSeed(library), ui: { ...DEFAULT_UI, theme: st.ui.theme, hintDismissed: st.ui.hintDismissed }, camera: null, agent: { versionId: null, name: 'Claude', step: 0 } }))
            useStore.temporal.getState().clear()
          },
        }
      },
      {
        limit: 100,
        partialize: (s) => ({ slots: s.slots, guide: s.guide, content: s.content, versions: s.versions, notes: s.notes, branchFrom: s.branchFrom, head: s.head }),
        equality: (a, b) =>
          a.slots === b.slots && a.guide === b.guide && a.content === b.content && a.versions === b.versions && a.notes === b.notes,
        handleSet: (handleSet) => leading(handleSet, 400),
      },
    ),
    {
      name: 'mixtape:v1',
      version: 1,
      partialize: (s) => ({
        tapeName: s.tapeName,
        slots: s.slots,
        guide: s.guide,
        content: s.content,
        versions: s.versions,
        notes: s.notes,
        branchFrom: s.branchFrom,
        head: s.head,
        framePos: s.framePos,
        ui: { ...s.ui, previewFrameId: null, editingNoteId: null, sheet: 'none' },
        camera: s.camera,
      }),
      merge: (persisted, current) => {
        // "proof" sections became "testimonials": rewrite ids and types in saved tapes.
        const migrated = JSON.parse(
          JSON.stringify(persisted ?? {})
            .replace(/"proof\./g, '"testimonials.')
            .replace(/"type":"proof"/g, '"type":"testimonials"')
            .replace(/mx-proof-/g, 'mx-testimonials-'),
        )
        const p = migrated as Partial<State>
        const merged = { ...current, ...p, ui: { ...current.ui, ...(p.ui ?? {}) } } as State
        // Drop anything that points at clips that no longer exist in the sample library.
        merged.slots = (merged.slots ?? []).filter((s) => library.clips[s.clipId])
        // One framework per hand-off.
        merged.ui.packetTargets = (merged.ui.packetTargets ?? ['astro']).slice(0, 1)
        for (const [id, v] of Object.entries(merged.versions ?? {})) {
          if (v.build && !v.build.done) merged.versions[id] = { ...v, status: 'changes', build: { ...v.build, done: true } }
        }
        return merged
      },
    },
  ),
)

const TYPE_ORDER: SectionType[] = [...SECTION_TYPES]
function defaultIndexFor(type: SectionType, slots: Slot[]): number {
  const rank = TYPE_ORDER.indexOf(type)
  const i = slots.findIndex((s) => TYPE_ORDER.indexOf(s.type) > rank)
  return i < 0 ? slots.length : i
}

export const undo = () => useStore.temporal.getState().undo()
export const redo = () => useStore.temporal.getState().redo()
export const pauseHistory = () => useStore.temporal.getState().pause()
export const resumeHistory = () => useStore.temporal.getState().resume()

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import type {
  BlockEdit,
  BlockKind,
  BlockMotion,
  BlockStyle,
  BuildTarget,
  Choice,
  GuideState,
  Keep,
  Note,
  NoteAnchor,
  NoteColor,
  NoteKind,
  NoteSource,
  NoteStatus,
  ProjectContent,
  SectionMotion,
  SectionSpacing,
  SectionType,
  Slot,
  Status,
  TokenGroup,
  TokenKey,
  VersionNode,
} from '@/core/types'
import { DEFAULT_KEEP, SECTION_TYPES, TOKEN_GROUPS } from '@/core/types'
import { adoptDesign, choose, chooseGroup, promote, removeCandidate } from '@/core/guide'
import { library, slotClip } from '@/data/library'
import { BANNER_ID } from '@/core/banner'
import { editList as applyListEdit, ListError, listOrder, type ListOp } from '@/core/lists'
import { keepOption, putBackOption, retireOption, showWords } from '@/core/words'
import { suggestClip } from '@/core/suggest'
import { BASE_TOKENS } from '@/core/tokens'
import { buildSeed } from './seed'
import { onSection } from '@/core/notes'
import { uid } from './uid'
import { versionActions } from './slices/versions'
import { noteActions } from './slices/notes'
import { DEFAULT_CONTENT } from '@/core/content'

export type Mode = 'captured' | 'unified'
export type Viewport = 'desktop' | 'mobile'
/** The one surface that can be open at a time; each grows out of the control that summons it. */
export type Sheet = 'none' | 'guide' | 'packet' | 'crate' | 'menu' | 'notes'
export type Tool = 'select' | 'hand' | 'sticky' | 'note'

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
  guideTab: 'style' | 'content'
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
  /** The block selected inside the focused section (b3), if any. */
  selectedBlockId: string | null
  /** Let a local agent (via the MCP bridge) edit this mix. Off until you turn it on. */
  agentAccess: boolean
  /** The mark whose card is open on the canvas. */
  openNoteId: string | null
}

export interface MixData {
  mixName: string
  slots: Slot[]
  guide: GuideState
  content: ProjectContent
  versions: Record<string, VersionNode>
  notes: Note[]
  branchFrom: string | null
  head: string | null
  framePos: Record<string, { x: number; y: number }>
}

export interface State extends MixData {
  ui: UiState
  camera: Camera | null
  agent: AgentState
  shuffleSeq: number
  flash: { id: number; text: string; undo?: boolean } | null

  // mix
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

  // blocks
  selectBlock: (blockId: string | null) => void
  /** Patch a block of the section's current clip; null clears its edit. */
  editBlock: (slotId: string, blockId: string, patch: Partial<BlockEdit> | null) => void
  setWord: (slotId: string, field: string, value: string | null) => void
  /** Navs: show or remove an announcement banner (the clip's own, or one added above it). */
  setBanner: (slotId: string, on: boolean) => void
  /** Add, duplicate, remove or move a list's items. Returns the item to select (a new one), or null if it couldn't. */
  editList: (slotId: string, change: ListOp) => { itemId: string | null } | null
  /** Keep words as an option for a field ("Keep as an option"). */
  keepWords: (slotId: string, field: string, text: string, by?: 'you' | 'agent') => void
  retireWords: (slotId: string, field: string, text: string) => void
  putBackWords: (slotId: string, field: string, text: string) => void
  /** Show one of a field's options. */
  chooseWords: (slotId: string, field: string, text: string) => void
  setSectionSpacing: (slotId: string, patch: Partial<SectionSpacing>) => void
  /** null = as clipped. */
  setSectionMotion: (slotId: string, motion: SectionMotion | null) => void
  /** Make this block's variant and style the default for every block of its kind. */
  promoteBlock: (slotId: string, blockId: string) => void
  clearComponent: (kind: BlockKind) => void
  addSwatch: (name: string, value: string) => string
  removeSwatch: (id: string) => void
  renameMix: (name: string) => void

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
  updateNote: (id: string, patch: Partial<Pick<Note, 'text' | 'color' | 'anchor' | 'kind' | 'suggestedCopy'>>) => void
  /** A mark: feedback with a kind, pinned to a block, an area or the page. */
  addMark: (m: { anchor: NoteAnchor; kind: NoteKind; text: string; suggestedCopy?: string; source?: NoteSource; author?: string }) => string
  setMarkStatus: (id: string, status: NoteStatus, resolution?: string) => void
  replyToMark: (id: string, text: string, source?: NoteSource, author?: string) => void
  deleteNote: (id: string) => void

  // ui
  setUi: (patch: Partial<UiState>) => void
  setCamera: (c: Camera) => void
  showFlash: (text: string, opts?: { undo?: boolean }) => void
  resetDemo: () => void
}



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
  selectedBlockId: null,
  agentAccess: false,
  openNoteId: null,
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

/** Where saved work lives in this browser. Before the rename it lived under the old name. */
export const STORAGE_KEY = 'blokmix:v1'
const LEGACY_KEY = 'mixtape:v1'

/**
 * Storage that reads saved work from before the rename when there's none under
 * the new name, and forgets the old copy once the new one is written.
 */
export function carryOver(ls: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  return {
    getItem: (k: string) => ls.getItem(k) ?? (k === STORAGE_KEY ? ls.getItem(LEGACY_KEY) : null),
    setItem: (k: string, v: string) => {
      ls.setItem(k, v)
      if (k === STORAGE_KEY) ls.removeItem(LEGACY_KEY)
    },
    removeItem: (k: string) => ls.removeItem(k),
  }
}

/** Saved state in today's words: "proof" sections are "testimonials", and what was the tape's name is the mix's. */
export function renamedState(persisted: unknown): Record<string, unknown> {
  const p = JSON.parse(
    JSON.stringify(persisted ?? {})
      .replace(/"proof\./g, '"testimonials.')
      .replace(/"type":"proof"/g, '"type":"testimonials"')
      .replace(/mx-proof-/g, 'mx-testimonials-'),
  ) as Record<string, unknown>
  // Saved before the rename: the mix's name was "tapeName".
  const old = 'tape' + 'Name'
  if (typeof p[old] === 'string' && p.mixName === undefined) p.mixName = p[old]
  delete p[old]
  return p
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
          focusSlot: (slotId) =>
            set((st) => ({
              ui: {
                ...st.ui,
                focusedSlotId: slotId,
                selectedBlockId: slotId === st.ui.focusedSlotId ? st.ui.selectedBlockId : null,
                ...(slotId ? { selectedFrameId: 'mix' } : {}),
              },
            })),

          selectBlock: (blockId) => set((st) => ({ ui: { ...st.ui, selectedBlockId: blockId } })),
          setBanner: (slotId, on) => {
            const slot = get().slots.find((s) => s.id === slotId)
            if (!slot || slot.type !== 'nav') return
            const own = slotClip({ ...slot, banner: false }).blocks.find((b) => b.kind === 'banner')
            if (own) get().editBlock(slotId, own.id, { hidden: on ? undefined : true })
            else updateSlot(slotId, (s) => ({ ...s, banner: on || undefined }))
          },
          editBlock: (slotId, blockId, patch) =>
            updateSlot(slotId, (s) => {
              // Hiding an added banner removes it.
              if (blockId === BANNER_ID && patch?.hidden) return { ...s, banner: undefined }
              const forClip = { ...(s.edits?.[s.clipId] ?? {}) }
              if (patch === null) delete forClip[blockId]
              else {
                const next: BlockEdit = { ...forClip[blockId], ...patch }
                if (patch.style !== undefined) next.style = patch.style && Object.keys(patch.style).length ? { ...forClip[blockId]?.style, ...patch.style } : undefined
                if (patch.motion !== undefined) {
                  const m = patch.motion && Object.keys(patch.motion).length ? { ...forClip[blockId]?.motion, ...patch.motion } : undefined
                  if (m) for (const k of Object.keys(m) as (keyof BlockMotion)[]) if (m[k] === undefined) delete m[k]
                  next.motion = m && Object.keys(m).length ? m : undefined
                }
                for (const k of Object.keys(next) as (keyof BlockEdit)[]) if (next[k] === undefined) delete next[k]
                if (next.style) for (const k of Object.keys(next.style) as (keyof BlockStyle)[]) if (next.style[k] === undefined) delete next.style[k]
                if (next.style && !Object.keys(next.style).length) delete next.style
                if (Object.keys(next).length) forClip[blockId] = next
                else delete forClip[blockId]
              }
              return { ...s, edits: { ...s.edits, [s.clipId]: forClip } }
            }),
          setWord: (slotId, field, value) =>
            updateSlot(slotId, (s) => {
              const words = { ...s.words }
              if (value === null) delete words[field]
              else words[field] = value
              return { ...s, words }
            }),
          editList: (slotId, change) => {
            const slot = get().slots.find((s) => s.id === slotId)
            if (!slot) return null
            const clip = slotClip(slot)
            let next: Slot
            try {
              next = applyListEdit(slot, clip, get().content, change)
            } catch (e) {
              if (e instanceof ListError) {
                get().showFlash(e.message)
                return null
              }
              throw e
            }
            updateSlot(slotId, () => next)
            // The new item, for add and duplicate, so it can be selected.
            if (change.op !== 'add' && change.op !== 'duplicate') return { itemId: null }
            const listId = change.op === 'add' ? change.listId : clip.blocks.find((b) => b.id === change.itemId)?.parent
            const before = new Set(listOrder(clip, listId ?? ''))
            const after = slotClip(next)
            const added = after.blocks.find((b) => b.parent === listId && b.kind === 'item' && b.n != null && !before.has(b.n))
            return { itemId: added?.id ?? null }
          },
          keepWords: (slotId, field, text, by = 'you') => updateSlot(slotId, (s) => keepOption(s, field, text, by)),
          retireWords: (slotId, field, text) => updateSlot(slotId, (s) => retireOption(s, field, text)),
          putBackWords: (slotId, field, text) => updateSlot(slotId, (s) => putBackOption(s, field, text)),
          chooseWords: (slotId, field, text) => updateSlot(slotId, (s) => showWords(s, slotClip(s), get().content, field, text)),
          setSectionSpacing: (slotId, patch) =>
            updateSlot(slotId, (s) => {
              const spacing = { ...s.spacing, ...patch }
              for (const k of Object.keys(spacing) as (keyof SectionSpacing)[]) if (!spacing[k] || spacing[k] === 'default') delete spacing[k]
              return { ...s, spacing: Object.keys(spacing).length ? spacing : undefined }
            }),
          setSectionMotion: (slotId, motion) =>
            updateSlot(slotId, (s) => {
              if (!motion || motion.mode === 'captured') return { ...s, motion: undefined, keep: { ...s.keep, motion: true } }
              // "None" also means the clip's own motion stays off, in the packet too.
              return { ...s, motion, keep: { ...s.keep, motion: motion.mode !== 'none' } }
            }),
          promoteBlock: (slotId, blockId) => {
            const st = get()
            const slot = st.slots.find((x) => x.id === slotId)
            const block = slot && slotClip(slot).blocks.find((b) => b.id === blockId)
            const edit = slot?.edits?.[slot.clipId]?.[blockId]
            if (!slot || !block || !edit) return
            set((s) => ({
              guide: { ...s.guide, components: { ...s.guide.components, [block.kind]: { variant: edit.variant, style: edit.style } } },
            }))
            // The block now just follows the page default.
            get().editBlock(slotId, blockId, edit.hidden ? { variant: undefined, style: undefined } : null)
          },
          clearComponent: (kind) =>
            set((s) => {
              const components = { ...s.guide.components }
              delete components[kind]
              return { guide: { ...s.guide, components } }
            }),
          addSwatch: (name, value) => {
            const id = uid('sw')
            set((s) => ({ guide: { ...s.guide, swatches: [...(s.guide.swatches ?? []), { id, name, value }] } }))
            return id
          },
          removeSwatch: (id) => set((s) => ({ guide: { ...s.guide, swatches: (s.guide.swatches ?? []).filter((w) => w.id !== id) } })),
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
              return { slots, notes: st.notes.filter((n) => onSection(n.anchor) !== slotId), ui: { ...st.ui, focusedSlotId: focus } }
            }),
          renameMix: (mixName) => set({ mixName }),

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

          ...versionActions(set, get),
          ...noteActions(set),

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
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => carryOver(localStorage)),
      partialize: (s) => ({
        mixName: s.mixName,
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
        const p = renamedState(persisted) as Partial<State>
        const merged = { ...current, ...p, ui: { ...current.ui, ...(p.ui ?? {}) } } as State
        // Tokens added since the mix was saved (e.g. line weight) start at their defaults.
        if (merged.guide?.base) merged.guide = { ...merged.guide, base: { ...BASE_TOKENS, ...merged.guide.base } }
        // Drop anything that points at clips that no longer exist in the sample library.
        merged.slots = (merged.slots ?? []).filter((s) => library.clips[s.clipId])
        // Copy fields added since the mix was saved (a nav banner's messages) start from the defaults.
        if (merged.content?.fields) {
          const fields = { ...merged.content.fields }
          for (const [type, defaults] of Object.entries(DEFAULT_CONTENT.fields) as [SectionType, Record<string, string>][]) {
            const mine = fields[type] ?? {}
            const missing = Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in mine)))
            if (Object.keys(missing).length) fields[type] = { ...mine, ...missing }
          }
          merged.content = { ...merged.content, fields }
        }
        // The Copy tab became Content.
        if ((merged.ui.guideTab as string) === 'copy') merged.ui.guideTab = 'content'
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

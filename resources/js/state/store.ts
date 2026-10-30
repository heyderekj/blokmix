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
  MobileSpacing,
  SectionType,
  Page,
  Site,
  Slot,
  Source,
  Status,
  TokenGroup,
  TokenKey,
  VersionNode,
} from '@/core/types'
import { DEFAULT_KEEP, SECTION_TYPES, TOKEN_GROUPS } from '@/core/types'
import { adoptDesign, choose, chooseGroup, emptyGuide, promote, promoteSource, removeCandidate, SOURCE_PREFIX } from '@/core/guide'
import { library, slotClip } from '@/data/library'
import { pickable } from '@/core/library'
import { BANNER_ID } from '@/core/banner'
import { editList as applyListEdit, ListError, listOrder, type ListOp } from '@/core/lists'
import { keepOption, putBackOption, retireOption, showWords } from '@/core/words'
import { suggestClip } from '@/core/suggest'
import type { FacetFilter } from '@/core/browse'
import { listOpOnEntries } from './collections'
import { BASE_TOKENS } from '@/core/tokens'
import { cleanTreatment, shadowToken, type EffectId, type EffectsState, type TreatmentValue } from '@/core/treatments'
import { buildSeed } from './seed'
import { allSlots, freePath, mapSlots, pageOf, pageOfSlot, pageView, setPageSlots, siteFromSlots, titleFromPath, updatePage as updatePageIn, updateSlotIn } from '@/core/site'
import { onSection } from '@/core/notes'
import { uid } from './uid'
import { versionActions } from './slices/versions'
import { noteActions } from './slices/notes'
import { DEFAULT_CONTENT } from '@/core/content'

export type Mode = 'captured' | 'unified'
export type Viewport = 'desktop' | 'mobile'
/** The one surface that can be open at a time; each grows out of the control that summons it. */
export type Sheet = 'none' | 'guide' | 'packet' | 'crate' | 'looks' | 'menu' | 'notes' | 'pages' | 'share'
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
  /** Searching and filtering the Crate (`core/browse.ts`). */
  crateQuery: string
  crateFacets: FacetFilter
  /** The Content panel: the page's words, or your collections (and which one is open). */
  contentView: 'words' | 'collections'
  openCollection: string | null
  /** A collection's template page shows one entry at a time: which, by page id. */
  previewEntry: Record<string, string>
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
  /** The page open on the canvas (null: the first). */
  pageId: string | null
}

export interface MixData {
  mixName: string
  /** The pages, and the nav and footer they share. */
  site: Site
  guide: GuideState
  content: ProjectContent
  versions: Record<string, VersionNode>
  notes: Note[]
  branchFrom: string | null
  head: string | null
  framePos: Record<string, { x: number; y: number }>
  /**
   * This mix's own clips (ids): its shelf and Crate show them first, and clips added while it's open join it. The
   * account's whole library stays a tab away; a clip used on the page counts as the mix's too (mixClipIds).
   */
  clips: string[]
}

export interface State extends MixData {
  ui: UiState
  camera: Camera | null
  agent: AgentState
  shuffleSeq: number
  /** undo: 'collections' takes back a change to your collections (their own history) instead of the mix's. */
  flash: { id: number; text: string; undo?: boolean | 'collections' } | null

  // mix
  cycle: (slotId: string, dir: 1 | -1) => void
  setClip: (slotId: string, clipId: string) => void
  shuffle: () => void
  toggleLock: (slotId: string) => void
  toggleKeep: (slotId: string, key: keyof Keep) => void
  focusSlot: (slotId: string | null) => void
  focusNext: (dir: 1 | -1) => void
  moveSlot: (slotId: string, toIndex: number) => void
  /** Add a section to a page (the open one by default) at a position in its view; a nav or footer becomes the site's shared one. */
  addSlot: (type: SectionType, clipId?: string, atIndex?: number, pageId?: string, extra?: Pick<Slot, 'inspiredBy'>) => void
  removeSlot: (slotId: string) => void

  // pages
  openPage: (pageId: string) => void
  addPage: (p?: { path?: string; title?: string; slots?: Slot[]; show?: Partial<Page['show']>; open?: boolean; template?: Page['template'] }) => string
  updatePage: (pageId: string, patch: { path?: string; title?: string; show?: Partial<Page['show']> }) => void
  removePage: (pageId: string) => void
  movePage: (pageId: string, toIndex: number) => void
  duplicatePage: (pageId: string) => string

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
  setSurface: (slotId: string, surface: Slot['surface']) => void
  /** null = as clipped. */
  setSectionMotion: (slotId: string, motion: SectionMotion | null) => void
  /** Make this block's variant and style the default for every block of its kind. */
  promoteBlock: (slotId: string, blockId: string) => void
  clearComponent: (kind: BlockKind) => void
  addSwatch: (name: string, value: string) => string
  removeSwatch: (id: string) => void
  renameMix: (name: string) => void
  /** Add clips to this mix's own set (already there: no change). */
  addMixClips: (ids: string[]) => void
  /** Take a clip out of this mix's set (it stays in your library, and on the page if it's used). */
  removeMixClip: (id: string) => void
  /** Swap in another style guide (a saved one, or another mix's), as one undo step. */
  replaceGuide: (guide: GuideState) => void
  /** Start over from a starter mix's pages and style guide (one undo step); words, notes and versions stay. */
  startFrom: (site: Site, guide: GuideState) => void

  // guide + copy
  promoteClip: (clipId: string, groups: TokenGroup[]) => void
  adoptClipDesign: (clipId: string, groups?: TokenGroup[]) => void
  /** A whole site's look (from the site library) as candidates, `src:site:<slug>#<group>`; adopt makes it win them. */
  promoteSite: (source: Source, groups?: TokenGroup[], adopt?: boolean) => void
  /** Credit (or stop crediting) the real site a section's layout was matched from. */
  setInspiredBy: (slotId: string, inspiredBy: Slot['inspiredBy'] | null) => void
  removeCandidate: (id: string) => void
  chooseToken: (key: TokenKey, choice: Choice | null) => void
  /** Set several tokens to your own values at once (a dial, light/dark): one undo step. */
  chooseTokens: (values: Partial<Record<TokenKey, string>>) => void
  chooseGroup: (candidateId: string) => void
  /** Set (or clear, with null) one of the style guide's effects; the shadow effect is also the card shadow token. */
  setEffect: (id: EffectId, value: TreatmentValue | null) => void
  /** Set several effects at once (a curated look, a library site's look kit), as one undo step. */
  setEffects: (effects: EffectsState, replace?: boolean) => void
  /** What's behind a section (null = as clipped). */
  setBackdrop: (slotId: string, value: TreatmentValue | null) => void
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
  showFlash: (text: string, opts?: { undo?: boolean | 'collections' }) => void
  resetDemo: () => void
}



const DEFAULT_UI: UiState = {
  mode: 'unified',
  viewport: 'desktop',
  sheet: 'none',
  guideTab: 'style',
  crateFilter: 'auto',
  crateQuery: '',
  crateFacets: {},
  contentView: 'words',
  openCollection: null,
  previewEntry: {},
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
  pageId: null,
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

/** The mix kept in this browser (the default, and what "local" opens). */
export const localMixStorage = () => createJSONStorage<Persisted>(() => carryOver(localStorage))

/** What the store saves: the mix itself plus this device's view of it (ui, camera). */
export type Persisted = MixData & { ui: UiState; camera: Camera | null }

/** The sections of the page open on the canvas, top to bottom (shared nav and footer included). */
/** The page to show a section on: its own, or for the shared nav and footer this one if it shows them. */
function pageFor(site: Site, slotId: string, here: string | null): string | null {
  const own = pageOfSlot(site, slotId)
  if (own) return own.id
  if (pageView(site, here).some((s) => s.id === slotId)) return here
  const kind = site.shared.nav?.id === slotId ? 'nav' : 'footer'
  return site.pages.find((p) => p.show[kind])?.id ?? here
}

export const currentSlots = (st: Pick<State, 'site' | 'ui'>) => pageView(st.site, st.ui.pageId)

/**
 * Saved state from before pages: one list of sections becomes a site (its nav
 * and footer shared, the rest the home page), in the mix and in every version.
 */
export function siteState(persisted: Record<string, unknown>): Record<string, unknown> {
  const p = { ...persisted }
  const toSite = <T extends Record<string, unknown>>(o: T): T => {
    if (!o || o.site || !Array.isArray(o.slots)) return o
    const { slots, ...rest } = o
    return { ...rest, site: siteFromSlots(slots as Slot[]) } as unknown as T
  }
  Object.assign(p, toSite(p))
  delete p.slots
  if (p.versions && typeof p.versions === 'object')
    p.versions = Object.fromEntries(
      Object.entries(p.versions as Record<string, VersionNode>).map(([id, v]) => [id, v.snapshot ? { ...v, snapshot: toSite(v.snapshot as unknown as Record<string, unknown>) } : v]),
    )
  return p
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
        const updateSlot = (slotId: string, fn: (s: Slot) => Slot) => set((st) => ({ site: updateSlotIn(st.site, slotId, fn) }))

        return {
          ...buildSeed(library),
          ui: DEFAULT_UI,
          camera: null,
          agent: { versionId: null, name: 'Claude', step: 0 },
          shuffleSeq: 0,
          flash: null,

          cycle: (slotId, dir) =>
            updateSlot(slotId, (s) => {
              const ids = pickable(library, s.type)
              if (ids.length < 2) return s
              const i = ids.indexOf(s.clipId)
              return { ...s, clipId: ids[(i + dir + ids.length) % ids.length] }
            }),
          setClip: (slotId, clipId) => updateSlot(slotId, (s) => (library.clips[clipId]?.type === s.type ? { ...s, clipId } : s)),
          shuffle: () => {
            const st = get()
            const view = currentSlots(st)
            if (view.every((s) => s.locked)) return st.showFlash('Every section is locked')
            let picks = new Map<string, string>()
            // Never "shuffle" into the same arrangement.
            for (let tries = 0; tries < 8; tries++) {
              picks = new Map(view.filter((s) => !s.locked).map((s) => [s.id, pickDifferent(pickable(library, s.type), s.clipId)]))
              if (view.some((s) => picks.has(s.id) && picks.get(s.id) !== s.clipId)) break
            }
            set((x) => ({ site: mapSlots(x.site, (s) => (picks.has(s.id) ? { ...s, clipId: picks.get(s.id)! } : s)), shuffleSeq: x.shuffleSeq + 1 }))
          },
          toggleLock: (slotId) => updateSlot(slotId, (s) => ({ ...s, locked: !s.locked })),
          toggleKeep: (slotId, key) => updateSlot(slotId, (s) => ({ ...s, keep: { ...s.keep, [key]: !s.keep[key] } })),
          focusSlot: (slotId) =>
            set((st) => ({
              ui: {
                ...st.ui,
                // A section on another page opens that page (a shared one stays put while it's shown here).
                pageId: slotId ? pageFor(st.site, slotId, st.ui.pageId) : st.ui.pageId,
                focusedSlotId: slotId,
                selectedBlockId: slotId === st.ui.focusedSlotId ? st.ui.selectedBlockId : null,
                ...(slotId ? { selectedFrameId: 'mix' } : {}),
              },
            })),

          selectBlock: (blockId) => set((st) => ({ ui: { ...st.ui, selectedBlockId: blockId } })),
          setBanner: (slotId, on) => {
            const slot = allSlots(get().site).find((s) => s.id === slotId)
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
                if (patch.mobile !== undefined) {
                  // Phones: merged like style; a value that matches desktop (or nothing set) falls away.
                  const cur = forClip[blockId]?.mobile
                  const ms = patch.mobile && patch.mobile.style !== undefined ? (patch.mobile.style ? { ...cur?.style, ...patch.mobile.style } : {}) : { ...cur?.style }
                  for (const k of Object.keys(ms) as (keyof MobileSpacing)[]) if (ms[k] === undefined || ms[k] === next.style?.[k]) delete ms[k]
                  const hidden = patch.mobile && 'hidden' in patch.mobile ? patch.mobile.hidden : cur?.hidden
                  const m = { ...(Object.keys(ms).length ? { style: ms } : {}), ...(hidden ? { hidden: true } : {}) }
                  next.mobile = Object.keys(m).length ? m : undefined
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
            const slot = allSlots(get().site).find((s) => s.id === slotId)
            if (!slot) return null
            // A list that shows a collection: the op changes its entries (their own history).
            const onEntries = listOpOnEntries(slot, change, get().site)
            if (onEntries) {
              if (onEntries.message) get().showFlash(onEntries.message, { undo: 'collections' })
              return { itemId: null }
            }
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
          setSurface: (slotId, surface) => updateSlot(slotId, (s) => ({ ...s, surface: surface === 'page' ? undefined : surface })),
          setSectionSpacing: (slotId, patch) =>
            updateSlot(slotId, (s) => {
              const spacing = { ...s.spacing, ...patch }
              for (const k of ['top', 'bottom'] as const) if (!spacing[k] || spacing[k] === 'default') delete spacing[k]
              // Phones: merged; a side that matches desktop falls away.
              const mobile = { ...s.spacing?.mobile, ...patch.mobile }
              for (const k of ['top', 'bottom'] as const) if (!mobile[k] || mobile[k] === (spacing[k] ?? 'default')) delete mobile[k]
              if (Object.keys(mobile).length) spacing.mobile = mobile
              else delete spacing.mobile
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
            const slot = allSlots(st.site).find((x) => x.id === slotId)
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
            const st = get()
            const slots = currentSlots(st)
            if (!slots.length) return
            const i = slots.findIndex((s) => s.id === st.ui.focusedSlotId)
            const n = i < 0 ? (dir > 0 ? 0 : slots.length - 1) : Math.min(slots.length - 1, Math.max(0, i + dir))
            st.focusSlot(slots[n].id)
          },
          moveSlot: (slotId, toIndex) =>
            set((st) => {
              // The shared nav stays first and the footer last; a page's own sections move between them.
              const page = pageOfSlot(st.site, slotId)
              if (!page) return {}
              const offset = st.site.shared.nav && page.show.nav ? 1 : 0
              const slots = page.slots.filter((s) => s.id !== slotId)
              const moving = page.slots.find((s) => s.id === slotId)!
              slots.splice(Math.max(0, Math.min(slots.length, toIndex - offset)), 0, moving)
              return { site: setPageSlots(st.site, page.id, slots) }
            }),
          addSlot: (type, clipId, atIndex, pageId, extra) => {
            const st = get()
            const page = pageOf(st.site, pageId ?? st.ui.pageId)
            const view = pageView(st.site, page.id)
            const focused = view.findIndex((s) => s.id === st.ui.focusedSlotId)
            const at = atIndex ?? (focused >= 0 ? focused + 1 : defaultIndexFor(type, view))
            const chrome = type === 'nav' || type === 'footer' ? type : null
            if (chrome && st.site.shared[chrome]) {
              // One nav and one footer for the whole site: show it here, or say where it already is.
              if (!page.show[chrome]) {
                set((x) => ({ site: updatePageIn(x.site, page.id, { show: { ...page.show, [chrome]: true } }) }))
                return st.showFlash(`Showing the site ${chrome} on this page`, { undo: true })
              }
              return st.showFlash(`The site already has a ${chrome}. Swap its clip instead.`)
            }
            // With no clip named, take the one that suits this spot best.
            const slot: Slot = { id: uid('slot'), type, clipId: clipId ?? suggestClip(type, view, at, library)[0]?.clipId, locked: false, keep: { ...DEFAULT_KEEP }, ...(extra?.inspiredBy ? { inspiredBy: extra.inspiredBy } : {}) }
            if (!slot.clipId) return
            set((x) => {
              let site: Site
              if (chrome) site = updatePageIn({ ...x.site, shared: { ...x.site.shared, [chrome]: slot } }, page.id, { show: { ...page.show, [chrome]: true } })
              else {
                const offset = x.site.shared.nav && page.show.nav ? 1 : 0
                const slots = [...page.slots]
                slots.splice(Math.max(0, Math.min(slots.length, at - offset)), 0, slot)
                site = setPageSlots(x.site, page.id, slots)
              }
              return { site, ui: { ...x.ui, pageId: page.id, focusedSlotId: slot.id, selectedFrameId: 'mix' } }
            })
          },
          removeSlot: (slotId) =>
            set((st) => {
              const view = currentSlots(st)
              const i = view.findIndex((s) => s.id === slotId)
              const { nav, footer } = st.site.shared
              // Removing the shared nav or footer takes it off every page.
              const site: Site =
                nav?.id === slotId
                  ? { ...st.site, shared: { ...st.site.shared, nav: undefined } }
                  : footer?.id === slotId
                    ? { ...st.site, shared: { ...st.site.shared, footer: undefined } }
                    : { ...st.site, pages: st.site.pages.map((p) => ({ ...p, slots: p.slots.filter((s) => s.id !== slotId) })) }
              const rest = view.filter((s) => s.id !== slotId)
              const focus = rest[Math.min(i, rest.length - 1)]?.id ?? null
              return { site, notes: st.notes.filter((n) => onSection(n.anchor) !== slotId), ui: { ...st.ui, focusedSlotId: focus } }
            }),

          openPage: (pageId) => set((st) => ({ ui: { ...st.ui, pageId, focusedSlotId: null, selectedBlockId: null, selectedFrameId: 'mix' } })),
          addPage: (p = {}) => {
            const id = uid('page')
            set((st) => {
              const path = freePath(st.site, p.path ?? `/page-${st.site.pages.length + 1}`)
              const page: Page = { id, path, title: p.title?.trim() || titleFromPath(path), slots: p.slots ?? [], show: { nav: true, footer: true, ...p.show }, ...(p.template ? { template: p.template } : {}) }
              return { site: { ...st.site, pages: [...st.site.pages, page] }, ...(p.open === false ? {} : { ui: { ...st.ui, pageId: id, focusedSlotId: null, selectedBlockId: null } }) }
            })
            return id
          },
          updatePage: (pageId, patch) =>
            set((st) => {
              const page = pageOf(st.site, pageId)
              const others = { ...st.site, pages: st.site.pages.filter((x) => x.id !== page.id) }
              const path = patch.path !== undefined ? freePath(others, patch.path) : page.path
              return { site: updatePageIn(st.site, page.id, { path, title: patch.title?.trim() || page.title, show: { ...page.show, ...patch.show } }) }
            }),
          removePage: (pageId) =>
            set((st) => {
              if (st.site.pages.length < 2) return {}
              const gone = st.site.pages.find((x) => x.id === pageId)
              if (!gone) return {}
              const ids = new Set(gone.slots.map((s) => s.id))
              const pages = st.site.pages.filter((x) => x.id !== pageId)
              return {
                site: { ...st.site, pages },
                notes: st.notes.filter((n) => !ids.has(onSection(n.anchor) ?? '')),
                ui: { ...st.ui, pageId: st.ui.pageId === pageId ? pages[0].id : st.ui.pageId, focusedSlotId: null, selectedBlockId: null },
              }
            }),
          movePage: (pageId, toIndex) =>
            set((st) => {
              const pages = [...st.site.pages]
              const from = pages.findIndex((x) => x.id === pageId)
              if (from < 0) return {}
              const [moving] = pages.splice(from, 1)
              pages.splice(Math.max(0, Math.min(pages.length, toIndex)), 0, moving)
              return { site: { ...st.site, pages } }
            }),
          duplicatePage: (pageId) => {
            const page = pageOf(get().site, pageId)
            // A copy is its own page: fresh section ids, the same clips, words, edits and looks.
            return get().addPage({ path: `${page.path === '/' ? '/home' : page.path}-copy`, title: `${page.title} copy`, slots: page.slots.map((s) => ({ ...structuredClone(s), id: uid('slot') })), show: page.show })
          },
          renameMix: (mixName) => set({ mixName }),
          addMixClips: (ids) => {
            const have = get().clips ?? []
            const fresh = ids.filter((id) => library.clips[id] && !have.includes(id))
            if (fresh.length) set({ clips: [...have, ...fresh] })
          },
          removeMixClip: (id) => set({ clips: (get().clips ?? []).filter((c) => c !== id) }),
          replaceGuide: (guide) => set({ guide: { ...emptyGuide(), ...structuredClone(guide), base: { ...BASE_TOKENS, ...guide.base } } }),
          startFrom: (site, guide) =>
            set((st) => ({
              site: structuredClone(site),
              guide: { ...emptyGuide(), ...structuredClone(guide), base: { ...BASE_TOKENS, ...guide.base } },
              ui: { ...st.ui, pageId: site.pages[0].id, focusedSlotId: null, selectedBlockId: null, selectedFrameId: 'mix' },
            })),

          promoteClip: (clipId, groups) => {
            const clip = library.clips[clipId]
            if (clip) set((st) => ({ guide: promote(st.guide, clip, groups) }))
          },
          adoptClipDesign: (clipId, groups = [...TOKEN_GROUPS]) => {
            const clip = library.clips[clipId]
            if (clip) set((st) => ({ guide: adoptDesign(st.guide, clip, groups) }))
          },
          promoteSite: (source, groups = [...TOKEN_GROUPS], adopt = false) =>
            set((st) => {
              const guide = promoteSource(st.guide, source, groups)
              if (!adopt) return { guide }
              const choices = { ...guide.choices }
              for (const g of groups) for (const c of guide.candidates) if (c.clipId === `${SOURCE_PREFIX}${source.id}` && c.group === g) for (const k of Object.keys(c.values) as TokenKey[]) choices[k] = { kind: 'candidate', candidateId: c.id }
              return { guide: { ...guide, choices } }
            }),
          setInspiredBy: (slotId, inspiredBy) =>
            updateSlot(slotId, (s) => {
              const { inspiredBy: _old, ...rest } = s
              return inspiredBy ? { ...rest, inspiredBy } : rest
            }),
          removeCandidate: (id) => set((st) => ({ guide: removeCandidate(st.guide, id) })),
          chooseToken: (key, choice) => set((st) => ({ guide: choose(st.guide, key, choice) })),
          setEffect: (id, value) => get().setEffects({ [id]: value ?? undefined }),
          setEffects: (patch, replace) =>
            set((st) => {
              const effects: EffectsState = replace ? {} : { ...st.guide.effects }
              for (const [k, v] of Object.entries(patch) as [EffectId, TreatmentValue | undefined][]) {
                const clean = v && cleanTreatment('effect', v)
                if (clean) effects[k] = clean
                else delete effects[k]
              }
              let guide: GuideState = { ...st.guide, effects: Object.keys(effects).length ? effects : undefined }
              // The shadow effect is the card shadow, everywhere the token is read (the token panel, tokens.json).
              if ('shadow' in patch || replace) guide = choose(guide, 'shadow.card', effects.shadow ? { kind: 'custom', value: shadowToken(effects.shadow) } : null)
              return { guide }
            }),
          setBackdrop: (slotId, value) =>
            updateSlot(slotId, (s) => {
              const clean = value && cleanTreatment('backdrop', value)
              return { ...s, backdrop: clean || undefined }
            }),
          chooseTokens: (values) =>
            set((st) => ({ guide: (Object.entries(values) as [TokenKey, string][]).reduce((g, [k, value]) => choose(g, k, { kind: 'custom', value }), st.guide) })),
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
        partialize: (s) => ({ site: s.site, guide: s.guide, content: s.content, versions: s.versions, notes: s.notes, branchFrom: s.branchFrom, head: s.head, clips: s.clips }),
        equality: (a, b) =>
          a.site === b.site && a.guide === b.guide && a.content === b.content && a.versions === b.versions && a.notes === b.notes && a.clips === b.clips,
        handleSet: (handleSet) => leading(handleSet, 400),
      },
    ),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: localMixStorage(),
      partialize: (s) => ({
        mixName: s.mixName,
        site: s.site,
        guide: s.guide,
        content: s.content,
        versions: s.versions,
        notes: s.notes,
        branchFrom: s.branchFrom,
        head: s.head,
        framePos: s.framePos,
        clips: s.clips,
        ui: { ...s.ui, previewFrameId: null, editingNoteId: null, sheet: 'none' as const },
        camera: s.camera,
      }),
      merge: (persisted, current) => {
        const p = siteState(renamedState(persisted)) as Partial<State>
        const merged = { ...current, ...p, ui: { ...current.ui, ...(p.ui ?? {}) } } as State
        // Tokens added since the mix was saved (e.g. line weight) start at their defaults.
        if (merged.guide?.base) merged.guide = { ...merged.guide, base: { ...BASE_TOKENS, ...merged.guide.base } }
        // Drop anything that points at clips that no longer exist in the sample library.
        merged.site = mapSlots(merged.site, (s) => (library.clips[s.clipId] ? s : null))
        // A mix saved before mixes had their own clips starts with the clips it uses (never another mix's set).
        merged.clips = (Array.isArray(p.clips) ? p.clips : mixClipIds({ ...merged, clips: [] })).filter((id) => library.clips[id]?.origin === 'clip')
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
          // A reference build dies with the tab; an agent's build goes on without it, so it stays open.
          if (v.build && !v.build.done && v.build.by !== 'agent') merged.versions[id] = { ...v, status: 'changes', build: { ...v.build, done: true } }
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

/** This mix's clips: its own set, plus any of your clips used on its pages (shared nav and footer included). */
export function mixClipIds(s: Pick<MixData, 'clips' | 'site'>): string[] {
  const used = allSlots(s.site).map((slot) => slot.clipId).filter((id) => library.clips[id]?.origin === 'clip')
  return [...new Set([...(s.clips ?? []), ...used])]
}

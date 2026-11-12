import { briefOf, kindOf, patchBrief, type Brief } from '@/core/brief'
import { create } from 'zustand'
import { createJSONStorage, persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
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
  InsertKind,
  MediaFill,
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
import { adoptDesign, choose, chooseGroup, emptyGuide, promote, promoteSource, removeCandidate, resolveGuide, SOURCE_PREFIX } from '@/core/guide'
import { paletteFrom , type PaletteVariant } from '@/core/palette'
import { toneOfGuide } from '@/core/dials'
import { library, slotClip } from '@/data/library'
import { cycleIds, withClip } from '@/core/library'
import { BANNER_ID } from '@/core/banner'
import { addInsert, insertOf, InsertError, removeInsert } from '@/core/inserts'
import { editList as applyListEdit, ListError, listOrder, type ListOp } from '@/core/lists'
import { keepOption, putBackOption, renameBrand, retireOption, showWords } from '@/core/words'
import { suggestClip } from '@/core/suggest'
import type { FacetFilter } from '@/core/browse'
import { listOpOnEntries } from './collections'
import { BASE_TOKENS } from '@/core/tokens'
import { cleanContract, emptyContract, isKept, type Contract } from '@/core/contract'
import { NO_BACKDROP } from '@/core/sectionDefaults'
import { applySkin as applySkinTo, dressSavedMix, OWN_LOOK, skinById, skinList, surpriseMe as remix } from '@/core/skins'
import type { TextStyleDef, TextStyleEdits, TextStyleId } from '@/core/textStyles'
import { cleanTreatment, shadowToken, type EffectId, type EffectsState, type TreatmentValue } from '@/core/treatments'
import { buildSeed } from './seed'
import { allSlots, freePath, mapSlots, pageOf, pageOfSlot, pageView, setPageSlots, siteFromSlots, titleFromPath, updatePage as updatePageIn, updateSlotIn } from '@/core/site'
import { onSection } from '@/core/notes'
import { uid } from './uid'
import { versionActions } from './slices/versions'
import { draftActions } from './slices/drafts'
import { draftsFromLegacy, draftSites, type Draft } from '@/core/drafts'
import { noteActions } from './slices/notes'
import { contentFor } from '@/core/start'
import type { FeelWord } from '@/core/feel'

export type Mode = 'captured' | 'unified'
export type Viewport = 'desktop' | 'mobile'
/** The one surface that can be open at a time; each grows out of the control that summons it. */
export type Sheet = 'none' | 'guide' | 'packet' | 'crate' | 'looks' | 'menu' | 'more' | 'notes' | 'pages' | 'drafts' | 'share' | 'publish'
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
  /** The Look panel, or the full style guide behind it. */
  guideView: 'look' | 'guide'
  /** How the site should feel, in the Look panel's words: which themes come up first. */
  feelWords: FeelWord[]
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
  /** Saved versions shown on the canvas as frames (this device); otherwise they live in their draft's history. */
  pinnedVersions: string[]
  packetSource: string // 'mix' or a version id
  packetTargets: BuildTarget[]
  hintDismissed: boolean
  editingNoteId: string | null
  myName: string
  /** The block selected inside the focused section (b3), if any. */
  selectedBlockId: string | null
  /** Let a local agent (via the MCP bridge) edit this mix. Off until you turn it on. */
  agentAccess: boolean
  /** Let Jev (TypeSafe) place, pick and check things on this device. On unless you turn it off. */
  jev: boolean
  /** The mark whose card is open on the canvas. */
  openNoteId: string | null
  /** The page open on the canvas (null: the first). */
  pageId: string | null
  /** The page scrolls like a website ('page'), or the whole free canvas with every version ('canvas'). */
  canvasMode: 'page' | 'canvas'
  /** The panel docked at the window's left: your words, the look, or notes (`ui/shell/LeftPanel.tsx`). */
  leftPanel: 'none' | 'words' | 'look' | 'notes'
  /** Where each page was scrolled to on this device: the page y at the top of the screen. */
  pageScroll: Record<string, number>
}

export interface MixData {
  mixName: string
  /** The pages, and the nav and footer they share. */
  site: Site
  guide: GuideState
  content: ProjectContent
  /** What you always want kept and where you'd like to be surprised (core/contract.ts). */
  contract?: Contract
  versions: Record<string, VersionNode>
  notes: Note[]
  /** Retired by drafts: where the mix was branched from (kept so older saves read). New code leaves it null. */
  branchFrom: string | null
  /** The open draft's head: the version last saved or restored in it. */
  head: string | null
  /** The mix's drafts (core/drafts.ts): the open one's body is this mix's site, guide, content and contract. */
  drafts: Record<string, Draft>
  draftId: string
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
  /** Add a blok after a block (in every item when it's inside a list's item); returns the new block's id. */
  addBlock: (slotId: string, kind: InsertKind, afterId: string) => string | null
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
  /** A slider's arrangement; a value of undefined goes back to how the layout comes. */
  setSlider: (slotId: string, patch: NonNullable<Slot['slider']>) => void
  setSectionWidth: (slotId: string, width: Slot['width'] | 'standard') => void
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
  /** Edit a text style (merged; undefined values drop), or null to put it back to its default. */
  setTextStyle: (id: TextStyleId, patch: Partial<TextStyleDef> | null) => void
  /** Set several effects at once (a curated look, a library site's look kit), as one undo step. */
  setEffects: (effects: EffectsState, replace?: boolean) => void
  /** What's behind a section (null = as clipped). */
  setBackdrop: (slotId: string, value: TreatmentValue | null) => void
  /** Put a whole skin on: one undo step, and the contract says what it leaves alone. False when there's no such skin. */
  applySkin: (skinId: string) => boolean
  /** Remix: the areas the contract opens come from other skins. Says what changed, or null when nothing can. */
  surpriseMe: (seed?: number) => string | null
  setContract: (patch: Partial<Contract>) => void
  setField: (type: SectionType, key: string, value: string) => void
  /** Your site's name, changed everywhere it's written; returns how many places changed. */
  setBrand: (brand: string) => number
  /** Your logo once, for the nav's and footer's logo (null takes it away). */
  setLogo: (logo: MediaFill | null) => void
  /** What the site is for (core/brief.ts), patched in one undo step; the kind follows it. */
  setBrief: (patch: Partial<Brief>) => void
  /** One brand color: a whole palette made from it, kept when you try other themes (null forgets it). */
  setBrandColor: (color: string | null, variant?: PaletteVariant) => void

  // versions
  pressVersion: () => string
  /** Your mix takes on a version; unsaved edits are saved as a version first (returns its letter, if one was made). */
  remix: (versionId: string) => string | null
  setStatus: (versionId: string, status: Status) => void
  renameVersion: (versionId: string, title: string) => void
  deleteVersion: (versionId: string) => void
  startBuild: (versionId: string, target: BuildTarget, agentName?: string) => string
  updateBuild: (buildId: string, patch: Partial<NonNullable<VersionNode['build']>>, status?: Status) => void
  setAgent: (agent: Partial<AgentState>) => void
  moveFrame: (frameId: string, x: number, y: number) => void

  // drafts
  /** Open another draft (one undo step): the open one keeps its own copy. */
  switchDraft: (id: string) => boolean
  /** A new draft from a draft (the open one by default) or a saved version; null at the limit. Opens it unless told not to. */
  addDraft: (from?: { draft?: string; version?: string }, opts?: { name?: string; open?: boolean }) => string | null
  updateDraft: (id: string, patch: { name?: string; status?: Status }) => void
  /** Delete a draft and its history (not the last one); deleting the open one opens its neighbour. */
  deleteDraft: (id: string) => boolean
  /** The open draft takes on a saved version (in that version's draft); unsaved edits are saved first. */
  restoreVersion: (versionId: string) => string | null

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
  /** The guided start on the open mix: its pages, style guide and words (versions and notes stay). */
  applyStart: (start: Pick<MixData, 'site' | 'guide' | 'content'>) => void
  /** Open a whole new mix in place of this one (the guided start without Laravel). Undo starts fresh. */
  openMixData: (data: MixData) => void
}



const DEFAULT_UI: UiState = {
  mode: 'unified',
  viewport: 'desktop',
  sheet: 'none',
  guideTab: 'style',
  guideView: 'look',
  feelWords: [],
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
  pinnedVersions: [],
  packetSource: 'mix',
  packetTargets: ['astro'],
  hintDismissed: false,
  editingNoteId: null,
  myName: 'Derek Castelli',
  selectedBlockId: null,
  agentAccess: false,
  jev: true,
  openNoteId: null,
  pageId: null,
  canvasMode: 'page',
  leftPanel: 'none',
  pageScroll: {},
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
/** Nothing saved in this browser yet (read before the store loads): the browser-only mix opens on the guided start. */
export const FIRST_VISIT = (() => {
  try {
    return !localStorage.getItem(STORAGE_KEY) && !localStorage.getItem('mixtape:v1')
  } catch {
    return false
  }
})()
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

/** The parts of what's saved that are the mix's work, not this device's view of it (ui, camera). */
const MIX_KEYS = ['mixName', 'site', 'guide', 'content', 'contract', 'versions', 'notes', 'branchFrom', 'head', 'framePos', 'clips', 'drafts', 'draftId'] as const
/** The same work as last time, by reference: only the view changed (the camera came to rest, a panel opened). */
export const sameMix = (a: Partial<MixData> | null | undefined, b: Partial<MixData>) => !!a && MIX_KEYS.every((k) => a[k] === b[k])

const viewWrites = new Set<() => void>()
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => viewWrites.forEach((w) => w()))

/**
 * Storage that writes a change to the work at once, but a change to the view only a moment after the last one, so
 * scrolling and zooming don't re-save the whole mix every time the camera stops.
 */
export function calmStorage<S extends Partial<MixData>>(inner: PersistStorage<S> | undefined, wait = 1000): PersistStorage<S> | undefined {
  // No storage here (tests, a locked-down browser): nothing to calm.
  if (!inner) return inner
  let last: S | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: [string, StorageValue<S>] | null = null
  const write = () => {
    clearTimeout(timer)
    if (!pending) return
    const [name, value] = pending
    pending = null
    void inner.setItem(name, value)
  }
  viewWrites.add(write)
  return {
    getItem: inner.getItem,
    removeItem: inner.removeItem,
    setItem: (name, value) => {
      const quiet = sameMix(last, value.state)
      last = value.state
      pending = [name, value]
      if (!quiet) return write()
      clearTimeout(timer)
      timer = setTimeout(write, wait)
    },
  }
}

/** The mix kept in this browser (the default, and what "local" opens). */
export const localMixStorage = () => calmStorage(createJSONStorage<Persisted>(() => carryOver(localStorage)))

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

          // The arrows step through the layouts and this mix's own clips (cycleIds), never your other mixes'.
          cycle: (slotId, dir) => {
            const mix = mixClipIds(get())
            updateSlot(slotId, (s) => {
              const ids = cycleIds(library, s.type, mix, s.clipId)
              if (ids.length < 2) return s
              const i = ids.indexOf(s.clipId)
              return withClip(s, ids[(i + dir + ids.length) % ids.length], library)
            })
          },
          // Picking a clip from another shelf (All your clips) brings it into this mix, and so into its arrows.
          setClip: (slotId, clipId) => {
            const clip = library.clips[clipId]
            const have = get().clips ?? []
            set((st) => ({
              site: updateSlotIn(st.site, slotId, (s) => (clip?.type === s.type ? withClip(s, clipId, library) : s)),
              ...(clip?.origin === 'clip' && !have.includes(clipId) ? { clips: [...have, clipId] } : {}),
            }))
          },
          shuffle: () => {
            const st = get()
            const view = currentSlots(st)
            if (view.every((s) => s.locked)) return st.showFlash('Every section is locked. Unlock one to shuffle.')
            // Layouts set to Keep (Keep or surprise) are hands off, for you as for agents.
            if (isKept(st.contract, 'layout')) return st.showFlash('Layouts are set to Keep, so Shuffle leaves them alone')
            let picks = new Map<string, string>()
            const mix = mixClipIds(st)
            // Never "shuffle" into the same arrangement.
            for (let tries = 0; tries < 8; tries++) {
              picks = new Map(view.filter((s) => !s.locked).map((s) => [s.id, pickDifferent(cycleIds(library, s.type, mix, s.clipId), s.clipId)]))
              if (view.some((s) => picks.has(s.id) && picks.get(s.id) !== s.clipId)) break
            }
            set((x) => ({ site: mapSlots(x.site, (s) => (picks.has(s.id) ? withClip(s, picks.get(s.id)!, library) : s)), shuffleSeq: x.shuffleSeq + 1 }))
            const n = view.filter((s) => picks.has(s.id) && picks.get(s.id) !== s.clipId).length
            get().showFlash(`Shuffled ${n} section${n === 1 ? '' : 's'}`, { undo: true })
          },
          // Locked means hands off, including the structure: an agent can't treat its layout as a mere reference.
          toggleLock: (slotId) => updateSlot(slotId, (s) => ({ ...s, locked: !s.locked, keep: s.locked ? s.keep : { ...s.keep, layout: true } })),
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
          addBlock: (slotId, kind, afterId) => {
            const slot = allSlots(get().site).find((s) => s.id === slotId)
            if (!slot) return null
            try {
              const out = addInsert(slot, slotClip(slot), kind, afterId)
              updateSlot(slotId, () => out.slot)
              return out.blockId
            } catch (e) {
              if (e instanceof InsertError) {
                get().showFlash(e.message)
                return null
              }
              throw e
            }
          },
          editBlock: (slotId, blockId, patch) => {
            updateSlot(slotId, (s) => {
              // Hiding an added banner removes it; so does hiding a blok you added.
              if (blockId === BANNER_ID && patch?.hidden) return { ...s, banner: undefined }
              const added = insertOf(blockId)
              if (added && patch?.hidden && (s.inserts?.[s.clipId] ?? []).some((i) => i.id === added)) return removeInsert(s, added)
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
            })
          },
          setWord: (slotId, field, value) => {
            updateSlot(slotId, (s) => {
              const words = { ...s.words }
              if (value === null) delete words[field]
              else words[field] = value
              return { ...s, words }
            })
          },
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
          // Page is the same as unset, unless the guide gives this type of section a band: then it's your choice against it.
          setSurface: (slotId, surface) => updateSlot(slotId, (s) => ({ ...s, surface: surface === 'page' && !get().guide.sections?.[s.type]?.surface ? undefined : surface })),
          setSlider: (slotId, patch) =>
            updateSlot(slotId, (s) => {
              const next = { ...s.slider, ...patch }
              for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined) delete next[k]
              const { slider: _old, ...rest } = s
              return Object.keys(next).length ? { ...rest, slider: next } : rest
            }),
          setSectionWidth: (slotId, width) => updateSlot(slotId, (s) => ({ ...s, width: width === 'standard' ? undefined : width })),
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
              return st.showFlash(`The site already has a ${chrome}. Change its layout instead.`)
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
          replaceGuide: (guide) => set({ guide: { skin: OWN_LOOK, ...emptyGuide(), ...structuredClone(guide), base: { ...BASE_TOKENS, ...guide.base } } }),
          startFrom: (site, guide) =>
            set((st) => ({
              site: structuredClone(site),
              guide: { skin: OWN_LOOK, ...emptyGuide(), ...structuredClone(guide), base: { ...BASE_TOKENS, ...guide.base } },
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
          setTextStyle: (id, patch) =>
            set((st) => {
              const all: TextStyleEdits = { ...st.guide.textStyles }
              const next = patch === null ? {} : { ...all[id], ...patch }
              for (const k of Object.keys(next) as (keyof TextStyleDef)[]) if (next[k] === undefined) delete next[k]
              if (Object.keys(next).length) all[id] = next
              else delete all[id]
              return { guide: { ...st.guide, textStyles: Object.keys(all).length ? all : undefined } }
            }),
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
              // Taking a backdrop off where the guide gives this type one needs saying, or the guide's comes back.
              return { ...s, backdrop: clean || (get().guide.sections?.[s.type]?.backdrop ? NO_BACKDROP : undefined) }
            }),
          applySkin: (skinId) => {
            const skin = skinById(skinId)
            if (!skin) return false
            set((st) => ({ guide: applySkinTo(st.guide, skin, st.contract) }))
            return true
          },
          surpriseMe: (seed = Date.now()) => {
            const st = get()
            const out = remix(st.guide, st.contract ?? emptyContract(), seed, skinList())
            if (!out) return null
            set({ guide: out.guide })
            return out.words
          },
          setContract: (patch) => set((st) => ({ contract: cleanContract({ ...(st.contract ?? emptyContract()), ...patch }) })),
          chooseTokens: (values) =>
            set((st) => ({ guide: (Object.entries(values) as [TokenKey, string][]).reduce((g, [k, value]) => choose(g, k, { kind: 'custom', value }), st.guide) })),
          chooseGroup: (candidateId) => set((st) => ({ guide: chooseGroup(st.guide, candidateId) })),
          setField: (type, key, value) =>
            set((st) => ({
              content: { ...st.content, fields: { ...st.content.fields, [type]: { ...(st.content.fields[type] ?? {}), [key]: value } } },
            })),
          setBrand: (brand) => {
            const st = get()
            const out = renameBrand(st.content, st.site, st.content.brand, brand)
            set({ content: out.content, site: out.site })
            return out.count
          },
          setBrief: (patch) =>
            set((st) => {
              const brief = patchBrief(briefOf(st.content), patch)
              const { brief: _, ...rest } = st.content
              const known = brief.format || brief.industry
              return { content: { ...rest, ...(Object.keys(brief).length ? { brief } : {}), ...(known ? { kind: kindOf(brief, st.content.kind) } : {}) } }
            }),
          setLogo: (logo) =>
            set((st) => {
              const { logo: _, ...rest } = st.content
              return { content: logo ? { ...rest, logo } : rest }
            }),
          setBrandColor: (color, variant) =>
            set((st) => {
              if (!color) {
                const { brand: _, ...rest } = st.guide
                return { guide: rest }
              }
              const colors = paletteFrom(color, toneOfGuide(resolveGuide(st.guide).tokens), variant)
              const guide = (Object.entries(colors) as [TokenKey, string][]).reduce((g, [k, value]) => choose(g, k, { kind: 'custom', value }), st.guide)
              const pairs = variant && (variant.accentTurn !== undefined || variant.tint !== undefined)
              return { guide: { ...guide, brand: { color, ...(pairs ? { variant } : {}) } } }
            }),

          ...versionActions(set, get),
          ...draftActions(set, get),
          ...noteActions(set),

          setUi: (patch) => set((st) => ({ ui: { ...st.ui, ...patch } })),
          setCamera: (camera) => set({ camera }),
          showFlash: (text, opts) => set((st) => ({ flash: { id: (st.flash?.id ?? 0) + 1, text, undo: opts?.undo } })),
          resetDemo: () => get().openMixData(buildSeed(library)),
          applyStart: (start) => set((st) => ({ site: start.site, guide: start.guide, content: start.content, ui: { ...st.ui, pageId: null, focusedSlotId: null, selectedBlockId: null } })),
          openMixData: (data) => {
            set((st) => ({ ...data, ui: { ...DEFAULT_UI, theme: st.ui.theme, hintDismissed: st.ui.hintDismissed }, camera: null, agent: { versionId: null, name: 'Claude', step: 0 } }))
            useStore.temporal.getState().clear()
          },
        }
      },
      {
        limit: 100,
        partialize: (s) => ({ site: s.site, guide: s.guide, content: s.content, contract: s.contract, versions: s.versions, notes: s.notes, branchFrom: s.branchFrom, head: s.head, clips: s.clips, drafts: s.drafts, draftId: s.draftId }),
        equality: (a, b) =>
          a.site === b.site && a.guide === b.guide && a.content === b.content && a.contract === b.contract && a.versions === b.versions && a.notes === b.notes && a.clips === b.clips && a.drafts === b.drafts && a.draftId === b.draftId,
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
        contract: s.contract,
        versions: s.versions,
        notes: s.notes,
        branchFrom: s.branchFrom,
        head: s.head,
        drafts: s.drafts,
        draftId: s.draftId,
        framePos: s.framePos,
        clips: s.clips,
        ui: { ...s.ui, previewFrameId: null, editingNoteId: null, sheet: 'none' as const },
        camera: s.camera,
      }),
      merge: (persisted, current) => {
        const p = siteState(renamedState(persisted)) as Partial<State>
        // Saved before drafts: one draft holding every version.
        if (!p.drafts || !p.draftId || !p.drafts[p.draftId]) Object.assign(p, draftsFromLegacy(p), { branchFrom: null })
        const merged = { ...current, ...p, ui: { ...current.ui, ...(p.ui ?? {}) } } as State
        merged.contract = cleanContract(p.contract)
        // Tokens added since the mix was saved (e.g. line weight) start at their defaults.
        if (merged.guide?.base) merged.guide = { ...merged.guide, base: { ...BASE_TOKENS, ...merged.guide.base } }
        // Drop anything that points at clips that no longer exist in the sample library. A built-in layout shows your
        // words and style: switches only captured clips have, left on from one, are turned off (withClip does this now).
        merged.site = mapSlots(merged.site, (s) =>
          !library.clips[s.clipId] ? null : library.clips[s.clipId].origin === 'layout' && (s.keep?.style || s.keep?.content) ? { ...s, keep: { ...s.keep, style: false, content: false } } : s,
        )
        // A mix saved before mixes had their own clips starts with the clips it uses (never another mix's set).
        merged.clips = (Array.isArray(p.clips) ? p.clips : mixClipIds({ ...merged, clips: [] })).filter((id) => library.clips[id]?.origin === 'clip')
        // Mixes saved before skins: their layouts went bare, so they take the closest skin's looks, keeping their own values.
        if (merged.guide && merged.site) Object.assign(merged, dressSavedMix(merged, library, skinList()))
        // Copy fields added since the mix was saved (a nav banner's messages) start from plain starter words, never
        // Blokmix's own demo copy.
        if (merged.content?.fields) {
          const fields = { ...merged.content.fields }
          const starter = contentFor({ kind: 'product', name: merged.content.brand ?? '' }).fields
          for (const [type, defaults] of Object.entries(starter) as [SectionType, Record<string, string>][]) {
            const mine = fields[type] ?? {}
            const missing = Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in mine)))
            if (Object.keys(missing).length) fields[type] = { ...mine, ...missing }
          }
          merged.content = { ...merged.content, fields }
        }
        // Content was a sheet that took over the screen; it's the Words panel beside the page now.
        if (merged.ui.sheet === 'guide' && merged.ui.guideTab === 'content') merged.ui = { ...merged.ui, sheet: 'none', leftPanel: 'words' }
        // The Copy tab became Content.
        if ((merged.ui.guideTab as string) === 'copy') merged.ui.guideTab = 'content'
        // One framework per hand-off.
        merged.ui.packetTargets = (merged.ui.packetTargets ?? ['astro']).slice(0, 1)
        // The other drafts' bodies get what the open one did: missing clips dropped, a look if saved before skins.
        merged.drafts = Object.fromEntries(
          Object.entries(merged.drafts).map(([id, d]) => {
            if (!d.body) return [id, d]
            const site = mapSlots(d.body.site, (s) => (library.clips[s.clipId] ? s : null))
            const guide = d.body.guide?.base ? { ...d.body.guide, base: { ...BASE_TOKENS, ...d.body.guide.base } } : d.body.guide
            return [id, { ...d, body: { ...d.body, ...dressSavedMix({ ...d.body, site, guide }, library, skinList()), site } }]
          }),
        )
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
export function mixClipIds(s: Pick<MixData, 'clips' | 'site'> & Partial<Pick<MixData, 'drafts' | 'draftId'>>): string[] {
  const sites = s.drafts && s.draftId ? draftSites({ site: s.site, drafts: s.drafts, draftId: s.draftId }) : [s.site]
  const used = sites.flatMap((site) => allSlots(site)).map((slot) => slot.clipId).filter((id) => library.clips[id]?.origin === 'clip')
  return [...new Set([...(s.clips ?? []), ...used])]
}

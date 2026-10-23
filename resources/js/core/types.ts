// Core types. Nothing in core/ imports React or Vite APIs, so the same code can
// later run inside the capture extension and the MCP server.

/** In typical page order. Inner pages use `header` (a page header) instead of `hero`. */
export const SECTION_TYPES = [
  'nav',
  'hero',
  'header',
  'logos',
  'features',
  'stats',
  'content',
  'team',
  'testimonials',
  'pricing',
  'blog',
  'faq',
  'contact',
  'cta',
  'footer',
] as const
export type SectionType = (typeof SECTION_TYPES)[number]

export const TOKEN_KEYS = [
  'color.bg',
  'color.surface',
  'color.text',
  'color.muted',
  'color.border',
  'color.primary',
  'color.onPrimary',
  'color.accent',
  'font.display',
  'font.body',
  'font.mono',
  'type.base',
  'type.ratio',
  'type.displayWeight',
  'radius.base',
  'stroke.width',
  'icon.set',
  'shadow.card',
  'space.base',
  'space.section',
  'motion.duration',
  'motion.ease',
] as const
export type TokenKey = (typeof TOKEN_KEYS)[number]
export type TokenSet = Record<TokenKey, string>

export const TOKEN_GROUPS = ['color', 'type', 'shape', 'space', 'motion'] as const
export type TokenGroup = (typeof TOKEN_GROUPS)[number]

export type CssVars = Record<string, string>

export interface FontSource {
  family: string
  /** Google Fonts css2 `family=` parameter, e.g. "Fraunces:opsz,wght@9..144,400;9..144,700" */
  css2: string
  /** Where it loads from (Google Fonts unless said otherwise). */
  provider?: 'google' | 'fontshare' | 'fontsource'
  /** Fontshare's `f[]=` parameter, e.g. "satoshi@400,500,700". */
  fontshare?: string
  /** Fontsource package and weights, e.g. "commit-mono@400,700" (one stylesheet per weight on jsDelivr). */
  fontsource?: string
}

export interface Source {
  id: string
  /** 'site': clipped from a real site. 'layout': Mixtape's built-in, neutral layouts. */
  kind?: 'site' | 'layout'
  name: string
  url: string
  personality: string
  tokens: TokenSet
  fonts: FontSource[]
  /** How its icon set was identified from its clips, when it was. */
  iconReason?: string
}

export interface Capture {
  url: string
  selector: string
  viewport: { width: number; height: number }
  capturedAt: string
}

export interface Clip {
  id: string // 'hero.marginalia-split'
  type: SectionType
  sourceId: string
  title: string
  layoutPattern: string
  /** Visual rhythm, used to suggest layouts that contrast with their neighbours. */
  rhythm?: Rhythm
  /** 'clip' came from a site you clipped; 'layout' is one of Mixtape's built-ins. */
  origin: 'clip' | 'layout'
  rootClass: string // 'mx-hero-marginalia-split'
  html: string
  css: string
  motionCss: string | null
  motionNotes?: string
  tokens: TokenSet
  fonts: FontSource[]
  fields: Record<string, string> // source copy keyed by data-mx-field
  blocks: BlockInfo[]
  capture: Capture
  hash: string
}

export interface Keep {
  /** Off = layout is reference only; the agent may restructure. */
  layout: boolean
  /** On = this section keeps its own captured look instead of the style guide. */
  style: boolean
  /** On = keep the source copy (off = your copy fills the fields). */
  content: boolean
  motion: boolean
}

export const DEFAULT_KEEP: Keep = { layout: true, style: false, content: false, motion: true }

export interface Slot {
  id: string
  type: SectionType
  clipId: string
  locked: boolean
  keep: Keep
  /** Block-level changes (variants, styles), by clip then block. */
  edits?: SlotEdits
  /** This section's own words, over the shared copy for its type. */
  words?: Record<string, string>
  spacing?: SectionSpacing
  motion?: SectionMotion
  /** Other ways to say a field's words, kept to switch between (by field). */
  options?: Record<string, WordOption[]>
  /** Navs: an announcement banner added above the nav (one clipped with its own uses that instead). */
  banner?: boolean
  /** Repeating items you added, removed or reordered, by list key ("f", "faq", "t1F"). */
  lists?: Record<string, ListItemRef[]>
}

/** One way to say a field's words, kept as an option (Koati's "Keep"). */
export interface WordOption {
  text: string
  /** Who wrote it. */
  by: 'you' | 'agent'
  keptAt: number
  /** Retired options leave the cycler but can be put back. */
  retiredAt?: number
}

/**
 * An item in a list, by its number in the list's fields (f4Title is item 4 of
 * list "f"). `from` is the item whose structure a new item copies.
 */
export interface ListItemRef {
  n: number
  from?: number
}

export interface Candidate {
  id: string
  clipId: string
  group: TokenGroup
  values: Partial<TokenSet>
  promotedAt: number
}

export type Choice = { kind: 'candidate'; candidateId: string } | { kind: 'custom'; value: string }

export interface GuideState {
  base: TokenSet
  candidates: Candidate[]
  choices: Partial<Record<TokenKey, Choice>>
  /** Extra named brand colours beyond the core palette. */
  swatches?: Swatch[]
  /** Defaults for kinds of blocks across the whole page ("All buttons: outline"). */
  components?: Partial<Record<BlockKind, ComponentDefault>>
}

export interface ConflictOption {
  value: string
  candidateIds: string[]
}

export interface Conflict {
  key: TokenKey
  options: ConflictOption[]
  resolved: boolean
  current: string
}

export type Provenance = 'base' | 'custom' | string // string = candidateId

export interface ResolvedGuide {
  tokens: TokenSet
  provenance: Record<TokenKey, Provenance>
  conflicts: Conflict[]
}

export interface ProjectContent {
  brand: string
  fields: Partial<Record<SectionType, Record<string, string>>>
}

/** ReviseMy's mark kinds, so marks can move between the sibling apps. */
export const NOTE_KINDS = ['must-fix', 'nit', 'question', 'keep'] as const
export type NoteKind = (typeof NOTE_KINDS)[number]
/** open → in_progress (agent working) → resolved (agent says done) → verified (only a person). */
export const NOTE_STATUSES = ['open', 'in_progress', 'resolved', 'verified'] as const
export type NoteStatus = (typeof NOTE_STATUSES)[number]
export type NoteSource = 'you' | 'agent' | 'checklist'

export interface NoteReply {
  id: string
  author: string
  source: NoteSource
  text: string
  at: number
}

/**
 * A note on the canvas. Without a kind it's a free-form sticky note; with one
 * it's a mark: specific feedback pinned to a block or an area, with a status.
 */
export interface Note {
  id: string
  text: string
  color: NoteColor
  anchor: NoteAnchor
  createdAt: number
  kind?: NoteKind
  status?: NoteStatus
  source?: NoteSource
  author?: string
  /** Marks are numbered N1, N2… in the order they were made. */
  number?: number
  /** The exact words the agent should use. */
  suggestedCopy?: string
  /** What was done, when an agent resolves it. */
  resolution?: string
  replies?: NoteReply[]
}
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green'
export type NoteAnchor =
  | { kind: 'world'; x: number; y: number }
  | { kind: 'slot'; slotId: string; dx: number; dy: number }
  | { kind: 'frame'; frameId: string; dx: number; dy: number }
  /** A block of one clip in a section; the label is kept so the mark still reads well if the clip changes. */
  | { kind: 'block'; slotId: string; clipId: string; blockId: string; label: string; quote?: string }
  /** Words selected inside a block's copy, with the field they're in. */
  | { kind: 'words'; slotId: string; clipId: string; blockId: string; label: string; field: string; quote: string }
  /** A drawn area of a section, as fractions of its box so it holds at any width. */
  | { kind: 'area'; slotId: string; clipId: string; rect: { x: number; y: number; w: number; h: number } }
  /** The whole page. */
  | { kind: 'page' }

export interface TapeSnapshot {
  slots: Slot[]
  guide: GuideState
  content: ProjectContent
  /** Sticky notes attached to slots at the time of the snapshot, by slot id. */
  slotNotes: Record<string, string[]>
  /** Sticky notes on the page but not on a section. */
  generalNotes?: string[]
  /** Marks (feedback with a kind and status) on this snapshot's sections or the page. */
  marks?: Note[]
  clipHashes: Record<string, string>
}

export const STATUSES = ['in-progress', 'ready', 'changes', 'approved', 'archived'] as const
export type Status = (typeof STATUSES)[number]

export type BuildTarget = 'astro' | 'next'

export interface VersionNode {
  id: string
  letter: string // 'A', 'B.1'
  parentId: string | null
  title: string
  status: Status
  createdAt: number
  kind: 'snapshot' | 'build'
  snapshot: TapeSnapshot // builds keep a copy of the snapshot they were built from
  build?: {
    by: 'reference' | 'agent'
    agentName: string
    target: BuildTarget
    previewUrl?: string
    steps: string[]
    done: boolean
  }
}

/**
 * The elements inside a section you can select, swap and restyle. Small ones
 * (heading … input) sit inside composite ones (card, item); a list holds the
 * repeating items of a section.
 */
export const BLOCK_KINDS = ['heading', 'text', 'button', 'link', 'badge', 'icon', 'image', 'input', 'banner', 'card', 'item', 'list'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

export interface BlockInfo {
  /** Order in the document: b0, b1… Stable for a clip's content. */
  id: string
  kind: BlockKind
  parent: string | null
  children: string[]
  /** People-facing name: "Features · Plan 2 · Button". Selectors are never shown. */
  label: string
  /** The copy field on (or inside) this block, if any. */
  field?: string
  /** Image slot name, for image blocks. */
  media?: string
  ratio?: string
  /** List name, for list blocks. */
  list?: string
  /** List blocks whose items you can add, remove and reorder: the key their fields are numbered by. */
  listKey?: string
  /** Items: their number in the list's key (f4Title → 4). */
  n?: number
  /** It is (or holds) a link, so it can lead somewhere. */
  linkable?: boolean
}

/**
 * A colour from the palette: a guide token ('primary'), an extra swatch
 * ('x:brand'), optionally mixed towards the page colour ('primary/20' = 20% of
 * primary over the background). Never a raw hex, so it re-themes.
 */
export type ColorRef = string

/** A step on the spacing scale (--mx-space-0 … --mx-space-10), never raw pixels. */
export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export interface BlockStyle {
  fill?: ColorRef
  ink?: ColorRef
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'pill'
  shadow?: 'none' | 'soft' | 'lifted' | 'offset'
  /** Inner padding. */
  padding?: SpaceStep
  /** Space above and below the block. */
  above?: SpaceStep
  below?: SpaceStep
  /** Space between the block's children (lists, cards, items). */
  gap?: SpaceStep
}

/** A section's top or bottom padding, relative to the style guide's section spacing. */
export type SectionSpace = 'none' | 'tight' | 'default' | 'roomy'

export interface SectionSpacing {
  top?: SectionSpace
  bottom?: SectionSpace
}

export const ENTER_PRESETS = ['rise', 'fade', 'pop', 'drop', 'slide', 'blur'] as const
export type EnterPreset = (typeof ENTER_PRESETS)[number]
export const HOVER_PRESETS = ['lift', 'glow', 'tilt', 'zoom', 'nudge', 'underline'] as const
export type HoverPreset = (typeof HOVER_PRESETS)[number]
export const SCROLL_PRESETS = ['reveal', 'parallax'] as const
export type ScrollPreset = (typeof SCROLL_PRESETS)[number]
export const LOOP_PRESETS = ['float', 'breathe', 'spin'] as const
export type LoopPreset = (typeof LOOP_PRESETS)[number]
export type MotionSpeed = 'quick' | 'normal' | 'slow'

/** A block's motion. 'none' switches off what the section would otherwise give it (its stagger). */
export interface BlockMotion {
  enter?: EnterPreset | 'none'
  hover?: HoverPreset
  scroll?: ScrollPreset
  loop?: LoopPreset
  speed?: MotionSpeed
}

/** A section's motion: as clipped, a preset you chose, or none. */
export interface SectionMotion {
  mode: 'captured' | 'preset' | 'none'
  enter?: EnterPreset
  /** Blocks arrive one after another instead of together. */
  stagger?: boolean
  /** Play when scrolled into view (on the canvas, it plays on load). */
  onScroll?: boolean
  speed?: MotionSpeed
}

export const PLACEHOLDER_STYLES = ['mesh', 'shapes', 'arch', 'waves', 'grid', 'portrait'] as const
export type PlaceholderStyle = (typeof PLACEHOLDER_STYLES)[number]

/** A stock photo, hotlinked as the provider asks, with its credit. */
export interface StockPhoto {
  provider: 'unsplash'
  id: string
  url: string
  thumb: string
  width: number
  height: number
  author: string
  authorUrl: string
  link: string
  description?: string
}

/** When moving media plays. Scrub ties a Lottie's progress to scrolling. */
export const MEDIA_PLAY = ['autoplay', 'hover', 'inview', 'click', 'scrub'] as const
export type MediaPlay = (typeof MEDIA_PLAY)[number]

/** A video or animation link: a file, or a YouTube/Vimeo page that embeds a player. */
export interface MediaLink {
  url: string
  provider?: 'youtube' | 'vimeo'
  /** The provider's video id, for embeds. */
  id?: string
}

/**
 * What fills an image block: a placeholder drawn from your palette (it
 * re-themes with the style guide), an image you uploaded (kept in this
 * browser), a stock photo, or something that moves: a video, a Lottie
 * animation, or a YouTube/Vimeo embed.
 */
export interface MediaFill {
  source: 'placeholder' | 'upload' | 'stock' | 'video' | 'lottie' | 'embed'
  style?: PlaceholderStyle
  seed?: number
  /** Upload (image, video or Lottie): the asset id in the browser's asset store. */
  asset?: string
  stock?: StockPhoto
  link?: MediaLink
  alt?: string
  fit?: 'cover' | 'contain'
  /** Moving media: when it plays, whether it loops, and whether a click opens it large. */
  play?: MediaPlay
  loop?: boolean
  lightbox?: boolean
  /** A still shown before it plays and with reduced motion: an image asset id or URL. */
  poster?: string
}

/** Your changes to one block of one clip in one section. */
export interface BlockEdit {
  /** A variant from the block library ('outline'); absent = the clip's own look. */
  variant?: string
  style?: BlockStyle
  motion?: BlockMotion
  media?: MediaFill
  /** Icon blocks: a different icon (by name) than the clip drew. */
  icon?: string
  /** Links and buttons: where they lead (absent = from their words, else nowhere). */
  link?: LinkTarget
  hidden?: boolean
}

/** Where a link leads. */
export type LinkTarget =
  | { to: 'section'; slotId: string }
  | { to: 'page'; path: string }
  | { to: 'url'; url: string; newTab?: boolean }
  | { to: 'email'; address: string }
  | { to: 'phone'; number: string }
  | { to: 'none' }

/** Edits per clip, then per block id, so swapping clips and back keeps them. */
export type SlotEdits = Record<string, Record<string, BlockEdit>>

/** A section-wide default for a kind of block, promoted from one block ("All buttons"). */
export interface ComponentDefault {
  variant?: string
  style?: BlockStyle
}

export interface Swatch {
  id: string
  name: string
  value: string // hex
}

export const RHYTHMS = ['centered', 'split', 'grid', 'stack', 'band'] as const
export type Rhythm = (typeof RHYTHMS)[number]

export interface Library {
  sources: Record<string, Source>
  clips: Record<string, Clip>
  /** Every clip and layout of a type: your clips first, then layouts. */
  byType: Record<SectionType, string[]>
  /** Only the built-in layouts of a type. */
  layoutsByType: Record<SectionType, string[]>
  warnings: LintIssue[]
}

export interface LintIssue {
  clipId: string
  level: 'error' | 'warn'
  message: string
}

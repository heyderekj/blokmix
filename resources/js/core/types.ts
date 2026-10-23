// Core types. Nothing in core/ imports React or Vite APIs, so the same code can
// later run inside the capture extension and the MCP server.

export const SECTION_TYPES = ['nav', 'hero', 'features', 'proof', 'pricing', 'footer'] as const
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
}

export interface Source {
  id: string
  name: string
  url: string
  personality: string
  tokens: TokenSet
  fonts: FontSource[]
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
  rootClass: string // 'mx-hero-marginalia-split'
  html: string
  css: string
  motionCss: string | null
  motionNotes?: string
  tokens: TokenSet
  fonts: FontSource[]
  fields: Record<string, string> // source copy keyed by data-mx-field
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

export interface Note {
  id: string
  text: string
  color: NoteColor
  anchor: NoteAnchor
  createdAt: number
}
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green'
export type NoteAnchor =
  | { kind: 'world'; x: number; y: number }
  | { kind: 'slot'; slotId: string; dx: number; dy: number }
  | { kind: 'frame'; frameId: string; dx: number; dy: number }

export interface TapeSnapshot {
  slots: Slot[]
  guide: GuideState
  content: ProjectContent
  /** Sticky notes attached to slots at the time of the snapshot, by slot id. */
  slotNotes: Record<string, string[]>
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

export interface Library {
  sources: Record<string, Source>
  clips: Record<string, Clip>
  byType: Record<SectionType, string[]>
  warnings: LintIssue[]
}

export interface LintIssue {
  clipId: string
  level: 'error' | 'warn'
  message: string
}

import type { MediaRender } from '@/core/media'
import type { ShaderSpec } from '@/core/treatments/shaders'

export interface LightboxPayload {
  kind: 'image' | 'video' | 'lottie' | 'embed'
  src?: string
  poster?: string
  alt?: string
  player?: string
}

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
  /** The selected block's type size in px, when it's the selection's box. */
  font?: number
}

/** What a frame in edit mode reports about its blocks. */
export interface BlockEvent {
  hover?: { id: string; rect: FrameRect } | null
  pick?: string | null
  selRect?: FrameRect | null
  word?: { field: string; value: string }
  editing?: boolean
  /** A key pressed (or, with `up`, let go of) while the frame had focus. */
  key?: { key: string; code: string; meta: boolean; ctrl: boolean; shift: boolean; alt: boolean; up?: boolean }
  /** Note mode: a block clicked (with the point), or an area being drawn / drawn. */
  notePick?: string | null
  rect?: FrameRect | null
  at?: { x: number; y: number }
  drag?: FrameRect | null
  area?: FrameRect
  /** Words selected in note mode. */
  words?: { block: string | null; field: string; quote: string; rect: FrameRect }
  /** Someone opened a lightbox in an interactive frame. */
  lightbox?: LightboxPayload
  asset?: string | null
  /** An item picked up by pressing on it and moving (frame px), then where the pointer goes, then let go. */
  dragItem?: { id: string; x: number; y: number }
  dragMove?: { x: number; y: number }
  dragEnd?: boolean
  /** Rects of the blocks the parent asked to track (for pins). */
  rects?: Record<string, FrameRect>
}

/** Routes postMessages from sandboxed frames to the component that owns each frame. */
type Handler = (
  data: { ns: 'mx'; ready?: boolean; needShaders?: boolean; height?: number; goto?: string; open?: string; wheel?: { dx: number; dy: number; mode: number; x: number; y: number; ctrl: boolean; meta: boolean; shift: boolean }; sections?: { slot: string; top: number; height: number }[] } & BlockEvent,
) => void

const handlers = new Map<MessageEventSource, Handler>()
let listening = false

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('message', (e) => {
    if (!e.source || !e.data || e.data.ns !== 'mx') return
    handlers.get(e.source)?.(e.data)
  })
}

export function registerFrame(win: Window, handler: Handler): () => void {
  listen()
  handlers.set(win, handler)
  return () => {
    if (handlers.get(win) === handler) handlers.delete(win)
  }
}

export interface FrameState {
  css: string
  motion: boolean
  fields: Record<string, string> | null
  fonts: (string | null)[]
  outline: boolean
  /** A slider's arrangement, as attributes on the section root. */
  slider: { slide?: string; show?: number; intro?: string }
  /** Block variants and styles: CSS for @layer blocks, plus each edited block's variant id. */
  blocks: { css: string; variants: Record<string, string> }
  /** Pictures and moving media filling image blocks, by block id. */
  media: Record<string, MediaRender>
  /** A live backdrop: the shader running behind the section (its CSS is in blocks). */
  backdrop: ShaderSpec | null
  /** Named icons redrawn in the style guide's set (null = the clip's own icons). */
  /** `only`: redraw just the overridden icons (the section keeps its clipped look). */
  icons: { set: string; glyphs: Record<string, string>; overrides: Record<string, string>; only?: boolean } | null
  /** Lists you changed: elements to swap in place (everything else re-applies on top). */
  lists: { sel: string; html: string; before?: boolean }[]
  /** Where each link block leads: its href, and the section for links within the page. */
  links: Record<string, { href: string; slot?: string; newTab?: boolean }>
}

export function postState(
  win: Window | null | undefined,
  s: Partial<FrameState> & { replay?: boolean; edit?: boolean; noteMode?: boolean; select?: string | null; editText?: string; track?: string[]; clearSelection?: boolean; blobs?: Record<string, Blob>; shadersJs?: string },
) {
  win?.postMessage({ ns: 'mx', ...s }, '*')
}

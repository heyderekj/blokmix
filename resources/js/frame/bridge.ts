export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

/** What a frame in edit mode reports about its blocks. */
export interface BlockEvent {
  hover?: { id: string; rect: FrameRect } | null
  pick?: string | null
  selRect?: FrameRect | null
  word?: { field: string; value: string }
  editing?: boolean
  key?: { key: string; code: string; meta: boolean; ctrl: boolean; shift: boolean; alt: boolean }
}

/** Routes postMessages from sandboxed frames to the component that owns each frame. */
type Handler = (
  data: { ns: 'mx'; ready?: boolean; height?: number; sections?: { slot: string; top: number; height: number }[] } & BlockEvent,
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
  /** Block variants and styles: CSS for @layer blocks, plus each edited block's variant id. */
  blocks: { css: string; variants: Record<string, string> }
}

export function postState(
  win: Window | null | undefined,
  s: Partial<FrameState> & { replay?: boolean; edit?: boolean; select?: string | null; editText?: string },
) {
  win?.postMessage({ ns: 'mx', ...s }, '*')
}

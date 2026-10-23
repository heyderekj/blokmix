/** Routes postMessages from sandboxed frames to the component that owns each frame. */
type Handler = (data: { ns: 'mx'; ready?: boolean; height?: number; sections?: { slot: string; top: number; height: number }[] }) => void

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
}

export function postState(win: Window | null | undefined, s: Partial<FrameState> & { replay?: boolean }) {
  win?.postMessage({ ns: 'mx', ...s }, '*')
}

import { create } from 'zustand'
import { BRIDGE_URL, type BuildAck, type BuildFile, type BuildMessage } from '@/core/commands/bridge'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

/**
 * The tab's side of the local MCP bridge (scripts/mcp-bridge.ts). Only runs
 * while you've turned on "Let agents edit this mix"; reconnects quietly when
 * the bridge starts later.
 */
type LinkStatus = 'off' | 'waiting' | 'connected'
export const useAgentLink = create<{ status: LinkStatus; lastCommand: string | null }>()(() => ({ status: 'off', lastCommand: null }))

let ws: WebSocket | null = null
let retry = 0
/** The bridge request being run right now (set while a command starts, so an async command can claim it). */
let current: number | null = null
const acks = new Map<number, (a: BuildAck['ack']) => void>()

export interface BridgeWriter {
  /** Opens builds/<dir>/ on the bridge's machine; resolves to its absolute path. */
  open: (dir: string) => Promise<string>
  write: (f: BuildFile) => void
  /** Resolves once every file is on disk, with how many there were. */
  flush: () => Promise<number>
}

/**
 * Writes files next to the bridge, for the bridge request whose command is starting. Call it
 * synchronously at the start of a command; null when the command didn't come over the bridge.
 */
export function bridgeWriter(): BridgeWriter | null {
  const id = current
  const sock = ws
  if (id === null || !sock) return null
  const send = (m: BuildMessage) => sock.send(JSON.stringify(m))
  const answer = () =>
    new Promise<BuildAck['ack']>((resolve, reject) => {
      const t = window.setTimeout(() => (acks.delete(id), reject(new Error('The bridge didn’t confirm the files in time'))), 60_000)
      acks.set(id, (a) => (window.clearTimeout(t), acks.delete(id), resolve(a)))
    })
  return {
    open: async (dir) => {
      const a = answer()
      send({ id, build: { dir } })
      const r = await a
      if (r.error || !r.dir) throw new Error(r.error ?? 'The bridge didn’t open a build folder')
      return r.dir
    },
    write: (file) => send({ id, file }),
    flush: async () => {
      const a = answer()
      send({ id, flush: true })
      const r = await a
      if (r.error) throw new Error(r.error)
      return r.written ?? 0
    },
  }
}

function connect() {
  if (!useStore.getState().ui.agentAccess) return
  useAgentLink.setState({ status: 'waiting' })
  try {
    ws = new WebSocket(BRIDGE_URL)
  } catch {
    schedule()
    return
  }
  ws.onopen = () => useAgentLink.setState({ status: 'connected' })
  ws.onmessage = (e) => {
    let msg: { id: number; name: string; input: unknown; ack?: BuildAck['ack'] }
    try {
      msg = JSON.parse(String(e.data))
    } catch {
      return
    }
    if (msg.ack) return acks.get(msg.id)?.(msg.ack)
    // Some commands take a moment (measuring a page, composing a packet): wait for them.
    const run = () => {
      current = msg.id
      try {
        return runCommand(msg.name, msg.input, 'agent')
      } finally {
        current = null
      }
    }
    Promise.resolve()
      .then(run)
      .then(
        (result) => {
          useAgentLink.setState({ lastCommand: msg.name })
          ws?.send(JSON.stringify({ id: msg.id, ok: true, result }))
        },
        (err) => ws?.send(JSON.stringify({ id: msg.id, ok: false, error: (err as Error).message })),
      )
  }
  ws.onclose = () => {
    ws = null
    if (useStore.getState().ui.agentAccess) schedule()
    else useAgentLink.setState({ status: 'off' })
  }
}

function schedule() {
  useAgentLink.setState({ status: 'waiting' })
  window.clearTimeout(retry)
  retry = window.setTimeout(connect, 2500)
}

/** Follow the setting: connect when it's on, hang up when it's off. */
export function startAgentLink() {
  let on = useStore.getState().ui.agentAccess
  if (on) connect()
  useStore.subscribe((s) => {
    if (s.ui.agentAccess === on) return
    on = s.ui.agentAccess
    window.clearTimeout(retry)
    if (on) connect()
    else {
      ws?.close()
      ws = null
      useAgentLink.setState({ status: 'off' })
    }
  })
}

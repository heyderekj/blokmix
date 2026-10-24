import { create } from 'zustand'
import { BRIDGE_URL } from '@/core/commands/bridge'
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
    let msg: { id: number; name: string; input: unknown }
    try {
      msg = JSON.parse(String(e.data))
    } catch {
      return
    }
    let reply: { id: number; ok: boolean; result?: unknown; error?: string }
    try {
      reply = { id: msg.id, ok: true, result: runCommand(msg.name, msg.input, 'agent') }
      useAgentLink.setState({ lastCommand: msg.name })
    } catch (err) {
      reply = { id: msg.id, ok: false, error: (err as Error).message }
    }
    ws?.send(JSON.stringify(reply))
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

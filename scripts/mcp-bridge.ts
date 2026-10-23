/**
 * Mixtape's MCP bridge: lets Claude Code (or any MCP client) drive the Mixtape
 * tab you have open, through the same commands the app's own controls use.
 *
 *   claude mcp add mixtape -- npm --prefix /path/to/mixtape run -s mcp
 *
 * Then in Mixtape: menu → "Let agents edit this tape". The tab connects to this
 * bridge over a local WebSocket (127.0.0.1 only, Mixtape's own origins only);
 * every change an agent makes shows on the canvas and is one undo away.
 */
import { WebSocketServer, type WebSocket } from 'ws'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { toolDefinitions } from '../resources/js/core/commands/schema'
import { BRIDGE_PORT, BRIDGE_PATH, allowedOrigin } from '../resources/js/core/commands/bridge'

// stdout belongs to the MCP protocol; anything human goes to stderr.
const log = (...a: unknown[]) => console.error('[mixtape]', ...a)

let tab: WebSocket | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()

const wss = new WebSocketServer({ host: '127.0.0.1', port: BRIDGE_PORT, path: BRIDGE_PATH })
wss.on('connection', (ws, req) => {
  if (!allowedOrigin(req.headers.origin)) {
    log(`refused a connection from ${req.headers.origin ?? 'an unknown origin'}`)
    ws.close(1008, 'origin not allowed')
    return
  }
  tab?.close(1000, 'replaced by a newer tab')
  tab = ws
  log('Mixtape tab connected')
  ws.on('message', (data) => {
    let msg: { id?: number; ok?: boolean; result?: unknown; error?: string }
    try {
      msg = JSON.parse(String(data))
    } catch {
      return
    }
    const p = msg.id !== undefined ? pending.get(msg.id) : undefined
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(msg.id!)
    if (msg.ok) p.resolve(msg.result)
    else p.reject(new Error(msg.error ?? 'Command failed'))
  })
  ws.on('close', () => {
    if (tab === ws) {
      tab = null
      log('Mixtape tab disconnected')
    }
  })
})
wss.on('error', (e) => log(`couldn’t listen on 127.0.0.1:${BRIDGE_PORT}:`, e.message))

function call(name: string, input: unknown): Promise<unknown> {
  if (!tab || tab.readyState !== tab.OPEN)
    return Promise.reject(new Error('Mixtape isn’t connected. Open Mixtape, then in its menu turn on “Let agents edit this tape”.'))
  const id = ++seq
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Mixtape didn’t answer in time'))
    }, 15000)
    pending.set(id, { resolve, reject, timer })
    tab!.send(JSON.stringify({ id, name, input }))
  })
}

const server = new Server(
  { name: 'mixtape', version: '0.1.0' },
  {
    capabilities: { tools: {} },
    instructions:
      'Mixtape is a canvas where a page is mixed from sections clipped from real sites and built-in layouts. Start with get_page to see sections and their blocks (labelled like "Pricing · Plan 2 · Button"). Prefer looks, palette colours and spacing steps over one-offs, run review after changes, and use show to point the person at what you changed. Every change is one undo away for them.',
  },
)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions().map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema as { type: 'object' } })),
}))
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await call(req.params.name, req.params.arguments ?? {})
    return { content: [{ type: 'text', text: JSON.stringify(result ?? { ok: true }, null, 2) }] }
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: (e as Error).message }] }
  }
})

await server.connect(new StdioServerTransport())
log(`bridge ready on ws://127.0.0.1:${BRIDGE_PORT}${BRIDGE_PATH}`)

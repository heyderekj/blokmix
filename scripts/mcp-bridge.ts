/**
 * Blokmix's MCP bridge: lets Claude Code (or any MCP client) drive the Blokmix
 * tab you have open, through the same commands the app's own controls use.
 *
 *   claude mcp add blokmix -- npm --prefix /path/to/blokmix run -s mcp
 *
 * Agent builds (prepare_build) are written to builds/<mix>-<letter>/ (BLOKMIX_BUILDS
 * moves them).
 *
 * Then in Blokmix: menu → "Let agents edit this mix". The tab connects to this
 * bridge over a local WebSocket (127.0.0.1 only, Blokmix's own origins only);
 * every change an agent makes shows on the canvas and is one undo away.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { toolDefinitions } from '../resources/js/core/commands/schema'
import { BRIDGE_PORT, BRIDGE_PATH, allowedOrigin, safeBuildDir, safeBuildPath, timeoutFor, type BuildAck, type BuildFile } from '../resources/js/core/commands/bridge'

// stdout belongs to the MCP protocol; anything human goes to stderr.
const log = (...a: unknown[]) => console.error('[blokmix]', ...a)

let tab: WebSocket | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()

// Agent builds (prepare_build) land in builds/<mix>-<letter>/, next to this repo unless BLOKMIX_BUILDS says otherwise.
const BUILDS = resolve(process.env.BLOKMIX_BUILDS ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'builds'))
const writing = new Map<number, { dir: string; written: number }>()

/** Handles a build's file messages; true when the message was one. */
function buildMessage(ws: WebSocket, msg: { id: number; build?: { dir: string }; file?: BuildFile; flush?: boolean }): boolean {
  const ack = (a: BuildAck['ack']) => ws.send(JSON.stringify({ id: msg.id, ack: a } satisfies BuildAck))
  if (msg.build) {
    const name = safeBuildDir(msg.build.dir)
    if (!name || !pending.has(msg.id)) return ack({ error: `Can’t write a build to “${msg.build.dir}”` }), true
    const dir = join(BUILDS, name)
    try {
      mkdirSync(dir, { recursive: true })
    } catch (e) {
      return ack({ error: `Couldn’t create ${dir}: ${(e as Error).message}` }), true
    }
    writing.set(msg.id, { dir, written: 0 })
    ack({ dir })
    return true
  }
  if (msg.file) {
    const w = writing.get(msg.id)
    const rel = safeBuildPath(msg.file.path)
    const target = w && rel ? resolve(w.dir, rel) : null
    // Every path is checked twice: as written, and once resolved, it must stay inside the build's folder.
    if (!w || !target || !target.startsWith(w.dir + sep)) {
      log(`refused to write “${msg.file.path}”`)
      if (w) w.written = -Infinity
      return true
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, msg.file.enc === 'base64' ? Buffer.from(msg.file.data, 'base64') : msg.file.data)
    w.written++
    return true
  }
  if (msg.flush) {
    const w = writing.get(msg.id)
    writing.delete(msg.id)
    if (!w) ack({ error: 'No build is being written' })
    else if (w.written < 0) ack({ error: 'Some files had paths outside the build folder, so the build was refused' })
    else {
      log(`wrote ${w.written} files to ${w.dir}`)
      ack({ written: w.written })
    }
    return true
  }
  return false
}

/** More hosted origins to trust (a preview or staging address), comma-separated: BLOKMIX_ORIGINS=https://… */
const EXTRA_ORIGINS = (process.env.BLOKMIX_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

const wss = new WebSocketServer({ host: '127.0.0.1', port: BRIDGE_PORT, path: BRIDGE_PATH })
wss.on('connection', (ws, req) => {
  if (!allowedOrigin(req.headers.origin, EXTRA_ORIGINS)) {
    log(`refused a connection from ${req.headers.origin ?? 'an unknown origin'}`)
    ws.close(1008, 'origin not allowed')
    return
  }
  tab?.close(1000, 'replaced by a newer tab')
  tab = ws
  log('Blokmix tab connected')
  ws.on('message', (data) => {
    let msg: { id?: number; ok?: boolean; result?: unknown; error?: string; build?: { dir: string }; file?: BuildFile; flush?: boolean }
    try {
      msg = JSON.parse(String(data))
    } catch {
      return
    }
    if (msg.id !== undefined && buildMessage(ws, msg as { id: number })) return
    const p = msg.id !== undefined ? pending.get(msg.id) : undefined
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(msg.id!)
    writing.delete(msg.id!)
    if (msg.ok) p.resolve(msg.result)
    else p.reject(new Error(msg.error ?? 'Command failed'))
  })
  ws.on('close', () => {
    if (tab === ws) {
      tab = null
      log('Blokmix tab disconnected')
    }
  })
})
wss.on('error', (e) => log(`couldn’t listen on 127.0.0.1:${BRIDGE_PORT}:`, e.message))

function call(name: string, input: unknown): Promise<unknown> {
  if (!tab || tab.readyState !== tab.OPEN)
    return Promise.reject(new Error('Blokmix isn’t connected. Open Blokmix, then in its menu turn on “Let agents edit this mix”.'))
  const id = ++seq
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Blokmix didn’t answer in time'))
    }, timeoutFor(name))
    pending.set(id, { resolve, reject, timer })
    tab!.send(JSON.stringify({ id, name, input }))
  })
}

const server = new Server(
  { name: 'blokmix', version: '0.1.0' },
  {
    capabilities: { tools: {} },
    instructions:
      'Blokmix is a canvas where a page is mixed from sections clipped from real sites and built-in layouts. Start with get_page to see sections and their blocks (labelled like "Pricing · Plan 2 · Button"). Prefer looks, palette colours and spacing steps over one-offs, run review after changes, and use show to point the person at what you changed. Every change is one undo away for them. To build a version for real: list_versions, then prepare_build (it writes the packet to disk and returns the prompt; a mix that isn’t paid for refuses and says how to pay), build and preview it, report_build with the preview URL, and if ReviseMy is connected run its review loop and bring the marks back with import_review_marks.',
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

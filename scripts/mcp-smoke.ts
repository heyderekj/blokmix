/**
 * Smoke test for the MCP bridge: starts it like an MCP client would, lists the
 * tools, and (when a Mixtape tab is connected) reads the page.
 *   npx vite-node scripts/mcp-smoke.ts [command] [json-input]
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const [name = 'get_page', input = '{}'] = process.argv.slice(2)
const client = new Client({ name: 'mixtape-smoke', version: '0.0.0' })
await client.connect(new StdioClientTransport({ command: 'npm', args: ['run', '-s', 'mcp'], cwd: process.cwd(), stderr: 'inherit' }))
const { tools } = await client.listTools()
console.log(`${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`)
// Give the tab a moment to (re)connect to the fresh bridge.
await new Promise((r) => setTimeout(r, Number(process.env.WAIT ?? 4000)))
const res = await client.callTool({ name, arguments: JSON.parse(input) })
const text = (res.content as { text: string }[])[0]?.text ?? ''
console.log(res.isError ? `ERROR: ${text}` : text.slice(0, 1500))
await client.close()

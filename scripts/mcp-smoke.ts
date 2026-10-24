/**
 * Smoke test for the MCP bridge: starts it like an MCP client would, lists the
 * tools, and (when a Blokmix tab is connected) runs one command.
 *   npx vite-node scripts/mcp-smoke.ts [command] [json-input]
 *
 * `build` runs the agent build loop's first steps instead: list_versions →
 * prepare_build (checks the packet landed on disk) → report_build.
 *   npx vite-node scripts/mcp-smoke.ts build [version]
 * It leaves a finished build on the canvas; delete it there when you're done.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const [name = 'get_page', input = '{}'] = process.argv.slice(2)
const client = new Client({ name: 'blokmix-smoke', version: '0.0.0' })
await client.connect(new StdioClientTransport({ command: 'npm', args: ['run', '-s', 'mcp'], cwd: process.cwd(), stderr: 'inherit' }))
const { tools } = await client.listTools()
console.log(`${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`)
// Give the tab a moment to (re)connect to the fresh bridge.
await new Promise((r) => setTimeout(r, Number(process.env.WAIT ?? 4000)))

async function call<T = unknown>(tool: string, args: Record<string, unknown>): Promise<T> {
  const res = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 130_000 })
  const text = (res.content as { text: string }[])[0]?.text ?? ''
  if (res.isError) throw new Error(`${tool}: ${text}`)
  return JSON.parse(text) as T
}

function check(ok: unknown, what: string) {
  console.log(`${ok ? '✓' : '✗'} ${what}`)
  if (!ok) process.exitCode = 1
}

if (name === 'build') {
  const { versions } = await call<{ versions: { letter: string; kind: string }[] }>('list_versions', {})
  const version = process.argv[3] ?? versions.find((v) => v.kind === 'snapshot')?.letter
  check(version, `list_versions: ${versions.length} versions${version ? `, building ${version}` : ' (save one first)'}`)
  if (version) {
    const b = await call<{ build: string; dir: string; files: string[]; prompt: string }>('prepare_build', { version, target: 'astro', agent_name: 'Smoke test' })
    const missing = b.files.filter((f) => !existsSync(join(b.dir, f)))
    check(b.files.length && !missing.length, `prepare_build: ${b.build}, ${b.files.length} files in ${b.dir}${missing.length ? `; missing ${missing.slice(0, 5).join(', ')}` : ''}`)
    check(b.prompt.includes('report_build'), 'prepare_build: the prompt spells out the loop')
    await call('report_build', { build: b.build, step: 'Smoke test step' })
    const done = await call<{ status: string; build: { steps: string[]; done: boolean; dir: string } }>('report_build', { build: b.build, done: true })
    check(done.build.done && done.build.steps.includes('Smoke test step') && done.build.dir === b.dir, `report_build: ${b.build} is ${done.status}`)
  }
} else {
  const res = await client.callTool({ name, arguments: JSON.parse(input) })
  const text = (res.content as { text: string }[])[0]?.text ?? ''
  console.log(res.isError ? `ERROR: ${text}` : text.slice(0, 1500))
}
await client.close()

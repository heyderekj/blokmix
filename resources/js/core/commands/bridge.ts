/** Where the local MCP bridge listens, shared by the bridge script and the app. */
export const BRIDGE_PORT = 4317
export const BRIDGE_PATH = '/blokmix'
export const BRIDGE_URL = `ws://127.0.0.1:${BRIDGE_PORT}${BRIDGE_PATH}`

/** How long the bridge waits for the tab. Commands that compose or measure a whole page get longer. */
export const COMMAND_TIMEOUTS: Record<string, number> = { prepare_build: 120_000, review: 30_000 }
export const timeoutFor = (name: string) => COMMAND_TIMEOUTS[name] ?? 15_000

/** Only Blokmix itself, served locally, may connect. */
export function allowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  try {
    const u = new URL(origin)
    return (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.localhost')) && (u.protocol === 'http:' || u.protocol === 'https:')
  } catch {
    return false
  }
}

/**
 * Files an agent build writes through the bridge. The tab sends, for the command's request id:
 * `{id, build: {dir}}` (the bridge answers `{id, ack: {dir}}` with the absolute folder), then one
 * `{id, file}` per file, then `{id, flush: true}` (answered `{id, ack: {written}}`), then the result.
 */
export interface BuildFile {
  path: string
  enc: 'utf8' | 'base64'
  data: string
}
export type BuildMessage = { id: number; build: { dir: string } } | { id: number; file: BuildFile } | { id: number; flush: true }
export type BuildAck = { id: number; ack: { dir?: string; written?: number; error?: string } }

/** A packet path the bridge may write: relative, forward slashes, no `..`, nothing hidden at the root. Null when it isn't. */
export function safeBuildPath(p: string): string | null {
  if (typeof p !== 'string' || !p || p.length > 400) return null
  if (/[\0\\:]/.test(p) || p.startsWith('/') || p.startsWith('~')) return null
  const parts = p.split('/')
  if (parts.some((s) => !s || s === '.' || s === '..')) return null
  return parts.join('/')
}

/** A build's folder name: one plain segment ("launch-week-b-1"). Null when it isn't one. */
export function safeBuildDir(d: string): string | null {
  return typeof d === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(d) ? d : null
}

/** builds/<mix-slug>-<letter>, with the letter made path-safe ("B.1" → "b-1"). */
export function buildDirName(mixName: string, letter: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${(slug(mixName) || 'blokmix').slice(0, 60)}-${slug(letter) || 'build'}`
}

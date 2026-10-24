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

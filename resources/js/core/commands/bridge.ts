/** Where the local MCP bridge listens, shared by the bridge script and the app. */
export const BRIDGE_PORT = 4317
export const BRIDGE_PATH = '/mixtape'
export const BRIDGE_URL = `ws://127.0.0.1:${BRIDGE_PORT}${BRIDGE_PATH}`

/** Only Mixtape itself, served locally, may connect. */
export function allowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  try {
    const u = new URL(origin)
    return (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.localhost')) && (u.protocol === 'http:' || u.protocol === 'https:')
  } catch {
    return false
  }
}

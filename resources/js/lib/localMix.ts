import { STORAGE_KEY } from '@/state/store'
import { api, type ServerMix } from './mixSync'

/** The mix kept in this browser (the /local board, or the Vite-only app), as it's saved: null when there isn't one. */
export function localMixState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('mixtape:v1')
    return (raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }).state : null) ?? null
  } catch {
    return null
  }
}

/**
 * Copy the browser's mix to your mixes on the server (the browser keeps its copy). Resolves to the new mix's short
 * address, or the reason it couldn't (a full plan, a dropped connection), in words.
 */
export async function saveLocalMix(state: Record<string, unknown>, fallbackName = 'Untitled mix'): Promise<{ short: string } | { problem: string }> {
  const { mixName, versions, drafts, ui: _ui, camera: _camera, ...data } = state
  void _ui
  void _camera
  try {
    const res = await api<ServerMix & { short: string; message?: string }>('POST', '/api/mixes', { name: (mixName as string | undefined) ?? fallbackName, data, versions: versions ?? {}, ...(drafts ? { drafts } : {}) })
    return res.status === 201 ? { short: res.body.short } : { problem: res.body?.message ?? 'Couldn’t save that mix. Try again.' }
  } catch {
    return { problem: 'Couldn’t reach Blokmix. Check your connection and try again.' }
  }
}

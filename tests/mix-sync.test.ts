import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '@/state/store'
import { buildSeed } from '@/state/seed'
import { library } from '@/data/library'
import { openMix, useSave, type ServerMix } from '@/lib/mixSync'

// A browser's localStorage (before the store is made, so it persists), and a server that records what it's sent.
const ls = vi.hoisted(() => {
  const m = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) },
    document: { cookie: 'XSRF-TOKEN=tok%3D' },
  })
  return m
})

type Call = { method: string; url: string; headers: Record<string, string>; body: Record<string, unknown> | undefined }
let calls: Call[] = []
let reply: (c: Call) => { status: number; body: unknown } | Promise<never>
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const call = { method: String(init.method), url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined }
  calls.push(call)
  const r = await reply(call)
  return { status: r.status, json: async () => r.body } as Response
})
vi.stubGlobal('fetch', fetchMock)

const seed = buildSeed(library)
const serverMix = (over: Partial<ServerMix> = {}): ServerMix => {
  const { mixName, versions, ...data } = seed
  return { id: 'm1', name: mixName, data, versions, lock: 1, ...over }
}
const settle = async () => {
  await vi.advanceTimersByTimeAsync(1000)
  await vi.runOnlyPendingTimersAsync()
}

beforeEach(() => {
  vi.useFakeTimers()
  ls.clear()
  calls = []
  reply = () => ({ status: 200, body: { lock: 2 } })
})
afterEach(() => {
  openMix('local')
  vi.useRealTimers()
})

describe('saving a mix to the server', () => {
  it('opens the server’s mix and sends nothing until it changes', async () => {
    openMix(serverMix({ name: 'From the server' }))
    expect(useStore.getState().mixName).toBe('From the server')
    expect(useSave.getState()).toMatchObject({ mixId: 'm1', status: 'saved' })
    await settle()
    expect(calls).toHaveLength(0)
  })

  it('sends only what changed, a moment later, naming its lock', async () => {
    openMix(serverMix())
    useStore.getState().renameMix('Launch page')
    useStore.getState().renameMix('Launch site')
    expect(useSave.getState().status).toBe('saving')
    await settle()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'PUT', url: '/api/mixes/m1', body: { name: 'Launch site' } })
    expect(calls[0].headers['If-Match']).toBe('"1"')
    expect(calls[0].headers['X-XSRF-TOKEN']).toBe('tok=')
    expect(useSave.getState().status).toBe('saved')

    // The next save names the lock the server gave back, and sends the new version only.
    useStore.getState().pressVersion()
    await settle()
    const put = calls[1].body!.versions as { put: Record<string, unknown>; remove: string[] }
    expect(calls[1].headers['If-Match']).toBe('"2"')
    expect(Object.keys(put.put)).toHaveLength(1)
    expect(put.remove).toEqual([])
    expect(calls[1].body!.data).toBeDefined()
  })

  it('shows the mix as it is now when another tab saved first', async () => {
    openMix(serverMix())
    reply = () => ({ status: 412, body: { mix: serverMix({ name: 'Saved in another tab', lock: 5 }) } })
    useStore.getState().renameMix('Mine')
    await settle()
    expect(useStore.getState().mixName).toBe('Saved in another tab')
    reply = () => ({ status: 200, body: { lock: 6 } })
    useStore.getState().renameMix('After')
    await settle()
    expect(calls.at(-1)!.headers['If-Match']).toBe('"5"')
  })

  it('keeps edits in this browser while offline, then sends them', async () => {
    openMix(serverMix())
    reply = () => Promise.reject(new TypeError('Failed to fetch'))
    useStore.getState().renameMix('Offline edit')
    await vi.advanceTimersByTimeAsync(900)
    expect(useSave.getState().status).toBe('offline')
    const cache = JSON.parse(ls.get('blokmix:mix:m1')!)
    expect(cache.unsent.mixName).toBe('Offline edit')

    // A reload on the same lock picks the unsent edits up.
    openMix('local')
    openMix(serverMix())
    expect(useStore.getState().mixName).toBe('Offline edit')

    reply = () => ({ status: 200, body: { lock: 2 } })
    await vi.advanceTimersByTimeAsync(31_000)
    useStore.getState().renameMix('Offline edit')
    await settle()
    expect(calls.at(-1)!.body).toMatchObject({ name: 'Offline edit' })
    expect(useSave.getState().status).toBe('saved')
  })

  it('starts a new mix blank and saves it whole', async () => {
    openMix(serverMix({ id: 'm2', name: 'Untitled mix', data: null, versions: {} }))
    const st = useStore.getState()
    expect(st.site.pages).toHaveLength(1)
    expect(st.site.pages[0].slots).toHaveLength(0)
    st.addSlot('hero')
    await settle()
    expect(calls[0].url).toBe('/api/mixes/m2')
    expect((calls[0].body!.data as { site: unknown }).site).toBeDefined()
  })
})

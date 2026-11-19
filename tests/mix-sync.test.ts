import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '@/state/store'
import { buildSeed } from '@/state/seed'
import { library } from '@/data/library'
import { discardRecovery, flushMix, openMix, useSave, type ServerMix } from '@/lib/mixSync'

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
type Reply = { status: number; body: unknown }
let reply: (c: Call) => Reply | Promise<Reply>
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  // Only saves are recorded; the uploads list (GET …/assets) answers empty.
  if (!init?.method || init.method === 'GET') return { status: 200, ok: true, json: async () => [] } as unknown as Response
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

  it('a view change (the camera at rest) sends nothing and writes the offline copy a moment later', async () => {
    openMix(serverMix())
    useStore.getState().setCamera({ x: 0, y: 0, z: 1 })
    await settle()
    calls = []
    ls.delete('blokmix:mix:m1')
    useStore.getState().setCamera({ x: 1, y: 2, z: 0.5 })
    useStore.getState().setCamera({ x: 3, y: 4, z: 0.5 })
    expect(ls.get('blokmix:mix:m1')).toBeUndefined()
    await settle()
    expect(calls).toHaveLength(0)
    expect(JSON.parse(ls.get('blokmix:mix:m1')!).camera).toEqual({ x: 3, y: 4, z: 0.5 })
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

  it('keeps the latest local edits in recovery when another tab saves first', async () => {
    openMix(serverMix())
    let finish!: (r: Reply) => void
    reply = () => new Promise((resolve) => { finish = resolve })
    useStore.getState().renameMix('Mine')
    const pending = flushMix()
    useStore.getState().renameMix('Edited during the save')
    const next = serverMix({ name: 'Saved in another tab', lock: 5 })
    finish({ status: 412, body: { mix: next } })
    await pending
    await settle()
    expect(calls).toHaveLength(1)
    expect(useStore.getState().mixName).toBe('Saved in another tab')
    openMix('local')
    openMix(next)
    const [recovery] = useSave.getState().recoveries
    expect(recovery.state.mixName).toBe('Edited during the save')
    reply = () => ({ status: 200, body: { lock: 6 } })
    useStore.getState().renameMix('After')
    await settle()
    expect(calls.at(-1)!.headers['If-Match']).toBe('"5"')
    expect(useSave.getState().recoveries).toHaveLength(1)
    discardRecovery(recovery.id)
    expect(useSave.getState().recoveries).toHaveLength(0)
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
    expect(useSave.getState().status).toBe('saving')

    reply = () => ({ status: 200, body: { lock: 2 } })
    await settle()
    expect(calls.at(-1)!.body).toMatchObject({ name: 'Offline edit' })
    expect(useSave.getState().status).toBe('saved')
  })

  it('keeps offline edits in recovery when the server changed before reopening the mix', async () => {
    openMix(serverMix())
    reply = () => Promise.reject(new TypeError('Failed to fetch'))
    useStore.getState().renameMix('Offline edit')
    await flushMix()
    openMix('local')
    const newer = serverMix({ lock: 8, name: 'Saved elsewhere' })
    openMix(newer)
    expect(useStore.getState().mixName).toBe('Saved elsewhere')
    expect(useSave.getState().recoveries.map((r) => r.state.mixName)).toEqual(['Offline edit'])
    const count = calls.length
    await settle()
    expect(calls).toHaveLength(count)
    openMix('local')
    openMix(newer)
    expect(useSave.getState().recoveries).toHaveLength(1)
  })

  it('does not clear another tab’s cached work when a save finishes', async () => {
    openMix(serverMix())
    let finish!: (r: Reply) => void
    reply = () => new Promise((resolve) => { finish = resolve })
    useStore.getState().renameMix('Saved from here')
    const pending = flushMix()
    const cached = JSON.parse(ls.get('blokmix:mix:m1')!)
    cached.writer = 'other-tab'
    cached.unsent.mixName = 'Still pending in the other tab'
    ls.set('blokmix:mix:m1', JSON.stringify(cached))
    finish({ status: 200, body: { lock: 2 } })
    await pending

    expect(useSave.getState().status).toBe('saved')
    expect(JSON.parse(ls.get('blokmix:mix:m1')!).unsent.mixName).toBe('Still pending in the other tab')
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

  it('lets a viewer leave marks but puts any other change back', async () => {
    openMix(serverMix({ id: 'm3' }), { role: 'viewer' })
    const st = useStore.getState()
    const site = st.site
    st.addSlot('faq')
    expect(useStore.getState().site).toBe(site)
    expect(useStore.getState().flash?.text).toMatch(/view this site and leave marks/)
    useStore.getState().addMark({ anchor: { kind: 'page' }, kind: 'keep', text: 'Love the hero' })
    expect(useStore.getState().notes.at(-1)?.text).toBe('Love the hero')
    await settle()
    expect(calls.at(-1)!.body!.data).toMatchObject({ notes: expect.arrayContaining([expect.objectContaining({ text: 'Love the hero' })]) })
    openMix('local')
    useStore.getState().addSlot('faq')
    expect(useStore.getState().site).not.toBe(site)
  })
})

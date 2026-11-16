import { create } from 'zustand'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { VersionNode } from '@/core/types'
import type { Draft } from '@/core/drafts'
import { STORAGE_KEY, localMixStorage, sameMix, useStore, type MixData, type Persisted } from '@/state/store'
import { blankMix } from '@/state/seed'
import { uid } from '@/state/uid'
import { useAccount, type MixRole } from './account'
import { xsrf } from './http'
import { assetIdsIn, syncAssets } from './assets'

/**
 * Saving a mix to the server. The store persists through whichever storage is
 * plugged in: this browser's (the "local" mix) or a server mix's. A server mix
 * saves a moment after each change, one request at a time, sending only what
 * changed (the mix's data, its name, and the versions that changed). Each save
 * names the lock it last read; a stale one gets the mix as it is now, which
 * replaces what's on screen after keeping the unsent work as a recovery copy.
 * This device's view (ui, camera) and edits not yet sent stay in localStorage.
 */

/** A mix as the server sends it (Mix::toBoard). */
export interface ServerMix {
  id: string
  name: string
  data: MixFields | null
  versions: Record<string, VersionNode>
  /** The mix's drafts, by id (the open one's body is in `data`). */
  drafts?: Record<string, Draft>
  lock: number
  schema?: number
  /** Archived: read-only until its owner brings it back. */
  archived?: boolean
  /** Whether it can be exported and built: paid for, its owner has Plus from before, or the waitlist. */
  ships?: boolean
}

type MixFields = Omit<MixData, 'mixName' | 'versions' | 'drafts'>
const FIELDS = ['site', 'guide', 'content', 'contract', 'notes', 'branchFrom', 'head', 'draftId', 'framePos', 'clips'] as const
/** Versions and drafts each go up one by one: only the ones that changed. */
type Keyed = 'versions' | 'drafts'
type KeyedPut = { versions: VersionNode; drafts: Draft }

export type SaveStatus = 'local' | 'saved' | 'saving' | 'offline' | 'error'
interface Recovery {
  id: string
  at: number
  state: Persisted
}
/** How saving is going, for the top bar. */
export const useSave = create<{ status: SaveStatus; mixId: string; recoveries: Recovery[] }>()(() => ({ status: 'local', mixId: 'local', recoveries: [] }))

const SAVE_AFTER = 800
const VIEW_AFTER = 1000
const cacheKey = (id: string) => `blokmix:mix:${id}`
const recoveryKey = (id: string) => `${cacheKey(id)}:recovery`
// Keep recovery available in this session even if the browser is out of storage.
const memoryRecovery = new Map<string, Recovery[]>()

function readRecoveries(id: string): Recovery[] {
  try {
    return memoryRecovery.get(id) ?? JSON.parse(localStorage.getItem(recoveryKey(id)) ?? '[]')
  } catch {
    return []
  }
}

function saveRecoveries(id: string, recoveries: Recovery[]) {
  try {
    if (recoveries.length) localStorage.setItem(recoveryKey(id), JSON.stringify(recoveries))
    else localStorage.removeItem(recoveryKey(id))
    memoryRecovery.delete(id)
  } catch {
    memoryRecovery.set(id, recoveries)
  }
  if (useSave.getState().mixId === id) useSave.setState({ recoveries })
}

function keepRecovery(id: string, state: Persisted) {
  saveRecoveries(id, [{ id: uid('recovery'), at: Date.now(), state }, ...readRecoveries(id)])
}

export function discardRecovery(recoveryId: string) {
  const id = useSave.getState().mixId
  saveRecoveries(id, readRecoveries(id).filter((r) => r.id !== recoveryId))
}

interface Cache {
  lock: number
  /** Which open board wrote the pending work. */
  writer?: string
  ui?: Persisted['ui']
  camera?: Persisted['camera']
  /** The whole mix, while edits are waiting to be sent. */
  unsent?: Persisted
}

const readCache = (id: string): Cache | null => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(id)) ?? 'null') as Cache | null
  } catch {
    return null
  }
}
const writeCache = (id: string, c: Cache) => {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(c))
  } catch {
    // A full localStorage only costs the offline copy; the server still has the mix.
  }
}

const fields = (s: Partial<Persisted>): MixFields => Object.fromEntries(FIELDS.map((k) => [k, s[k]])) as MixFields
const json = new WeakMap<object, string>()
/** JSON for a version or draft, remembered per object (they're replaced, never changed in place). */
const nodeJson = (v: object) => {
  let s = json.get(v)
  if (s === undefined) json.set(v, (s = JSON.stringify(v)))
  return s
}


export async function api<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}, keepalive = false): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    keepalive,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...xsrf(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: (res.status === 204 ? null : await res.json().catch(() => null)) as T }
}

class MixSync {
  readonly id: string
  private lock: number
  /** What the server has, to send only the difference. */
  private base: { name: string; data: string | null; versions: Record<string, string>; drafts: Record<string, string> }
  private latest: Persisted | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private inflight: Promise<void> | null = null
  private retry = 0
  private closed = false
  private viewTimer: ReturnType<typeof setTimeout> | undefined
  /** Whether the latest state holds edits the server doesn't have yet. */
  private unsent = false
  private resume = false
  private writer = uid('save')

  constructor(mix: ServerMix) {
    this.id = mix.id
    this.lock = mix.lock
    this.base = {
      name: mix.name,
      data: mix.data ? JSON.stringify(mix.data) : null,
      versions: Object.fromEntries(Object.entries(mix.versions ?? {}).map(([k, v]) => [k, JSON.stringify(v)])),
      drafts: Object.fromEntries(Object.entries(mix.drafts ?? {}).map(([k, v]) => [k, JSON.stringify(v)])),
    }
  }

  /** What the board starts from: the server's mix, or edits this browser hadn't sent yet (when made on top of the same lock). */
  initial(mix: ServerMix): Persisted {
    const cache = readCache(mix.id)
    if (cache?.unsent) {
      if (cache.lock === mix.lock && !mix.archived) {
        this.resume = true
        writeCache(this.id, { ...cache, writer: this.writer })
        return cache.unsent
      }
      if (this.diff(cache.unsent)) keepRecovery(this.id, cache.unsent)
      writeCache(this.id, { lock: mix.lock, ui: cache.ui, camera: cache.camera })
    }
    const view = { ui: cache?.ui, camera: cache?.camera ?? null }
    // A new mix may hold only some fields (a guide it started from); a blank mix fills the rest.
    const data = { ...fields(blankMix(mix.name)), ...mix.data }
    return { ...data, mixName: mix.name, versions: mix.versions ?? {}, ...(mix.drafts && Object.keys(mix.drafts).length ? { drafts: mix.drafts } : {}), ...view } as Persisted
  }

  start(state: Persisted) {
    if (this.resume) this.changed(state)
    else this.latest = state
  }

  storage(mix: ServerMix): PersistStorage<Persisted> {
    const start = this.initial(mix)
    return {
      getItem: () => ({ state: start, version: 1 }),
      setItem: (_name: string, value: StorageValue<Persisted>) => this.changed(value.state),
      removeItem: () => {},
    }
  }

  private changed(state: Persisted) {
    if (this.closed) return
    const quiet = sameMix(this.latest, state)
    this.latest = state
    clearTimeout(this.viewTimer)
    if (quiet) {
      // Only this device's view moved (the camera came to rest): nothing to compare or send, and the offline copy
      // is written a moment after the last such change.
      this.viewTimer = setTimeout(() => this.writeView(), VIEW_AFTER)
      return
    }
    // A change back to the old base still needs saving if an in-flight request is about to change that base.
    this.unsent = !!this.inflight || !!this.diff(state)
    this.writeView(true)
    if (!this.unsent) return
    useSave.setState({ status: 'saving' })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), SAVE_AFTER)
  }

  /** This device's view (and the edits still waiting to be sent) into the offline copy. */
  writeView(replacePending = false) {
    clearTimeout(this.viewTimer)
    const s = this.latest
    if (!s) return
    const cache = readCache(this.id)
    if (cache?.unsent && cache.writer && cache.writer !== this.writer) {
      if (!replacePending || !this.unsent) return
      keepRecovery(this.id, cache.unsent)
    }
    writeCache(this.id, { lock: this.lock, ui: s.ui, camera: s.camera, ...(this.unsent ? { writer: this.writer, unsent: s } : {}) })
  }

  private diff(state: Persisted) {
    const out: { name?: string; data?: MixFields } & { [K in Keyed]?: { put: Record<string, KeyedPut[K]>; remove: string[] } } = {}
    if (state.mixName !== this.base.name) out.name = state.mixName
    const data = JSON.stringify(fields(state))
    if (data !== this.base.data) out.data = fields(state)
    for (const key of ['versions', 'drafts'] as const) {
      const now = (state[key] ?? {}) as Record<string, object>
      const put: Record<string, object> = {}
      for (const [k, v] of Object.entries(now)) if (this.base[key][k] !== nodeJson(v)) put[k] = v
      const remove = Object.keys(this.base[key]).filter((k) => !now[k])
      if (Object.keys(put).length || remove.length) (out as Record<string, unknown>)[key] = { put, remove }
    }
    return Object.keys(out).length ? out : null
  }

  /** Send what changed now. One request at a time; a change made meanwhile goes in the next. */
  async flush(keepalive = false): Promise<void> {
    clearTimeout(this.timer)
    if (this.inflight) {
      await this.inflight
      if (!keepalive) return this.flush()
    }
    const state = this.latest
    const change = this.unsent && state && this.diff(state)
    if (!state || !change) {
      this.unsent = false
      this.writeView()
      if (!this.closed) useSave.setState({ status: 'saved' })
      return
    }
    this.inflight = (async () => {
      try {
        const res = await api<{ lock: number; mix?: ServerMix }>('PUT', `/api/mixes/${this.id}`, change, { 'If-Match': `"${this.lock}"` }, keepalive)
        if (res.status === 200) {
          this.lock = res.body.lock
          this.base = {
            name: change.name ?? this.base.name,
            data: change.data ? JSON.stringify(change.data) : this.base.data,
            versions: Object.fromEntries(Object.entries(state.versions ?? {}).map(([k, v]) => [k, nodeJson(v)])),
            drafts: Object.fromEntries(Object.entries(state.drafts ?? {}).map(([k, v]) => [k, nodeJson(v)])),
          }
          this.retry = 0
          const still = this.latest && this.diff(this.latest)
          this.unsent = !!still
          this.writeView()
          if (!this.closed) useSave.setState({ status: still ? 'saving' : 'saved' })
          if (still && !this.closed) this.timer = setTimeout(() => void this.flush(), SAVE_AFTER)
        } else if (res.status === 412 && res.body.mix) {
          // Include edits made during the request and stop the old sync from retrying them.
          const unsent = this.latest ?? state
          const recovery = new MixSync(res.body.mix).diff(unsent)
          if (recovery) keepRecovery(this.id, unsent)
          this.latest = null
          this.unsent = false
          const cache = readCache(this.id)
          if (cache?.lock === this.lock && (!cache.writer || cache.writer === this.writer)) {
            writeCache(this.id, { lock: res.body.mix.lock, ui: cache.ui, camera: cache.camera })
          }
          if (!this.closed) {
            openMix(res.body.mix, { force: true })
            if (recovery) useStore.getState().showFlash('This mix changed elsewhere. Download your unsent edits from the mix menu.')
          }
        } else {
          if (!this.closed) useSave.setState({ status: 'error' })
          console.error('Saving the mix failed', res.status, res.body)
        }
      } catch {
        // Offline or the server's away: keep the edits here and try again, backing off.
        if (!this.closed) {
          useSave.setState({ status: 'offline' })
          this.retry++
          this.timer = setTimeout(() => void this.flush(), Math.min(30_000, 1000 * 2 ** this.retry))
        }
      } finally {
        this.inflight = null
      }
    })()
    return this.inflight
  }

  close() {
    if (this.viewTimer) this.writeView()
    void this.flush(true)
    this.closed = true
  }
}

let current: MixSync | null = null

/** Send whatever's waiting now (before signing out, say). */
export const flushMix = () => current?.flush() ?? Promise.resolve()
let openId = 'local'
export const openMixId = () => openId

/**
 * Point the store at a mix: "local" (this browser's) or one from the server.
 * Saves whatever the previous one had waiting first. Undo history starts over.
 */
export function openMix(mix: ServerMix | 'local', opts: { force?: boolean; role?: MixRole } = {}) {
  const id = mix === 'local' ? 'local' : mix.id
  const role = mix === 'local' ? 'owner' : (opts.role ?? useAccount.getState().role)
  useAccount.setState({ role })
  if (id === openId && !opts.force) return
  current?.close()
  current = null
  viewOnly?.()
  viewOnly = null
  openId = id
  const persist = useStore.persist
  let sync: MixSync | null = null
  if (mix === 'local') {
    persist.setOptions({ name: STORAGE_KEY, storage: localMixStorage() })
    useSave.setState({ status: 'local', mixId: 'local', recoveries: [] })
  } else {
    sync = new MixSync(mix)
    current = sync
    persist.setOptions({ name: cacheKey(mix.id), storage: sync.storage(mix) })
    useSave.setState({ status: 'saved', mixId: mix.id, recoveries: readRecoveries(mix.id) })
  }
  void persist.rehydrate()
  sync?.start(persist.getOptions().partialize!(useStore.getState()))
  useStore.temporal.getState().clear()
  if (role === 'viewer') viewOnly = holdStill()
  // Uploads: fetch what this browser lacks, send what the server lacks.
  if (mix !== 'local') {
    const st = useStore.getState()
    const recoveries = useSave.getState().recoveries.map((r) => [r.state.site, r.state.versions, r.state.drafts])
    void syncAssets(mix.id, assetIdsIn([st.site, st.versions, st.drafts, recoveries]), role !== 'viewer')
  } else void syncAssets(null, [], false)
}

/** What a viewer can't change: everything but the marks (notes) and their own view. */
const HELD = ['mixName', 'site', 'guide', 'content', 'contract', 'versions', 'branchFrom', 'head', 'clips', 'drafts', 'draftId'] as const
let viewOnly: (() => void) | null = null

/**
 * A viewer looks and leaves marks. Any other change, from a control, a shortcut or
 * an agent, is put back as it happens (the server would refuse it anyway).
 */
function holdStill(): () => void {
  const held = Object.fromEntries(HELD.map((k) => [k, useStore.getState()[k]])) as Pick<MixData, (typeof HELD)[number]>
  let told = false
  return useStore.subscribe((st) => {
    if (HELD.every((k) => st[k] === held[k])) return
    useStore.setState(held)
    if (!told) {
      told = true
      st.showFlash('You can view this mix and leave marks. Ask its owner to make you an editor to change it.')
    }
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === recoveryKey(openId)) useSave.setState({ recoveries: readRecoveries(openId) })
  })
  // Last chance to send edits when the tab closes (the offline copy covers it if this doesn't make it).
  window.addEventListener('pagehide', () => {
    current?.writeView()
    void current?.flush(true)
  })
}

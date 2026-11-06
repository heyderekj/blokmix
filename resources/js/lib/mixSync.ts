import { create } from 'zustand'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { VersionNode } from '@/core/types'
import { STORAGE_KEY, localMixStorage, sameMix, useStore, type MixData, type Persisted } from '@/state/store'
import { blankMix } from '@/state/seed'
import { useAccount, type MixRole } from './account'
import { xsrf } from './http'
import { assetIdsIn, syncAssets } from './assets'

/**
 * Saving a mix to the server. The store persists through whichever storage is
 * plugged in: this browser's (the "local" mix) or a server mix's. A server mix
 * saves a moment after each change, one request at a time, sending only what
 * changed (the mix's data, its name, and the versions that changed). Each save
 * names the lock it last read; a stale one gets the mix as it is now, which
 * replaces what's on screen. This device's view (ui, camera) and any edits not
 * yet sent stay in localStorage, so a reload or a dropped connection loses
 * nothing.
 */

/** A mix as the server sends it (Mix::toBoard). */
export interface ServerMix {
  id: string
  name: string
  data: MixFields | null
  versions: Record<string, VersionNode>
  lock: number
  schema?: number
  /** Archived: read-only until its owner brings it back. */
  archived?: boolean
  /** Whether its owner has a mix pack (what the board opens follows the owner). */
  paid?: boolean
}

type MixFields = Omit<MixData, 'mixName' | 'versions'>
const FIELDS = ['site', 'guide', 'content', 'contract', 'notes', 'branchFrom', 'head', 'framePos', 'clips'] as const

export type SaveStatus = 'local' | 'saved' | 'saving' | 'offline' | 'error'
/** How saving is going, for the top bar. */
export const useSave = create<{ status: SaveStatus; mixId: string }>()(() => ({ status: 'local', mixId: 'local' }))

const SAVE_AFTER = 800
const VIEW_AFTER = 1000
const cacheKey = (id: string) => `blokmix:mix:${id}`

interface Cache {
  lock: number
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
/** JSON for a version node, remembered per object (nodes are replaced, never changed in place). */
const nodeJson = (v: VersionNode) => {
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
  private base: { name: string; data: string | null; versions: Record<string, string> }
  private latest: Persisted | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private inflight: Promise<void> | null = null
  private retry = 0
  private closed = false
  private viewTimer: ReturnType<typeof setTimeout> | undefined
  /** Whether the latest state holds edits the server doesn't have yet. */
  private unsent = false

  constructor(mix: ServerMix) {
    this.id = mix.id
    this.lock = mix.lock
    this.base = {
      name: mix.name,
      data: mix.data ? JSON.stringify(mix.data) : null,
      versions: Object.fromEntries(Object.entries(mix.versions ?? {}).map(([k, v]) => [k, JSON.stringify(v)])),
    }
  }

  /** What the board starts from: the server's mix, or edits this browser hadn't sent yet (when made on top of the same lock). */
  initial(mix: ServerMix): Persisted {
    const cache = readCache(mix.id)
    if (cache?.unsent && cache.lock === mix.lock) return cache.unsent
    const view = { ui: cache?.ui, camera: cache?.camera ?? null }
    // A new mix may hold only some fields (a guide it started from); a blank mix fills the rest.
    const data = { ...fields(blankMix(mix.name)), ...mix.data }
    return { ...data, mixName: mix.name, versions: mix.versions ?? {}, ...view } as Persisted
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
    const pending = this.diff(state)
    this.unsent = !!pending
    writeCache(this.id, { lock: this.lock, ui: state.ui, camera: state.camera, ...(pending ? { unsent: state } : {}) })
    if (!pending) return
    useSave.setState({ status: 'saving' })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), SAVE_AFTER)
  }

  /** This device's view (and the edits still waiting to be sent) into the offline copy. */
  writeView() {
    clearTimeout(this.viewTimer)
    const s = this.latest
    if (s) writeCache(this.id, { lock: this.lock, ui: s.ui, camera: s.camera, ...(this.unsent ? { unsent: s } : {}) })
  }

  private diff(state: Persisted) {
    const out: { name?: string; data?: MixFields; versions?: { put: Record<string, VersionNode>; remove: string[] } } = {}
    if (state.mixName !== this.base.name) out.name = state.mixName
    const data = JSON.stringify(fields(state))
    if (data !== this.base.data) out.data = fields(state)
    const put: Record<string, VersionNode> = {}
    for (const [k, v] of Object.entries(state.versions ?? {})) if (this.base.versions[k] !== nodeJson(v)) put[k] = v
    const remove = Object.keys(this.base.versions).filter((k) => !state.versions?.[k])
    if (Object.keys(put).length || remove.length) out.versions = { put, remove }
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
    const change = state && this.diff(state)
    if (!state || !change) {
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
          }
          this.retry = 0
          const still = this.latest && this.diff(this.latest)
          this.unsent = !!still
          writeCache(this.id, { lock: this.lock, ui: state.ui, camera: state.camera, ...(still ? { unsent: this.latest! } : {}) })
          if (!this.closed) useSave.setState({ status: still ? 'saving' : 'saved' })
          if (still && !this.closed) this.timer = setTimeout(() => void this.flush(), SAVE_AFTER)
        } else if (res.status === 412 && res.body.mix) {
          // Saved somewhere else since we read it (another tab): show theirs.
          writeCache(this.id, { lock: res.body.mix.lock, ui: state.ui, camera: state.camera })
          if (!this.closed) {
            openMix(res.body.mix, { force: true })
            useStore.getState().showFlash('This mix changed in another tab. Showing the latest.')
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
  if (mix === 'local') {
    persist.setOptions({ name: STORAGE_KEY, storage: localMixStorage() })
    useSave.setState({ status: 'local', mixId: 'local' })
  } else {
    const sync = new MixSync(mix)
    current = sync
    persist.setOptions({ name: cacheKey(mix.id), storage: sync.storage(mix) })
    useSave.setState({ status: 'saved', mixId: mix.id })
  }
  void persist.rehydrate()
  useStore.temporal.getState().clear()
  if (role === 'viewer') viewOnly = holdStill()
  // Uploads: fetch what this browser lacks, send what the server lacks.
  if (mix !== 'local') {
    const st = useStore.getState()
    void syncAssets(mix.id, assetIdsIn([st.site, st.versions]), role !== 'viewer')
  } else void syncAssets(null, [], false)
}

/** What a viewer can't change: everything but the marks (notes) and their own view. */
const HELD = ['mixName', 'site', 'guide', 'content', 'contract', 'versions', 'branchFrom', 'head', 'clips'] as const
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
  // Last chance to send edits when the tab closes (the offline copy covers it if this doesn't make it).
  window.addEventListener('pagehide', () => {
    current?.writeView()
    void current?.flush(true)
  })
}

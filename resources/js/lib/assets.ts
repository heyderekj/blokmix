import { create } from 'zustand'
import type { UploadData } from '@/core/media'

/**
 * Images you upload or paste, kept in this browser (IndexedDB), never in the
 * mix's saved state, which stays small. Each is downscaled to WebP, at most
 * 1,600px on its long side. Frames get them as data URLs, because a sandboxed
 * frame can't read this page's blob URLs.
 */
export interface Asset {
  id: string
  name: string
  kind?: 'image' | 'video' | 'lottie'
  /** Images: the downscaled WebP. */
  dataUrl?: string
  /** Videos and Lotties: the file itself. */
  bytes?: ArrayBuffer
  mime?: string
  /** Videos: a still from the first frame, as a data URL. */
  poster?: string
  width: number
  height: number
  addedAt: number
}

const DB = 'blokmix'
/** Uploads saved before the rename. */
const LEGACY_DB = 'mixtape'
const STORE = 'assets'

function db(name = DB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export const useAssets = create<{ assets: Record<string, Asset>; loaded: boolean }>()(() => ({ assets: {}, loaded: false }))

/** Bring uploads saved under the old name across, once, then remove the old database. */
async function carryOverUploads() {
  const names = (await indexedDB.databases?.())?.map((d) => d.name) ?? []
  if (!names.includes(LEGACY_DB)) return
  const old = await db(LEGACY_DB)
  const items = await new Promise<Asset[]>((resolve, reject) => {
    const r = old.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<Asset[]>
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  old.close()
  const d = await db()
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite')
    for (const a of items) t.objectStore(STORE).put(a)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
  indexedDB.deleteDatabase(LEGACY_DB)
}

export async function loadAssets() {
  if (typeof indexedDB === 'undefined') return
  try {
    await carryOverUploads().catch(() => {})
    const all = await tx<Asset[]>('readonly', (s) => s.getAll() as IDBRequest<Asset[]>)
    useAssets.setState({ assets: Object.fromEntries(all.map((a) => [a.id, a])), loaded: true })
  } catch {
    useAssets.setState({ loaded: true })
  }
}

export const assetUrl = (id: string) => useAssets.getState().assets[id]?.dataUrl

/** An upload as the core needs it (for frames and exports). */
export const uploadData = (id: string): UploadData | undefined => {
  const a = useAssets.getState().assets[id]
  return a && { dataUrl: a.dataUrl, bytes: a.bytes, mime: a.mime, poster: a.poster }
}

const MAX_MOVING = 40 * 1024 * 1024

/** Store any dropped or pasted file: images are downscaled; videos and Lotties kept as they are. */
export async function addFile(file: File): Promise<Asset> {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/')) return addImage(file, file.name)
  const isVideo = file.type.startsWith('video/')
  const isLottie = name.endsWith('.lottie') || name.endsWith('.json')
  if (!isVideo && !isLottie) throw new Error('Drop an image, a video, or a Lottie (.lottie or .json)')
  if (file.size > MAX_MOVING) throw new Error('That file is over 40 MB; trim or compress it first (Dinky does videos too)')
  const bytes = await file.arrayBuffer()
  const meta = isVideo ? await videoStill(file) : { width: 0, height: 0, poster: undefined }
  const asset: Asset = {
    id: `${isVideo ? 'vid' : 'lot'}_${Math.random().toString(36).slice(2, 10)}`,
    name: file.name,
    kind: isVideo ? 'video' : 'lottie',
    bytes,
    mime: isVideo ? file.type || 'video/mp4' : name.endsWith('.json') ? 'application/json' : 'application/zip',
    poster: meta.poster,
    width: meta.width,
    height: meta.height,
    addedAt: Date.now(),
  }
  await tx('readwrite', (s) => s.put(asset))
  useAssets.setState((st) => ({ assets: { ...st.assets, [asset.id]: asset } }))
  return asset
}

/** The first frame of a video, as a WebP still, plus its size. */
async function videoStill(file: Blob): Promise<{ width: number; height: number; poster?: string }> {
  const url = URL.createObjectURL(file)
  try {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.src = url
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res()
      v.onerror = () => rej(new Error('Can’t read that video'))
    })
    v.currentTime = Math.min(0.1, (v.duration || 1) / 10)
    await new Promise<void>((res) => (v.onseeked = () => res()))
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return { width: v.videoWidth, height: v.videoHeight, poster: c.toDataURL('image/webp', 0.82) }
  } catch {
    return { width: 0, height: 0 }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Downscale and store an image file; resolves to its asset id. */
export async function addImage(file: Blob, name = 'image'): Promise<Asset> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/webp', 0.86)
  const asset: Asset = { id: `img_${Math.random().toString(36).slice(2, 10)}`, name, kind: 'image', dataUrl, width: w, height: h, addedAt: Date.now() }
  await tx('readwrite', (s) => s.put(asset))
  useAssets.setState((st) => ({ assets: { ...st.assets, [asset.id]: asset } }))
  return asset
}

export async function removeAsset(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  useAssets.setState((st) => {
    const assets = { ...st.assets }
    delete assets[id]
    return { assets }
  })
}

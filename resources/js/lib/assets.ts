import { create } from 'zustand'

/**
 * Images you upload or paste, kept in this browser (IndexedDB), never in the
 * tape's saved state, which stays small. Each is downscaled to WebP, at most
 * 1,600px on its long side. Frames get them as data URLs, because a sandboxed
 * frame can't read this page's blob URLs.
 */
export interface Asset {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
  addedAt: number
}

const DB = 'mixtape'
const STORE = 'assets'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
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

export async function loadAssets() {
  if (typeof indexedDB === 'undefined') return
  try {
    const all = await tx<Asset[]>('readonly', (s) => s.getAll() as IDBRequest<Asset[]>)
    useAssets.setState({ assets: Object.fromEntries(all.map((a) => [a.id, a])), loaded: true })
  } catch {
    useAssets.setState({ loaded: true })
  }
}

export const assetUrl = (id: string) => useAssets.getState().assets[id]?.dataUrl

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
  const asset: Asset = { id: `img_${Math.random().toString(36).slice(2, 10)}`, name, dataUrl, width: w, height: h, addedAt: Date.now() }
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

import type { VersionNode } from '@/core/types'
import { useStore, type MixData } from '@/state/store'
import { assetIdsIn, putAssets, useAssets, type Asset } from './assets'

/**
 * A mix as one file: its pages, style guide, words, notes and versions, plus the
 * uploads it uses, so it can move between browsers, devices and the server, or be
 * kept as a backup. Older shapes inside are brought up to date when it opens
 * (the store's own migrations).
 */
export const MIX_FILE_FORMAT = 'blokmix.mix/v1'

type Fields = Omit<MixData, 'mixName' | 'versions'>
type FileAsset = Omit<Asset, 'bytes'> & { bytes?: string }
export interface MixFile {
  format: typeof MIX_FILE_FORMAT
  name: string
  exportedAt: string
  data: Fields
  versions: Record<string, VersionNode>
  assets: FileAsset[]
}

const FIELDS = ['site', 'guide', 'content', 'notes', 'branchFrom', 'head', 'framePos'] as const

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer

/** The open mix as a file. */
export function mixFile(): MixFile {
  const st = useStore.getState()
  const data = Object.fromEntries(FIELDS.map((k) => [k, st[k]])) as Fields
  const all = useAssets.getState().assets
  const assets = assetIdsIn([data, st.versions])
    .map((id) => all[id])
    .filter((a): a is Asset => !!a)
    .map((a) => ({ ...a, bytes: a.bytes ? toBase64(a.bytes) : undefined }))
  return { format: MIX_FILE_FORMAT, name: st.mixName, exportedAt: new Date().toISOString(), data, versions: st.versions, assets }
}

/** Download the open mix as `<name>.blokmix.json`. */
export function downloadMix() {
  const file = mixFile()
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${file.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'mix'}.blokmix.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Read a mix file, and keep its uploads in this browser. Throws a readable error for anything else. */
export async function readMixFile(file: Blob): Promise<MixFile> {
  let parsed: Partial<MixFile>
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('That isn’t a Blokmix mix file.')
  }
  if (parsed.format !== MIX_FILE_FORMAT || !parsed.data || typeof parsed.name !== 'string') throw new Error('That isn’t a Blokmix mix file.')
  const assets = (parsed.assets ?? []).map((a) => ({ ...a, bytes: a.bytes ? fromBase64(a.bytes) : undefined }) as Asset)
  await putAssets(assets)
  return { ...(parsed as MixFile), versions: parsed.versions ?? {}, assets: parsed.assets ?? [] }
}

/** Without Laravel: make a mix file the mix in this browser (the page reloads to open it). */
export function replaceLocalMix(file: MixFile, storageKey: string) {
  localStorage.setItem(storageKey, JSON.stringify({ state: { ...file.data, mixName: file.name, versions: file.versions }, version: 1 }))
  location.reload()
}

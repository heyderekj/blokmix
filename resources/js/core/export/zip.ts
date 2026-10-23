import { strToU8, zipSync } from 'fflate'
import type { FileMap } from './shared'

export function zipFiles(files: FileMap, folder: string): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [path, text] of Object.entries(files)) entries[`${folder}/${path}`] = strToU8(text)
  return zipSync(entries, { level: 6 })
}

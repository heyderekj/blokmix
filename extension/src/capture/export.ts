// Packing a capture for the Blokmix repo: a zip laid out like the repo
// (samples/clips/<type>/<folder>/…, samples/sources/<source>.json).

import { strToU8, zipSync } from 'fflate'

export function zipFiles(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([p, t]) => [p, strToU8(t)])), { level: 6 })
}

/** Directory writes the panel needs (File System Access API), kept small so it can be faked in tests. */
export interface DirLike {
  name: string
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirLike>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>
}

export interface WriteReport {
  written: string[]
  kept: string[]
}

async function exists(dir: DirLike, parts: string[]): Promise<boolean> {
  try {
    let d = dir
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p)
    await d.getFileHandle(parts[parts.length - 1])
    return true
  } catch {
    return false
  }
}

/**
 * Write a capture's files into the Blokmix repo folder (or its samples/ folder).
 * A source that already exists is kept: the clip carries its own tokens in clip.json.
 */
export async function writeToRepo(root: DirLike, files: Record<string, string>): Promise<WriteReport> {
  const report: WriteReport = { written: [], kept: [] }
  for (const [path, text] of Object.entries(files)) {
    let parts = path.split('/')
    if (root.name === 'samples' && parts[0] === 'samples') parts = parts.slice(1)
    if (parts[0] === 'sources' || parts[1] === 'sources') {
      if (await exists(root, parts)) {
        report.kept.push(path)
        continue
      }
    }
    let d = root
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true })
    const fh = await d.getFileHandle(parts[parts.length - 1], { create: true })
    const w = await fh.createWritable()
    await w.write(text)
    await w.close()
    report.written.push(path)
  }
  return report
}

/** Does this folder look like the Blokmix repo (or its samples folder)? */
export async function looksLikeRepo(dir: DirLike): Promise<boolean> {
  try {
    if (dir.name === 'samples') {
      await dir.getDirectoryHandle('clips')
      return true
    }
    const samples = await dir.getDirectoryHandle('samples')
    await samples.getDirectoryHandle('clips')
    return true
  } catch {
    return false
  }
}

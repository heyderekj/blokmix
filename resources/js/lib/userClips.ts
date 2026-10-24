import { create } from 'zustand'
import { strFromU8, unzipSync } from 'fflate'
import type { Source } from '@/core/types'
import { buildLibrary, extendLibrary, rawClipsFromFiles } from '@/core/library'
import { library } from '@/data/library'
import { xsrf } from './http'

/**
 * Clips captured with the extension, saved to your account: yours, and those of the
 * people you share mixes with (so a shared mix opens with every section). They join
 * the built-in library before the board opens a mix.
 */
export const useUserClips = create<{ ids: string[] }>()(() => ({ ids: [] }))

const CLIP_PATH = /^samples\/(clips\/[a-z]+\/[\w-]+\/(clip\.html|clip\.css|motion\.css|clip\.json)|sources\/[a-z0-9-]+\.json)$/

/** Files grouped as `samples/...` paths: the shape of the extension's zip (and the repo). */
type ClipFiles = Record<string, string>

function addToLibrary(sets: ClipFiles[]): string[] {
  const all = Object.assign({}, ...sets) as ClipFiles
  const sources = Object.entries(all)
    .filter(([p]) => p.startsWith('samples/sources/'))
    .map(([, text]) => JSON.parse(text) as Source)
  const added = extendLibrary(library, sources, rawClipsFromFiles(all))
  if (added.length) useUserClips.setState((s) => ({ ids: [...s.ids, ...added] }))
  return added
}

/** Load the account's clips into the library (Laravel only; quietly nothing otherwise). */
export async function loadUserClips() {
  try {
    const res = await fetch('/api/clips', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const list = (await res.json()) as { files: ClipFiles }[]
    addToLibrary(list.map((c) => c.files))
  } catch {
    // Offline: the built-in library still works.
  }
}

/**
 * A clip zip from the extension: read it, lint it as `npm run clip:add` would, and
 * save it to your account. Throws with the lint's own words when it isn't clean.
 */
export async function addClipZip(zip: Blob): Promise<string[]> {
  const files: ClipFiles = {}
  for (const [path, bytes] of Object.entries(unzipSync(new Uint8Array(await zip.arrayBuffer())))) if (CLIP_PATH.test(path)) files[path] = strFromU8(bytes)
  const sources = Object.entries(files)
    .filter(([p]) => p.startsWith('samples/sources/'))
    .map(([, text]) => JSON.parse(text) as Source)
  const check = buildLibrary([...Object.values(library.sources), ...sources.filter((s) => !library.sources[s.id])], rawClipsFromFiles(files))
  const ids = Object.keys(check.clips)
  if (!ids.length) throw new Error('That zip has no clip in it. Use a zip the Blokmix extension saved.')
  const errors = check.warnings.filter((w) => w.level === 'error' && ids.includes(w.clipId))
  if (errors.length) throw new Error(`That clip needs fixing first: ${errors.map((e) => e.message).join('; ')}`)
  const taken = ids.filter((id) => library.clips[id])
  if (taken.length === ids.length) throw new Error(`${taken.join(', ')} is already in your library.`)

  const res = await fetch('/api/clips', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...xsrf() },
    body: JSON.stringify({ files }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Couldn’t save that clip. Try again.')
  return addToLibrary([files])
}

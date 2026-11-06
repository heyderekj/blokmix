// Publishing a mix to blok.page: the board builds the pages (the same composing as exports), zips them and sends them
// up in one request; the server keeps them at blok.page/<code>/<slug>. Used by the Publish sheet and agent commands.

import { create } from 'zustand'
import { strToU8, zipSync } from 'fflate'
import type { VersionNode } from '@/core/types'
import { publishFiles } from '@/core/export/publish'
import { packetInputFor } from './packet'
import { withBakedPosters } from './shaderPosters'
import { xsrf } from './http'
import { useSave } from './mixSync'
import { useStore } from '@/state/store'

export interface Publication {
  code: string
  name: string
  slug: string
  url: string
  pages: string[]
  size: number
  badge: boolean
  /** The version published (its id), or null for the working mix. */
  version: string | null
  live: boolean
  publishedAt: string | null
}

/** This mix's publication, as last heard from the server. */
export const usePublication = create<{ pub: Publication | null; loaded: string | null }>(() => ({ pub: null, loaded: null }))

export class PublishError extends Error {}

function mixId(): string {
  const id = useSave.getState().mixId
  if (!id || id === 'local') throw new PublishError('This mix lives only in this browser. Save it to your mixes to publish it.')
  return id
}

async function call(method: string, body?: FormData): Promise<Publication | null> {
  const res = await fetch(`/api/mixes/${mixId()}/publication`, {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...xsrf() },
    body,
  })
  const json = (await res.json().catch(() => null)) as { publication?: Publication | null; message?: string; errors?: Record<string, string[]> } | null
  if (!res.ok) {
    const first = json?.errors ? Object.values(json.errors)[0]?.[0] : undefined
    throw new PublishError(first ?? json?.message ?? `Publishing failed (${res.status}).`)
  }
  const pub = json?.publication ?? null
  usePublication.setState({ pub, loaded: useSave.getState().mixId })
  return pub
}

export function loadPublication(): Promise<Publication | null> {
  return call('GET')
}

/** Where a publish is, for the sheet to say while it works (a minute for a big mix: most of it sending and saving). */
export type PublishStep =
  | { stage: 'compose' }
  | { stage: 'posters'; count: number }
  | { stage: 'pack'; pages: number; files: number }
  | { stage: 'upload'; progress: number; bytes: number }
  | { stage: 'save' }

type OnStep = (step: PublishStep) => void

/** Let the sheet paint the new step before the next piece of work holds the thread. */
const breathe = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))

/** The working mix (null) or a version, as pages and pictures in one zip. */
export async function publicationBundle(version: VersionNode | null, onStep: OnStep = () => {}): Promise<{ zip: Uint8Array; pages: string[] }> {
  onStep({ stage: 'compose' })
  await breathe()
  const input = packetInputFor(useStore.getState(), { version, targets: ['astro'] })
  if (input.page.shaders.length) {
    onStep({ stage: 'posters', count: input.page.shaders.length })
    await breathe()
  }
  const page = await withBakedPosters(input.page)
  const files = publishFiles(page)
  const pages = Object.keys(files).filter((p) => p.endsWith('.html'))
  onStep({ stage: 'pack', pages: pages.length, files: Object.keys(files).length - pages.length })
  await breathe()
  const entries: Record<string, Uint8Array> = {}
  for (const [path, data] of Object.entries(files)) entries[path] = typeof data === 'string' ? strToU8(data) : data
  return { zip: zipSync(entries, { level: 6 }), pages }
}

/** POST with upload progress (fetch can't report it), then the same handling as `call`. */
function send(form: FormData, onStep: OnStep): Promise<Publication | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/mixes/${mixId()}/publication`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    for (const [k, v] of Object.entries(xsrf())) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      if (e.loaded >= e.total) onStep({ stage: 'save' })
      else onStep({ stage: 'upload', progress: e.loaded / e.total, bytes: e.total })
    }
    xhr.upload.onload = () => onStep({ stage: 'save' })
    xhr.onerror = () => reject(new PublishError('Couldn’t reach Blokmix. Check your connection and try again.'))
    xhr.onload = () => {
      let json: { publication?: Publication | null; message?: string; errors?: Record<string, string[]> } | null = null
      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        // Not JSON: fall through to the status.
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const first = json?.errors ? Object.values(json.errors)[0]?.[0] : undefined
        reject(new PublishError(publishProblem(xhr.status, first ?? json?.message)))
        return
      }
      const pub = json?.publication ?? null
      usePublication.setState({ pub, loaded: useSave.getState().mixId })
      resolve(pub)
    }
    xhr.send(form)
  })
}

/** Publish (or republish: same address) the working mix or a version under `name`. */
export async function publishMix(opts: { version: VersionNode | null; name: string; onStep?: OnStep }): Promise<Publication> {
  mixId()
  const onStep = opts.onStep ?? (() => {})
  const { zip } = await publicationBundle(opts.version, onStep)
  const form = new FormData()
  form.append('name', opts.name.trim() || useStore.getState().mixName || 'Mix')
  if (opts.version) form.append('version', opts.version.id)
  form.append('bundle', new Blob([zip as BlobPart], { type: 'application/zip' }), 'bundle.zip')
  onStep({ stage: 'upload', progress: 0, bytes: zip.byteLength })
  const pub = await send(form, onStep)
  if (!pub) throw new PublishError('Publishing failed.')
  return pub
}

export function unpublishMix(): Promise<Publication | null> {
  return call('DELETE')
}

/** blok.page's address for this mix while it's live, for BLOKMIX.md. */
export function publishedUrl(): string | undefined {
  const { pub, loaded } = usePublication.getState()
  return pub?.live && loaded === useSave.getState().mixId ? pub.url : undefined
}

/** Why publishing didn't work, in words: what happened and what to do next, never a bare status code. */
export function publishProblem(status: number, said?: string): string {
  if (status === 401 || status === 419) return 'You’ve been signed out. Sign in, then publish again.'
  if (status === 413) return 'Too big to publish. Try smaller pictures or videos.'
  if (status === 429) return 'That’s a lot of publishing at once. Wait a minute and try again.'
  if (said) return said
  if (status >= 500) return 'Blokmix had a problem publishing. Try again in a moment.'
  return 'Publishing didn’t work. Try again.'
}


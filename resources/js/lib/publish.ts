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

/** The working mix (null) or a version, as pages and pictures in one zip. */
export async function publicationBundle(version: VersionNode | null): Promise<{ zip: Uint8Array; pages: string[] }> {
  const input = packetInputFor(useStore.getState(), { version, targets: ['astro'] })
  const page = await withBakedPosters(input.page)
  const files = publishFiles(page)
  const entries: Record<string, Uint8Array> = {}
  for (const [path, data] of Object.entries(files)) entries[path] = typeof data === 'string' ? strToU8(data) : data
  return { zip: zipSync(entries, { level: 6 }), pages: Object.keys(files).filter((p) => p.endsWith('.html')) }
}

/** Publish (or republish: same address) the working mix or a version under `name`. */
export async function publishMix(opts: { version: VersionNode | null; name: string }): Promise<Publication> {
  mixId()
  const { zip } = await publicationBundle(opts.version)
  const form = new FormData()
  form.append('name', opts.name.trim() || useStore.getState().mixName || 'Mix')
  if (opts.version) form.append('version', opts.version.id)
  form.append('bundle', new Blob([zip as BlobPart], { type: 'application/zip' }), 'bundle.zip')
  const pub = await call('POST', form)
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

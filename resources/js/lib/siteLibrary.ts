import type { FontSource, GuideState, Library, Page, SectionType, Site, Slot, Source, TokenKey, TokenSet } from '@/core/types'
import { DEFAULT_KEEP, SECTION_TYPES, TOKEN_GROUPS, TOKEN_KEYS } from '@/core/types'
import { BASE_TOKENS } from '@/core/tokens'
import { layoutOpen, pickable } from '@/core/library'
import { emptyGuide, promoteSource, SOURCE_PREFIX } from '@/core/guide'
import { normalizePath, siteFromSlots } from '@/core/site'
import { isHosted } from './host'
import { api } from './mixSync'

/**
 * The site library (Landbook-style): real websites captured offline, each page split into sections, each section
 * matched to one of Blokmix's built-in layouts. Clipping from it always lands the MATCHED LAYOUT, never the site's
 * words or pictures; the site's look can join the style guide as candidates. Screenshots are only a reference.
 *
 * Served by `GET /api/library` and `GET /api/library/sites/{slug}` in your account; Vite on its own uses a small
 * made-up fixture in development (`data/librarySample.ts`).
 */

export interface LibrarySiteSummary {
  slug: string
  name: string
  url: string
  industry: string | null
  tags: string[]
  /** By role: bg, text, primary, accent… */
  palette: Record<string, string>
  thumb: string | null
  status: string
  pages: number
  sections: number
  matched: number
  needsLayout: number
  updated_at: string
}

export type LibrarySectionStatus = 'matched' | 'needs_layout' | 'hidden'

export interface LibrarySection {
  id: number | string
  order: number
  type: string
  /** In page pixels, at 1440 wide. */
  box: { y: number; h: number }
  /** A built-in layout's clip id ("features.layout-grid"), when matched. */
  layoutId: string | null
  score: number | null
  status: LibrarySectionStatus
  screenshot: string | null
  hint?: string | null
}

export interface LibraryPage {
  id: number | string
  path: string
  title: string
  order: number
  screenshot: string | null
  width: number
  height: number
  sections: LibrarySection[]
}

export interface LibrarySite {
  slug: string
  name: string
  url: string
  industry: string | null
  tags: string[]
  /** Flat, as in a style guide: { "color.bg": "#fff", "font.display": "…" }. */
  tokens: Record<string, string>
  fonts: unknown
  personality: string | null
  status: string
  thumb: string | null
  pages: LibraryPage[]
}

// ---------------------------------------------------------------------------------------------------------------
// Pure: tokens → Source, what a section clips to, what a clip would add.

export const siteSourceId = (slug: string) => `site:${slug}`
/** The candidate id prefix for a site's look in the style guide: `src:site:<slug>#<group>`. */
export const siteCandidatePrefix = (slug: string) => `${SOURCE_PREFIX}${siteSourceId(slug)}`

/** A site's flat tokens as a full Source (`kind: 'site'`); tokens it doesn't set stay neutral. */
export function sourceFromSite(site: Pick<LibrarySite, 'slug' | 'name' | 'url' | 'tokens' | 'fonts' | 'personality'>): Source {
  const tokens = { ...BASE_TOKENS } as TokenSet
  for (const [k, v] of Object.entries(site.tokens ?? {})) {
    if ((TOKEN_KEYS as readonly string[]).includes(k) && typeof v === 'string' && v.trim()) tokens[k as TokenKey] = v.trim()
  }
  return { id: siteSourceId(site.slug), kind: 'site', name: site.name, url: site.url, personality: site.personality ?? '', tokens, fonts: fontsOf(site.fonts) }
}

/** The API's fonts: FontSources, or bare family names (loaded from Google Fonts by name). */
function fontsOf(raw: unknown): FontSource[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((f): FontSource[] => {
    if (typeof f === 'string' && f.trim()) return [{ family: f.trim(), css2: f.trim().replace(/ /g, '+') }]
    if (f && typeof f === 'object' && typeof (f as FontSource).family === 'string') {
      const x = f as FontSource
      return [{ ...x, css2: x.css2 ?? x.family.replace(/ /g, '+') }]
    }
    return []
  })
}

export type SectionClipState =
  | { clippable: true; clipId: string; type: SectionType }
  | { clippable: false; reason: 'needs_layout' | 'missing' | 'hidden'; note: string }

/** Whether a section can land in a mix, and as which built-in layout. */
export function sectionClipState(lib: Pick<Library, 'clips'>, s: LibrarySection): SectionClipState {
  if (s.status === 'hidden') return { clippable: false, reason: 'hidden', note: 'Hidden in the library' }
  if (s.status === 'needs_layout' || !s.layoutId) return { clippable: false, reason: 'needs_layout', note: 'No layout yet' }
  const clip = lib.clips[s.layoutId]
  if (!clip || !(SECTION_TYPES as readonly string[]).includes(clip.type))
    return { clippable: false, reason: 'missing', note: `Its layout (${s.layoutId}) isn’t in this version of Blokmix` }
  return { clippable: true, clipId: openStandIn(lib, clip.id), type: clip.type }
}

/**
 * On Free (`paid === false`), a section matched to a layout in a mix pack lands as an open layout of the same shape
 * (rhythm), else the type's first open one.
 */
function openStandIn(lib: Pick<Library, 'clips'> & Partial<Library>, id: string): string {
  if (!lib.byType || layoutOpen(lib as Library, id)) return id
  const clip = lib.clips[id]
  const open = pickable(lib as Library, clip.type).filter((x) => lib.clips[x].origin === 'layout')
  return open.find((x) => lib.clips[x].rhythm === clip.rhythm) ?? open[0] ?? id
}

/** "features.layout-grid" → "Grid": a layout's short name for labels. */
export function layoutName(lib: Pick<Library, 'clips'>, clipId: string | null): string {
  if (!clipId) return 'No layout yet'
  const clip = lib.clips[clipId]
  if (clip?.title) return clip.title
  const v = clipId.split('.').pop() ?? clipId
  return v.replace(/^layout-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export interface ClipPlan {
  slots: { order: number; type: SectionType; clipId: string }[]
  skipped: { order: number; type: string; reason: string }[]
}

/** The sections a clip would add, in page order. `picks` are section orders, or 'all'. */
export function planClip(lib: Pick<Library, 'clips'>, page: LibraryPage, picks: number[] | 'all'): ClipPlan {
  const want = picks === 'all' ? null : new Set(picks)
  const plan: ClipPlan = { slots: [], skipped: [] }
  const sections = [...page.sections].sort((a, b) => a.order - b.order)
  if (want) for (const n of want) if (!sections.some((s) => s.order === n)) plan.skipped.push({ order: n, type: '?', reason: `No section ${n} on ${page.path}` })
  for (const s of sections) {
    if (want && !want.has(s.order)) continue
    const state = sectionClipState(lib, s)
    if (state.clippable) plan.slots.push({ order: s.order, type: state.type, clipId: state.clipId })
    else if (want || state.reason !== 'hidden') plan.skipped.push({ order: s.order, type: s.type, reason: state.note })
  }
  return plan
}

/** Credit for a section matched from a site's page: the site's name and that page's address. */
export function inspiredOf(site: Pick<LibrarySite, 'name' | 'url'>, page?: Pick<LibraryPage, 'path'>): NonNullable<Slot['inspiredBy']> {
  let url = site.url
  try {
    if (page && page.path && page.path !== '/') url = new URL(page.path, site.url).href
  } catch {
    /* keep the site's address */
  }
  return { site: site.name, url }
}

/** A page by path, title or id; the first page by default. */
export function pickPage(site: LibrarySite, ref?: string | number): LibraryPage | null {
  const pages = [...site.pages].sort((a, b) => a.order - b.order)
  if (ref === undefined || ref === '') return pages[0] ?? null
  const r = String(ref).trim().toLowerCase()
  return pages.find((p) => String(p.id) === r || p.path.toLowerCase() === r || normalizePath(p.path) === normalizePath(r) || p.title.toLowerCase() === r) ?? null
}

/** The site's look, adopted: every group a candidate from the site, and chosen. */
export function siteGuide(source: Source): GuideState {
  const g = promoteSource(emptyGuide(), source, [...TOKEN_GROUPS])
  const choices: GuideState['choices'] = {}
  for (const c of g.candidates) for (const k of Object.keys(c.values) as TokenKey[]) choices[k] = { kind: 'candidate', candidateId: c.id }
  return { ...g, choices }
}

/** A new mix from one of a site's pages: its matched layouts in order (crediting the site) under the site's look. */
export function mixFromSitePage(lib: Pick<Library, 'clips'>, site: LibrarySite, page: LibraryPage): { mixName: string; site: Site; guide: GuideState; skipped: ClipPlan['skipped'] } {
  const plan = planClip(lib, page, 'all')
  const inspiredBy = inspiredOf(site, page)
  const slots: Slot[] = plan.slots.map((s, i) => ({ id: `slot_site_${i}`, type: s.type, clipId: s.clipId, locked: false, keep: { ...DEFAULT_KEEP }, inspiredBy }))
  const built = siteFromSlots(slots, { title: page.title || 'Home' })
  const home: Page = built.pages[0]
  return { mixName: `${site.name}${page.path === '/' ? '' : ` ${page.title}`} remix`, site: { ...built, pages: [home] }, guide: siteGuide(sourceFromSite(site)), skipped: plan.skipped }
}

// ---------------------------------------------------------------------------------------------------------------
// Fetch + cache.

export interface SiteLibraryBackend {
  list: () => Promise<LibrarySiteSummary[]>
  site: (slug: string) => Promise<LibrarySite | null>
}

export class SiteLibraryError extends Error {}

const serverBackend: SiteLibraryBackend = {
  list: async () => {
    const res = await api<LibrarySiteSummary[] | { data: LibrarySiteSummary[] }>('GET', '/api/library')
    if (res.status === 401 || res.status === 419) throw new SiteLibraryError('Sign in to browse the site library')
    if (res.status !== 200) throw new SiteLibraryError(`The site library didn’t load (${res.status})`)
    const body = res.body
    // The server's palette is token-keyed ("color.bg"); cards read it by role ("bg").
    return (Array.isArray(body) ? body : (body?.data ?? [])).map((s) => ({
      ...s,
      palette: Object.fromEntries(Object.entries(s.palette ?? {}).map(([k, v]) => [k.replace(/^color\./, ''), v])),
    }))
  },
  site: async (slug) => {
    const res = await api<LibrarySite>('GET', `/api/library/sites/${encodeURIComponent(slug)}`)
    if (res.status === 404) return null
    if (res.status !== 200) throw new SiteLibraryError(`${slug} didn’t load (${res.status})`)
    return res.body
  },
}

const fixtureBackend: SiteLibraryBackend = {
  list: async () => (await import('@/data/librarySample')).SAMPLE_SUMMARIES,
  site: async (slug) => (await import('@/data/librarySample')).SAMPLE_SITES.find((s) => s.slug === slug) ?? null,
}

let override: SiteLibraryBackend | null = null
/** Tests (and future hosts) can serve the library from somewhere else; null goes back to the default. */
export function setSiteLibraryBackend(b: SiteLibraryBackend | null) {
  override = b
  listCache = null
  siteCache.clear()
}

/** Whether there's a site library here: your account (Laravel), or the made-up fixture while developing. */
export function siteLibraryAvailable(): boolean {
  return !!override || isHosted() || !!import.meta.env.DEV
}
/** True when browsing the made-up fixture rather than your account's library. */
export const usingFixture = () => !override && !isHosted() && !!import.meta.env.DEV

function backend(): SiteLibraryBackend {
  if (override) return override
  if (isHosted()) return serverBackend
  if (import.meta.env.DEV) return fixtureBackend
  throw new SiteLibraryError('The site library lives in your Blokmix account. Sign in at blokmix.com to browse it.')
}

let listCache: Promise<LibrarySiteSummary[]> | null = null
const siteCache = new Map<string, Promise<LibrarySite | null>>()
const loaded = new Map<string, LibrarySite>()

export function listSites(fresh = false): Promise<LibrarySiteSummary[]> {
  if (!listCache || fresh) {
    listCache = backend().list()
    listCache.catch(() => (listCache = null))
  }
  return listCache
}

/**
 * A site with its pages and sections. Its look joins `library.sources` (as `site:<slug>`), so style-guide
 * candidates from it are named and resolve like any clip's source.
 */
export function loadSite(slug: string, lib?: Library): Promise<LibrarySite | null> {
  let p = siteCache.get(slug)
  if (!p) {
    p = backend()
      .site(slug)
      .then((site) => {
        if (site) {
          loaded.set(site.slug, site)
          if (lib) registerSiteSource(lib, site)
        }
        return site
      })
    p.catch(() => siteCache.delete(slug))
    siteCache.set(slug, p)
  } else if (lib) void p.then((site) => site && registerSiteSource(lib, site))
  return p
}

/** A site already loaded this session, if it was. */
export const cachedSite = (slug: string) => loaded.get(slug) ?? null

export function registerSiteSource(lib: Library, site: LibrarySite): Source {
  const src = sourceFromSite(site)
  lib.sources[src.id] = src
  return src
}

/** A site by slug or name (case-insensitive), loaded. */
export async function findSite(ref: string, lib?: Library): Promise<LibrarySite> {
  const r = ref.trim().toLowerCase()
  const sites = await listSites()
  const hit = sites.find((s) => s.slug.toLowerCase() === r) ?? sites.find((s) => s.name.toLowerCase() === r) ?? sites.find((s) => s.name.toLowerCase().includes(r))
  if (!hit) throw new SiteLibraryError(`No site “${ref}” in the library${sites.length ? ` (some: ${sites.slice(0, 8).map((s) => s.slug).join(', ')})` : ''}`)
  const site = await loadSite(hit.slug, lib)
  if (!site) throw new SiteLibraryError(`${hit.name} isn’t in the library any more`)
  return site
}

/** Search the list: words match name, industry, tags and address; industry narrows to one. */
export function filterSites(sites: LibrarySiteSummary[], q: { query?: string; industry?: string }): LibrarySiteSummary[] {
  const words = (q.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const ind = q.industry?.trim().toLowerCase()
  return sites.filter((s) => {
    if (ind && (s.industry ?? '').toLowerCase() !== ind) return false
    const hay = [s.name, s.slug, s.url, s.industry ?? '', ...(s.tags ?? [])].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

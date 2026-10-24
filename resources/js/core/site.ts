// The site: pages, each with its own sections, between one nav and one footer
// they share. A page can hide the shared nav or footer (a landing page with no
// nav). Slot ids are unique across the whole site, so edits, notes and links
// find a section without knowing its page.

import type { Page, SectionType, Site, Slot } from './types'

/** "/About us/" → "/about-us"; "" and "home" → "/". */
export function normalizePath(p: string): string {
  const parts = p
    .trim()
    .toLowerCase()
    .split('/')
    .map((x) => x.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
  if (!parts.length || (parts.length === 1 && (parts[0] === 'home' || parts[0] === 'index'))) return '/'
  return `/${parts.join('/')}`
}

/** A page by id (or path); the first page when it's gone or not given. */
export function pageOf(site: Site, ref?: string | null): Page {
  if (ref) {
    const hit = site.pages.find((p) => p.id === ref) ?? site.pages.find((p) => p.path === normalizePath(ref))
    if (hit) return hit
  }
  return site.pages[0]
}

const views = new WeakMap<Page, WeakMap<Site['shared'], Slot[]>>()
/** A page as it reads top to bottom: the shared nav (if shown), its own sections, the shared footer (if shown). */
export function pageView(site: Site, pageId?: string | null): Slot[] {
  const page = pageOf(site, pageId)
  if (!page) return []
  let byShared = views.get(page)
  if (!byShared) views.set(page, (byShared = new WeakMap()))
  let v = byShared.get(site.shared)
  if (!v) {
    const { nav, footer } = site.shared
    v = [...(nav && page.show.nav ? [nav] : []), ...page.slots, ...(footer && page.show.footer ? [footer] : [])]
    byShared.set(site.shared, v)
  }
  return v
}

const everything = new WeakMap<Site, Slot[]>()
/** Every section on the site, once: the nav, each page's sections in order, the footer. */
export function allSlots(site: Site): Slot[] {
  let v = everything.get(site)
  if (!v) {
    const { nav, footer } = site.shared
    v = [...(nav ? [nav] : []), ...site.pages.flatMap((p) => p.slots), ...(footer ? [footer] : [])]
    everything.set(site, v)
  }
  return v
}

/** Whether a section is the shared nav or footer. */
export const isShared = (site: Site, slotId: string) => site.shared.nav?.id === slotId || site.shared.footer?.id === slotId

/** The page a section belongs to; null for the shared nav and footer. */
export function pageOfSlot(site: Site, slotId: string): Page | null {
  return site.pages.find((p) => p.slots.some((s) => s.id === slotId)) ?? null
}

/** Change every section (return null to drop one). */
export function mapSlots(site: Site, fn: (s: Slot) => Slot | null): Site {
  const one = (s: Slot | undefined) => (s ? (fn(s) ?? undefined) : undefined)
  return {
    pages: site.pages.map((p) => ({ ...p, slots: p.slots.flatMap((s) => fn(s) ?? []) })),
    shared: { nav: one(site.shared.nav), footer: one(site.shared.footer) },
  }
}

/** Change one section, wherever it is. Untouched pages keep their identity. */
export function updateSlotIn(site: Site, slotId: string, fn: (s: Slot) => Slot): Site {
  const { nav, footer } = site.shared
  if (nav?.id === slotId) return { ...site, shared: { ...site.shared, nav: fn(nav) } }
  if (footer?.id === slotId) return { ...site, shared: { ...site.shared, footer: fn(footer) } }
  return { ...site, pages: site.pages.map((p) => (p.slots.some((s) => s.id === slotId) ? { ...p, slots: p.slots.map((s) => (s.id === slotId ? fn(s) : s)) } : p)) }
}

/** Replace one page's own sections. */
export function setPageSlots(site: Site, pageId: string, slots: Slot[]): Site {
  return { ...site, pages: site.pages.map((p) => (p.id === pageId ? { ...p, slots } : p)) }
}

/** Change a page's settings. */
export function updatePage(site: Site, pageId: string, patch: Partial<Omit<Page, 'id' | 'slots'>>): Site {
  return { ...site, pages: site.pages.map((p) => (p.id === pageId ? { ...p, ...patch, show: { ...p.show, ...patch.show } } : p)) }
}

/**
 * A single page of sections as a site: its first nav and last footer become
 * the shared ones, the rest is the home page. How older mixes and versions
 * become sites.
 */
export function siteFromSlots(slots: Slot[], home: Partial<Pick<Page, 'id' | 'title'>> = {}): Site {
  const nav = slots.find((s) => s.type === 'nav')
  const footer = [...slots].reverse().find((s) => s.type === 'footer')
  return {
    pages: [{ id: home.id ?? 'page_home', path: '/', title: home.title ?? 'Home', slots: slots.filter((s) => s !== nav && s !== footer), show: { nav: true, footer: true } }],
    shared: { nav, footer },
  }
}

/** A path no page uses yet, starting from the one asked for (/about, /about-2…). */
export function freePath(site: Site, want: string): string {
  const base = normalizePath(want)
  if (!site.pages.some((p) => p.path === base)) return base
  for (let n = 2; ; n++) {
    const p = base === '/' ? `/page-${n}` : `${base}-${n}`
    if (!site.pages.some((x) => x.path === p)) return p
  }
}

/** "/about" → "About"; "/" → "Home". */
export const titleFromPath = (path: string) =>
  path === '/' ? 'Home' : (path.split('/').filter(Boolean).at(-1) ?? 'Page').replace(/-+/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** Starting points for a new page: its own sections, top to bottom (the shared nav and footer come with it). */
export const PAGE_TEMPLATES = {
  blank: { title: 'New page', types: [] },
  about: { title: 'About', types: ['header', 'content', 'team', 'cta'] },
  contact: { title: 'Contact', types: ['header', 'contact', 'faq'] },
  pricing: { title: 'Pricing', types: ['header', 'pricing', 'faq', 'cta'] },
  blog: { title: 'Blog', types: ['header', 'blog', 'cta'] },
} as const satisfies Record<string, { title: string; types: readonly SectionType[] }>
export type PageTemplate = keyof typeof PAGE_TEMPLATES

// Where links go. Clips write every link as href="#"; a section decides where
// each one leads: a section on this page, another page of the site, a web
// address, an email or a phone number. Words that name a section on the page
// ("Pricing", "Questions") lead there by themselves, emails and phone numbers
// become mailto: and tel:, so most links work before anyone sets one.

import type { BlockInfo, LinkTarget, SectionType, Site, Slot } from './types'
import { allSlots, pageView } from './site'
import { TYPE_LABEL } from './content'
import { attr, type HEl, type HNode } from './html/parse'

/** Words that point at a kind of section, beyond its own name. */
const SECTION_WORDS: Partial<Record<SectionType, string[]>> = {
  features: ['features', 'how it works', 'product', 'why us', 'benefits', 'capabilities'],
  pricing: ['pricing', 'plans', 'prices', 'cost'],
  faq: ['faq', 'faqs', 'questions', 'help'],
  testimonials: ['testimonials', 'reviews', 'customers', 'stories', 'love'],
  team: ['team', 'about', 'about us', 'people', 'company'],
  blog: ['blog', 'journal', 'news', 'articles', 'writing', 'updates'],
  contact: ['contact', 'contact us', 'get in touch', 'talk to us', 'say hello', 'support'],
  stats: ['numbers', 'results', 'impact'],
  logos: ['clients', 'partners', 'customers'],
  content: ['story', 'our story', 'mission'],
  hero: ['home', 'top'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()

/** A section's anchor in the exported page (#pricing, #faq, #features-2). */
export function sectionAnchors(slots: Pick<Slot, 'id' | 'type'>[]): Record<string, string> {
  const used = new Map<string, number>()
  const out: Record<string, string> = {}
  for (const s of slots) {
    const base = norm(TYPE_LABEL[s.type]).replace(/ /g, '-')
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    out[s.id] = n > 1 ? `${base}-${n}` : base
  }
  return out
}

/**
 * What links can reach from where they are: the sections (the page being shown
 * first, so its own sections win), each one's href from here ("#pricing" on the
 * same page, "/about#team" on another), and the site's pages.
 */
export interface LinkScope {
  slots: Pick<Slot, 'id' | 'type'>[]
  hrefs: Record<string, string>
  pages?: { id: string; path: string; title: string }[]
  /** For sections on another page than this one: that page's title. */
  elsewhere?: Record<string, string>
}

/** One page on its own: every section is "#anchor". */
export function pageScope(slots: Pick<Slot, 'id' | 'type'>[]): LinkScope {
  const anchors = sectionAnchors(slots)
  return { slots, hrefs: Object.fromEntries(slots.map((s) => [s.id, `#${anchors[s.id]}`])) }
}

/**
 * The whole site, seen from one page (or from the shared nav and footer, with
 * `here` null): sections on this page are "#anchor", others "/path#anchor". A
 * site of one page keeps plain "#anchor" everywhere.
 */
export function siteScope(site: Site, here: string | null): LinkScope {
  const multi = site.pages.length > 1
  const hrefs: Record<string, string> = {}
  const elsewhere: Record<string, string> = {}
  for (const page of site.pages) {
    const anchors = sectionAnchors(pageView(site, page.id))
    for (const s of page.slots) {
      const away = multi && page.id !== here
      hrefs[s.id] = away ? `${page.path === '/' ? '/' : page.path}#${anchors[s.id]}` : `#${anchors[s.id]}`
      if (away) elsewhere[s.id] = page.title
    }
  }
  const { nav, footer } = site.shared
  if (nav) hrefs[nav.id] = '#nav'
  if (footer) hrefs[footer.id] = '#footer'
  const first = here ? (site.pages.find((p) => p.id === here)?.slots ?? []) : []
  const slots = [...first, ...allSlots(site).filter((s) => !first.includes(s))]
  return { slots, hrefs, elsewhere, pages: site.pages.map((p) => ({ id: p.id, path: p.path, title: p.title })) }
}

/**
 * Where a link should go when nobody said: the section its words name (not the
 * section it's in; this page's first), a page they name ("About"), an email or
 * a phone number. Null when the words don't say.
 */
export function suggestLink(words: string, scope: LinkScope, fromSlotId: string): LinkTarget | null {
  const w = words.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w)) return { to: 'email', address: w }
  if (/^\+?[\d\s().-]{7,}$/.test(w) && (w.match(/\d/g) ?? []).length >= 7) return { to: 'phone', number: w }
  const n = norm(w)
  if (!n) return null
  // A section on this page first, then a page of that name ("About"), then a section on another page.
  let away: LinkTarget | null = null
  for (const s of scope.slots) {
    if (s.id === fromSlotId || s.type === 'nav' || s.type === 'footer') continue
    const names = [norm(TYPE_LABEL[s.type]), ...(SECTION_WORDS[s.type] ?? [])]
    if (!names.includes(n)) continue
    if (!scope.elsewhere?.[s.id]) return { to: 'section', slotId: s.id }
    away ??= { to: 'section', slotId: s.id }
  }
  for (const p of scope.pages ?? []) if (norm(p.title) === n || (p.path !== '/' && norm(p.path.replace(/\//g, ' ')) === n)) return { to: 'page', path: p.path, pageId: p.id }
  return away
}

export interface ResolvedLink {
  href: string
  newTab: boolean
  /** Section targets: the section, so the canvas can jump there. */
  slotId?: string
  /** True when this is the suggestion, not something set. */
  auto: boolean
  target: LinkTarget | null
}

/** The href a link target makes, from where the link is. */
export function hrefFor(t: LinkTarget | null, scope: Pick<LinkScope, 'hrefs' | 'pages'>): string {
  if (!t) return '#'
  switch (t.to) {
    case 'section':
      return scope.hrefs[t.slotId] ?? '#'
    case 'page': {
      // A page linked by id follows it when its path changes.
      const path = (t.pageId && scope.pages?.find((p) => p.id === t.pageId)?.path) || t.path
      return path.startsWith('/') ? path : `/${path}`
    }
    case 'url':
      return /^[a-z][a-z0-9+.-]*:/i.test(t.url) ? t.url : `https://${t.url}`
    case 'email':
      return `mailto:${t.address}`
    case 'phone':
      return `tel:${t.number.replace(/[^\d+]/g, '')}`
    case 'none':
      return '#'
  }
}

/** A link block's destination: what you set, else the suggestion from its words. */
export function resolveLink(set: LinkTarget | undefined, words: string, scope: LinkScope, fromSlotId: string): ResolvedLink {
  const target = set ?? suggestLink(words, scope, fromSlotId)
  const live = target && target.to === 'section' && !scope.slots.some((s) => s.id === target.slotId) ? null : target
  return {
    href: hrefFor(live, scope),
    newTab: live?.to === 'url' ? live.newTab !== false : false,
    slotId: live?.to === 'section' ? live.slotId : undefined,
    auto: !set && !!live,
    target: live,
  }
}

/** How a destination reads in the chrome: "Pricing section", "Team section on About", "/about", "stripe.com". */
export function describeLink(t: LinkTarget | null, scope: Pick<LinkScope, 'slots' | 'elsewhere' | 'pages'>): string {
  if (!t || t.to === 'none') return 'Nowhere yet'
  switch (t.to) {
    case 'section': {
      const s = scope.slots.find((x) => x.id === t.slotId)
      const on = scope.elsewhere?.[t.slotId]
      return s ? `${TYPE_LABEL[s.type]} section${on ? ` on ${on}` : ''}` : 'A removed section'
    }
    case 'page': {
      const p = scope.pages?.find((x) => x.id === t.pageId || x.path === t.path)
      return p ? `${p.title} page` : hrefFor(t, { hrefs: {} })
    }
    case 'url':
      return t.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    case 'email':
      return t.address
    case 'phone':
      return t.number
  }
}

/** The <a> a block links with: the block itself, or the first one inside it that isn't another block's. */
export function linkElementOf(el: HEl): HEl | null {
  if (el.tag === 'a') return el
  let found: HEl | null = null
  const walk = (nodes: HNode[]) => {
    for (const n of nodes) {
      if (found || n.t !== 'el' || attr(n, 'data-mx-block') !== undefined) continue
      if (n.tag === 'a') found = n
      else walk(n.kids)
    }
  }
  walk(el.kids)
  return found
}

/** Blocks a person can point somewhere. */
export const isLinkable = (b: BlockInfo) => !!b.linkable

/** The words a link block shows, for suggesting where it goes. */
export function linkWords(b: BlockInfo, blocks: BlockInfo[], fields: Record<string, string>): string {
  if (b.field) return fields[b.field] ?? ''
  const inner = blocks.find((x) => x.parent === b.id && x.field)
  return inner?.field ? (fields[inner.field] ?? '') : ''
}

/** Every linkable block's destination in a section. */
export function sectionLinks(
  blocks: BlockInfo[],
  edits: Record<string, { link?: LinkTarget }> | undefined,
  fields: Record<string, string>,
  scope: LinkScope,
  slotId: string,
): Record<string, ResolvedLink> {
  const out: Record<string, ResolvedLink> = {}
  for (const b of blocks) if (b.linkable) out[b.id] = resolveLink(edits?.[b.id]?.link, linkWords(b, blocks, fields), scope, slotId)
  return out
}

/** Write destinations into a section's markup (href, and target/rel for new tabs). */
export function applyLinks(tree: HNode[], links: Record<string, ResolvedLink>): HNode[] {
  const set = (a: HEl, l: ResolvedLink): HEl => {
    const attrs = a.attrs.filter(([k]) => k !== 'href' && k !== 'target' && k !== 'rel')
    attrs.splice(0, 0, ['href', l.href])
    if (l.newTab) attrs.push(['target', '_blank'], ['rel', 'noopener noreferrer'])
    return { ...a, attrs }
  }
  const visit = (nodes: HNode[]): HNode[] =>
    nodes.map((n) => {
      if (n.t !== 'el') return n
      const id = attr(n, 'data-mx-b')
      const l = id ? links[id] : undefined
      let el: HEl = { ...n, kids: visit(n.kids) }
      if (l) {
        const a = linkElementOf(n)
        if (a === n) el = set(el, l)
        else if (a) {
          // The same element: copies keep the clip element's attribute list.
          const swap = (nodes: HNode[]): HNode[] => nodes.map((k) => (k.t !== 'el' ? k : k.attrs === a.attrs ? set(k, l) : { ...k, kids: swap(k.kids) }))
          el = { ...el, kids: swap(el.kids) }
        }
      }
      return el
    })
  return visit(tree)
}

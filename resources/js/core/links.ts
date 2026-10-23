// Where links go. Clips write every link as href="#"; a section decides where
// each one leads: a section on this page, another page of the site, a web
// address, an email or a phone number. Words that name a section on the page
// ("Pricing", "Questions") lead there by themselves, emails and phone numbers
// become mailto: and tel:, so most links work before anyone sets one.

import type { BlockInfo, LinkTarget, SectionType, Slot } from './types'
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
 * Where a link should go when nobody said: the section its words name (not the
 * section it's in), an email or a phone number. Null when the words don't say.
 */
export function suggestLink(words: string, slots: Pick<Slot, 'id' | 'type'>[], fromSlotId: string): LinkTarget | null {
  const w = words.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w)) return { to: 'email', address: w }
  if (/^\+?[\d\s().-]{7,}$/.test(w) && (w.match(/\d/g) ?? []).length >= 7) return { to: 'phone', number: w }
  const n = norm(w)
  if (!n) return null
  for (const s of slots) {
    if (s.id === fromSlotId || s.type === 'nav' || s.type === 'footer') continue
    const names = [norm(TYPE_LABEL[s.type]), ...(SECTION_WORDS[s.type] ?? [])]
    if (names.includes(n)) return { to: 'section', slotId: s.id }
  }
  return null
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

/** The href a link target makes. */
export function hrefFor(t: LinkTarget | null, anchors: Record<string, string>): string {
  if (!t) return '#'
  switch (t.to) {
    case 'section':
      return anchors[t.slotId] ? `#${anchors[t.slotId]}` : '#'
    case 'page':
      return t.path.startsWith('/') ? t.path : `/${t.path}`
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
export function resolveLink(set: LinkTarget | undefined, words: string, slots: Pick<Slot, 'id' | 'type'>[], fromSlotId: string, anchors: Record<string, string>): ResolvedLink {
  const target = set ?? suggestLink(words, slots, fromSlotId)
  const live = target && target.to === 'section' && !slots.some((s) => s.id === target.slotId) ? null : target
  return {
    href: hrefFor(live, anchors),
    newTab: live?.to === 'url' ? live.newTab !== false : false,
    slotId: live?.to === 'section' ? live.slotId : undefined,
    auto: !set && !!live,
    target: live,
  }
}

/** How a destination reads in the chrome: "Pricing section", "/about", "stripe.com". */
export function describeLink(t: LinkTarget | null, slots: Pick<Slot, 'id' | 'type'>[]): string {
  if (!t || t.to === 'none') return 'Nowhere yet'
  switch (t.to) {
    case 'section': {
      const s = slots.find((x) => x.id === t.slotId)
      return s ? `${TYPE_LABEL[s.type]} section` : 'A removed section'
    }
    case 'page':
      return hrefFor(t, {})
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
  slots: Pick<Slot, 'id' | 'type'>[],
  slotId: string,
  anchors: Record<string, string>,
): Record<string, ResolvedLink> {
  const out: Record<string, ResolvedLink> = {}
  for (const b of blocks) if (b.linkable) out[b.id] = resolveLink(edits?.[b.id]?.link, linkWords(b, blocks, fields), slots, slotId, anchors)
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

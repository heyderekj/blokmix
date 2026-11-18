import { suggestLink, siteScope } from './links'
import type { BlockEdit, Library, LinkTarget, ProjectContent, SectionType, Site } from './types'

const NAV_LABEL: Partial<Record<SectionType, string>> = {
  features: 'Features', content: 'Our story', gallery: 'Gallery', pricing: 'Pricing',
  testimonials: 'Reviews', team: 'Team', blog: 'Journal', contact: 'Contact', faq: 'FAQ',
}

const ACTION_SECTIONS: SectionType[] = ['contact', 'cta', 'pricing', 'features']

/** Start with links that have destinations in this draft. Each layout can offer different sections. */
export function navForStart(site: Site, content: ProjectContent, lib: Library): { site: Site; content: ProjectContent } {
  const nav = site.shared.nav
  const home = site.pages.find((page) => page.path === '/')
  const clip = nav && lib.clips[nav.clipId]
  if (!nav || !home || clip?.origin !== 'layout' || !content.fields.nav) return { site, content }

  const scope = siteScope(site, home.id)
  const fields = { ...content.fields.nav }
  const links: { label: string; target: LinkTarget }[] = []
  for (const slot of home.slots) {
    const label = NAV_LABEL[slot.type]
    if (label && !links.some((entry) => entry.label === label)) links.push({ label, target: { to: 'section', slotId: slot.id } })
  }
  for (const page of site.pages) {
    if (page.id !== home.id) links.push({ label: page.title, target: { to: 'page', path: page.path, pageId: page.id } })
  }
  const edits: Record<string, BlockEdit> = { ...nav.edits?.[clip.id] }
  const blocks = clip.blocks.filter((b) => b.kind === 'link' && b.field && /^link\d+$/.test(b.field))
    .sort((a, b) => a.field!.localeCompare(b.field!))
  for (const [i, block] of blocks.entries()) {
    const item = links[i]
    if (item) {
      fields[block.field!] = item.label
      edits[block.id] = { ...edits[block.id], link: item.target }
    } else {
      const id = clip.blocks.find((b) => b.id === block.parent)?.kind === 'item' ? block.parent! : block.id
      edits[id] = { ...edits[id], hidden: true }
    }
  }

  const action = clip.blocks.find((b) => b.field === 'cta' && b.linkable)
  const destination = ACTION_SECTIONS.map((type) => home.slots.find((slot) => slot.type === type)).find(Boolean)
  const target = suggestLink(fields.cta ?? '', scope, nav.id)
  if (action && !target && destination) edits[action.id] = { ...edits[action.id], link: { to: 'section', slotId: destination.id } }
  if (action && !target && !destination) edits[action.id] = { ...edits[action.id], hidden: true }

  return {
    site: { ...site, shared: { ...site.shared, nav: { ...nav, edits: { ...nav.edits, [clip.id]: edits } } } },
    content: { ...content, fields: { ...content.fields, nav: fields } },
  }
}

// What to make next. Jev looks at every section captured for the site library (a
// screenshot each) and answers the same questions about all of them: what type it is,
// what shape it has, and which elements and visual treatments it uses. Code then
// counts what recurs across sites that Blokmix has no layout, element or treatment for.
// The questions and the "have" map below are the parts to review and grow.

import { SECTION_TYPES, type SectionType } from '../types'
import { choice, noul, at } from './ask'
import { SECTION_CRITERIA } from './vocab'
import type { Criterion, JevRequest, JevResponse, Question } from './types'
import { choiceOf, top, yes } from './read'

/** The section shapes in docs/layout-coverage.md. */
export const ARCHETYPES: Record<string, Criterion> = {
  centered: { what: 'Everything stacked and centered in one column', examples: ['A centered headline, a line and a button'] },
  split: { what: 'Two columns: words on one side, a picture or form on the other' },
  'media-below': { what: 'Words on top, one large picture or product shot below them' },
  'full-bleed': { what: 'A photo or video filling the whole section, words laid over it' },
  grid: { what: 'Two, three or four equal cards or columns side by side' },
  bento: { what: 'Tiles of different sizes fitted together like a bento box' },
  list: { what: 'A vertical list of rows, one under another' },
  tabs: { what: 'Tabs or buttons that switch which panel shows' },
  carousel: { what: 'A row that slides sideways, with arrows or dots' },
  gallery: { what: 'Many pictures arranged as a grid, masonry or filmstrip' },
  'off-grid': { what: 'Pieces that overlap or sit at uneven, staggered positions' },
  sticky: { what: 'One side stays put while the other side scrolls past it' },
  band: { what: 'A filled, colored panel inset on the page, holding the section' },
  timeline: { what: 'Steps or dates along a line' },
  comparison: { what: 'A table or side-by-side comparing options' },
  other: { what: 'None of these shapes' },
}

export interface GapElement {
  id: string
  label: string
  /** An element people place, or a visual treatment over things. */
  kind: 'element' | 'visual'
  question: string
  /** What Blokmix already has for it: clip ids, treatment ids or block looks, checked against the library. */
  have?: string[]
}

export const ELEMENTS: GapElement[] = [
  // Elements
  { id: 'countdown', label: 'Countdown timer', kind: 'element', question: 'Does the section show a countdown to a date (days, hours, minutes)?' },
  { id: 'map', label: 'Map', kind: 'element', question: 'Does the section show a map?', have: ['contact.layout-map'] },
  { id: 'rating', label: 'Star rating', kind: 'element', question: 'Does the section show a star rating or review score?' },
  { id: 'compare-table', label: 'Comparison table', kind: 'element', question: 'Does the section have a table comparing plans or options feature by feature?', have: ['pricing.layout-table', 'features.layout-compare'] },
  { id: 'marquee', label: 'Scrolling ticker', kind: 'element', question: 'Is there a row of logos or words that runs sideways like a ticker?', have: ['logos.layout-marquee'] },
  { id: 'before-after', label: 'Before and after slider', kind: 'element', question: 'Is there a before-and-after picture with a handle to compare them?' },
  { id: 'product-card', label: 'Product card with price', kind: 'element', question: 'Are there product cards, each with a photo, a name and a price?', have: ['pricing.layout-products'] },
  { id: 'hours', label: 'Opening hours', kind: 'element', question: 'Does the section list opening hours by day?' },
  { id: 'menu', label: 'Menu with prices', kind: 'element', question: 'Is there a food or drink menu: dishes with prices?' },
  { id: 'schedule', label: 'Event schedule', kind: 'element', question: 'Is there a schedule or agenda: times with talks or activities?' },
  { id: 'app-badges', label: 'App store badges', kind: 'element', question: 'Are there App Store or Google Play badges?' },
  { id: 'avatar-stack', label: 'Avatar stack', kind: 'element', question: 'Is there a small row of overlapping round profile photos (like “join 2,000 others”)?' },
  { id: 'steps', label: 'Numbered steps', kind: 'element', question: 'Are there numbered steps (1, 2, 3) explaining how something works?', have: ['content.layout-steps'] },
  { id: 'filter-chips', label: 'Filter chips', kind: 'element', question: 'Is there a row of small buttons or chips for filtering or picking a category?' },
  { id: 'search', label: 'Search box', kind: 'element', question: 'Is there a search box?' },
  { id: 'video', label: 'Video', kind: 'element', question: 'Does the section show a video or a video player with a play button?', have: ['hero.layout-video-inline', 'content.layout-video'] },
  { id: 'form', label: 'Form', kind: 'element', question: 'Is there a form with fields to fill in (beyond one email box)?', have: ['contact.layout-form', 'hero.layout-form'] },
  { id: 'newsletter', label: 'Email sign-up', kind: 'element', question: 'Is there a single email field with a sign-up button?', have: ['cta.layout-newsletter', 'footer.layout-newsletter'] },
  { id: 'sticker', label: 'Sticker or stamp', kind: 'element', question: 'Is there a tilted sticker, stamp or round badge stuck on the design?', have: ['cta.layout-sticker'] },
  { id: 'ui-screenshot', label: 'Product screenshot', kind: 'element', question: 'This whole picture is a screenshot of a website. Inside it, is there a smaller picture of a different app’s or product’s screen (a dashboard, a phone app, a product UI) shown as an image?', have: ['mock:dashboard', 'mock:analytics'] },
  // Visual treatments
  { id: 'grain', label: 'Grain or noise', kind: 'visual', question: 'Is there a visible grain or noise texture over the colors?', have: ['effect:grain', 'backdrop:grain'] },
  { id: 'glass', label: 'Frosted glass', kind: 'visual', question: 'Are there frosted-glass panels you can blurrily see through?', have: ['effect:glass'] },
  { id: 'glow', label: 'Glow', kind: 'visual', question: 'Do things glow, with soft colored light around them?', have: ['effect:glow'] },
  { id: 'mesh-gradient', label: 'Mesh gradient', kind: 'visual', question: 'Is there a soft, blurry multi-color gradient background?', have: ['backdrop:mesh', 'backdrop:mesh-gradient'] },
  { id: 'grid-lines', label: 'Grid or dot pattern', kind: 'visual', question: 'Is there a background of fine grid lines or dots?', have: ['backdrop:grid', 'backdrop:dots'] },
  { id: 'hand-drawn', label: 'Hand-drawn marks', kind: 'visual', question: 'Are there hand-drawn scribbles, underlines, arrows or doodles?', have: ['look:heading.scribble'] },
  { id: '3d', label: '3D render', kind: 'visual', question: 'Is there a 3D-rendered object or scene?' },
  { id: 'illustration', label: 'Flat illustration', kind: 'visual', question: 'Is there a drawn illustration (not a photo, not a screenshot)?' },
  { id: 'duotone', label: 'Duotone photo', kind: 'visual', question: 'Is a photo tinted in just one or two colors?' },
  { id: 'huge-type', label: 'Oversized type', kind: 'visual', question: 'Is there text so big it fills most of the width or runs off the edge?', have: ['hero.layout-editorial', 'footer.layout-wordmark'] },
  { id: 'shapes', label: 'Abstract shapes', kind: 'visual', question: 'Are there large decorative abstract shapes (blobs, circles, arcs)?', have: ['placeholder:shapes', 'backdrop:orb'] },
  { id: 'cut-out', label: 'Cut-out photo', kind: 'visual', question: 'Is there a photo of a person or product cut out from its background?' },
]

/** Above this a Noul counts as seen. */
export const SEEN = 0.7

const TYPES_PLUS: Record<string, Criterion> = { ...SECTION_CRITERIA, none_of_these: { what: 'None of these: a kind of section Blokmix has no type for', examples: ['A store locator', 'An event agenda', 'A product catalog'] } }

/** The questions for one section's screenshot (`section` in the state is the picture's reference). */
export function gapQuestions(): Record<string, Question> {
  const q: Record<string, Question> = {
    type: choice(`What kind of website section is ${at('section')}? ${at('place')} says where it sits on its page.`, TYPES_PLUS),
    archetype: choice(`How is ${at('section')} laid out?`, ARCHETYPES),
  }
  for (const e of ELEMENTS) q[`el_${e.id.replace(/-/g, '_')}`] = noul(`${e.question} Look at ${at('section')}.`)
  return q
}

/** Where a section sits, in words: a screenshot alone makes any big heading look like the top of a page. */
export const placeWords = (order: number, count: number) =>
  order === 0 ? `The first section at the top of the page (1 of ${count})` : order === count - 1 ? `The last section at the bottom of the page (${count} of ${count})` : `Section ${order + 1} of ${count}, partway down the page, not the top`

/** The request for one section's screenshot, with where it sits on its page. */
export function gapRequest(ref: string, asset: NonNullable<JevRequest['assets']>[string], place?: string): JevRequest {
  return { model: 'jev-latest', state: { section: ref, ...(place ? { place } : {}) }, questions: gapQuestions(), assets: { [ref]: asset } }
}

/** One section, as Jev read it. */
export interface SectionRead {
  site: string
  page: string
  order: number
  screenshot: string
  storedType: SectionType
  layoutId?: string
  status?: string
  type: { option: string; p: number }
  archetype: { option: string; p: number }
  seen: string[]
}

export function readSection(base: Omit<SectionRead, 'type' | 'archetype' | 'seen'>, res: JevResponse | null): SectionRead | null {
  const t = choiceOf(res, 'type')
  const a = choiceOf(res, 'archetype')
  if (!t || !a) return null
  const seen = ELEMENTS.filter((e) => (yes(res, `el_${e.id.replace(/-/g, '_')}`) ?? 0) >= SEEN).map((e) => e.id)
  return { ...base, type: top(t), archetype: top(a), seen }
}

/** What Blokmix has, so a gap is only a gap when nothing covers it. */
export interface Have {
  clips: Set<string>
  treatments: Set<string>
}

export function covered(e: GapElement, have: Have): boolean {
  return (e.have ?? []).some((id) => have.clips.has(id) || have.treatments.has(id))
}

export interface GapReport {
  sections: number
  sites: number
  layouts: { type: string; archetype: string; sites: string[]; count: number; examples: string[] }[]
  newTypes: { site: string; screenshot: string; p: number }[]
  elements: { id: string; label: string; kind: 'element' | 'visual'; sites: string[]; count: number; have: boolean }[]
  retype: { site: string; screenshot: string; stored: string; jev: string; p: number }[]
}

/** Counted across sites: what recurs and what Blokmix lacks. */
export function gapReport(reads: SectionRead[], have: Have): GapReport {
  const where = (s: SectionRead) => `${s.site}/${s.screenshot}`
  const layouts = new Map<string, GapReport['layouts'][number]>()
  for (const s of reads.filter((r) => r.status === 'needs_layout')) {
    const type = s.type.option === 'none_of_these' ? s.storedType : s.type.option
    const key = `${type}·${s.archetype.option}`
    const row = layouts.get(key) ?? { type, archetype: s.archetype.option, sites: [], count: 0, examples: [] }
    row.count++
    if (!row.sites.includes(s.site)) row.sites.push(s.site)
    if (row.examples.length < 4) row.examples.push(where(s))
    layouts.set(key, row)
  }
  const elements = ELEMENTS.map((e) => {
    const hits = reads.filter((r) => r.seen.includes(e.id))
    return { id: e.id, label: e.label, kind: e.kind, sites: [...new Set(hits.map((h) => h.site))], count: hits.length, have: covered(e, have) }
  })
  return {
    sections: reads.length,
    sites: new Set(reads.map((r) => r.site)).size,
    layouts: [...layouts.values()].sort((a, b) => b.sites.length - a.sites.length || b.count - a.count),
    newTypes: reads.filter((r) => r.type.option === 'none_of_these' && r.type.p >= 0.5).map((r) => ({ site: r.site, screenshot: r.screenshot, p: r.type.p })),
    elements: elements.filter((e) => e.count > 0).sort((a, b) => Number(a.have) - Number(b.have) || b.sites.length - a.sites.length || b.count - a.count),
    retype: reads
      .filter((r) => r.type.option !== r.storedType && r.type.option !== 'none_of_these' && r.type.p >= 0.8 && (SECTION_TYPES as readonly string[]).includes(r.type.option))
      .map((r) => ({ site: r.site, screenshot: r.screenshot, stored: r.storedType, jev: r.type.option, p: r.type.p })),
  }
}

/** The report as Markdown: what to make next, most-seen first. */
export function gapMarkdown(r: GapReport, minSites = 2): string {
  const pct = (p: number) => `${Math.round(p * 100)}%`
  const lines = [`# What to make next`, '', `Jev read ${r.sections} sections from ${r.sites} sites in the site library.`, '']
  lines.push('## Layouts to make', '', 'Sections no built-in layout matches, by type and shape. Most sites first.', '')
  for (const l of r.layouts) lines.push(`- **${l.type} · ${l.archetype}**: ${l.count} on ${l.sites.length} site${l.sites.length === 1 ? '' : 's'} (${l.sites.join(', ')}). e.g. ${l.examples.join(', ')}`)
  if (!r.layouts.length) lines.push('- Nothing: every section matched a layout.')
  const missing = (kind: 'element' | 'visual') => r.elements.filter((e) => e.kind === kind && !e.have && e.sites.length >= minSites)
  lines.push('', '## Elements to make', '', `Seen on ${minSites}+ sites with nothing in Blokmix for them.`, '')
  for (const e of missing('element')) lines.push(`- **${e.label}**: ${e.count} sections on ${e.sites.length} sites (${e.sites.join(', ')})`)
  if (!missing('element').length) lines.push('- None yet.')
  lines.push('', '## Treatments to make', '', `Visual treatments seen on ${minSites}+ sites that Blokmix can’t do yet.`, '')
  for (const e of missing('visual')) lines.push(`- **${e.label}**: ${e.count} sections on ${e.sites.length} sites (${e.sites.join(', ')})`)
  if (!missing('visual').length) lines.push('- None yet.')
  lines.push('', '## Already covered', '')
  for (const e of r.elements.filter((x) => x.have)) lines.push(`- ${e.label}: seen ${e.count}× on ${e.sites.length} sites`)
  if (r.newTypes.length) {
    lines.push('', '## Sections with no type', '', 'Jev thinks these fit none of Blokmix’s section types.', '')
    for (const n of r.newTypes) lines.push(`- ${n.site}/${n.screenshot} (${pct(n.p)} sure)`)
  }
  if (r.retype.length) {
    lines.push('', '## Maybe the wrong type', '', 'Jev is sure these are another type than the one stored. Check them in /library/admin.', '')
    for (const x of r.retype) lines.push(`- ${x.site}/${x.screenshot}: stored ${x.stored}, Jev says ${x.jev} (${pct(x.p)})`)
  }
  return lines.join('\n') + '\n'
}

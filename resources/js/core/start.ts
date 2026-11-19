// The guided start: what you're making becomes three raw starts, in Wireframe, to pick
// a structure; the one you pick then goes under the skins, with your brand color if you
// have one. Starter mixes that fit come first; the rest are put together from the
// library's two shelves, following the page order people expect for that kind of site.
// Pure: measuring and picking the best happen in the browser (`lib/start.ts`).

import type { Density, GuideState, Kind, Library, ProjectContent, SectionType, Site, Slot, Starter } from './types'
import { DEFAULT_KEEP } from './types'
import { emptyGuide } from './guide'
import { DEFAULT_CONTENT, FIELD_SCHEMA } from './content'
import { KIND_WORDS, SHARED_WORDS } from './startWords'
import { PAGE_TEMPLATES, siteFromSlots, type PageTemplate } from './site'
import { suggestClip, suggestTypes } from './suggest'
import { pickable, shelfOf } from './library'
import { applySkin, skinById, skinList, WIREFRAME } from './skins'
import type { Mode, PaletteVariant, Palette } from './palette'
import { navForStart } from './startNav'
import { heroFamily } from './heroLayouts'
import { mineKey } from './ownWords'
import { FORMATS, GOAL_SECTIONS, goalsOf, INDUSTRIES, MAIN_ACTION_FIELDS, type Brief } from './brief'
import { placeSection, sectionsFor } from './jev/describe'

export interface StartInput {
  kind: Kind
  /** The site's name: the brand in the nav and footer. */
  name: string
  /** In one line, what it is: becomes the main headline. */
  oneLiner?: string
  /** The skin it's dressed in; Wireframe until you've picked a structure. */
  skin?: string
  /** One brand color (hex); the skin's own when left out. */
  brand?: string | null
  /** A whole palette (colors by feel), in place of one made from the brand color. */
  variant?: PaletteVariant
  palette?: Palette | null
  mode?: Mode
  /** Shuffle: a different seed gives different picks. */
  seed?: number
  /** Home's sections top to bottom, in place of the kind's usual page (a description, or chips you changed). */
  sections?: SectionType[]
  /** What the site is for (core/brief.ts): kept with the words, and its main button fills the page's buttons. */
  brief?: Brief
  /** The main button's words ("Order ahead"), from what the site should help people do. */
  button?: string
  /** Pages besides home that were asked for ("an about page", "a page for our classes"), from the page templates. */
  pages?: { template: PageTemplate; purpose?: string | null }[]
}

export interface StartCandidate {
  id: string
  /** "Starter: Studio portfolio", or what it's made of. */
  label: string
  /** A starter mix, put together from the library, or made from words you pasted. */
  from: 'starter' | 'library' | 'words'
  starterId?: string
  site: Site
  guide: GuideState
  content: ProjectContent
  /** How many sections came from each shelf. */
  shelves: { plain: number; real: number }
  /** The direction it was made in (core/directions.ts), when it came from one. */
  direction?: string
}

/** Each kind's pages, top to bottom, in the order people expect (nav and footer included on Home). */
export const RECIPES: Record<Kind, { home: SectionType[]; about?: SectionType[] }> = {
  product: { home: ['nav', 'hero', 'logos', 'features', 'testimonials', 'pricing', 'faq', 'cta', 'footer'] },
  studio: { home: ['nav', 'hero', 'logos', 'features', 'testimonials', 'contact', 'footer'], about: ['header', 'team', 'cta'] },
  local: { home: ['nav', 'hero', 'features', 'testimonials', 'faq', 'contact', 'footer'] },
  event: { home: ['nav', 'hero', 'features', 'stats', 'faq', 'cta', 'footer'] },
  personal: { home: ['nav', 'hero', 'content', 'blog', 'contact', 'footer'] },
  writing: { home: ['nav', 'hero', 'blog', 'testimonials', 'cta', 'footer'] },
}

/**
 * Home's sections from the brief: the kind's page, shaped by the format (a portfolio leads with the work) and the goals
 * (each adds the section it leans on most, where it belongs), then what a description asked for (`want`).
 */
export function recipeFor(brief: Brief, kind: Kind, want: Partial<Record<SectionType, number>> = {}): SectionType[] {
  let out = sectionsFor(kind, want)
  if (brief.format === 'portfolio' && !out.includes('gallery')) out = [...out.slice(0, 2), 'gallery', ...out.slice(2)]
  for (const g of goalsOf(brief)) {
    const t = GOAL_SECTIONS[g][0]
    if (t && !out.includes(t)) out = placeSection(out, t)
  }
  return out
}

/** The style guide for a start: a skin, with a palette from your brand color, or turned the other way, if you asked. */
export function guideFor(input: Pick<StartInput, 'skin' | 'brand' | 'mode' | 'palette' | 'variant'>): GuideState {
  const skin = skinById(input.skin ?? WIREFRAME) ?? skinList()[0]
  if (!skin) return emptyGuide()
  const base = emptyGuide()
  if (input.mode) base.mode = input.mode
  if (input.brand) base.brand = {color:input.brand, ...(input.variant ? {variant:input.variant} : {})}
  const guide = applySkin(base, skin)
  return input.palette ? {...guide, base:{...guide.base, ...input.palette}} : guide
}

/** An address for the contact section, made from the site's name: "Fern & Co" → hello@fernco.com. */
const emailFor = (name: string) => `hello@${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '') || 'example'}.com`

/**
 * The words for a start: every section's starter words for your kind of site
 * (`core/startWords.ts`), with your name in them and your line as the headline.
 */
export function contentFor(input: Pick<StartInput, 'kind' | 'name' | 'oneLiner' | 'brief' | 'button'>, year = new Date().getFullYear()): ProjectContent {
  const name = input.name.trim() || 'Your site'
  const fill = (s: string) => s.replaceAll('{name}', name).replaceAll('{email}', emailFor(name)).replaceAll('{year}', String(year))
  const fields: ProjectContent['fields'] = {}
  // Words that are yours though they live here: your name and email wherever they're filled in, and your one line.
  const mine: string[] = []
  for (const type of Object.keys(FIELD_SCHEMA) as SectionType[]) {
    // Every field in the schema gets words: the kind's, then the shared ones, then (only if both lack it) the default.
    const words = { ...DEFAULT_CONTENT.fields[type], ...SHARED_WORDS[type], ...KIND_WORDS[input.kind][type] }
    fields[type] = Object.fromEntries(Object.entries(words).map(([k, v]) => [k, fill(v)]))
    // Just the name or the email (a nav's brand, a contact address), and the footer's legal line: yours as given.
    if (input.name.trim()) for (const [k, v] of Object.entries(words)) if (/^\{(name|email)\}$/.test(v.trim()) || (type === 'footer' && k === 'legal')) mine.push(mineKey(type, k))
  }
  // The main button, on the hero and the closing push.
  const button = input.button?.trim()
  if (button)
    for (const t of ['hero', 'cta'] as const)
      if (fields[t]) {
        fields[t] = { ...fields[t], ctaPrimary: button }
        mine.push(mineKey(t, 'ctaPrimary'))
      }
  const line = input.oneLiner?.trim()
  if (line && fields.hero) {
    fields.hero = { ...fields.hero, headline: line }
    mine.push(mineKey('hero', 'headline'))
  }
  // The main button's words, wherever the page has one: yours when you typed them, picked ones are still filler.
  const action = input.brief?.mainAction?.trim()
  if (action)
    for (const [type, field] of MAIN_ACTION_FIELDS)
      if (fields[type] && field in fields[type]!) {
        fields[type] = { ...fields[type], [field]: action }
        if (input.brief?.mainActionTyped) mine.push(mineKey(type, field))
      }
  const brief = input.brief && Object.keys(input.brief).length ? { brief: input.brief } : {}
  return { brand: name, kind: input.kind, fields, ...(mine.length ? { mine } : {}), ...brief }
}

const slotFor = (id: string, type: SectionType, clipId: string): Slot => ({ id, type, clipId, locked: false, keep: { ...DEFAULT_KEEP } })

/** A site from pages of clip ids (Home first, its nav and footer shared). */
export function siteFromPages(lib: Library, pages: { path: string; title: string; sections: string[] }[], prefix: string): Site {
  const slotsOf = (ids: string[], p: number) => ids.filter((id) => lib.clips[id]).map((id, i) => slotFor(`${prefix}p${p}s${i}`, lib.clips[id].type, id))
  const [home, ...rest] = pages
  const site = siteFromSlots(slotsOf(home?.sections ?? [], 0))
  for (const [i, page] of rest.entries()) {
    const slots = slotsOf(page.sections, i + 1).filter((s) => s.type !== 'nav' && s.type !== 'footer')
    site.pages.push({ id: `${prefix}page${i + 1}`, path: page.path, title: page.title, slots, show: { nav: true, footer: true } })
  }
  return site
}

/**
 * Pages besides home, each from its page template: the kind's About when home is the kind's usual page, then the pages
 * asked for, one of each (a blank one only when it says what it's for, titled by its words).
 */
export function otherPages(input: Pick<StartInput, 'pages'>, about: SectionType[] | undefined, lib: Library, variant: number, seed: number, prefs: PagePrefs = {}): { path: string; title: string; sections: string[] }[] {
  const out: { path: string; title: string; sections: string[] }[] = []
  if (about) out.push({ path: '/about', title: 'About', sections: fillPage(lib, about, variant, seed, undefined, prefs) })
  for (const p of input.pages ?? []) {
    const t = PAGE_TEMPLATES[p.template]
    const purpose = p.purpose?.trim()
    const title = p.template === 'blank' ? (purpose ? purpose.replace(/^./, (c) => c.toUpperCase()).slice(0, 40) : '') : t.title
    const path = `/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    if (!title || out.some((o) => o.path === path)) continue
    const types: SectionType[] = t.types.length ? [...t.types] : ['header', 'content', 'cta']
    out.push({ path, title, sections: fillPage(lib, types, variant, seed, undefined, prefs) })
  }
  return out
}

/** A small, stable hash for seeded picks. */
const mix = (...parts: (string | number)[]) => {
  let h = 2166136261
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/** What a direction (core/directions.ts) asks of a page: its own layouts per type, best first, and how roomy. */
export interface PagePrefs {
  layouts?: Partial<Record<SectionType, string[]>>
  density?: Density
}

/**
 * One page, filled section by section. A direction's own layouts for a type come first (the first that's offered; a
 * seed or a variant turns between its first two). Otherwise each spot ranks the clips for its type the way Add section does
 * (rhythm contrast with the section above, leaning to the direction's density), built-in layouts first since they
 * take any skin; `variant` and the seed pick among the best few so starts differ.
 */
export function fillPage(lib: Library, types: SectionType[], variant: number, seed: number, hero?: string, prefs: PagePrefs = {}): string[] {
  const out: string[] = []
  for (const type of types) {
    if (type === 'hero' && hero) {
      out.push(hero)
      continue
    }
    const own = (prefs.layouts?.[type] ?? []).filter((id) => pickable(lib, type).includes(id))
    if (own.length) {
      out.push(own[(variant + (seed ? mix(seed, type) : 0)) % Math.min(2, own.length)])
      continue
    }
    // A clear brand, a short row of links and one action are the default chrome for generated pages.
    if (type === 'nav') {
      const navs = ['simple', 'centered', 'pill'].map((id) => `nav.layout-${id}`).filter((id) => lib.clips[id])
      if (navs.length) {
        out.push(navs[(variant + seed) % navs.length])
        continue
      }
    }
    const slots = out.map((clipId) => ({ type: lib.clips[clipId].type, clipId }))
    const ranked = suggestClip(type, slots, slots.length, lib)
      .map((s, i) => ({ id: s.clipId, score: (lib.clips[s.clipId].origin === 'layout' ? 2 : 0) - i * 0.25 + (prefs.density && lib.clips[s.clipId].density === prefs.density ? 0.5 : 0) }))
      .sort((a, b) => b.score - a.score)
    if (!ranked.length) continue
    const top = ranked.slice(0, Math.min(3, ranked.length))
    out.push(top[(variant + mix(seed, type)) % top.length].id)
  }
  return out
}

// Start with compositions that make sense for the brief. Shuffle brings the rest of the shelf forward.
const leadHeroes: Record<Kind, string[]> = {
  product: ['split', 'product', 'bento', 'editorial'],
  studio: ['editorial', 'split', 'collage', 'media-below'],
  local: ['split', 'editorial', 'media-below', 'bento'],
  event: ['bento', 'editorial', 'form', 'split'],
  personal: ['portrait', 'split', 'centered', 'collage'],
  writing: ['editorial', 'form', 'split', 'collage'],
}

function heroesFor(lib: Library, kind: Kind, seed: number): string[] {
  const all = pickable(lib, 'hero')
  const layouts = all.filter((id) => lib.clips[id].origin === 'layout' && !id.startsWith('hero.layout-video-'))
  const lead = leadHeroes[kind].map((id) => `hero.layout-${id}`).filter((id) => layouts.includes(id))
  const ordered = [...new Set([...lead, ...layouts])]
  const turn = ordered.length ? seed % ordered.length : 0
  return [...ordered.slice(turn), ...ordered.slice(0, turn), ...all.filter((id) => lib.clips[id].origin === 'clip')]
}

export const countShelves = (lib: Library, site: Site) => {
  const ids = [site.shared.nav, site.shared.footer, ...site.pages.flatMap((p) => p.slots)].filter(Boolean).map((s) => s!.clipId)
  return {
    plain: ids.filter((id) => shelfOf(lib.clips[id]) === 'plain').length,
    real: ids.filter((id) => shelfOf(lib.clips[id]) === 'real').length,
  }
}

const signature = (site: Site) => [site.shared.nav, ...site.pages.flatMap((p) => p.slots), site.shared.footer].map((s) => s?.clipId ?? '').join(',')

/** Starter mixes for a kind of site. */
export function startersFor(lib: Library, kind: Kind, brief?: Brief): Starter[] {
  const fits = (s: Starter) => (brief?.industry && s.industries?.includes(brief.industry) ? 2 : 0) + (brief?.format && s.formats?.includes(brief.format) ? 1 : 0)
  return lib.starters.filter((s) => s.kind === kind).sort((a, b) => fits(b) - fits(a))
}

/**
 * Three (or `n`) different starts. Up to two matching starter mixes come first; the
 * rest are put together from the library, each opening with a different hero.
 * Every start shares the same style guide and words, so they differ in layout only.
 */
export function startCandidates(input: StartInput, lib: Library, n = 3): StartCandidate[] {
  const seed = input.seed ?? 0
  const guide = guideFor(input)
  const content = contentFor(input)
  const out: StartCandidate[] = []
  const seen = new Set<string>()
  const push = (c: Omit<StartCandidate, 'id' | 'shelves'>) => {
    const sig = signature(c.site)
    if (seen.has(sig) || out.length >= n) return
    seen.add(sig)
    out.push({ ...c, ...navForStart(c.site, c.content, lib), id: `start${out.length}`, shelves: countShelves(lib, c.site) })
  }

  // Your own list of sections wins over starter mixes, which come with theirs.
  const own = !!input.sections?.length && input.sections.join() !== RECIPES[input.kind].home.join()
  const starters = own ? [] : startersFor(lib, input.kind, input.brief)
  const offset = starters.length ? seed % starters.length : 0
  const usedHeroes = new Set<string>()
  const rotatedStarters = [...starters.slice(offset), ...starters.slice(0, offset)]
  for (const s of rotatedStarters) {
    if (out.length >= Math.min(2, n - 1)) break
    const hero = s.pages[0]?.sections.find((id) => lib.clips[id]?.type === 'hero')
    if (hero && usedHeroes.has(heroFamily(hero, lib))) continue
    if (hero) usedHeroes.add(heroFamily(hero, lib))
    push({ label: `Starter: ${s.name}`, from: 'starter', starterId: s.id, site: siteFromPages(lib, s.pages, `${s.id}_`), guide, content })
  }

  const recipe = own ? { ...RECIPES[input.kind], home: input.sections! } : RECIPES[input.kind]
  const heroes = heroesFor(lib, input.kind, seed)
  for (let variant = 0; out.length < n && variant < n * 4; variant++) {
    const distinct = heroes.findIndex((id) => !usedHeroes.has(heroFamily(id, lib)))
    const index = distinct >= 0 ? distinct : 0
    const [hero] = heroes.splice(index, 1)
    if (hero) usedHeroes.add(heroFamily(hero, lib))
    const pages = [{ path: '/', title: 'Home', sections: fillPage(lib, recipe.home, variant, seed, hero) }]
    pages.push(...otherPages(input, recipe.about, lib, variant, seed))
    const site = siteFromPages(lib, pages, `gen${variant}_`)
    const shelves = countShelves(lib, site)
    const label = shelves.real ? `${shelves.real} real-site section${shelves.real === 1 ? '' : 's'}, ${shelves.plain} plain` : `${lib.clips[hero ?? '']?.title ?? 'A fresh mix'}`
    push({ label, from: 'library', site, guide, content })
  }
  return out
}

/** A nav and a footer for a page made another way (from your words): built-in layouts, turned by `variant`. */
export function chromeFor(lib: Library, variant: number, seed = 0): { nav?: string; footer?: string } {
  const [nav, footer] = fillPage(lib, ['nav', 'footer'], variant, seed)
  return { nav, footer }
}

/** Problems with the starter mixes: unknown clips, or sections where a page can't have them. Empty when all is well. */
export function checkStarters(lib: Library): string[] {
  const problems: string[] = []
  for (const s of lib.starters) {
    if (!s.pages.length) problems.push(`${s.id}: no pages`)
    for (const i of s.industries ?? []) if (!(INDUSTRIES as readonly string[]).includes(i)) problems.push(`${s.id}: unknown industry ${i}`)
    for (const f of s.formats ?? []) if (!(FORMATS as readonly string[]).includes(f)) problems.push(`${s.id}: unknown format ${f}`)
    for (const [p, page] of s.pages.entries()) {
      const types: SectionType[] = []
      for (const id of page.sections) {
        const clip = lib.clips[id]
        if (!clip) {
          problems.push(`${s.id}: unknown clip ${id}`)
          continue
        }
        const slots = types.map((type) => ({ type, clipId: '' }))
        const fit = suggestTypes(slots, slots.length).find((t) => t.type === clip.type)
        if (!fit?.allowed && !(p > 0 && (clip.type === 'nav' || clip.type === 'footer'))) problems.push(`${s.id} ${page.path}: ${id} — ${fit?.reason ?? 'not allowed here'}`)
        types.push(clip.type)
      }
    }
  }
  return problems
}

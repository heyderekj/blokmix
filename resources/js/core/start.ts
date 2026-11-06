// The guided start: what you're making becomes three raw starts, in Wireframe, to pick
// a structure; the one you pick then goes under the skins, with your brand color if you
// have one. Starter mixes that fit come first; the rest are put together from the
// library's two shelves, following the page order people expect for that kind of site.
// Pure: measuring and picking the best happen in the browser (`lib/start.ts`).

import type { GuideState, Kind, Library, ProjectContent, SectionType, Site, Slot, Starter } from './types'
import { DEFAULT_KEEP } from './types'
import { emptyGuide } from './guide'
import { DEFAULT_CONTENT, FIELD_SCHEMA } from './content'
import { KIND_WORDS, SHARED_WORDS } from './startWords'
import { siteFromSlots } from './site'
import { suggestClip, suggestTypes } from './suggest'
import { pickable, shelfOf, starterOpen } from './library'
import { applySkin, skinById, skinList, WIREFRAME } from './skins'
import { setTone } from './dials'
import { paletteFrom, type Mode, type Palette } from './palette'
import { resolveGuide } from './guide'
import { mineKey } from './ownWords'

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
  palette?: Palette | null
  mode?: Mode
  /** Shuffle: a different seed gives different picks. */
  seed?: number
  /** Home's sections top to bottom, in place of the kind's usual page (a description, or chips you changed). */
  sections?: SectionType[]
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
}

export const KIND_LABEL: Record<Kind, { name: string; words: string }> = {
  product: { name: 'An app or product', words: 'Software, a gadget, something people sign up for or buy' },
  studio: { name: 'A studio or service', words: 'Your design studio, agency, practice or freelance work' },
  local: { name: 'A local business', words: 'A café, shop, salon or anything with a door people walk through' },
  event: { name: 'An event or launch', words: 'Something coming soon: a waitlist, a conference, a drop' },
  personal: { name: 'A personal site', words: 'You: who you are, what you do, how to reach you' },
  writing: { name: 'Writing or a newsletter', words: 'Essays, issues, a publication people subscribe to' },
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

/** The style guide for a start: a skin, with a palette from your brand color, or turned the other way, if you asked. */
export function guideFor(input: Pick<StartInput, 'skin' | 'brand' | 'mode' | 'palette'>): GuideState {
  const skin = skinById(input.skin ?? WIREFRAME) ?? skinList()[0]
  if (!skin) return emptyGuide()
  const guide = applySkin(emptyGuide(), skin)
  const mode = input.mode ?? skin.mode
  const colors = input.palette ? input.palette : input.brand ? paletteFrom(input.brand, mode) : mode !== skin.mode ? setTone(resolveGuide(guide).tokens, mode) : null
  return colors ? { ...guide, base: { ...guide.base, ...colors } } : guide
}

/** An address for the contact section, made from the site's name: "Fern & Co" → hello@fernco.com. */
const emailFor = (name: string) => `hello@${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '') || 'example'}.com`

/**
 * The words for a start: every section's starter words for your kind of site
 * (`core/startWords.ts`), with your name in them and your line as the headline.
 */
export function contentFor(input: Pick<StartInput, 'kind' | 'name' | 'oneLiner'>, year = new Date().getFullYear()): ProjectContent {
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
  const line = input.oneLiner?.trim()
  if (line && fields.hero) {
    fields.hero = { ...fields.hero, headline: line }
    mine.push(mineKey('hero', 'headline'))
  }
  return { brand: name, kind: input.kind, fields, ...(mine.length ? { mine } : {}) }
}

const slotFor = (id: string, type: SectionType, clipId: string): Slot => ({ id, type, clipId, locked: false, keep: { ...DEFAULT_KEEP } })

/** A site from pages of clip ids (Home first, its nav and footer shared). */
function siteFromPages(lib: Library, pages: { path: string; title: string; sections: string[] }[], prefix: string): Site {
  const slotsOf = (ids: string[], p: number) => ids.filter((id) => lib.clips[id]).map((id, i) => slotFor(`${prefix}p${p}s${i}`, lib.clips[id].type, id))
  const [home, ...rest] = pages
  const site = siteFromSlots(slotsOf(home?.sections ?? [], 0))
  for (const [i, page] of rest.entries()) {
    const slots = slotsOf(page.sections, i + 1).filter((s) => s.type !== 'nav' && s.type !== 'footer')
    site.pages.push({ id: `${prefix}page${i + 1}`, path: page.path, title: page.title, slots, show: { nav: true, footer: true } })
  }
  return site
}

/** A small, stable hash for seeded picks. */
const mix = (...parts: (string | number)[]) => {
  let h = 2166136261
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * One page, filled section by section. Each spot ranks the clips for its type the
 * way Add section does (rhythm contrast with the section above), built-in layouts
 * first since they take any skin; `variant` and the seed pick among the best few so
 * starts differ.
 */
function fillPage(lib: Library, types: SectionType[], variant: number, seed: number, hero?: string): string[] {
  const out: string[] = []
  for (const type of types) {
    if (type === 'hero' && hero) {
      out.push(hero)
      continue
    }
    const slots = out.map((clipId) => ({ type: lib.clips[clipId].type, clipId }))
    const ranked = suggestClip(type, slots, slots.length, lib)
      .map((s, i) => ({ id: s.clipId, score: (lib.clips[s.clipId].origin === 'layout' ? 2 : 0) - i * 0.25 }))
      .sort((a, b) => b.score - a.score)
    if (!ranked.length) continue
    const top = ranked.slice(0, Math.min(3, ranked.length))
    out.push(top[(variant + mix(seed, type)) % top.length].id)
  }
  return out
}

/** Heroes for generated starts: built-in layouts first, in an order the seed turns, so each start opens differently. */
function heroesFor(lib: Library, seed: number): string[] {
  const all = pickable(lib, 'hero')
  const layouts = all.filter((id) => lib.clips[id].origin === 'layout')
  const turn = layouts.length ? mix(seed, 'hero') % layouts.length : 0
  return [...new Set([...layouts.slice(turn), ...layouts.slice(0, turn), ...all])]
}

const countShelves = (lib: Library, site: Site) => {
  const ids = [site.shared.nav, site.shared.footer, ...site.pages.flatMap((p) => p.slots)].filter(Boolean).map((s) => s!.clipId)
  return {
    plain: ids.filter((id) => shelfOf(lib.clips[id]) === 'plain').length,
    real: ids.filter((id) => shelfOf(lib.clips[id]) === 'real').length,
  }
}

const signature = (site: Site) => [site.shared.nav, ...site.pages.flatMap((p) => p.slots), site.shared.footer].map((s) => s?.clipId ?? '').join(',')

/** Starter mixes for a kind of site this mix can use. */
export function startersFor(lib: Library, kind: Kind): Starter[] {
  return lib.starters.filter((s) => s.kind === kind && starterOpen(lib, s))
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
    out.push({ ...c, id: `start${out.length}`, shelves: countShelves(lib, c.site) })
  }

  // Your own list of sections wins over starter mixes, which come with theirs.
  const own = !!input.sections?.length && input.sections.join() !== RECIPES[input.kind].home.join()
  const starters = own ? [] : startersFor(lib, input.kind)
  const offset = starters.length ? seed % starters.length : 0
  for (const s of [...starters.slice(offset), ...starters.slice(0, offset)].slice(0, Math.min(2, n - 1))) {
    push({ label: `Starter: ${s.name}`, from: 'starter', starterId: s.id, site: siteFromPages(lib, s.pages, `${s.id}_`), guide, content })
  }

  const recipe = own ? { ...RECIPES[input.kind], home: input.sections! } : RECIPES[input.kind]
  const usedHeroes = new Set(out.map((c) => c.site.pages[0].slots.find((s) => s.type === 'hero')?.clipId))
  const heroes = heroesFor(lib, seed).filter((id) => !usedHeroes.has(id))
  for (let variant = 0, tries = 0; out.length < n && tries < n * 4; variant++, tries++) {
    const hero = heroes.length ? heroes[(variant + seed) % heroes.length] : undefined
    const pages = [{ path: '/', title: 'Home', sections: fillPage(lib, recipe.home, variant, seed, hero) }]
    if (recipe.about) pages.push({ path: '/about', title: 'About', sections: fillPage(lib, recipe.about, variant, seed) })
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

// The guided start: three light answers (what you're making, a feel, maybe a
// brand color) become three real starting mixes. Starter mixes that fit come
// first; the rest are put together from the library's two shelves, following the
// page order people expect for that kind of site. Pure: measuring and picking
// the best happen in the browser (`lib/start.ts`).

import type { GuideState, Kind, Library, ProjectContent, SectionType, Site, Slot, Starter } from './types'
import { DEFAULT_KEEP } from './types'
import { emptyGuide } from './guide'
import { DEFAULT_CONTENT, FIELD_SCHEMA } from './content'
import { KIND_WORDS, SHARED_WORDS } from './startWords'
import { siteFromSlots } from './site'
import { suggestClip, suggestTypes } from './suggest'
import { pickable, shelfOf, starterOpen, toneOf } from './library'
import { vibeById, vibeTokens, type Vibe } from './vibes'
import type { Mode } from './palette'

export interface StartInput {
  kind: Kind
  /** The site's name: the brand in the nav and footer. */
  name: string
  /** In one line, what it is: becomes the main headline. */
  oneLiner?: string
  vibe: string
  /** One brand color (hex); the vibe's own when left out. */
  brand?: string | null
  mode?: Mode
  /** Shuffle: a different seed gives different picks. */
  seed?: number
}

export interface StartCandidate {
  id: string
  /** "Starter: Studio portfolio", or what it's made of. */
  label: string
  from: 'starter' | 'library'
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

/** The style guide for a start: the vibe's choices and a palette from your brand color. */
export function guideFor(input: Pick<StartInput, 'vibe' | 'brand' | 'mode'>): GuideState {
  const vibe = vibeById(input.vibe)
  return { ...emptyGuide(), base: vibeTokens(vibe, { brand: input.brand, mode: input.mode }) }
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
  for (const type of Object.keys(FIELD_SCHEMA) as SectionType[]) {
    // Every field in the schema gets words: the kind's, then the shared ones, then (only if both lack it) the default.
    const words = { ...DEFAULT_CONTENT.fields[type], ...SHARED_WORDS[type], ...KIND_WORDS[input.kind][type] }
    fields[type] = Object.fromEntries(Object.entries(words).map(([k, v]) => [k, fill(v)]))
  }
  const line = input.oneLiner?.trim()
  if (line && fields.hero) fields.hero = { ...fields.hero, headline: line }
  return { brand: name, fields }
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

/** How well a clip suits the vibe: its feel tag, or (for clips without tags) whether its own colors match light or dark. */
function suits(lib: Library, clipId: string, vibe: Vibe, mode: Mode): number {
  const clip = lib.clips[clipId]
  if (!vibe.feel) return clip.origin === 'layout' ? 1 : 0 // Sketch: plain sections read best
  if (clip.feel?.length) return clip.feel.includes(vibe.feel) ? (clip.feel[0] === vibe.feel ? 3 : 2) : 0
  const tone = toneOf(clip)
  return (tone === 'dark') === (mode === 'dark') ? 1 : 0
}

/**
 * One page, filled section by section. Each spot ranks the clips for its type the
 * way Add section does (rhythm contrast with the section above), plus how well each
 * suits the vibe; `variant` and the seed pick among the best few so starts differ.
 */
function fillPage(lib: Library, types: SectionType[], vibe: Vibe, mode: Mode, variant: number, seed: number, hero?: string): string[] {
  const out: string[] = []
  for (const type of types) {
    if (type === 'hero' && hero) {
      out.push(hero)
      continue
    }
    const slots = out.map((clipId) => ({ type: lib.clips[clipId].type, clipId }))
    const ranked = suggestClip(type, slots, slots.length, lib)
      .map((s, i) => ({ id: s.clipId, score: suits(lib, s.clipId, vibe, mode) * 2 - i * 0.25 }))
      .sort((a, b) => b.score - a.score)
    if (!ranked.length) continue
    const top = ranked.slice(0, Math.min(3, ranked.length))
    out.push(top[(variant + mix(seed, type)) % top.length].id)
  }
  return out
}

/** Heroes for generated starts: the vibe's favourites, then any hero that suits it, then the rest. */
function heroesFor(lib: Library, vibe: Vibe, mode: Mode): string[] {
  const all = pickable(lib, 'hero')
  const fav = vibe.heroes.filter((id) => all.includes(id))
  const suited = all.filter((id) => !fav.includes(id) && suits(lib, id, vibe, mode) >= 2)
  return [...new Set([...fav, ...suited, ...all])]
}

const countShelves = (lib: Library, site: Site) => {
  const ids = [site.shared.nav, site.shared.footer, ...site.pages.flatMap((p) => p.slots)].filter(Boolean).map((s) => s!.clipId)
  return {
    plain: ids.filter((id) => shelfOf(lib.clips[id]) === 'plain').length,
    real: ids.filter((id) => shelfOf(lib.clips[id]) === 'real').length,
  }
}

const signature = (site: Site) => [site.shared.nav, ...site.pages.flatMap((p) => p.slots), site.shared.footer].map((s) => s?.clipId ?? '').join(',')

/** Starter mixes for a kind of site this mix can use, the ones in the chosen feel first. */
export function startersFor(lib: Library, kind: Kind, vibe: string): Starter[] {
  return lib.starters.filter((s) => s.kind === kind && starterOpen(lib, s)).sort((a, b) => Number(b.vibe === vibe) - Number(a.vibe === vibe))
}

/**
 * Three (or `n`) different starts. Up to two matching starter mixes come first; the
 * rest are put together from the library, each opening with a different hero.
 * Every start shares the same style guide and words, so they differ in layout only.
 */
export function startCandidates(input: StartInput, lib: Library, n = 3): StartCandidate[] {
  const vibe = vibeById(input.vibe)
  const mode = input.mode ?? vibe.mode
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

  const starters = startersFor(lib, input.kind, input.vibe)
  const offset = starters.length ? seed % starters.length : 0
  for (const s of [...starters.slice(offset), ...starters.slice(0, offset)].slice(0, Math.min(2, n - 1))) {
    push({ label: `Starter: ${s.name}`, from: 'starter', starterId: s.id, site: siteFromPages(lib, s.pages, `${s.id}_`), guide, content })
  }

  const recipe = RECIPES[input.kind]
  const usedHeroes = new Set(out.map((c) => c.site.pages[0].slots.find((s) => s.type === 'hero')?.clipId))
  const heroes = heroesFor(lib, vibe, mode).filter((id) => !usedHeroes.has(id))
  for (let variant = 0, tries = 0; out.length < n && tries < n * 4; variant++, tries++) {
    const hero = heroes.length ? heroes[(variant + seed) % heroes.length] : undefined
    const pages = [{ path: '/', title: 'Home', sections: fillPage(lib, recipe.home, vibe, mode, variant, seed, hero) }]
    if (recipe.about) pages.push({ path: '/about', title: 'About', sections: fillPage(lib, recipe.about, vibe, mode, variant, seed) })
    const site = siteFromPages(lib, pages, `gen${variant}_`)
    const shelves = countShelves(lib, site)
    const label = shelves.real ? `${shelves.real} real-site section${shelves.real === 1 ? '' : 's'}, ${shelves.plain} plain` : `${lib.clips[hero ?? '']?.title ?? 'A fresh mix'}`
    push({ label, from: 'library', site, guide, content })
  }
  return out
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

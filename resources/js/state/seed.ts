import type { Library, SectionType, Site, Slot, VersionNode } from '@/core/types'
import { allSlots, siteFromSlots } from '@/core/site'
import { DEFAULT_KEEP } from '@/core/types'
import { emptyGuide, promote } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { autoTitle } from '@/core/versions'
import type { MixData } from './store'
import { snapshotOf } from './snapshot'

/** The demo mix: four very different sources stacked into one page, with real conflicts to resolve. */
const SEED_PICKS: [SectionType, string][] = [
  ['nav', 'nav.monolith-bar'],
  ['hero', 'hero.marginalia-split'],
  ['features', 'features.puffin-bento'],
  ['testimonials', 'testimonials.nightowl-marquee'],
  ['pricing', 'pricing.puffin-toggle'],
  ['footer', 'footer.monolith-mega'],
]

const SEED_PROMOTIONS: [string, 'color' | 'type' | 'shape'][] = [
  ['features.puffin-bento', 'color'],
  ['hero.marginalia-split', 'color'],
  ['testimonials.nightowl-marquee', 'type'],
  ['hero.marginalia-split', 'type'],
  ['nav.monolith-bar', 'shape'],
  ['features.puffin-bento', 'shape'],
]

/** A second page, so the demo is a site: About, built from Blokmix's own layouts. */
const ABOUT_PICKS: [SectionType, string][] = [
  ['header', 'header.layout-centered'],
  ['team', 'team.layout-grid'],
  ['cta', 'cta.layout-band'],
]

export function buildSeed(lib: Library): MixData {
  const pick = (picks: [SectionType, string][], prefix: string) =>
    picks.flatMap(([type, want], i): Slot[] => {
      const clipId = lib.clips[want] ? want : lib.byType[type][0]
      return clipId ? [{ id: `${prefix}${i}`, type, clipId, locked: false, keep: { ...DEFAULT_KEEP } }] : []
    })
  const home = siteFromSlots(pick(SEED_PICKS, 'slot_seed'))
  const site: Site = {
    ...home,
    pages: [...home.pages, { id: 'page_about', path: '/about', title: 'About', slots: pick(ABOUT_PICKS, 'slot_about'), show: { nav: true, footer: true } }],
  }

  let guide = emptyGuide()
  SEED_PROMOTIONS.forEach(([clipId, group], i) => {
    const clip = lib.clips[clipId]
    if (clip) guide = promote(guide, clip, [group], 1_000 + i)
  })

  const content = structuredClone(DEFAULT_CONTENT)
  const versionA: VersionNode = {
    id: 'v_seedA',
    letter: 'A',
    parentId: null,
    title: autoTitle(allSlots(site), lib),
    status: 'ready',
    createdAt: 1,
    kind: 'snapshot',
    snapshot: snapshotOf({ site, guide, content, notes: [] }),
  }

  return {
    mixName: 'Blokmix launch page',
    site,
    guide,
    content,
    versions: { [versionA.id]: versionA },
    notes: [],
    branchFrom: null,
    head: versionA.id,
    framePos: {},
  }
}

/** A new mix: one empty Home page, no style guide yet, the default words. */
export function blankMix(name = 'Untitled mix'): MixData {
  return {
    mixName: name,
    site: siteFromSlots([]),
    guide: emptyGuide(),
    content: structuredClone(DEFAULT_CONTENT),
    versions: {},
    notes: [],
    branchFrom: null,
    head: null,
    framePos: {},
  }
}

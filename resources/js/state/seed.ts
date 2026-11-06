import { draftsFromLegacy } from '@/core/drafts'
import type { Library, SectionType, VersionNode } from '@/core/types'
import { allSlots, siteFromSlots } from '@/core/site'
import { emptyGuide } from '@/core/guide'
import { applySkin, skinById, WIREFRAME } from '@/core/skins'
import { buildStarter } from '@/core/starters'
import { DEFAULT_CONTENT } from '@/core/content'
import { contentFor } from '@/core/start'
import { autoTitle } from '@/core/versions'
import type { MixData } from './store'
import { snapshotOf } from './snapshot'

/** The demo mix: a launch page from Blokmix's own layouts, ready to remix and restyle. */
const SEED_PICKS: [SectionType, string][] = [
  ['nav', 'nav.layout-pill'],
  ['hero', 'hero.layout-product'],
  ['features', 'features.layout-bento'],
  ['testimonials', 'testimonials.layout-row'],
  ['pricing', 'pricing.layout-tiers'],
  ['footer', 'footer.layout-columns'],
]

/** A second page, so the demo is a site: About. */
const ABOUT_PICKS: [SectionType, string][] = [
  ['header', 'header.layout-centered'],
  ['team', 'team.layout-grid'],
  ['cta', 'cta.layout-band'],
]

export function buildSeed(lib: Library): MixData {
  // A sample removed from the library falls back to the first clip of its type.
  const pick = (picks: [SectionType, string][]) => picks.map(([type, want]) => (lib.clips[want] ? want : lib.byType[type][0])).filter(Boolean)
  const { site, guide } = buildStarter(lib, {
    id: 'seed',
    name: 'Blokmix launch page',
    description: 'The demo mix',
    skin: 'wireframe',
    pages: [
      { path: '/', title: 'Home', sections: pick(SEED_PICKS), slotPrefix: 'slot_seed' },
      { path: '/about', title: 'About', sections: pick(ABOUT_PICKS), id: 'page_about', slotPrefix: 'slot_about' },
    ],
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
    ...draftsFromLegacy({ versions: { [versionA.id]: versionA }, head: versionA.id, createdAt: 1 }),
    notes: [],
    branchFrom: null,
    framePos: {},
    clips: [],
  }
}

/** A new mix: one empty Home page, no style guide yet, plain starter words (never Blokmix's own demo copy). */
export function blankMix(name = 'Untitled mix'): MixData {
  const wireframe = skinById(WIREFRAME)
  return {
    mixName: name,
    site: siteFromSlots([]),
    // New and blank: raw until you dress it.
    guide: wireframe ? applySkin(emptyGuide(), wireframe) : emptyGuide(),
    content: contentFor({ kind: 'product', name: '' }),
    ...draftsFromLegacy({}),
    notes: [],
    branchFrom: null,
    framePos: {},
    clips: [],
  }
}

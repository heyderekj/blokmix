import type { Library, SectionType, Slot, VersionNode } from '@/core/types'
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

export function buildSeed(lib: Library): MixData {
  const slots: Slot[] = []
  SEED_PICKS.forEach(([type, want], i) => {
    const clipId = lib.clips[want] ? want : lib.byType[type][0]
    if (clipId) slots.push({ id: `slot_seed${i}`, type, clipId, locked: false, keep: { ...DEFAULT_KEEP } })
  })

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
    title: autoTitle(slots, lib),
    status: 'ready',
    createdAt: 1,
    kind: 'snapshot',
    snapshot: snapshotOf({ slots, guide, content, notes: [] }),
  }

  return {
    mixName: 'Blokmix launch page',
    slots,
    guide,
    content,
    versions: { [versionA.id]: versionA },
    notes: [],
    branchFrom: null,
    head: versionA.id,
    framePos: {},
  }
}

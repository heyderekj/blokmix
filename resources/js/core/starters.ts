import type { GuideState, Library, Page, SectionType, Site, Slot, TokenKey, TokenSet } from './types'
import { DEFAULT_KEEP, TOKEN_KEYS } from './types'
import { siteFromSlots } from './site'
import { choose, emptyGuide } from './guide'
import { applySkin, skinById } from './skins'

/**
 * Starter mixes: short, ready combinations of sections under a sample style guide, the replacement for
 * templates. Open one, dial the style, mark notes. Each lives in `samples/starters/<id>.json`.
 */
export interface StarterPage {
  path: string
  title: string
  /** Clip ids, top to bottom. On the first page, a nav and a footer become the site's shared ones. */
  sections: string[]
  /** Fixed ids, so the demo mix keeps its own (otherwise `page_<n>` and `slot_<n>_<i>`). */
  id?: string
  slotPrefix?: string
}

export interface Starter {
  id: string
  name: string
  description: string
  /** For the guided start (`core/start.ts`): what kind of site it is, and the skin it's dressed in when opened on its own. */
  kind?: string
  skin?: string
  /** Its sample style guide: the tokens it sets (the rest stay neutral). They land as your own values, so dials and
   * knobs move them like any other. */
  tokens?: Partial<TokenSet>
  pages: StarterPage[]
}

export interface StarterMix {
  mixName: string
  site: Site
  guide: GuideState
}

export class StarterError extends Error {}

/** Load `samples/starters/*.json` (keyed by path), each one named by its file. */
export function startersFromFiles(files: Record<string, Omit<Starter, 'id'>>): Starter[] {
  return Object.entries(files)
    // The guided start's starters say `blurb`; it's the same line.
    .map(([path, s]) => ({ ...s, description: s.description ?? (s as { blurb?: string }).blurb ?? '', id: path.split('/').pop()!.replace(/\.json$/, '') }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The clips a starter uses that the library doesn't have. */
export function missingClips(lib: Library, starter: Starter): string[] {
  return [...new Set(starter.pages.flatMap((p) => p.sections).filter((id) => !lib.clips[id]))]
}

export function buildStarter(lib: Library, starter: Starter): StarterMix {
  const missing = missingClips(lib, starter)
  if (missing.length) throw new StarterError(`Starter “${starter.name}” uses clips the library doesn’t have: ${missing.join(', ')}`)
  const badKey = Object.keys(starter.tokens ?? {}).find((k) => !TOKEN_KEYS.includes(k as TokenKey))
  if (badKey) throw new StarterError(`Starter “${starter.name}” sets an unknown token “${badKey}”`)
  if (!starter.pages.length) throw new StarterError(`Starter “${starter.name}” has no pages`)

  const slots = (p: StarterPage, n: number): Slot[] =>
    p.sections.map((clipId, i) => ({
      id: `${p.slotPrefix ?? `slot_${n}_`}${i}`,
      type: lib.clips[clipId].type,
      clipId,
      locked: false,
      keep: { ...DEFAULT_KEEP },
    }))
  const [first, ...rest] = starter.pages
  const home = siteFromSlots(slots(first, 0), { id: first.id, title: first.title })
  const pages: Page[] = rest.map((p, i) => ({ id: p.id ?? `page_${i + 1}`, path: p.path, title: p.title, slots: slots(p, i + 1), show: { nav: true, footer: true } }))
  const site: Site = { ...home, pages: [...home.pages, ...pages] }

  // Its skin, then any sample values of its own on top.
  const dressed = starter.skin && skinById(starter.skin)
  const under = dressed ? applySkin(emptyGuide(), dressed) : emptyGuide()
  const guide = (Object.entries(starter.tokens ?? {}) as [TokenKey, string][]).reduce((g, [k, value]) => choose(g, k, { kind: 'custom', value }), under)
  return { mixName: starter.name, site, guide }
}

/** What a starter holds, for pickers and agents: its section types per page. */
export function describeStarter(lib: Library, starter: Starter) {
  return {
    id: starter.id,
    name: starter.name,
    description: starter.description,
    pages: starter.pages.map((p) => ({ path: p.path, title: p.title, sections: p.sections.map((id) => lib.clips[id]?.type).filter(Boolean) as SectionType[] })),
  }
}

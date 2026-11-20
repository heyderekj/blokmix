import { briefOf, kindOf } from '@/core/brief'
import { rankDirections, type RankedDirection } from '@/core/directions'
import { pageView } from '@/core/site'
import { library } from '@/data/library'
import '@/data/directions'
import type { State } from './store'

/**
 * Other directions for the site you have: ranked by what it's for and what you've leaned toward, leaving out what you
 * already picked (the start's version, other drafts) and anything else named. The Drafts panel's row and Another take
 * both come from here.
 */
export function directionsForSite(st: Pick<State, 'site' | 'guide' | 'content'>, count: number, exclude: string[] = []): RankedDirection[] {
  const { content, guide, site } = st
  const brief = briefOf(content)
  const home = site.pages[0]
  const sections = home ? pageView(site, home.id).map((s) => s.type) : undefined
  const picked = (content.taste?.events ?? []).filter((e) => e.kind === 'picked' && e.ref).map((e) => e.ref!)
  return rankDirections({
    input: { kind: content.kind ?? kindOf(brief), brief, sections, brand: guide.brand?.color ?? null, variant: guide.brand?.variant, mode: guide.mode },
    lib: library,
    taste: content.taste,
    exclude: [...picked, ...exclude],
    count,
  })
}

/**
 * Another take: a new draft, opened, in the best direction you haven't tried yet, your pages and words carried over
 * (`tryDirection`). Null when the site holds as many drafts as it can, or nothing is left to try.
 */
export function anotherTake(st: State): { id: string; direction: RankedDirection } | null {
  const next = directionsForSite(st, 1)[0]
  if (!next) return null
  const id = st.tryDirection(next.direction)
  return id ? { id, direction: next } : null
}

import type { Library } from './types'

// Group by what a visitor sees above the fold. Several different clips share an opening silhouette.
const families: Record<string, string> = {
  'hero.layout-centered': 'centered',
  'hero.layout-form': 'centered',
  'hero.layout-logos': 'centered',
  'hero.layout-product': 'centered',
  'hero.layout-media-below': 'centered',
  'hero.layout-video-inline': 'centered',
  'hero.layout-split': 'split',
  'hero.layout-overlap': 'split',
  'hero.layout-slider': 'split',
  'hero.layout-editorial': 'editorial',
  'hero.layout-portrait': 'editorial',
  'hero.layout-collage': 'collage',
  'hero.layout-backdrop': 'backdrop',
  'hero.layout-video-backdrop': 'backdrop',
  'hero.layout-bento': 'bento',
}

export function heroFamily(id: string, lib: Library): string {
  return families[id] ?? lib.clips[id]?.rhythm ?? id
}

/** Keep the ranked list intact after offering its best example of every hero composition. */
export function diverseHeroes(ids: string[], lib: Library): string[] {
  const seen = new Set<string>()
  const first: string[] = []
  const alternatives: string[] = []
  for (const id of ids) {
    const family = heroFamily(id, lib)
    const group = seen.has(family) ? alternatives : first
    group.push(id)
    seen.add(family)
  }
  return [...first, ...alternatives]
}

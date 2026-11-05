import type { Slot, Source } from '@/core/types'
import { buildLibrary, rawClipsFromFiles } from '@/core/library'
import { sectionClip, type SectionClip } from '@/core/lists'
import { startersFromFiles, type Starter } from '@/core/starters'
// Mockups and curated looks register with core/treatments whenever the library loads.
import './treatments'
import './skins'

const sourceFiles = import.meta.glob('/samples/sources/*.json', { eager: true, import: 'default' }) as Record<string, Source>
const clipFiles = import.meta.glob('/samples/clips/**/*.{html,css,json}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const starterFiles = import.meta.glob('/samples/starters/*.json', { eager: true, import: 'default' }) as Record<string, Omit<Starter, 'id'>>

/** Starter mixes (`samples/starters/`): ready combinations of sections under a sample style guide. */
export const starters = startersFromFiles(starterFiles)

// The guided start reads them from the library (those with a kind and a skin).
export const library = buildLibrary(Object.values(sourceFiles), rawClipsFromFiles(clipFiles), starters as unknown as Parameters<typeof buildLibrary>[2])

if (import.meta.env.DEV && library.warnings.length) {
  console.groupCollapsed(`[blokmix] ${library.warnings.length} clip lint issue(s)`)
  for (const w of library.warnings) console[w.level === 'error' ? 'error' : 'warn'](`${w.clipId}: ${w.message}`)
  console.groupEnd()
}

/** The clip a section shows: the library clip with the section's lists applied (blocks, fields, ids). */
export function slotClip(slot: Pick<Slot, 'clipId' | 'lists' | 'banner'>): SectionClip {
  return sectionClip(library.clips[slot.clipId], slot.lists, { banner: slot.banner })
}

import type { Slot, Source, Starter } from '@/core/types'
import { buildLibrary, rawClipsFromFiles } from '@/core/library'
import { sectionClip, type SectionClip } from '@/core/lists'

const sourceFiles = import.meta.glob('/samples/sources/*.json', { eager: true, import: 'default' }) as Record<string, Source>
const clipFiles = import.meta.glob('/samples/clips/**/*.{html,css,json}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const starterFiles = import.meta.glob('/samples/starters/*.json', { eager: true, import: 'default' }) as Record<string, Omit<Starter, 'id'>>
const starters = Object.entries(starterFiles).map(([path, s]) => ({ ...s, id: path.split('/').pop()!.replace(/\.json$/, '') }))

export const library = buildLibrary(Object.values(sourceFiles), rawClipsFromFiles(clipFiles), starters)

if (import.meta.env.DEV && library.warnings.length) {
  console.groupCollapsed(`[blokmix] ${library.warnings.length} clip lint issue(s)`)
  for (const w of library.warnings) console[w.level === 'error' ? 'error' : 'warn'](`${w.clipId}: ${w.message}`)
  console.groupEnd()
}

/** The clip a section shows: the library clip with the section's lists applied (blocks, fields, ids). */
export function slotClip(slot: Pick<Slot, 'clipId' | 'lists' | 'banner'>): SectionClip {
  return sectionClip(library.clips[slot.clipId], slot.lists, { banner: slot.banner })
}

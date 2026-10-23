import type { Source } from '@/core/types'
import { buildLibrary, rawClipsFromFiles } from '@/core/library'

const sourceFiles = import.meta.glob('/samples/sources/*.json', { eager: true, import: 'default' }) as Record<string, Source>
const clipFiles = import.meta.glob('/samples/clips/**/*.{html,css,json}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export const library = buildLibrary(Object.values(sourceFiles), rawClipsFromFiles(clipFiles))

if (import.meta.env.DEV && library.warnings.length) {
  console.groupCollapsed(`[mixtape] ${library.warnings.length} clip lint issue(s)`)
  for (const w of library.warnings) console[w.level === 'error' ? 'error' : 'warn'](`${w.clipId}: ${w.message}`)
  console.groupEnd()
}

// Lint library clips and show how they index: blocks, list keys and fields.
//   npx vite-node scripts/lint-clips.ts hero.layout-split features   (clip ids, or a type for all its layouts)
// Exits 1 on any lint error, so it can gate a batch of new clips.

import { SECTION_TYPES, type SectionType } from '../resources/js/core/types'
import { FIELD_SCHEMA } from '../resources/js/core/content'
import { sectionClip } from '../resources/js/core/lists'
import { library } from '../resources/js/data/library'

const wanted = process.argv.slice(2)
const ids = wanted.length
  ? wanted.flatMap((w) => (SECTION_TYPES.includes(w as SectionType) ? library.layoutsByType[w as SectionType] : [w]))
  : Object.keys(library.clips)

let errors = 0
for (const id of ids) {
  const clip = library.clips[id]
  const issues = library.warnings.filter((w) => w.clipId === id || w.clipId === id.split('.')[1])
  if (!clip) {
    console.log(`\n${id}: not loaded`)
    for (const i of issues) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.message}`)
    errors += issues.filter((i) => i.level === 'error').length || 1
    continue
  }
  errors += issues.filter((i) => i.level === 'error').length
  const section = sectionClip(clip)
  const lists = section.blocks.filter((b) => b.kind === 'list').map((b) => `${b.list}→${b.listKey ?? 'unnumbered'}`)
  const missing = FIELD_SCHEMA[clip.type].filter((f) => !(f in clip.fields))
  console.log(`\n${id} (${clip.rhythm}): ${issues.length ? '' : 'lint clean'}`)
  for (const i of issues) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.message}`)
  console.log(`  blocks ${clip.blocks.length} · lists ${lists.join(', ') || 'none'}`)
  console.log(`  unused fields: ${missing.join(' ') || 'none'}`)
}
process.exit(errors ? 1 : 0)

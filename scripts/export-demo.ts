/**
 * Writes the seeded demo tape's packet to .out/packet so the Astro and Next.js
 * exports can be installed and built from the command line.
 *   npm run export:demo
 *   npm run export:demo -- --layouts   (a page of every built-in layout, to build-check them all)
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { library } from '../resources/js/data/library'
import { buildSeed } from '../resources/js/state/seed'
import { composePage } from '../resources/js/core/compose'
import { resolveGuide } from '../resources/js/core/guide'
import { packetFiles } from '../resources/js/core/export/packet'
import { DEFAULT_KEEP, SECTION_TYPES, type Slot } from '../resources/js/core/types'

const out = join(process.cwd(), '.out', 'packet')
const seed = buildSeed(library)
const version = seed.versions[seed.head!]
const allLayouts = process.argv.includes('--layouts')
const slots: Slot[] = allLayouts
  ? SECTION_TYPES.flatMap((t) => library.layoutsByType[t]).map((clipId, i) => ({
      id: `layout-${i}`,
      type: library.clips[clipId].type,
      clipId,
      locked: false,
      keep: { ...DEFAULT_KEEP },
      // A spread of block looks, so the build check covers restyled blocks too.
      edits: {
        [clipId]: Object.fromEntries(
          library.clips[clipId].blocks
            .filter((b) => b.kind === 'button' || b.kind === 'heading' || b.kind === 'card' || b.kind === 'image')
            .slice(0, 3)
            .map((b, j) => [b.id, j === 0 ? { variant: b.kind === 'button' ? 'outline' : b.kind === 'heading' ? 'marker' : 'rounded', style: { fill: 'x:Sunset' } } : { style: { radius: 'lg' as const } }]),
        ),
      },
    }))
  : version.snapshot.slots
const guideState = allLayouts
  ? { ...version.snapshot.guide, swatches: [{ id: 'sw', name: 'Sunset', value: '#ff7a00' }], components: { badge: { variant: 'dot' } } }
  : version.snapshot.guide
const snap = { ...version.snapshot, slots, guide: guideState }
const guide = resolveGuide(snap.guide)
const files = packetFiles({
  page: composePage({ slots: snap.slots, guide, content: snap.content, library, slotNotes: snap.slotNotes, title: snap.content.brand, page: snap.guide }),
  guide,
  guideState: snap.guide,
  library,
  tapeName: seed.tapeName,
  version: { id: version.id, letter: version.letter, title: version.title, status: version.status },
  targets: ['astro', 'next'],
  marks: snap.marks,
  notes: snap.generalNotes,
})

rmSync(out, { recursive: true, force: true })
for (const [path, text] of Object.entries(files)) {
  const file = join(out, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}
console.log(`Wrote ${Object.keys(files).length} files to ${out}`)
if (library.warnings.length) console.warn(`${library.warnings.length} clip lint issue(s)`)

/**
 * Writes the seeded demo tape's packet to .out/packet so the Astro and Next.js
 * exports can be installed and built from the command line.
 *   npm run export:demo
 *   npm run export:demo -- --layouts   (a page of every built-in layout, to build-check them all)
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { library } from '../resources/js/data/library'
import { buildSeed } from '../resources/js/state/seed'
import { composePage } from '../resources/js/core/compose'
import { resolveGuide } from '../resources/js/core/guide'
import { packetFiles } from '../resources/js/core/export/packet'
import { DEFAULT_KEEP, PLACEHOLDER_STYLES, SECTION_TYPES, type MediaFill, type Slot } from '../resources/js/core/types'

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
      // Every other section uses a staggered preset instead of its own motion.
      motion: i % 2 ? ({ mode: 'preset', enter: 'rise', stagger: true, onScroll: true } as const) : undefined,
      // A spread of block looks, so the build check covers restyled blocks too.
      edits: {
        [clipId]: {
          ...Object.fromEntries(
            library.clips[clipId].blocks
              .filter((b) => b.kind === 'button' || b.kind === 'heading' || b.kind === 'card')
              .slice(0, 3)
              .map((b, j) => [
                b.id,
                j === 0
                  ? { variant: b.kind === 'button' ? 'outline' : b.kind === 'heading' ? 'marker' : 'rounded', style: { fill: 'x:Sunset' }, motion: { hover: 'lift' as const } }
                  : { style: { radius: 'lg' as const }, motion: { scroll: 'reveal' as const, loop: j === 2 ? ('float' as const) : undefined } },
              ]),
          ),
          // Every image block gets a placeholder picture, cycling through the styles.
          ...Object.fromEntries(
            library.clips[clipId].blocks
              .filter((b) => b.kind === 'image')
              .map((b, j) => [b.id, { media: demoMedia(i + j) }]),
          ),
        },
      },
    }))
  : version.snapshot.slots
/** Mostly palette placeholders, with a video, a Lottie and a YouTube embed (in a lightbox) mixed in. */
function demoMedia(n: number): MediaFill {
  if (n % 7 === 3) return { source: 'video', link: { url: 'https://cdn.example.com/demo.mp4' }, play: 'inview', loop: true, alt: 'Product demo' }
  if (n % 7 === 5) return { source: 'lottie', link: { url: 'https://cdn.example.com/spark.lottie' }, play: 'scrub', alt: '' }
  if (n % 11 === 6) return { source: 'embed', link: { url: 'https://youtu.be/aqz-KE-bpKQ', provider: 'youtube', id: 'aqz-KE-bpKQ' }, play: 'click', lightbox: true, alt: 'Launch film' }
  return { source: 'placeholder', style: PLACEHOLDER_STYLES[n % PLACEHOLDER_STYLES.length], seed: n + 1, alt: '' }
}

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
for (const [path, data] of Object.entries(files)) {
  const file = join(out, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, data)
}
console.log(`Wrote ${Object.keys(files).length} files to ${out}`)
optimiseWithDinky(out)

/**
 * Squeeze exported raster images with Dinky's CLI (dinkyfiles.com) when it's
 * installed: same names and formats, so references still match.
 */
function optimiseWithDinky(root: string) {
  const bin = process.env.DINKY ?? 'dinky'
  if (spawnSync(bin, ['--help'], { stdio: 'ignore' }).error) {
    console.log('Dinky CLI not found; skipping image optimisation (set DINKY=/path/to/dinky to use it).')
    return
  }
  for (const target of ['astro', 'next']) {
    const dir = join(root, target, 'public', 'media')
    const images = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f)) : []
    if (!images.length) continue
    const tmp = join(root, `.dinky-${target}`)
    mkdirSync(tmp, { recursive: true })
    for (const f of images) {
      const fmt = f.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg')
      const res = spawnSync(bin, ['compress-image', join(dir, f), '-f', fmt, '-w', '1600', '--strip-metadata', '--json', '-o', tmp], { encoding: 'utf8' })
      try {
        const out = JSON.parse(res.stdout) as { results: { output?: string; outputBytes?: number; originalBytes?: number; error?: string }[] }
        const r = out.results[0]
        if (r?.output && !r.error && (r.outputBytes ?? Infinity) < (r.originalBytes ?? 0)) renameSync(r.output, join(dir, f))
      } catch {
        console.warn(`Dinky couldn’t optimise ${f}`)
      }
    }
    rmSync(tmp, { recursive: true, force: true })
    console.log(`Dinky optimised ${images.length} image(s) in ${target}/public/media`)
  }
}
if (library.warnings.length) console.warn(`${library.warnings.length} clip lint issue(s)`)

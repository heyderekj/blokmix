/**
 * Redraws the named icons in built-in layouts from their names, so the art in clip.html matches what the board
 * draws (compose redraws every named icon in the style guide's set; this keeps the raw clip honest too).
 *   npx vite-node scripts/redraw-clip-icons.ts [type | clip id …] [--set lucide:regular] [--check]
 * Keeps each <svg>'s own attributes (class, data-mx-*, width, height, aria) in place and swaps only the drawing and
 * the pack's viewBox/fill/stroke. An icon whose parts carry classes is a mechanism the clip animates: left alone.
 * --check lists what would change and exits 1 if anything would.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import data from '../resources/js/data/icons.json'
import { iconSet } from '../resources/js/core/icons'

const args = process.argv.slice(2)
const setAt = args.indexOf('--set')
const setId = setAt >= 0 ? args[setAt + 1] : 'lucide:regular'
const check = args.includes('--check')
const wanted = args.filter((a, i) => !a.startsWith('--') && i !== setAt + 1)
const set = iconSet(setId)
const packs = data.packs as Record<string, Record<string, Record<string, string>>>
const body = (name: string) => packs[set.pack]?.[set.weight]?.[name]
if (set.style !== 'outline' || set.pack === 'phosphor' || set.pack === 'material') throw new Error('Redraw with an outline set drawn on a 24-unit grid (lucide, tabler, heroicons, iconoir)')
const DRAWING: Record<string, string> = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': String(set.stroke ?? 2), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }

const root = join(process.cwd(), 'samples/clips')
const dirs = readdirSync(root).flatMap((type) =>
  readdirSync(join(root, type))
    .filter((d) => d.startsWith('layout-'))
    .map((d) => ({ id: `${type}.${d}`, type, path: join(root, type, d, 'clip.html') })),
)
const picked = dirs.filter((d) => existsSync(d.path) && (!wanted.length || wanted.some((w) => w === d.type || w === d.id)))

let changed = 0
for (const d of picked) {
  const html = readFileSync(d.path, 'utf8')
  const next = html.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g, (whole, open: string, inner: string) => {
    const name = /\bdata-mx-icon="([\w-]+)"/.exec(open)?.[1]
    if (!name || /<\w+[^>]*\sclass="/.test(inner)) return whole
    const drawing = body(name)
    if (!drawing) throw new Error(`${d.id}: no icon "${name}" in ${setId}`)
    const attrs = [...open.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? ''] as [string, string])
    const seen = new Set<string>()
    const out = attrs.map(([k, v]) => {
      seen.add(k)
      return [k, DRAWING[k] ?? v] as [string, string]
    })
    for (const [k, v] of Object.entries(DRAWING)) if (!seen.has(k)) out.push([k, v])
    return `<svg ${out.map(([k, v]) => `${k}="${v}"`).join(' ')}>${drawing}</svg>`
  })
  if (next !== html) {
    changed++
    console.log(`${check ? 'would redraw' : 'redrew'} ${d.id}`)
    if (!check) writeFileSync(d.path, next)
  }
}
console.log(`${changed} of ${picked.length} layouts ${check ? 'would change' : 'changed'}`)
if (check && changed) process.exit(1)

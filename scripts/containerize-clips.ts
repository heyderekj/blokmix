// Move clips onto section-sized responsiveness: width breakpoints become container queries (core/containerize.ts) and
// the fixed content widths become the style guide's width tokens.
//   npx vite-node scripts/containerize-clips.ts [type | clip id …]   (no arguments: every built-in layout)
// Rewrites clip.css in place and prints what changed; lint (scripts/lint-clips.ts) warns about anything left.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { toContainerQueries } from '../resources/js/core/containerize'

const root = join(process.cwd(), 'samples', 'clips')
const wanted = process.argv.slice(2)
const dirs = readdirSync(root).flatMap((type) =>
  readdirSync(join(root, type))
    .filter((folder) => folder.startsWith('layout-') || wanted.length)
    .map((folder) => ({ id: `${type}.${folder}`, type, dir: join(root, type, folder) })),
)
const picked = wanted.length ? dirs.filter((d) => wanted.includes(d.id) || wanted.includes(d.type)) : dirs

/** The content column and the reading column, as declarations (breakpoints of the same number stay). */
export function useWidthTokens(css: string): string {
  return css
    .replace(/(^|[;{\s])max-width:\s*1200px(?=\s*[;}])/g, '$1max-width: var(--mx-width-content)')
    .replace(/(^|[;{\s])max-width:\s*760px(?=\s*[;}])/g, '$1max-width: var(--mx-width-text)')
}

let changed = 0
for (const { id, dir } of picked) {
  const file = join(dir, 'clip.css')
  if (!existsSync(file)) continue
  const before = readFileSync(file, 'utf8')
  const after = useWidthTokens(toContainerQueries(before))
  if (after === before) continue
  writeFileSync(file, after)
  changed++
  const n = (s: string, re: RegExp) => s.match(re)?.length ?? 0
  console.log(`${id}: ${n(after, /@container\b/g) - n(before, /@container\b/g)} container queries, ${n(after, /var\(--mx-width-/g) - n(before, /var\(--mx-width-/g)} widths`)
}
console.log(`${changed} of ${picked.length} clips changed`)

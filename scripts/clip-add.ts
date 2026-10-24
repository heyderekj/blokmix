// Add a clip zip from the Blokmix Clipper extension to the repo, then lint it.
//   npm run clip:add -- ~/Downloads/hero.acme-split.zip
// Sources that already exist are kept (the clip carries its own tokens in clip.json).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import type { Source } from '../resources/js/core/types'
import { buildLibrary, rawClipsFromFiles } from '../resources/js/core/library'

const root = process.cwd()
const zips = process.argv.slice(2)
if (!zips.length) {
  console.error('Usage: npm run clip:add -- <clip.zip> [more.zip…]')
  process.exit(1)
}

const added: Record<string, string> = {}
for (const zip of zips) {
  const files = unzipSync(readFileSync(resolve(zip)))
  for (const [path, bytes] of Object.entries(files)) {
    if (!/^samples\/(clips\/[a-z]+\/[\w-]+\/(clip\.html|clip\.css|motion\.css|clip\.json)|sources\/[a-z0-9]+\.json)$/.test(path)) {
      console.warn(`  skipped ${path} (not a clip file)`)
      continue
    }
    const full = join(root, path)
    if (path.startsWith('samples/sources/') && existsSync(full)) {
      console.log(`  kept    ${path} (already there)`)
      continue
    }
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, strFromU8(bytes))
    added[path] = strFromU8(bytes)
    console.log(`  added   ${path}`)
  }
}

// Lint what was added against the whole library, as the app will.
const sources = readdirSync(join(root, 'samples/sources')).map((f) => JSON.parse(readFileSync(join(root, 'samples/sources', f), 'utf8')) as Source)
const lib = buildLibrary(sources, rawClipsFromFiles(added))
const ids = Object.keys(lib.clips)
let errors = 0
for (const id of ids) {
  const issues = lib.warnings.filter((w) => w.clipId === id)
  errors += issues.filter((i) => i.level === 'error').length
  console.log(`\n${id}: ${issues.length ? '' : 'lint clean'}`)
  for (const i of issues) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.message}`)
}
process.exit(errors ? 1 : 0)

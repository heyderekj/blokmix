// Writes each reader task's instructions and schema to resources/reader/<task>.json, which the server (and the dev
// proxy) read. Run after changing resources/js/core/reader/: npx vite-node scripts/read/build.ts
// tests/reader.test.ts checks the committed files match.

import { writeFileSync } from 'node:fs'
import { READ_TASKS } from '../../resources/js/core/reader/schema'
import { specJson } from '../../resources/js/core/reader/spec'

for (const task of READ_TASKS) {
  writeFileSync(new URL(`../../resources/reader/${task}.json`, import.meta.url), specJson(task))
  console.log(`resources/reader/${task}.json`)
}

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Jev's name shows in one place people read: the menu's credit (TopBar). Everything else says what happened.
// Agents' command descriptions (core/commands/schema) and owner-only tools may name it.
const ROOT = join(__dirname, '../resources/js')
const ALLOWED = ['ui/shell/TopBar.tsx', 'core/commands/schema/', 'pages/library/admin.tsx', 'core/jev/gaps.ts']

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|ts)$/.test(f) ? [p] : []
  })
}

/** String literals and JSX text that name Jev, outside comments. */
function namesJev(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
  const out: string[] = []
  for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g)) if (/\bJev\b/.test(m[2])) out.push(m[2])
  for (const m of code.matchAll(/>([^<>{}]*\bJev\b[^<>{}]*)</g)) out.push(m[1].trim())
  return out
}

describe('Jev’s name', () => {
  it('shows only in the menu’s credit', () => {
    const found: string[] = []
    for (const f of files(ROOT)) {
      const rel = f.slice(ROOT.length + 1)
      if (ALLOWED.some((a) => rel.startsWith(a))) continue
      for (const s of namesJev(readFileSync(f, 'utf8'))) found.push(`${rel}: ${s}`)
    }
    expect(found).toEqual([])
  })
})

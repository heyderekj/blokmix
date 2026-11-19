import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseSync } from 'vite'
import { describe, expect, it } from 'vitest'

// On screen the project is a site, it holds drafts, and "mix" is only the verb (Mix: another version, `shuffle` in
// code). Agents' command descriptions keep their words (the commands are named `list_mix_clips`, `get_mix`…), and
// `core/content.ts` holds the demo page's own sample words (page copy, not Blokmix's controls).
const ROOT = join(__dirname, '../resources/js')
const ALLOWED = ['core/commands/schema/', 'core/content.ts']

/** "mix" as a noun for the project, and the old word for a mixed theme. */
const NOUN =
  /\b(mixes|mix['’]s|(a|an|the|this|that|your|our|their|new|my|another|untitled|saved|working|demo|local|browser-only|whole|other|each|every|one|open|shared) mix)\b|\bmix (file|name|page)\b|\bmashup\b/i
/** Ids, paths, keys and URLs: not words anyone reads. */
const CODE = /^[/a-z0-9_.:#?=&{}$\-[\]*]+$/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : []
  })
}

/** Every string literal, template piece and bit of JSX text in a file. */
export function strings(path: string, src: string): string[] {
  const { program } = parseSync(path, src)
  const out: string[] = []
  const visit = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(visit)
    const node = n as { type?: string; value?: unknown }
    // Imports, module names and types never reach the screen.
    if (node.type && /^(Import|Export(All|Named)Declaration$)|^TS(Literal|TypeAlias|Interface|Enum)/.test(node.type) && node.type !== 'ExportNamedDeclaration') return
    if (node.type === 'Literal' && typeof node.value === 'string') out.push(node.value)
    else if (node.type === 'TemplateElement') out.push((node.value as { cooked?: string; raw: string }).cooked ?? (node.value as { raw: string }).raw)
    else if (node.type === 'JSXText') out.push(String(node.value))
    for (const [k, v] of Object.entries(node)) if (k !== 'type') visit(v)
  }
  visit(program)
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export function mixNouns(path: string, src: string): string[] {
  return strings(path, src).filter((s) => !CODE.test(s) && NOUN.test(s))
}

describe('the words for a site', () => {
  it('never call the project a mix on screen', () => {
    const found: string[] = []
    for (const f of files(ROOT)) {
      const rel = f.slice(ROOT.length + 1)
      if (ALLOWED.some((a) => rel.startsWith(a))) continue
      for (const s of mixNouns(f, readFileSync(f, 'utf8'))) found.push(`${rel}: ${s}`)
    }
    expect(found).toEqual([])
  })

  it('reads the noun, not the verb', () => {
    expect(mixNouns('a.ts', `const a = 'Your mixes'; const b = 'Mix unlocked sections'; const c = '/mixes'`)).toEqual(['Your mixes'])
    expect(mixNouns('a.tsx', `const x = <p>Save this mix to your account</p>`)).toEqual(['Save this mix to your account'])
    expect(mixNouns('a.ts', `// this mix\nconst y = 'Mix again'`)).toEqual([])
  })
})

import type { ComposedPage, ComposedSection } from '../compose'
import type { Collection, CollectionField, EntryValue } from '../collections'
import { contentVar, type FileMap } from './shared'

/**
 * Collections in exports. Astro gets real content collections (src/content.config.ts with a zod schema per
 * collection, one file per entry under src/content/<collection>/); Next gets the same entries as JSON under
 * content/collections/<collection>/ and a small reader. A list bound to a collection is filled from its entries at
 * build time, shaped like the section's own content file, so the section component stays as it is.
 */

/** The body field: the first rich-text field, written as the Markdown file's body in Astro. */
export const bodyField = (c: Collection) => c.schema.fields.find((f) => f.type === 'markdown')

function zodFor(f: CollectionField, required: boolean): string {
  const base =
    f.type === 'number'
      ? 'z.number()'
      : f.type === 'date'
        ? 'z.coerce.date()'
        : f.type === 'list'
          ? 'z.array(z.string())'
          : f.type === 'select' && f.options?.length
            ? `z.enum(${JSON.stringify(f.options)})`
            : f.type === 'url'
              ? 'z.string().url()'
              : 'z.string()'
  return required ? base : `${base}.nullish()`
}

const ident = (slug: string) => slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '') || 'items'

/** The values an entry file holds: its fields, plus where it sits in the collection's order and whether it's a draft. */
function entryData(c: Collection, e: Collection['entries'][number], skip?: string): Record<string, EntryValue | boolean | number> {
  const out: Record<string, EntryValue | boolean | number> = {}
  for (const f of c.schema.fields) if (f.key !== skip && e.data[f.key] != null && e.data[f.key] !== '') out[f.key] = e.data[f.key]
  out.order = e.order
  if (e.draft) out.draft = true
  return out
}

/** YAML frontmatter, written as JSON values (which YAML reads as-is). */
const frontmatter = (data: Record<string, unknown>) => `---\n${Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n`

/** Helpers both exports put in lib/: entries in order without drafts, and a value as the words a list shows. */
const TEXT_HELPER = `/** A rich-text field's nth paragraph (1 = first), as plain text: how a prose section shows an article. */
export function paragraph(md: unknown, n: number): string {
  return String(md ?? '').split(/\\n\\s*\\n/).map(text).filter(Boolean)[n - 1] ?? ''
}

/** A value as the words a section shows: dates as "Oct 14, 2026", lists joined, Markdown as plain text. */
export function text(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
    .replace(/\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')
    .replace(/^#{1,6}\\s+/gm, '')
    .replace(/[*_\`>~]/g, '')
    .replace(/\\s+/g, ' ')
    .trim()
}`

export function astroCollectionFiles(page: ComposedPage, root: string): FileMap {
  const files: FileMap = {}
  const cols = page.collections ?? []
  if (!cols.length) return files
  files[`${root}src/content.config.ts`] = `// Your collections from Blokmix: each entry is a file under src/content/<collection>/.
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

${cols
  .map((c) => {
    const body = bodyField(c)
    const fields = c.schema.fields.filter((f) => f !== body).map((f) => `    ${f.key}: ${zodFor(f, f.key === c.schema.titleField)},`)
    return `const ${ident(c.slug)} = defineCollection({
  loader: glob({ pattern: '**/*.${body ? 'md' : 'json'}', base: './src/content/${c.slug}' }),
  schema: z.object({
${fields.join('\n')}
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
})`
  })
  .join('\n\n')}

export const collections = { ${cols.map((c) => (ident(c.slug) === c.slug ? c.slug : `'${c.slug}': ${ident(c.slug)}`)).join(', ')} }
`
  for (const c of cols) {
    const body = bodyField(c)
    for (const e of c.entries) {
      if (body) files[`${root}src/content/${c.slug}/${e.slug}.md`] = frontmatter(entryData(c, e, body.key)) + `\n${String(e.data[body.key] ?? '').trim()}\n`
      else files[`${root}src/content/${c.slug}/${e.slug}.json`] = JSON.stringify(entryData(c, e), null, 2) + '\n'
    }
  }
  files[`${root}src/lib/collections.ts`] = `import { getCollection, type CollectionKey } from 'astro:content'

/** A collection's entries as a list shows them: drafts left out, in its order (or sorted by a field), capped. */
export async function entries<C extends CollectionKey>(name: C, opts: { sort?: { field: string; dir: 'asc' | 'desc' }; filter?: { field: string; equals: string }; limit?: number } = {}) {
  let list = (await getCollection(name)).filter((e) => !(e.data as { draft?: boolean }).draft)
  const value = (e: (typeof list)[number], f: string) => (e.data as Record<string, unknown>)[f]
  if (opts.filter) list = list.filter((e) => text(value(e, opts.filter!.field)).toLowerCase() === opts.filter!.equals.toLowerCase())
  list.sort((a, b) => {
    if (!opts.sort) return Number(value(a, 'order') ?? 0) - Number(value(b, 'order') ?? 0)
    const x = value(a, opts.sort.field)
    const y = value(b, opts.sort.field)
    const cmp = x instanceof Date && y instanceof Date ? x.getTime() - y.getTime() : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true })
    return opts.sort.dir === 'desc' ? -cmp : cmp
  })
  return list.slice(0, opts.limit ?? list.length)
}

${TEXT_HELPER}
`
  return files
}

export function nextCollectionFiles(page: ComposedPage, root: string): FileMap {
  const files: FileMap = {}
  const cols = page.collections ?? []
  if (!cols.length) return files
  for (const c of cols) for (const e of c.entries) files[`${root}content/collections/${c.slug}/${e.slug}.json`] = JSON.stringify({ slug: e.slug, ...entryData(c, e) }, null, 2) + '\n'
  files[`${root}lib/collections.ts`] = `import fs from 'node:fs'
import path from 'node:path'

// Your collections from Blokmix: each entry is a JSON file under content/collections/<collection>/.
${cols
  .map((c) => {
    const fields = c.schema.fields.map((f) => `  ${f.key}${f.key === c.schema.titleField ? '' : '?'}: ${f.type === 'number' ? 'number' : f.type === 'list' ? 'string[]' : 'string'}`)
    return `export interface ${pascal(c.slug)}Entry {\n  slug: string\n${fields.join('\n')}\n  order: number\n  draft?: boolean\n}`
  })
  .join('\n\n')}

export interface Collections {
${cols.map((c) => `  '${c.slug}': ${pascal(c.slug)}Entry`).join('\n')}
}

/** Every entry of a collection, read from its folder at build time. */
export function getCollection<C extends keyof Collections>(name: C): Collections[C][] {
  const dir = path.join(process.cwd(), 'content', 'collections', name)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Collections[C])
}

export function getEntry<C extends keyof Collections>(name: C, slug: string): Collections[C] | undefined {
  return getCollection(name).find((e) => e.slug === slug)
}

/** A collection's entries as a list shows them: drafts left out, in its order (or sorted by a field), capped. */
export function entries<C extends keyof Collections>(name: C, opts: { sort?: { field: string; dir: 'asc' | 'desc' }; filter?: { field: string; equals: string }; limit?: number } = {}): Collections[C][] {
  let list = getCollection(name).filter((e) => !e.draft)
  const value = (e: Collections[C], f: string) => (e as unknown as Record<string, unknown>)[f]
  if (opts.filter) list = list.filter((e) => text(value(e, opts.filter!.field)).toLowerCase() === opts.filter!.equals.toLowerCase())
  list.sort((a, b) => {
    if (!opts.sort) return a.order - b.order
    const cmp = String(value(a, opts.sort.field) ?? '').localeCompare(String(value(b, opts.sort.field) ?? ''), undefined, { numeric: true })
    return opts.sort.dir === 'desc' ? -cmp : cmp
  })
  return list.slice(0, opts.limit ?? list.length)
}

${TEXT_HELPER.replace("if (v instanceof Date)", "if (typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })\n  if (v instanceof Date)")}
`
  return files
}

const pascal = (slug: string) => ident(slug).replace(/^./, (c) => c.toUpperCase())

/**
 * A section's content prop when some of its lists show collections: its content file with those lists replaced by
 * entries (each mapped to the item's keys). `astro` reads entry.data; Next's entries are plain objects.
 */
export function boundContent(s: ComposedSection, flavor: 'astro' | 'next'): { setup: string[]; expr: string } | null {
  if (!s.bound?.length) return null
  const setup: string[] = []
  const parts = s.bound.map((b) => {
    const name = `${contentVar(s).replace(/Content$/, '')}${b.key[0].toUpperCase()}${b.key.slice(1)}`
    const opts = JSON.stringify({ ...(b.sort ? { sort: b.sort } : {}), ...(b.filter ? { filter: b.filter } : {}), ...(b.limit ? { limit: b.limit } : {}) })
    const data = flavor === 'astro' ? 'e.data' : 'e'
    const plain = Object.keys(b.map).length === 1 && Object.keys(b.map)[0] === 'text'
    const item = plain ? `text(${data}.${b.map.text})` : `({ ${Object.entries(b.map).map(([k, f]) => `${k}: text(${data}.${f})`).join(', ')} })`
    setup.push(`const ${name} = ${flavor === 'astro' ? 'await ' : ''}entries('${b.collection}'${opts === '{}' ? '' : `, ${opts}`}).${flavor === 'astro' ? 'then((list) => list.map((e) => ' + item + '))' : `map((e) => ${item})`}`)
    return `${b.key}: ${name}`
  })
  return { setup, expr: `{ ...${contentVar(s)}, ${parts.join(', ')} }` }
}

/**
 * A section's content on a collection's template page: its fields that show "the entry" read the page's entry
 * (`entry`, from getStaticPaths in Astro, from the route's slug in Next). Combined with any bound lists.
 */
export function sectionContent(s: ComposedSection, flavor: 'astro' | 'next', page?: ComposedPage): { setup: string[]; expr: string } | null {
  const lists = boundContent(s, flavor)
  if (!s.entryBound) return lists
  const tpl = page?.site?.pages.find((p) => p.sections.includes(s))?.template
  const c = tpl ? page?.collections?.find((x) => x.slug === tpl.collection) : undefined
  const body = c ? bodyField(c) : undefined
  const read = (key: string) => (flavor === 'astro' ? (key === body?.key ? 'entry.body' : `entry.data.${key}`) : `entry.${key}`)
  const fields = Object.entries(s.entryBound).map(([field, path]) => {
    const [key, nth] = path.split('#')
    return `${field}: ${nth ? `paragraph(${read(key)}, ${nth})` : `text(${read(key)})`}`
  })
  const base = lists ? lists.expr.slice(0, -2) : `{ ...${contentVar(s)}`
  return { setup: lists?.setup ?? [], expr: `${base}, ${fields.join(', ')} }` }
}

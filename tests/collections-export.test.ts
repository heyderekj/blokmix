import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { sectionClip } from '@/core/lists'
import { parseHtml } from '@/core/html/parse'
import { outline } from '@/core/outline'
import { resolveFields, DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { autoMap, entriesFromList, findList, inferSchema, addField, updateEntry, type Collection } from '@/core/collections'
import { composeSite } from '@/core/compose'
import { resolveGuide, emptyGuide } from '@/core/guide'
import { siteFromSlots } from '@/core/site'
import { astroFiles } from '@/core/export/astro'
import { nextFiles } from '@/core/export/next'

function boundBlog(): { slot: Slot; collection: Collection } {
  const clip = sectionClip(library.clips['blog.layout-cards'])
  const fields = resolveFields(clip.type, clip.fields, DEFAULT_CONTENT, false, undefined).fields
  const list = findList(outline(parseHtml(clip.html)), 'p')!
  const schema = inferSchema(clip, list, fields)
  let collection: Collection = { id: 'c', slug: 'blog-posts', name: 'Blog posts', schema, entries: entriesFromList(clip, list, fields, undefined, schema, 1) }
  collection = addField(collection, 'Body', 'markdown')
  collection = updateEntry(collection, collection.entries[0].id, { data: { body: '## Hello\n\nThe **first** post.' } })
  const { map, image } = autoMap(list, schema)
  return { collection, slot: { id: 's', type: 'blog', clipId: clip.id, locked: false, keep: { ...DEFAULT_KEEP }, bind: { lists: { p: { collection: 'blog-posts', map, image, limit: 3 } } } } }
}

const compose = () => {
  const { slot, collection } = boundBlog()
  return composeSite({ site: siteFromSlots([slot]), guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library, bind: { collections: { 'blog-posts': collection } } })
}

describe('collections in exports', () => {
  it('writes Astro content collections: a zod schema and a file per entry', () => {
    const files = astroFiles(compose())
    const config = files['astro/src/content.config.ts'] as string
    expect(config).toContain("defineCollection({")
    expect(config).toContain("base: './src/content/blog-posts'")
    expect(config).toMatch(/title: z\.string\(\),/)
    expect(config).toMatch(/excerpt: z\.string\(\)\.nullish\(\),/)
    expect(config).not.toMatch(/body:/) // the Markdown is each file's body
    expect(config).toContain("'blog-posts': blogPosts")
    const md = Object.keys(files).filter((f) => f.startsWith('astro/src/content/blog-posts/'))
    expect(md.length).toBeGreaterThan(2)
    expect(md.every((f) => f.endsWith('.md'))).toBe(true)
    const first = Object.entries(files).find(([f, v]) => f.startsWith('astro/src/content/blog-posts/') && String(v).includes('## Hello'))!
    expect(String(first[1])).toMatch(/^---\n(.+\n)*title: ".+"\n/)
    expect(String(first[1])).toContain('order: 0')
  })

  it('fills the bound list from entries in the page, keeping the component as it is', () => {
    const files = astroFiles(compose())
    const page = files['astro/src/pages/index.astro'] as string
    expect(page).toContain("import { entries, paragraph, text } from '../lib/collections'")
    expect(page).toContain("await entries('blog-posts', {\"limit\":3})")
    expect(page).toMatch(/posts: \w+Posts/)
    expect(files['astro/src/lib/collections.ts']).toContain("getCollection(name)")
  })

  it('writes Next entries as JSON with a typed reader', () => {
    const files = nextFiles(compose())
    expect(Object.keys(files).some((f) => f.startsWith('next/content/collections/blog-posts/') && f.endsWith('.json'))).toBe(true)
    const lib = files['next/lib/collections.ts'] as string
    expect(lib).toContain('export interface BlogPostsEntry')
    expect(lib).toContain('body?: string')
    const page = files['next/app/page.tsx'] as string
    expect(page).toContain("import { entries, getEntry, paragraph, text } from '@/lib/collections'")
    expect(page).toContain("entries('blog-posts', {\"limit\":3}).map((e) =>")
  })

  it('makes a page per entry from a template page, in Astro and Next', () => {
    const { slot, collection } = boundBlog()
    const header: Slot = { id: 'h', type: 'header', clipId: 'header.layout-media', locked: false, keep: { ...DEFAULT_KEEP }, bind: { entry: { fields: { heading: 'title', intro: 'body#1' } } } }
    const home = siteFromSlots([slot])
    const site = { ...home, pages: [...home.pages, { id: 'p2', path: '/blog-posts/[slug]', title: 'Post', slots: [header], show: { nav: true, footer: true }, template: { collection: 'blog-posts' } }] }
    const page = composeSite({ site, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library, bind: { collections: { 'blog-posts': collection }, entryPath: (c, s) => `/${c}/${s}` } })
    const astro = astroFiles(page)['astro/src/pages/blog-posts/[slug].astro'] as string
    expect(astro).toContain('export async function getStaticPaths()')
    expect(astro).toContain("getCollection('blog-posts')")
    expect(astro).toContain('heading: text(entry.data.title)')
    expect(astro).toContain('intro: paragraph(entry.body, 1)')
    const next = nextFiles(page)['next/app/blog-posts/[slug]/page.tsx'] as string
    expect(next).toContain('export function generateStaticParams()')
    expect(next).toContain("getEntry('blog-posts', (await params).slug)")
    expect(next).toContain('intro: paragraph(entry.body, 1)')
    // The home page's list links each item to its entry's page.
    expect(astroFiles(page)['astro/src/components/sections/BlogLayoutCards.astro'] as string).toMatch(/href="\/blog-posts\/[a-z-]+"/)
  })
})

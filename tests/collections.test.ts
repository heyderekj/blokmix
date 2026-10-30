import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { sectionClip } from '@/core/lists'
import { parseHtml } from '@/core/html/parse'
import { outline } from '@/core/outline'
import { resolveFields, DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import {
  addEntry,
  addField,
  applyBindings,
  autoMap,
  boundEntries,
  boundFields,
  entriesFromList,
  findList,
  inferSchema,
  removeField,
  renameField,
  retypeField,
  retypeImpact,
  slugify,
  uniqueSlug,
  updateEntry,
  type Collection,
} from '@/core/collections'

const slotFor = (clipId: string, extra: Partial<Slot> = {}): Slot => ({ id: 's', type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP }, ...extra })

/** Make a collection from a section's list, the way the canvas does. */
function fromList(clipId: string, listKey: string): { collection: Collection; slot: Slot } {
  const slot = slotFor(clipId)
  const clip = sectionClip(library.clips[clipId])
  const fields = resolveFields(clip.type, clip.fields, DEFAULT_CONTENT, false, undefined).fields
  const list = findList(outline(parseHtml(clip.html)), listKey)!
  const schema = inferSchema(clip, list, fields)
  const collection: Collection = { id: 'c1', slug: 'things', name: 'Things', schema, entries: entriesFromList(clip, list, fields, undefined, schema, 1000) }
  const { map, image } = autoMap(list, schema)
  return { collection, slot: { ...slot, bind: { lists: { [listKey]: { collection: 'things', map, image } } } } }
}

const drawn = (slot: Slot, collection: Collection, entryPath?: (c: string, s: string) => string | null) => {
  const s = applyBindings(slot, library.clips[slot.clipId], { collections: { [collection.slug]: collection }, entryPath })
  const clip = sectionClip(library.clips[slot.clipId], s.lists)
  return { slot: s, clip, fields: resolveFields(clip.type, clip.fields, DEFAULT_CONTENT, false, s.words).fields }
}

describe('collections', () => {
  it('names things', () => {
    expect(slugify('Clipping a section, not a screenshot!')).toBe('clipping-a-section-not-a-screenshot')
    expect(slugify('Café’s menu')).toBe('cafes-menu')
    expect(uniqueSlug('Launch', ['launch', 'launch-2'])).toBe('launch-3')
  })

  it('infers a schema from each collection-like list', () => {
    const blog = fromList('blog.layout-cards', 'p').collection
    expect(blog.schema.fields.map((f) => [f.key, f.type])).toEqual(expect.arrayContaining([['title', 'text'], ['excerpt', 'longText'], ['cover', 'image']]))
    expect(blog.schema.titleField).toBe('title')
    expect(blog.entries.length).toBeGreaterThan(2)
    expect(blog.entries[0].slug).toBe(slugify(String(blog.entries[0].data.title)))

    const team = fromList('team.layout-grid', 'm').collection
    expect(team.schema.titleField).toBe('name')
    const faq = fromList('faq.layout-accordion', 'faq').collection
    expect(faq.schema.fields.map((f) => f.key)).toEqual(['q', 'a'])
    expect(faq.schema.fields.find((f) => f.key === 'a')!.type).toBe('longText')

    const pricing = fromList('pricing.layout-tiers', 't').collection
    expect(pricing.schema.fields.find((f) => f.key === 'features')?.type).toBe('list')
    expect(Array.isArray(pricing.entries[0].data.features)).toBe(true)
  })

  it('fills a bound list from entries: count, words, nested lists', () => {
    const { collection, slot } = fromList('blog.layout-cards', 'p')
    const more = addEntry(collection, { title: 'A brand new post', excerpt: 'Fresh words.' }, 2000).collection
    const out = drawn(slot, more)
    const posts = out.clip.blocks.filter((b) => b.kind === 'item' && b.parent === out.clip.blocks.find((x) => x.kind === 'list')!.id)
    expect(posts.length).toBe(Math.min(more.entries.length, 9))
    expect(Object.values(out.fields)).toContain('A brand new post')

    const p = fromList('pricing.layout-tiers', 't')
    const edited = updateEntry(p.collection, p.collection.entries[0].id, { data: { features: ['One thing', 'Two things'] } })
    const pf = drawn(p.slot, edited)
    expect(Object.values(pf.fields)).toEqual(expect.arrayContaining(['One thing', 'Two things']))
  })

  it('sorts, filters, caps and leaves drafts out', () => {
    const { collection } = fromList('blog.layout-cards', 'p')
    const drafted = updateEntry(collection, collection.entries[0].id, { draft: true })
    expect(boundEntries(drafted, {}).some((e) => e.id === collection.entries[0].id)).toBe(false)
    expect(boundEntries(collection, { limit: 2 })).toHaveLength(2)
    const sorted = boundEntries(collection, { sort: { field: 'title', dir: 'desc' } }).map((e) => e.data.title as string)
    expect(sorted).toEqual([...sorted].sort().reverse())
    const one = boundEntries(collection, { filter: { field: 'title', equals: String(collection.entries[1].data.title) } })
    expect(one).toHaveLength(1)
  })

  it('links each item to its entry’s page, and fills pictures', () => {
    const { collection, slot } = fromList('blog.layout-cards', 'p')
    const withPic = updateEntry(collection, collection.entries[0].id, { data: { cover: { source: 'stock', alt: 'A desk', stock: { id: 'x', url: 'https://images.unsplash.com/x', thumb: '', author: 'A', authorUrl: '', link: '', downloadLocation: '' } as never } } })
    const out = drawn(slot, withPic, (_c, s) => `/blog/${s}`)
    const edits = out.slot.edits![slot.clipId]
    expect(Object.values(edits).some((e) => e.link && 'path' in e.link && e.link.path === `/blog/${collection.entries[0].slug}`)).toBe(true)
    expect(Object.values(edits).some((e) => e.media?.alt === 'A desk')).toBe(true)
  })

  it('knows which fields come from a collection', () => {
    const { slot } = fromList('blog.layout-cards', 'p')
    const f = boundFields(slot, library.clips[slot.clipId])
    expect([...f].some((x) => /^p\dTitle$/.test(x))).toBe(true)
    expect(f.has('heading')).toBe(false)
  })

  it('edits the schema and keeps the data', () => {
    const { collection } = fromList('blog.layout-cards', 'p')
    const renamed = renameField(collection, 'excerpt', 'Summary')
    expect(renamed.schema.fields.some((f) => f.key === 'summary')).toBe(true)
    expect(renamed.entries[0].data.summary).toBe(collection.entries[0].data.excerpt)
    const dated = retypeField(addField(collection, 'Published', 'text'), 'published', 'date')
    expect(dated.schema.fields.find((f) => f.key === 'published')!.type).toBe('date')
    const withDate = updateEntry(dated, dated.entries[0].id, { data: { published: 'Oct 14, 2026' } })
    expect(withDate.entries[0].data.published).toBe(new Date(Date.parse('Oct 14, 2026')).toISOString().slice(0, 10))
    expect(retypeImpact(collection, 'title', 'number')).toBeGreaterThan(0)
    expect(() => removeField(collection, 'title')).toThrow()
    expect(removeField(collection, 'excerpt').entries[0].data).not.toHaveProperty('excerpt')
    expect(() => updateEntry(collection, collection.entries[0].id, { data: { nope: 'x' } })).toThrow(/no field/)
  })
})

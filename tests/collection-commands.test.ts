import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { useCollections } from '@/state/collections'
import { runCommand } from '@/state/commands'
import { allSlots } from '@/core/site'
import { library } from '@/data/library'
import { applyBindings } from '@/core/collections'
import { sectionClip } from '@/core/lists'
import { resolveFields } from '@/core/content'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
  useCollections.setState({ bySlug: {} })
  useCollections.temporal.getState().clear()
})

const pricing = () => allSlots(useStore.getState().site).find((s) => s.type === 'pricing')!
/** The words a section shows, collections applied. */
const shown = () => {
  const s = pricing()
  const bound = applyBindings(s, library.clips[s.clipId], { collections: useCollections.getState().bySlug })
  const clip = sectionClip(library.clips[s.clipId], bound.lists)
  return resolveFields(clip.type, clip.fields, useStore.getState().content, false, bound.words).fields
}

describe('collection commands', () => {
  it('makes a collection from a list, binds it, and the section follows its entries', () => {
    const before = Object.values(shown())
    const c = runCommand('create_collection', { name: 'Plans', from: { section: 'pricing', list: 'plans' } }) as { slug: string; fields: { key: string; type: string }[]; entries: number }
    expect(c.slug).toBe('plans')
    expect(c.entries).toBeGreaterThan(1)
    expect(c.fields.map((f) => f.key)).toEqual(expect.arrayContaining(['name', 'features']))
    expect(pricing().bind?.lists?.t?.collection).toBe('plans')
    // Same words as before: the entries came from them.
    expect(Object.values(shown()).sort()).toEqual(before.sort())

    const first = (runCommand('get_collection', { collection: 'plans' }) as { entries: { id: string }[] }).entries[0]
    runCommand('update_entry', { collection: 'plans', entry: first.id, data: { name: 'Hobby' } })
    expect(Object.values(shown())).toContain('Hobby')
    // The mix itself didn't change: the words live in the collection.
    expect(Object.values(pricing().words ?? {})).not.toContain('Hobby')
  })

  it('edits the schema one change at a time', () => {
    runCommand('create_collection', { name: 'Plans', from: { section: 'pricing', list: 'plans' } })
    runCommand('update_schema', { collection: 'plans', add: { label: 'Popular', type: 'text' } })
    expect((runCommand('get_collection', { collection: 'plans' }) as { fields: { key: string }[] }).fields.map((f) => f.key)).toContain('popular')
    expect(() => runCommand('update_schema', { collection: 'plans', add: { label: 'A', type: 'text' }, remove: 'popular' })).toThrow(/one change/)
    expect(() => runCommand('update_entry', { collection: 'plans', entry: 'nope', data: {} })).toThrow(/No entry/)
  })

  it('unbinding keeps what the section showed as its own words', () => {
    runCommand('create_collection', { name: 'Plans', from: { section: 'pricing', list: 'plans' } })
    const first = (runCommand('get_collection', { collection: 'plans' }) as { entries: { id: string }[] }).entries[0]
    runCommand('update_entry', { collection: 'plans', entry: first.id, data: { name: 'Hobby' } })
    runCommand('unbind_list', { section: 'pricing', list: 'plans' })
    expect(pricing().bind).toBeUndefined()
    expect(Object.values(pricing().words ?? {})).toContain('Hobby')
  })

  it('binds an existing collection to another list and adds entries', () => {
    runCommand('create_collection', { name: 'Plans', from: { section: 'pricing', list: 'plans' } })
    runCommand('add_entry', { collection: 'plans', data: { name: 'Enterprise' } })
    expect(Object.values(shown())).toContain('Enterprise')
    runCommand('reorder_entries', { collection: 'plans', entries: ['enterprise'] })
    const list = (runCommand('get_collection', { collection: 'plans' }) as { entries: { slug: string }[] }).entries
    expect(list[0].slug).toBe('enterprise')
    expect((runCommand('list_collections', {}) as { collections: { usedIn: unknown[] }[] }).collections[0].usedIn).toHaveLength(1)
  })

  it('adds a template page whose sections show each entry, and lists link to it', () => {
    runCommand('create_collection', { name: 'Plans', from: { section: 'pricing', list: 'plans' } })
    const page = runCommand('add_collection_page', { collection: 'plans' }) as { page: string; sections: string[]; body: string }
    expect(page.page).toBe('/plans/[slug]')
    expect(page.sections).toEqual(['header', 'content', 'cta'])
    expect((runCommand('get_collection', { collection: 'plans' }) as { fields: { key: string; type: string }[] }).fields.some((f) => f.type === 'markdown')).toBe(true)
    const tpl = useStore.getState().site.pages.find((p) => p.template)!
    expect(tpl.template?.collection).toBe('plans')
    const entries = (runCommand('get_collection', { collection: 'plans' }) as { entries: { slug: string; title: string }[] }).entries
    runCommand('preview_entry', { page: '/plans/[slug]', entry: entries[1].slug })
    const header = (runCommand('get_content', { page: '/plans/[slug]', section: 'header' }) as { content: { heading: string } }[])[0]
    expect(header.content.heading).toBe(entries[1].title)
    expect(() => runCommand('add_collection_page', { collection: 'plans' })).toThrow(/already has/)
    // The pricing list's items now lead to each plan's page.
    const s = pricing()
    const bound = applyBindings(s, library.clips[s.clipId], { collections: useCollections.getState().bySlug, entryPath: (c, slug) => `/${c}/${slug}` })
    expect(JSON.stringify(bound.edits)).toContain(`/plans/${entries[0].slug}`)
  })
})

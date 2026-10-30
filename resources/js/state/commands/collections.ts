import type { Slot } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { slotClip, library } from '@/data/library'
import { parseHtml } from '@/core/html/parse'
import { outline } from '@/core/outline'
import { resolveFields } from '@/core/content'
import { allSlots } from '@/core/site'
import { applyBindings, autoMap, CollectionError, entriesFromList, entryTitle, findList as findOutline, inferSchema, sortedEntries, type Collection, type EntryValue } from '@/core/collections'
import { useCollections, entryPathFor } from '../collections'
import { useStore } from '../store'
import { CommandError, findSection, findList, putSlot } from './refs'

/** Collections run their own store (and history); errors read like every other command's. */
const run = <T,>(f: () => T): T => {
  try {
    return f()
  } catch (e) {
    if (e instanceof CollectionError) throw new CommandError(e.message)
    throw e
  }
}

function findCollection(ref: string): Collection {
  const all = Object.values(useCollections.getState().bySlug)
  const r = ref.trim().toLowerCase()
  const c = all.find((x) => x.slug === r) ?? all.find((x) => x.name.toLowerCase() === r)
  if (!c) throw new CommandError(`No collection “${ref}”. Yours: ${all.map((x) => x.slug).join(', ') || 'none yet (create_collection makes one)'}.`)
  return c
}

/** The lists in this mix that show a collection. */
function usedIn(slug: string) {
  return allSlots(useStore.getState().site).flatMap((s) =>
    Object.entries(s.bind?.lists ?? {})
      .filter(([, b]) => b.collection === slug)
      .map(([key]) => ({ section: s.id, type: s.type, list: key })),
  )
}

const describe = (c: Collection) => ({
  slug: c.slug,
  name: c.name,
  fields: c.schema.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, ...(f.required ? { required: true } : {}) })),
  titleField: c.schema.titleField,
  entries: c.entries.length,
  usedIn: usedIn(c.slug),
})

function listOf(slot: Slot, ref: string) {
  const block = findList(slot, ref)
  if (!block.listKey) throw new CommandError(`${block.label}’s items are set by the layout, so it can’t show a collection.`)
  const clip = slotClip(slot)
  const list = findOutline(outline(parseHtml(clip.html)), block.listKey)
  if (!list) throw new CommandError(`${block.label} can’t show a collection.`)
  return { block, list, clip }
}

export const read = {
  preview_entry: (i: CommandInput<'preview_entry'>) => {
    const st = useStore.getState()
    const page = st.site.pages.find((p) => p.template && (p.path === i.page || p.title.toLowerCase() === i.page.toLowerCase() || p.id === i.page))
    if (!page?.template) throw new CommandError(`No template page “${i.page}”.`)
    const c = findCollection(page.template.collection)
    const e = c.entries.find((x) => x.id === i.entry || x.slug === i.entry)
    if (!e) throw new CommandError(`No entry “${i.entry}” in ${c.name}.`)
    st.setUi({ previewEntry: { ...st.ui.previewEntry, [page.id]: e.id }, pageId: page.id })
    return { page: page.path, entry: e.slug }
  },
  list_collections: () => ({ collections: Object.values(useCollections.getState().bySlug).map(describe) }),
  get_collection: (i: CommandInput<'get_collection'>) => {
    const c = findCollection(i.collection)
    const entries = sortedEntries(c).slice(0, i.limit ?? Infinity)
    return { ...describe(c), entries: entries.map((e) => ({ id: e.id, slug: e.slug, title: entryTitle(c, e), ...(e.draft ? { draft: true } : {}), data: e.data })) }
  },
}

export const write = {
  create_collection: (i: CommandInput<'create_collection'>) =>
    run(() => {
      const st = useCollections.getState()
      if (!i.from) {
        const c = st.create(i.name, { fields: [{ key: 'title', label: 'Title', type: 'text', required: true }], titleField: 'title' })
        return describe(c)
      }
      const slot = findSection(i.from.section)
      const { block, list, clip } = listOf(slot, i.from.list)
      const fields = resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
      const schema = inferSchema(clip, list, fields)
      const c = st.create(i.name, schema, entriesFromList(clip, list, fields, slot.edits?.[slot.clipId], schema))
      const { map, image } = autoMap(list, schema)
      putSlot({ ...slot, bind: { ...slot.bind, lists: { ...slot.bind?.lists, [block.listKey!]: { collection: c.slug, map, ...(image ? { image } : {}) } } } })
      return { ...describe(c), bound: { section: slot.id, list: block.label } }
    }),
  update_schema: (i: CommandInput<'update_schema'>) =>
    run(() => {
      const c = findCollection(i.collection)
      const st = useCollections.getState()
      const changes = [i.add, i.rename, i.retype, i.remove].filter((x) => x !== undefined).length
      if (changes !== 1) throw new CommandError('Make one change per call: add, rename, retype or remove.')
      if (i.add) st.addField(c.slug, i.add.label, i.add.type)
      if (i.rename) st.renameField(c.slug, i.rename.field, i.rename.label)
      if (i.retype) st.retypeField(c.slug, i.retype.field, i.retype.type)
      if (i.remove) st.removeField(c.slug, i.remove)
      return describe(findCollection(c.slug))
    }),
  add_entry: (i: CommandInput<'add_entry'>) =>
    run(() => {
      const c = findCollection(i.collection)
      const e = useCollections.getState().addEntry(c.slug, i.data as Record<string, EntryValue>)
      return { id: e.id, slug: e.slug }
    }),
  update_entry: (i: CommandInput<'update_entry'>) =>
    run(() => {
      const c = findCollection(i.collection)
      useCollections.getState().updateEntry(c.slug, i.entry, { data: i.data as Record<string, EntryValue> | undefined, slug: i.slug, draft: i.draft })
      const e = findCollection(c.slug).entries.find((x) => x.id === i.entry || x.slug === i.entry || x.slug === i.slug)!
      return { id: e.id, slug: e.slug, data: e.data }
    }),
  remove_entry: (i: CommandInput<'remove_entry'>) =>
    run(() => {
      const c = findCollection(i.collection)
      useCollections.getState().removeEntry(c.slug, i.entry)
      return { entries: findCollection(c.slug).entries.length }
    }),
  reorder_entries: (i: CommandInput<'reorder_entries'>) =>
    run(() => {
      const c = findCollection(i.collection)
      useCollections.getState().reorderEntries(c.slug, i.entries)
      return { order: sortedEntries(findCollection(c.slug)).map((e) => e.slug) }
    }),
  bind_list: (i: CommandInput<'bind_list'>) =>
    run(() => {
      const slot = findSection(i.section)
      const c = findCollection(i.collection)
      const { block, list } = listOf(slot, i.list)
      const auto = autoMap(list, c.schema)
      const map = i.map ?? auto.map
      for (const fk of Object.values(map)) if (!c.schema.fields.some((f) => f.key === fk)) throw new CommandError(`${c.name} has no field “${fk}”.`)
      const binding = { collection: c.slug, map, image: i.image ?? auto.image, sort: i.sort, filter: i.filter, limit: i.limit }
      putSlot({ ...slot, bind: { ...slot.bind, lists: { ...slot.bind?.lists, [block.listKey!]: JSON.parse(JSON.stringify(binding)) } } })
      return { section: slot.id, list: block.label, collection: c.slug, map }
    }),
  add_collection_page: (i: CommandInput<'add_collection_page'>) =>
    run(() => {
      const st = useStore.getState()
      let c = findCollection(i.collection)
      const existing = st.site.pages.find((p) => p.template?.collection === c.slug)
      if (existing) throw new CommandError(`${c.name} already has a template page: ${existing.path}`)
      if (!c.schema.fields.some((f) => f.type === 'markdown')) {
        useCollections.getState().addField(c.slug, 'Body', 'markdown')
        c = findCollection(c.slug)
      }
      const id = st.addPage({ path: `/${c.slug}/[slug]`, title: `${c.name} entry`, template: { collection: c.slug } })
      for (const [type, clip] of [['header', 'header.layout-media'], ['content', 'content.layout-prose'], ['cta', 'cta.layout-centered']] as const)
        useStore.getState().addSlot(type, library.clips[clip] ? clip : undefined, Number.MAX_SAFE_INTEGER, id)
      const page = useStore.getState().site.pages.find((p) => p.id === id)!
      const [header, prose] = page.slots
      const f = (t: string) => c.schema.fields.find((x) => x.type === t)?.key
      const summary = f('longText')
      const meta = f('date') ?? c.schema.fields.find((x) => x.key === 'meta')?.key
      const body = f('markdown')!
      if (header)
        putSlot({
          ...header,
          bind: { entry: { fields: JSON.parse(JSON.stringify({ heading: c.schema.titleField, intro: summary, eyebrow: meta })), media: f('image') ? { cover: f('image')! } : undefined } },
        })
      if (prose) putSlot({ ...prose, bind: { entry: { fields: { heading: c.schema.titleField, body1: `${body}#1`, body2: `${body}#2`, body3: `${body}#3` } } } })
      useStore.getState().focusSlot(null)
      return { page: page.path, sections: page.slots.map((s) => s.type), body }
    }),
  bind_field: (i: CommandInput<'bind_field'>) =>
    run(() => {
      const slot = findSection(i.section)
      const page = useStore.getState().site.pages.find((p) => p.slots.some((s) => s.id === slot.id))
      if (!page?.template) throw new CommandError('Fields show an entry only on a collection’s template page (add_collection_page makes one).')
      if (!i.field === !i.media) throw new CommandError('Name a field or a media (picture), not both.')
      const entry = { fields: { ...slot.bind?.entry?.fields }, media: { ...slot.bind?.entry?.media } }
      const bag = i.field ? entry.fields : entry.media
      const key = (i.field ?? i.media)!
      if (i.entry_field === null) delete bag[key]
      else bag[key] = i.entry_field
      putSlot({ ...slot, bind: { ...slot.bind, entry } })
      return { section: slot.id, entry }
    }),
  unbind_list: (i: CommandInput<'unbind_list'>) =>
    run(() => {
      const slot = findSection(i.section)
      const block = findList(slot, i.list)
      if (!block.listKey || !slot.bind?.lists?.[block.listKey]) throw new CommandError(`${block.label} isn’t showing a collection.`)
      // Keep what it shows as the section's own words and items.
      const shown = applyBindings(slot, library.clips[slot.clipId], { collections: useCollections.getState().bySlug, entryPath: entryPathFor(useStore.getState().site) })
      const { [block.listKey]: _gone, ...rest } = slot.bind.lists
      const bind = Object.keys(rest).length || slot.bind.entry ? { ...slot.bind, lists: Object.keys(rest).length ? rest : undefined } : undefined
      putSlot({ ...slot, words: shown.words, lists: shown.lists, edits: shown.edits, bind })
      return { section: slot.id, list: block.label }
    }),
}

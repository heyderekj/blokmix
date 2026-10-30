import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import type { Page, Site, Slot } from '@/core/types'
import { listOrder, sectionClip, type ListOp } from '@/core/lists'
import { library } from '@/data/library'
import {
  addEntry,
  addField,
  applyBindings,
  CollectionError,
  emptyTargets,
  sortedEntries,
  removeEntry,
  removeField,
  renameField,
  reorderEntries,
  retypeField,
  uniqueSlug,
  updateEntry,
  type BindContext,
  type Collection,
  type CollectionSchema,
  type Entry,
  type EntryValue,
  type FieldType,
} from '@/core/collections'

/**
 * Your collections: your account's content (blog posts, team, products), apart from any one mix, so every mix you
 * bind them in shows the same entries. They keep their own undo history: undoing on a mix never rewinds your
 * content. Saved in this browser; `lib/collections.ts` syncs them to your account when Blokmix is hosted.
 */
interface CollectionsState {
  bySlug: Record<string, Collection>
  create: (name: string, schema: CollectionSchema, entries?: Entry[]) => Collection
  rename: (slug: string, name: string) => void
  remove: (slug: string) => void
  /** Put a collection in as it is (from the server, or a mix file). */
  put: (c: Collection) => void
  addField: (slug: string, label: string, type: FieldType) => void
  renameField: (slug: string, key: string, label: string) => void
  retypeField: (slug: string, key: string, type: FieldType) => void
  removeField: (slug: string, key: string) => void
  addEntry: (slug: string, data: Record<string, EntryValue>) => Entry
  updateEntry: (slug: string, id: string, patch: { data?: Record<string, EntryValue>; slug?: string; draft?: boolean }) => void
  removeEntry: (slug: string, id: string) => void
  reorderEntries: (slug: string, ids: string[]) => void
}

export const COLLECTIONS_KEY = 'blokmix:collections'

const need = (s: CollectionsState, slug: string) => {
  const c = s.bySlug[slug]
  if (!c) throw new CollectionError(`No collection “${slug}”. Yours: ${Object.keys(s.bySlug).join(', ') || 'none yet'}.`)
  return c
}

export const useCollections = create<CollectionsState>()(
  persist(
    temporal(
      (set, get) => {
        const edit = (slug: string, f: (c: Collection) => Collection) => set((s) => ({ bySlug: { ...s.bySlug, [slug]: f(need(s, slug)) } }))
        return {
          bySlug: {},
          create: (name, schema, entries = []) => {
            const slug = uniqueSlug(name, Object.keys(get().bySlug))
            const c: Collection = { id: `col_${Date.now().toString(36)}`, slug, name: name.trim() || 'Untitled', schema, entries }
            set((s) => ({ bySlug: { ...s.bySlug, [slug]: c } }))
            return c
          },
          rename: (slug, name) => edit(slug, (c) => ({ ...c, name: name.trim() || c.name })),
          remove: (slug) =>
            set((s) => {
              const { [slug]: _gone, ...rest } = s.bySlug
              return { bySlug: rest }
            }),
          put: (c) => set((s) => ({ bySlug: { ...s.bySlug, [c.slug]: c } })),
          addField: (slug, label, type) => edit(slug, (c) => addField(c, label, type)),
          renameField: (slug, key, label) => edit(slug, (c) => renameField(c, key, label)),
          retypeField: (slug, key, type) => edit(slug, (c) => retypeField(c, key, type)),
          removeField: (slug, key) => edit(slug, (c) => removeField(c, key)),
          addEntry: (slug, data) => {
            const { collection, entry } = addEntry(need(get(), slug), data)
            set((s) => ({ bySlug: { ...s.bySlug, [slug]: collection } }))
            return entry
          },
          updateEntry: (slug, id, patch) => edit(slug, (c) => updateEntry(c, id, patch)),
          removeEntry: (slug, id) => edit(slug, (c) => removeEntry(c, id)),
          reorderEntries: (slug, ids) => edit(slug, (c) => reorderEntries(c, ids)),
        }
      },
      { limit: 100, partialize: (s) => ({ bySlug: s.bySlug }) },
    ),
    { name: COLLECTIONS_KEY, version: 1, storage: createJSONStorage(() => localStorage), partialize: (s) => ({ bySlug: s.bySlug }) },
  ),
)

export const undoCollections = () => useCollections.temporal.getState().undo()
export const redoCollections = () => useCollections.temporal.getState().redo()

/** What composing a page needs to fill bound sections: your collections and where entries' pages are. */
export function bindContextFor(site: Pick<Site, 'pages'>, collections = useCollections.getState().bySlug): BindContext {
  return { collections, entryPath: entryPathFor(site) }
}

/** Where an entry's own page is: the site's template page for its collection, with the slug in its [param]. */
export function entryPathFor(site: Pick<Site, 'pages'>) {
  return (collection: string, slug: string): string | null => {
    const page = site.pages.find((p) => p.template?.collection === collection)
    return page ? page.path.replace(/\[[^\]]+\]/, slug) : null
  }
}

/**
 * A list op (add, duplicate, remove, move, swap) on a list that shows a collection acts on its entries instead: the
 * list is a view of them. Null when the list isn't bound (the section's own list changes as usual); a message when
 * the op can't apply (a sorted list's order comes from the sort).
 */
export function listOpOnEntries(slot: Slot, change: ListOp, site: Pick<Site, 'pages'>): { done: true; message?: string } | null {
  if (!slot.bind?.lists) return null
  const lib = library.clips[slot.clipId]
  if (!lib) return null
  const targets = emptyTargets()
  const shown = applyBindings(slot, lib, bindContextFor(site), targets)
  const clip = sectionClip(lib, shown.lists, { banner: slot.banner })
  const listId = 'listId' in change ? change.listId : clip.blocks.find((b) => b.id === change.itemId)?.parent
  const list = clip.blocks.find((b) => b.id === listId && b.kind === 'list')
  const t = list?.listKey ? targets.items.get(list.listKey) : undefined
  if (!list || !t) return null
  const st = useCollections.getState()
  const c = st.bySlug[t.collection]
  if (!c) return null
  const order = listOrder(clip, list.id)
  const at = (id: string) => {
    const n = clip.blocks.find((b) => b.id === id)?.n
    return n == null ? -1 : order.indexOf(n)
  }
  // Rearranging only the entries this list shows, inside the collection's own order.
  const rearrange = (next: string[]) => {
    const full = sortedEntries(c).map((e) => e.id)
    const slots = full.map((id, i) => (t.entries.includes(id) ? i : -1)).filter((i) => i >= 0)
    slots.forEach((pos, k) => (full[pos] = next[k]))
    st.reorderEntries(c.slug, full)
  }
  const i = 'itemId' in change ? at(change.itemId) : -1
  switch (change.op) {
    case 'add':
      st.addEntry(c.slug, { [c.schema.titleField]: 'New entry' })
      return { done: true, message: `Added an entry to ${c.name}` }
    case 'duplicate': {
      const src = c.entries.find((e) => e.id === t.entries[i])
      if (!src) return { done: true }
      const copy = st.addEntry(c.slug, src.data)
      const next = [...t.entries]
      next.splice(i + 1, 0, copy.id)
      rearrange(next.slice(0, t.entries.length))
      return { done: true, message: `Duplicated an entry in ${c.name}` }
    }
    case 'remove':
      if (t.entries[i]) st.removeEntry(c.slug, t.entries[i])
      return { done: true, message: `Removed an entry from ${c.name}` }
    case 'move':
    case 'swap': {
      if (t.sorted) return { done: true, message: `This list is sorted; change its order in ${c.name} or remove the sort` }
      const next = [...t.entries]
      if (change.op === 'move') {
        const [moved] = next.splice(i, 1)
        next.splice(Math.max(0, Math.min(next.length, change.to)), 0, moved)
      } else {
        const j = at(change.withId)
        if (i < 0 || j < 0) return { done: true }
        ;[next[i], next[j]] = [next[j], next[i]]
      }
      rearrange(next)
      return { done: true }
    }
    case 'reset':
      return { done: true, message: `This list shows ${c.name}; unbind it to go back to the layout’s own items` }
  }
}

/** The entry a collection's template page shows: the one you picked, else the first in order (drafts last). */
export function templateEntry(page: Pick<Page, 'id' | 'template'> | undefined, picked: Record<string, string>, bySlug = useCollections.getState().bySlug) {
  if (!page?.template) return null
  const c = bySlug[page.template.collection]
  if (!c || !c.entries.length) return null
  const list = sortedEntries(c).sort((a, b) => Number(!!a.draft) - Number(!!b.draft))
  const entry = list.find((e) => e.id === picked[page.id]) ?? list[0]
  return { collection: c.slug, entry }
}

import { Dropdown } from '@/ui/controls/Dropdown'
import { useStore as useHistory } from 'zustand'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Layers, ImagePlus, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react'
import {
  autoMap,
  entryTitle,
  FIELD_TYPE_LABEL,
  FIELD_TYPES,
  retypeImpact,
  sortedEntries,
  type Collection,
  type CollectionField,
  type Entry,
  type EntryValue,
  type FieldType,
  type MediaRef,
} from '@/core/collections'
import { outline } from '@/core/outline'
import { parseHtml } from '@/core/html/parse'
import { library, slotClip } from '@/data/library'
import { runCommand } from '@/state/commands'
import { allSlots, pageOf } from '@/core/site'
import { TYPE_LABEL } from '@/core/content'
import { redoCollections, undoCollections, useCollections } from '@/state/collections'
import { currentSlots, useStore } from '@/state/store'
import { addImage, assetUrl, useAssets } from '@/lib/assets'
import { pickFile } from '@/lib/pickFile'
import { confirmAction } from '@/ui/shell/Confirm'

const inputCls =
  'w-full rounded-lg border border-zinc-950/10 bg-white px-2.5 py-1.5 text-[12.5px] text-zinc-800 outline-none transition focus:border-zinc-950/25 focus:ring-2 focus:ring-zinc-900/10'

/**
 * Collections: your content apart from any section (blog posts, team, products), shared by every mix you use them in.
 * A list on the page can show one; its words then come from the entries here. Its own undo, separate from the mix's.
 */
export function CollectionsPanel() {
  const open = useStore((s) => s.ui.openCollection)
  const all = useCollections((s) => s.bySlug)
  const c = open ? all[open] : undefined
  return c ? <CollectionView key={c.slug} c={c} /> : <CollectionList />
}

/** Offer the page's top-level repeatable lists. A list already connected to content keeps its source. */
function usePageLists() {
  const slots = useStore(currentSlots)
  return useMemo(() => slots.flatMap((slot, index) => {
    if (!library.clips[slot.clipId]) return []
    const clip = slotClip(slot)
    return outline(parseHtml(clip.html)).flatMap((node) => {
      if (node.t !== 'list' || !node.items.length || slot.bind?.lists?.[node.listKey]) return []
      return [{
        id: `${slot.id}/${node.id}`,
        section: slot.id,
        node,
        name: node.key.charAt(0).toUpperCase() + node.key.slice(1),
        label: `${index + 1}. ${TYPE_LABEL[slot.type]} · ${node.key}`,
      }]
    })
  }), [slots])
}

function CollectionHistory() {
  const undo = useHistory(useCollections.temporal, (s) => !!s.pastStates.length)
  const redo = useHistory(useCollections.temporal, (s) => !!s.futureStates.length)
  return <div className="ml-auto flex">
    <IconBtn label="Undo collection change" disabled={!undo} onClick={undoCollections}><Undo2 size={14} /></IconBtn>
    <IconBtn label="Redo collection change" disabled={!redo} onClick={redoCollections}><Redo2 size={14} /></IconBtn>
  </div>
}

function CollectionList() {
  const all = useCollections((s) => s.bySlug)
  const site = useStore((s) => s.site)
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const sources = usePageLists()
  const from = sources.find((list) => list.id === source)
  const list = Object.values(all).sort((a, b) => a.name.localeCompare(b.name))
  const usedIn = (slug: string) => allSlots(site).filter((s) => Object.values(s.bind?.lists ?? {}).some((b) => b.collection === slug))
  const create = () => {
    if (!name.trim() || (source && !from)) return
    try {
      const c = runCommand('create_collection', { name: name.trim(), ...(from && { from: { section: from.section, list: from.node.id } }) }, 'you') as { slug: string }
      useStore.getState().setUi({ openCollection: c.slug })
    } catch (e) {
      useStore.getState().showFlash(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Your collections</h3>
        <CollectionHistory />
      </div>
      <ul className="grid gap-1.5">
        {list.map((c) => {
          const used = usedIn(c.slug)
          const template = site.pages.find((p) => p.template?.collection === c.slug)
          return (
            <li key={c.slug}>
              <button
                type="button"
                onClick={() => useStore.getState().setUi({ openCollection: c.slug })}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white p-2.5 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.07)] transition-[box-shadow,scale] duration-150 hover:shadow-[0_0_0_1px_rgb(0_0_0/0.14)] active:scale-[0.99]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-key-soft text-[13px] font-bold text-key-ink"><Layers size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-zinc-900">{c.name}</span>
                  <span className="block truncate text-[11.5px] text-zinc-500">
                    {c.entries.length} {c.entries.length === 1 ? 'entry' : 'entries'} · {used.length ? `Used in ${used.map((s) => TYPE_LABEL[s.type]).join(', ')}` : template ? 'Has entry pages' : 'Available to use'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {!list.length && <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-600">Keep services, projects, or team members in one place. Edit an entry to update the lists that use it.</p>}
      <form onSubmit={(e) => { e.preventDefault(); create() }} className="mt-3 grid gap-3 rounded-xl border border-zinc-950/10 p-3">
        <h4 className="text-[13px] font-semibold">New collection</h4>
        <div className="grid gap-1 text-xs font-medium">Start with
          <Dropdown label="Start with" value={from?.id ?? ''} onChange={(id) => {
            if (!name.trim() || name === from?.name) setName(sources.find((l) => l.id === id)?.name ?? '')
            setSource(id)
          }} options={[{ v: '', label: 'An empty collection' }, ...sources.map((l) => ({ v: l.id, label: l.label, group: 'Lists on this page' }))]} />
        </div>
        {from && <p className="text-xs text-zinc-600">Creates {from.node.items.length} entries from this list and connects it to the collection.</p>}
        <label className="grid gap-1 text-xs font-medium">Collection name
          <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Services" className={inputCls} />
        </label>
        <button type="submit" disabled={!name.trim() || (!!source && !from)} className="btn-lit flex h-8 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold disabled:opacity-40">
          <Plus size={14} /> Create collection
        </button>
      </form>
    </div>
  )
}

function CollectionView({ c }: { c: Collection }) {
  const [tab, setTab] = useState<'entries' | 'fields'>('entries')
  const st = useCollections.getState
  return (
    <div>
      <div className="flex items-center gap-1 border-b border-zinc-950/5 px-2 py-2">
        <button type="button" aria-label="All collections" onClick={() => useStore.getState().setUi({ openCollection: null })} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900">
          <ArrowLeft size={15} />
        </button>
        <input
          key={c.slug + c.name}
          defaultValue={c.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && st().rename(c.slug, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Collection name"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[14px] font-semibold text-zinc-900 outline-none hover:bg-zinc-950/[0.04] focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
        />
        <CollectionHistory />
      </div>
      <div className="flex gap-0.5 px-3 pt-2.5">
        {(['entries', 'fields'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`h-7 cursor-pointer rounded-full px-3 text-[12px] font-semibold transition ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
          >
            {t === 'entries' ? `Entries · ${c.entries.length}` : `Fields · ${c.schema.fields.length}`}
          </button>
        ))}
      </div>
      {tab === 'entries' ? <><Entries c={c} /><PageConnection c={c} /></> : <Fields c={c} />}
    </div>
  )
}

function PageConnection({ c }: { c: Collection }) {
  const site = useStore((s) => s.site)
  const page = pageOf(site, useStore((s) => s.ui.pageId))
  const slots = useStore(currentSlots)
  const targets = usePageLists().filter((t) => Object.keys(autoMap(t.node, c.schema).map).length)
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState('')
  const target = targets.find((t) => t.id === selected)
  const connected = slots.flatMap((s) => Object.entries(s.bind?.lists ?? {}).filter(([, binding]) => binding.collection === c.slug).map(([key]) =>
    `${TYPE_LABEL[s.type]} · ${slotClip(s).blocks.find((b) => b.listKey === key)?.list ?? key}`))
  const connect = () => {
    if (!target) return
    try {
      runCommand('bind_list', { collection: c.slug, section: target.section, list: target.node.id }, 'you')
      setChoosing(false)
      setSelected('')
      useStore.getState().showFlash(`Connected ${c.name} to ${target.label}`, { undo: true })
    } catch (e) {
      useStore.getState().showFlash(e instanceof Error ? e.message : String(e))
    }
  }
  return <section className="mx-3 mb-3 grid gap-2 rounded-xl border border-zinc-950/10 bg-zinc-50 p-3">
    <h4 className="text-xs font-semibold [overflow-wrap:anywhere]">On {page.title}</h4>
    {connected.length > 0 && <p className="text-xs text-zinc-600">{connected.join(', ')}</p>}
    {targets.length > 0 ? choosing ? <>
      <Dropdown label="Page list" value={target?.id ?? ''} onChange={setSelected} options={[{ v: '', label: 'Choose a list' }, ...targets.map((t) => ({ v: t.id, label: t.label }))]} />
      <p className="text-xs text-zinc-600">This list will show the collection’s entries in place of its current items.</p>
      <div className="flex items-center gap-3">
        <button type="button" disabled={!target} onClick={connect} className="btn-lit rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Connect list</button>
        <button type="button" onClick={() => setChoosing(false)} className="text-xs font-medium">Cancel</button>
      </div>
    </> : <button type="button" onClick={() => setChoosing(true)} className="flex items-center gap-1 text-left text-xs font-semibold"><Plus size={13} /> Connect a page list</button>
    : !connected.length && <p className="text-xs text-zinc-600">Add a section with a repeatable list to show entries here.</p>}
  </section>
}

// ---------- entries ----------

function Entries({ c }: { c: Collection }) {
  const [open, setOpen] = useState<string | null>(null)
  const st = useCollections.getState
  const [title, setTitle] = useState('')
  const list = sortedEntries(c)
  const image = c.schema.fields.find((f) => f.type === 'image')
  useAssets((s) => s.assets) // redraw when uploads load
  const move = (i: number, d: -1 | 1) => {
    const ids = list.map((e) => e.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    st().reorderEntries(c.slug, ids)
  }
  return (
    <div className="px-3 py-2.5">
      <ul className="grid gap-1">
        {list.map((e, i) => (
          <li key={e.id} className="overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.07)]">
            <div className="group flex items-center gap-2 p-1.5 pr-1">
              <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg p-1 text-left hover:bg-zinc-950/[0.03]">
                {image && <Thumb v={e.data[image.key]} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-zinc-900">{entryTitle(c, e)}</span>
                  <span className="block truncate font-mono text-[10.5px] text-zinc-400">/{e.slug}</span>
                </span>
                {e.draft && <span className="rounded-full bg-zinc-950/6 px-1.5 py-px text-[10.5px] font-semibold text-zinc-500">Draft</span>}
              </button>
              <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={13} />
                </IconBtn>
                <IconBtn label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={13} />
                </IconBtn>
              </div>
            </div>
            {open === e.id && <EntryForm c={c} e={e} onClose={() => setOpen(null)} />}
          </li>
        ))}
      </ul>
      <form onSubmit={(ev) => {
        ev.preventDefault()
        if (!title.trim()) return
        setOpen(st().addEntry(c.slug, { [c.schema.titleField]: title.trim() }).id)
        setTitle('')
      }} className="mt-2 flex gap-1.5">
        <input aria-label="New entry title" placeholder="New entry title" value={title} onChange={(ev) => setTitle(ev.target.value)} className={inputCls + ' min-w-0 flex-1'} />
        <button type="submit" disabled={!title.trim()} className="btn-quiet flex shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-40"><Plus size={13} /> Add entry</button>
      </form>
    </div>
  )
}

function Thumb({ v }: { v: EntryValue | undefined }) {
  const m = v && typeof v === 'object' && !Array.isArray(v) ? (v as MediaRef) : null
  const src = m?.source === 'upload' && m.asset ? assetUrl(m.asset) : m?.source === 'stock' ? m.stock?.thumb || m.stock?.url : undefined
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-950/[0.05]">
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <ImagePlus size={13} className="text-zinc-300" />}
    </span>
  )
}

function EntryForm({ c, e, onClose }: { c: Collection; e: Entry; onClose: () => void }) {
  const st = useCollections.getState
  const set = (key: string, v: EntryValue) => st().updateEntry(c.slug, e.id, { data: { [key]: v } })
  return (
    <div className="grid gap-2.5 border-t border-zinc-950/5 bg-zinc-950/[0.015] p-3">
      {c.schema.fields.map((f) => (
        <label key={f.key} className="grid gap-1">
          <span className="flex items-baseline justify-between text-[11px] font-medium text-zinc-500">
            {f.label}
            <span className="text-[10px] text-zinc-400">{FIELD_TYPE_LABEL[f.type]}</span>
          </span>
          <FieldInput f={f} v={e.data[f.key] ?? null} onChange={(v) => set(f.key, v)} />
        </label>
      ))}
      <label className="grid gap-1">
        <span className="text-[11px] font-medium text-zinc-500">Entry slug</span>
        <input
          key={e.slug}
          defaultValue={e.slug}
          onBlur={(ev) => ev.target.value !== e.slug && st().updateEntry(c.slug, e.id, { slug: ev.target.value })}
          className={`${inputCls} font-mono`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-zinc-600">
          <input type="checkbox" checked={!!e.draft} onChange={(ev) => st().updateEntry(c.slug, e.id, { draft: ev.target.checked })} /> Draft · hide from pages and exports
        </label>
        <button
          type="button"
          onClick={async () => {
            if (await confirmAction({ title: `Delete “${entryTitle(c, e)}”?`, body: 'It leaves every list that shows this collection.', confirm: 'Delete' })) st().removeEntry(c.slug, e.id)
          }}
          className="ml-auto flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-problem-ink hover:bg-problem-soft"
        >
          <Trash2 size={13} /> Delete
        </button>
        <button type="button" onClick={onClose} className="h-7 cursor-pointer rounded-full px-2.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-950/5">
          Done
        </button>
      </div>
    </div>
  )
}

/** One control per field type; values save as you leave the field (or right away for choices and pictures). */
function FieldInput({ f, v, onChange }: { f: CollectionField; v: EntryValue; onChange: (v: EntryValue) => void }) {
  const text = v == null ? '' : Array.isArray(v) ? v.join('\n') : typeof v === 'object' ? '' : String(v)
  const blur = (val: string) => val !== text && onChange(val)
  switch (f.type) {
    case 'longText':
    case 'markdown':
      return (
        <textarea
          key={text}
          defaultValue={text}
          rows={f.type === 'markdown' ? 7 : 3}
          onBlur={(e) => blur(e.target.value)}
          placeholder={f.type === 'markdown' ? 'Markdown: **bold**, ## headings, - lists, [links](https://…)' : undefined}
          className={`${inputCls} resize-y ${f.type === 'markdown' ? 'font-mono text-[12px]' : ''}`}
        />
      )
    case 'list':
      return <textarea key={text} defaultValue={text} rows={3} onBlur={(e) => e.target.value !== text && onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} placeholder="One per line" className={`${inputCls} resize-y`} />
    case 'date':
      return <input type="date" value={text.slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} className={inputCls} />
    case 'number':
      return <input type="number" key={text} defaultValue={text} onBlur={(e) => blur(e.target.value)} className={inputCls} />
    case 'select':
      return (
        <Dropdown label={f.label} value={text} onChange={(next) => onChange(next || null)} className="w-full"
          options={[{ v: '', label: '—' }, ...[...new Set([...(f.options ?? []), text])].filter(Boolean).map((v) => ({ v, label: v }))]} />
      )
    case 'image':
      return <ImageField v={v} onChange={onChange} />
    default:
      return <input key={text} defaultValue={text} onBlur={(e) => blur(e.target.value)} type={f.type === 'url' ? 'url' : 'text'} className={inputCls} />
  }
}

function ImageField({ v, onChange }: { v: EntryValue; onChange: (v: EntryValue) => void }) {
  const m = v && typeof v === 'object' && !Array.isArray(v) ? (v as MediaRef) : null
  return (
    <div className="flex items-center gap-2">
      <Thumb v={v} />
      <button
        type="button"
        onClick={() =>
          pickFile('image/*', async (file) => {
            const a = await addImage(file, file.name)
            onChange({ source: 'upload', asset: a.id, alt: m?.alt ?? '' })
          })
        }
        className="btn-quiet h-7 cursor-pointer rounded-full px-2.5 text-[12px] font-semibold"
      >
        {m ? 'Replace' : 'Upload'}
      </button>
      {m && (
        <>
          <input key={m.alt} defaultValue={m.alt} placeholder="Alt text" onBlur={(e) => onChange({ ...m, alt: e.target.value })} className={`${inputCls} h-7 py-0`} />
          <IconBtn label="Remove picture" onClick={() => onChange(null)}>
            <X size={13} />
          </IconBtn>
        </>
      )}
    </div>
  )
}

// ---------- fields ----------

function Fields({ c }: { c: Collection }) {
  const st = useCollections.getState
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const retype = async (f: CollectionField, to: FieldType) => {
    const n = retypeImpact(c, f.key, to)
    if (n && !(await confirmAction({ title: `Make ${f.label} a ${FIELD_TYPE_LABEL[to].toLowerCase()}?`, body: `${n} ${n === 1 ? 'entry' : 'entries'} will convert; values that can’t convert are cleared.`, confirm: 'Convert' }))) return
    st().retypeField(c.slug, f.key, to)
  }
  const used = useMemo(() => new Set(c.entries.flatMap((e) => Object.keys(e.data).filter((k) => e.data[k] != null && e.data[k] !== ''))), [c.entries])
  return (
    <div className="px-3 py-2.5">
      <ul className="grid gap-1">
        {c.schema.fields.map((f) => (
          <li key={f.key} className="rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.07)]">
            <div className="flex items-center gap-1.5">
              <input
                key={f.label}
                defaultValue={f.label}
                aria-label="Field name"
                onBlur={(e) => e.target.value.trim() && e.target.value !== f.label && st().updateFieldDetails(c.slug, f.key, { label: e.target.value.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[12.5px] font-medium text-zinc-900 outline-none hover:bg-zinc-950/[0.04] focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
              />
              {f.key === c.schema.titleField && <span className="rounded-full bg-key-soft px-1.5 py-px text-[10px] font-semibold text-key-ink">Title</span>}
              <Dropdown label="Field type" value={f.type} onChange={(next) => retype(f, next)}
                options={FIELD_TYPES.filter((v) => v !== 'reference').map((v) => ({ v, label: FIELD_TYPE_LABEL[v] }))} />
              <IconBtn
                label={f.key === c.schema.titleField ? 'The title field can’t be removed' : 'Remove field'}
                disabled={f.key === c.schema.titleField}
                onClick={async () => {
                  if (!used.has(f.key) || (await confirmAction({ title: `Remove ${f.label}?`, body: 'Its values leave every entry.', confirm: 'Remove' }))) st().removeField(c.slug, f.key)
                }}
              >
                <Trash2 size={13} />
              </IconBtn>
            </div>
            {f.type === 'select' && <label className="mt-2 grid gap-1 px-1 pb-1 text-xs text-zinc-600">
              Choices (one per line)
              <textarea key={JSON.stringify(f.options)} defaultValue={f.options?.join('\n')} rows={3} className={inputCls} onBlur={(ev) => {
                const options = [...new Set(ev.target.value.split('\n').map((v) => v.trim()).filter(Boolean))]
                if (JSON.stringify(options) !== JSON.stringify(f.options ?? [])) st().updateFieldDetails(c.slug, f.key, { options })
              }} />
            </label>}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && label.trim()) {
              st().addField(c.slug, label, type)
              setLabel('')
            }
          }}
          placeholder="New field"
          className={inputCls}
        />
        <Dropdown label="New field type" value={type} onChange={setType}
          options={FIELD_TYPES.filter((v) => v !== 'reference').map((v) => ({ v, label: FIELD_TYPE_LABEL[v] }))} />
        <button
          type="button"
          disabled={!label.trim()}
          onClick={() => {
            st().addField(c.slug, label, type)
            setLabel('')
          }}
          className="btn-quiet flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-semibold disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      <button
        type="button"
        onClick={async () => {
          if (await confirmAction({ title: `Delete ${c.name}?`, body: 'Lists that show it go back to their own words. This can be undone with the collections’ Undo.', confirm: 'Delete collection' })) {
            useStore.getState().setUi({ openCollection: null })
            st().remove(c.slug)
          }
        }}
        className="mt-4 flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-problem-ink hover:bg-problem-soft"
      >
        <Trash2 size={13} /> Delete collection
      </button>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

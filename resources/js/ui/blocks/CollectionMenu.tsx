import { useState } from 'react'
import { Database, ExternalLink, Unlink } from 'lucide-react'
import type { BlockInfo, Slot } from '@/core/types'
import { useCollections } from '@/state/collections'
import { useStore } from '@/state/store'
import { runCommand, CommandError } from '@/state/commands'

/** Open a collection in the Content panel. */
export function openCollection(slug: string) {
  useStore.getState().setUi({ sheet: 'none', leftPanel: 'words', contentView: 'collections', openCollection: slug })
}

/**
 * A list and your collections: make one from these items (it learns their fields and keeps their words as entries),
 * show one you have, or, when the list already shows one, open it or let go of it (keeping the words it shows).
 */
export function CollectionMenu({ slot, list, onClose }: { slot: Slot; list: BlockInfo; onClose: () => void }) {
  const all = useCollections((s) => s.bySlug)
  const bound = list.listKey ? slot.bind?.lists?.[list.listKey] : undefined
  const c = bound ? all[bound.collection] : undefined
  const [name, setName] = useState(() => (list.list ? list.list[0].toUpperCase() + list.list.slice(1) : 'Items'))
  const run = (cmd: string, input: Record<string, unknown>) => {
    try {
      runCommand(cmd, input, 'you')
      onClose()
    } catch (e) {
      useStore.getState().showFlash(e instanceof CommandError ? e.message : String(e))
    }
  }

  if (bound)
    return (
      <div className="glass-menu w-[300px] animate-pop rounded-2xl p-1.5">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="grid size-8 place-items-center rounded-lg bg-key-soft text-key-ink">
            <Database size={14} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-zinc-900">{c?.name ?? bound.collection}</span>
            <span className="block text-[11.5px] text-zinc-500">
              {c ? `${c.entries.length} entries` : 'Not in your collections'}
              {bound.sort ? ` · by ${bound.sort.field}` : ''}
              {bound.limit ? ` · first ${bound.limit}` : ''}
            </span>
          </span>
        </div>
        <p className="px-2 pb-2 text-[11.5px] leading-snug text-zinc-500">These items show its entries. Type on the page to change an entry; add, remove and reorder here change the collection.</p>
        {c && (
          <MenuRow icon={ExternalLink} onClick={() => (openCollection(c.slug), onClose())}>
            Open {c.name}
          </MenuRow>
        )}
        <MenuRow icon={Unlink} onClick={() => run('unbind_list', { section: slot.id, list: list.id })}>
          Stop showing it (keep these words)
        </MenuRow>
      </div>
    )

  const others = Object.values(all)
  return (
    <div className="glass-menu w-[300px] animate-pop rounded-2xl p-2">
      <div className="px-1 pb-1.5 text-[12px] font-semibold text-zinc-900">Make a collection from these items</div>
      <p className="px-1 pb-2 text-[11.5px] leading-snug text-zinc-500">Their fields become its fields and their words its entries, shared by all your mixes.</p>
      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && run('create_collection', { name, from: { section: slot.id, list: list.id } })}
          className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-950/10 bg-white px-2.5 text-[12.5px] outline-none focus:ring-2 focus:ring-zinc-900/10"
          aria-label="Collection name"
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => run('create_collection', { name, from: { section: slot.id, list: list.id } })}
          className="btn-lit h-8 shrink-0 cursor-pointer rounded-lg px-3 text-[12.5px] font-semibold disabled:opacity-40"
        >
          Make it
        </button>
      </div>
      {others.length > 0 && (
        <>
          <div className="px-1 pb-1 pt-3 text-[11px] font-semibold text-zinc-400">Or show one you have</div>
          {others.map((o) => (
            <MenuRow key={o.slug} icon={Database} onClick={() => run('bind_list', { section: slot.id, list: list.id, collection: o.slug })}>
              {o.name} <span className="text-zinc-400">· {o.entries.length}</span>
            </MenuRow>
          ))}
        </>
      )}
    </div>
  )
}

function MenuRow({ icon: Icon, onClick, children }: { icon: typeof Database; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-zinc-800 transition hover:bg-zinc-950/5 active:scale-[0.99]">
      <Icon size={14} className="shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

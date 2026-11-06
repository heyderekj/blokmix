import { useState } from 'react'
import { ChevronDown, Copy, Eye, EyeOff, Package, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { draftList, versionsOf, type Draft } from '@/core/drafts'
import { allSlots } from '@/core/site'
import { TYPE_LABEL } from '@/core/content'
import type { VersionNode } from '@/core/types'
import { useStore } from '@/state/store'
import { canAddDraft } from '@/state/slices/drafts'
import { StatusRing } from '../frames/FrameHeader'
import { toggleSheet } from '../shell/TopBar'
import { newDraft, openDraft } from './open'

const PRESS = 'cursor-pointer transition-[background-color,color,scale] duration-150 active:scale-[0.97]'
const ROW_BUTTON = `flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`

/** The open draft's name in the top bar, between the mix's name and the page: opens Drafts. */
export function DraftSwitch() {
  const draft = useStore((s) => s.drafts[s.draftId])
  const count = useStore((s) => Object.keys(s.drafts).length)
  const open = useStore((s) => s.ui.sheet === 'drafts')
  if (!draft) return null
  return (
    <button
      type="button"
      onClick={() => toggleSheet('drafts')}
      aria-expanded={open}
      title={count > 1 ? `${count} drafts: open another, or see this one’s saved versions` : 'Drafts: try another direction, and this one’s saved versions'}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[14px] font-medium text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`}
    >
      <span className="grid size-5 place-items-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white">{draft.letter}</span>
      <span className="max-w-[140px] truncate max-lg:hidden">{draft.name}</span>
      {count > 1 && <span className="text-[12px] text-zinc-400 max-lg:hidden">of {count}</span>}
      <ChevronDown size={13} className={`text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

/**
 * Drafts, side by side: open one to work on it (the one you leave keeps its own copy), make a new one to try another
 * direction, rename or delete one. Under the open draft, its history: the versions you saved, to go back to.
 */
export function DraftsPanel() {
  const drafts = useStore((s) => s.drafts)
  const draftId = useStore((s) => s.draftId)
  const versions = useStore((s) => s.versions)
  const room = useStore(canAddDraft)
  const list = draftList(drafts)
  return (
    <div className="p-1.5">
      <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-zinc-400">
        <span>Drafts</span>
        <span className="font-medium">Each one is its own try</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {list.map((d) => (
          <DraftRow key={d.id} draft={d} open={d.id === draftId} only={list.length === 1} history={d.id === draftId ? versionsOf(versions, d.id) : []} />
        ))}
      </ul>
      <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
      <button
        type="button"
        disabled={!room}
        onClick={() => (newDraft(), useStore.getState().setUi({ sheet: 'none' }))}
        className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900 disabled:opacity-40 ${PRESS}`}
      >
        <Plus size={16} className="text-zinc-500" /> New draft from this one
        {!room && <span className="ml-auto text-[11.5px] font-normal text-zinc-400">No room for another</span>}
      </button>
      <p className="px-2.5 pb-1.5 pt-0.5 text-[11.5px] leading-snug text-zinc-500">Save a version (⌘S) to keep a moment of the open draft you can go back to.</p>
    </div>
  )
}

function DraftRow({ draft: d, open, only, history }: { draft: Draft; open: boolean; only: boolean; history: VersionNode[] }) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(d.name)
  const st = useStore.getState
  const room = useStore(canAddDraft)
  const saved = history.filter((v) => v.kind === 'snapshot')
  return (
    <li className={`rounded-lg ${open ? 'bg-zinc-950/[0.05]' : 'hover:bg-zinc-950/[0.03]'}`}>
      <div className="flex items-center gap-1.5 pr-1">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              st().updateDraft(d.id, { name })
              setRenaming(false)
            }}
          >
            <StatusRing letter={d.letter} status={d.status ?? 'in-progress'} small />
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => (st().updateDraft(d.id, { name }), setRenaming(false))} maxLength={60} className="h-8 min-w-0 flex-1 rounded-md bg-white px-2 text-[13.5px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] outline-none" />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => (open ? null : (openDraft(d.id), st().setUi({ sheet: 'none' })))}
            onDoubleClick={() => setRenaming(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left active:scale-[0.99]"
          >
            <StatusRing letter={d.letter} status={d.status ?? 'in-progress'} small />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[13.5px] ${open ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>{d.name}</span>
              <span className="block truncate text-[11.5px] text-zinc-500">{open ? `You’re working here${saved.length ? ` · ${saved.length} saved` : ''}` : summary(d)}</span>
            </span>
            {!open && <span className="text-[12px] font-semibold text-zinc-500">Open</span>}
          </button>
        )}
        <button type="button" title="More" aria-label={`More for ${d.name}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={`grid size-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-800 ${PRESS}`}>
          <ChevronDown size={15} className={`transition-transform duration-200 ${menu ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {menu && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <button type="button" className={ROW_BUTTON} onClick={() => (setMenu(false), setRenaming(true))}>
            <Pencil size={12} /> Rename
          </button>
          {room && (
            <button type="button" className={ROW_BUTTON} onClick={() => (setMenu(false), newDraft({ draft: d.id }), st().setUi({ sheet: 'none' }))}>
              <Copy size={12} /> New draft from this
            </button>
          )}
          {!only && (
            <button
              type="button"
              className={`${ROW_BUTTON} text-red-600 hover:text-red-700`}
              onClick={() => {
                setMenu(false)
                st().deleteDraft(d.id)
                st().showFlash(`Deleted ${d.name}`, { undo: true })
              }}
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
      {open && history.length > 0 && <History versions={history} />}
    </li>
  )
}

/** The open draft's saved versions, newest first: go back to one, branch a draft from it, export it or show it on the canvas. */
function History({ versions }: { versions: VersionNode[] }) {
  const st = useStore.getState
  const pinned = useStore((s) => s.ui.pinnedVersions)
  const head = useStore((s) => s.head)
  const room = useStore(canAddDraft)
  const [all, setAll] = useState(false)
  const shown = all ? versions : versions.slice(0, 4)
  return (
    <div className="mx-2 mb-2 mt-0.5 border-l-2 border-zinc-950/10 pl-2.5">
      <div className="pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-400">Saved</div>
      <ul className="flex flex-col gap-1">
        {shown.map((v) => {
          const on = pinned.includes(v.id)
          return (
            <li key={v.id} className="rounded-md px-1 py-1 hover:bg-white/60">
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 font-mono text-[11.5px] font-semibold text-zinc-700">{v.letter}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-600">
                  {v.kind === 'build' ? `${v.build?.target === 'next' ? 'Next.js' : 'Astro'} build` : `${when(v.createdAt)} · ${sectionsOf(v)}`}
                  {v.id === head && <span className="text-zinc-400"> · here</span>}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-0.5 pl-9">
                {v.kind === 'snapshot' && v.id !== head && (
                  <button type="button" className={ROW_BUTTON} title="The open draft goes back to this. Unsaved changes are saved first; ⌘Z undoes it." onClick={() => (st().restoreVersion(v.id), st().showFlash(`Back to ${v.letter}`, { undo: true }))}>
                    <RotateCcw size={12} /> Go back to this
                  </button>
                )}
                {v.kind === 'snapshot' && room && (
                  <button type="button" className={ROW_BUTTON} onClick={() => (newDraft({ version: v.id }), st().setUi({ sheet: 'none' }))}>
                    <Copy size={12} /> New draft
                  </button>
                )}
                <button type="button" className={ROW_BUTTON} onClick={() => st().setUi({ packetSource: v.id, sheet: 'packet' })}>
                  <Package size={12} /> Export
                </button>
                {v.kind === 'snapshot' && (
                  <button type="button" className={ROW_BUTTON} onClick={() => st().setUi({ pinnedVersions: on ? pinned.filter((x) => x !== v.id) : [...pinned, v.id] })}>
                    {on ? <EyeOff size={12} /> : <Eye size={12} />} {on ? 'Hide from canvas' : 'Show on canvas'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {versions.length > 4 && (
        <button type="button" onClick={() => setAll((x) => !x)} className={`${ROW_BUTTON} mt-1`}>
          {all ? 'Fewer' : `All ${versions.length}`}
        </button>
      )}
    </div>
  )
}

const summary = (d: Draft) => {
  const n = d.body ? allSlots(d.body.site).length : 0
  const pages = d.body?.site.pages.length ?? 1
  return `${pages > 1 ? `${pages} pages · ` : ''}${n} sections`
}
const sectionsOf = (v: VersionNode) =>
  v.snapshot.site.pages[0]?.slots
    .map((s) => TYPE_LABEL[s.type])
    .filter((x) => x !== 'Nav' && x !== 'Footer')
    .slice(0, 3)
    .join(', ') || 'Empty'
function when(t: number): string {
  const d = new Date(t)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

import './draft-panel.css'
import { Comparison, IterationActions, ReviewItem, useReturns } from './IterationReview'
import { useSave } from '@/lib/mixSync'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  Layers,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { draftList, newestVersionFirst, versionsOf, type Draft } from '@/core/drafts'
import { allSlots } from '@/core/site'
import { TYPE_LABEL } from '@/core/content'
import type { VersionNode } from '@/core/types'
import { useStore } from '@/state/store'
import { canAddDraft } from '@/state/slices/drafts'
import { StatusRing } from '../frames/FrameHeader'
import { SendToAgent } from '../shell/SendToAgent'
import { toggleSheet } from '../shell/TopBar'
import { newDraft, openDraft } from './open'

const PRESS = 'cursor-pointer transition-[background-color,color,scale] duration-150 active:scale-[0.97]'
const ROW_BUTTON = `flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`

/** The open draft's name in the top bar, between the mix's name and the page: opens Drafts. */
export function DraftSwitch() {
  const pending = useStore((s) =>
    Object.values(s.versions).reduce((n, v) => n + (v.returns?.filter((r) => r.status === 'pending').length ?? 0), 0),
  )
  useReturns(useSave((s) => s.mixId))
  const draft = useStore((s) => s.drafts[s.draftId])
  const count = useStore((s) => Object.keys(s.drafts).length)
  const open = useStore((s) => s.ui.sheet === 'drafts')
  if (!draft) return null
  return (
    <button
      type="button"
      onClick={() => toggleSheet('drafts')}
      aria-expanded={open}
      title={
        count > 1
          ? `${count} drafts: open another, or see this one’s saved versions`
          : 'Drafts: try another direction, and this one’s saved versions'
      }
      className={`flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[14px] font-medium text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`}
    >
      <span className="grid size-5 place-items-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white">{draft.letter}</span>
      <span className="max-w-[140px] truncate max-lg:hidden">{draft.name}</span>
      {count > 1 && <span className="text-[12px] text-zinc-400 max-lg:hidden">of {count}</span>}
      {pending > 0 && <span className="rounded-full bg-pink-100 px-2 text-xs">{pending} returned</span>}
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
  const [wide, setWide] = useState(false)
  const [manage, setManage] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const reviewTrigger = useRef<HTMLButtonElement | null>(null)
  const previousReview = useRef<string | null>(null)
  const list = draftList(drafts)
  const history = wide ? Object.values(versions).sort(newestVersionFirst) : versionsOf(versions, draftId)
  const pending = history.flatMap((base) =>
    (base.returns ?? []).filter((r) => r.status === 'pending').map((r) => ({ key: base.id + '/' + r.bundle.id, base, bundle: r.bundle })),
  )
  const active = pending.find((r) => r.key === reviewId && r.base.draftId === draftId)
  const heading = useRef<HTMLHeadingElement>(null)
  const activeKey = active?.key
  useEffect(() => {
    if (activeKey) {
      previousReview.current = activeKey
      heading.current?.focus()
    } else if (previousReview.current) {
      if (reviewTrigger.current?.isConnected) reviewTrigger.current.focus()
      else heading.current?.focus()
      previousReview.current = null
      setReviewId(null)
    }
  }, [activeKey])

  return (
    <section className="draft-panel bg-background p-4 text-foreground sm:p-5" aria-label="Draft history">
      {active ? (
        <>
          <button className="draft-back" onClick={() => setReviewId(null)}>
            <ArrowLeft size={15} /> Draft history
          </button>
          <h2 ref={heading} tabIndex={-1} className="draft-title mt-3">
            {active.bundle.summary}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.bundle.agent} · Based on {active.base.letter}
          </p>
          <ReviewItem key={active.bundle.id} base={active.base} bundle={active.bundle} />
        </>
      ) : manage ? (
        <>
          <button className="draft-back" onClick={() => setManage(false)}>
            <ArrowLeft size={15} /> Draft history
          </button>
          <div className="my-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="draft-title">Manage drafts</h2>
            <button disabled={!room} className="draft-secondary" onClick={() => (newDraft(), useStore.getState().setUi({ sheet: 'none' }))}>
              <Plus size={15} /> New draft
            </button>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border p-1">
            {list.map((d) => (
              <DraftRow key={d.id} draft={d} open={d.id === draftId} only={list.length === 1} />
            ))}
          </ul>
        </>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={heading} tabIndex={-1} className="draft-title">
              Draft history
            </h2>
            <button className="draft-secondary" onClick={() => setManage(true)}>
              <GitBranch size={15} /> Manage drafts
            </button>
          </header>
          <div role="group" aria-label="History scope" className="draft-scope">
            <button aria-pressed={!wide} onClick={() => setWide(false)}>
              <GitBranch size={15} /> This draft
            </button>
            <button aria-pressed={wide} onClick={() => setWide(true)}>
              <Layers size={15} /> All drafts
            </button>
          </div>
          {pending.length > 0 && (
            <section className="mb-5" aria-label="Needs review">
              <h3 className="draft-subtitle">Needs review</h3>
              <div className="grid gap-2">
                {pending.map(({ key, base, bundle }) => (
                  <button
                    key={key}
                    ref={key === previousReview.current ? reviewTrigger : undefined}
                    className="draft-inbox"
                    onClick={() => {
                      if (base.draftId && base.draftId !== draftId) useStore.getState().switchDraft(base.draftId)
                      setReviewId(key)
                    }}
                  >
                    <span className="draft-agent-icon">
                      <Bot size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[15px] leading-snug">{bundle.summary}</strong>
                      <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                        {bundle.agent} · {base.letter} · {bundle.changes.length} {bundle.changes.length === 1 ? 'change' : 'changes'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-agent-ink">
                      Review <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <History key={wide ? 'all' : draftId} versions={history} wide={wide} />
          <IterationActions />
        </>
      )}
    </section>
  )
}

function DraftRow({ draft: d, open, only }: { draft: Draft; open: boolean; only: boolean }) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(d.name)
  const st = useStore.getState
  const room = useStore(canAddDraft)
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
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => (st().updateDraft(d.id, { name }), setRenaming(false))}
              maxLength={60}
              className="h-8 min-w-0 flex-1 rounded-md bg-white px-2 text-[13.5px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] outline-none"
            />
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
              <span className={`block truncate text-[13.5px] ${open ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>
                {d.name}
              </span>
              <span className="block truncate text-[11.5px] text-zinc-500">{open ? 'Current draft' : summary(d)}</span>
            </span>
            {!open && <span className="text-[12px] font-semibold text-zinc-500">Open</span>}
          </button>
        )}
        <button
          type="button"
          title="More"
          aria-label={`More for ${d.name}`}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className={`grid size-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-800 ${PRESS}`}
        >
          <ChevronDown size={15} className={`transition-transform duration-200 ${menu ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {menu && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <button type="button" className={ROW_BUTTON} onClick={() => (setMenu(false), setRenaming(true))}>
            <Pencil size={12} /> Rename
          </button>
          {room && (
            <button
              type="button"
              className={ROW_BUTTON}
              onClick={() => (setMenu(false), newDraft({ draft: d.id }), st().setUi({ sheet: 'none' }))}
            >
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
    </li>
  )
}

/** The open draft's saved versions, newest first: go back to one, branch a draft from it, export it or show it on the canvas. */
function History({ versions, wide }: { versions: VersionNode[]; wide: boolean }) {
  const st = useStore.getState
  const drafts = useStore((s) => s.drafts)
  const pinned = useStore((s) => s.ui.pinnedVersions)
  const head = useStore((s) => s.head)
  const room = useStore(canAddDraft)
  const [all, setAll] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [compare, setCompare] = useState<VersionNode | null>(null)
  const [pair, setPair] = useState<[VersionNode, VersionNode] | null>(null)
  const shown = all ? versions : versions.slice(0, 4)
  return (
    <section aria-label="Saved versions">
      <h3 className="draft-subtitle">
        Saved versions <span className="ml-1 font-normal text-muted-foreground">{versions.length}</span>
      </h3>
      {pair && <Comparison left={pair[0]} right={pair[1]} close={() => setPair(null)} />}
      {compare && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-agent-soft px-3 py-2 text-sm">
          Choose a version to compare with {compare.letter}.
          <button className="draft-back" onClick={() => setCompare(null)}>
            Cancel
          </button>
        </div>
      )}
      {!versions.length && (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Save a version to start this history.
        </p>
      )}
      <ul className="draft-versions">
        {shown.map((v) => {
          const on = pinned.includes(v.id)
          const isOpen = expanded === v.id && !compare
          const title =
            v.kind === 'build'
              ? `${v.build?.target === 'next' ? 'Next.js' : 'Astro'} build`
              : v.handoff && (!v.title || v.title === 'Blokmix')
                ? 'Sent to agent'
                : v.title || 'Saved version'
          const by = v.acceptedFrom?.agent ?? v.handoff?.by ?? v.author
          return (
            <li key={v.id}>
              <button
                className="draft-version"
                aria-expanded={!!isOpen}
                disabled={!!compare && (compare.id === v.id || v.kind !== 'snapshot')}
                onClick={() => {
                  if (compare) {
                    setPair([compare, v])
                    setCompare(null)
                  } else setExpanded(isOpen ? null : v.id)
                }}
              >
                <span className="draft-version-id">{v.letter}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[15px] leading-snug">{title}</strong>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    {[wide && v.draftId && drafts[v.draftId]?.name, when(v.createdAt), by].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {v.id === head && (
                  <span className="draft-current">
                    <Check size={12} /> Current
                  </span>
                )}
                <ChevronRight size={15} className={isOpen ? 'rotate-90' : ''} />
              </button>
              {isOpen && (
                <div className="draft-version-detail">
                  <p className="mb-1 text-sm text-muted-foreground">{sectionsOf(v)}</p>
                  {v.handoff && <p className="text-sm">Sent by {v.handoff.by}</p>}
                  {v.returns?.map((r) => (
                    <p key={r.bundle.id} className="text-sm">
                      {r.bundle.summary} · {r.status}
                    </p>
                  ))}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.kind === 'snapshot' && versions.some((other) => other.kind === 'snapshot' && other.id !== v.id) && (
                      <button
                        className={ROW_BUTTON}
                        onClick={() => {
                          setCompare(v)
                          setAll(true)
                        }}
                      >
                        <Columns2 size={14} /> Compare
                      </button>
                    )}
                    {v.kind === 'snapshot' && <SendToAgent version={v} className="min-h-7 rounded-full text-[12px]" />}
                    {v.kind === 'snapshot' && v.id !== head && (
                      <button
                        type="button"
                        className={ROW_BUTTON}
                        title="The open draft goes back to this. Unsaved changes are saved first; ⌘Z undoes it."
                        onClick={() => (st().restoreVersion(v.id), st().showFlash(`Back to ${v.letter}`, { undo: true }))}
                      >
                        <RotateCcw size={12} /> Go back to this
                      </button>
                    )}
                    {v.kind === 'snapshot' && room && (
                      <button
                        type="button"
                        className={ROW_BUTTON}
                        onClick={() => (newDraft({ version: v.id }), st().setUi({ sheet: 'none' }))}
                      >
                        <Copy size={12} /> New draft
                      </button>
                    )}
                    <button type="button" className={ROW_BUTTON} onClick={() => st().setUi({ packetSource: v.id, sheet: 'packet' })}>
                      <Package size={12} /> Export
                    </button>
                    {v.kind === 'snapshot' && (
                      <button
                        type="button"
                        className={ROW_BUTTON}
                        onClick={() => st().setUi({ pinnedVersions: on ? pinned.filter((x) => x !== v.id) : [...pinned, v.id] })}
                      >
                        {on ? <EyeOff size={12} /> : <Eye size={12} />} {on ? 'Hide from canvas' : 'Show on canvas'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {versions.length > 4 && (
        <button type="button" onClick={() => setAll((x) => !x)} className={`${ROW_BUTTON} mt-1`}>
          {all ? 'Show fewer versions' : `Show all ${versions.length} versions`}
        </button>
      )}
    </section>
  )
}

const summary = (d: Draft) => {
  const n = d.body ? allSlots(d.body.site).length : 0
  const pages = d.body?.site.pages.length ?? 1
  return `${pages > 1 ? `${pages} pages · ` : ''}${n} ${n === 1 ? 'section' : 'sections'}`
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
  return today
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

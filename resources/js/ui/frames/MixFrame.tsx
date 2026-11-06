import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { entryTitle, sortedEntries } from '@/core/collections'
import { templateEntry, useCollections } from '@/state/collections'
import { Eye, Plus } from 'lucide-react'
import { MixMark } from '../brand/MixMark'
import { snapshotKey } from '@/core/versions'
import { pageOf } from '@/core/site'
import { barRoomBelow, useBarOverhang } from '../canvas/useBarFloor'
import { useStore, currentSlots } from '@/state/store'
import { useLayout } from '@/state/layout'
import { useResolvedGuide } from '@/state/derived'
import { MIX_ID, VIEW_W } from '../canvas/geometry'
import { FrameHeader, HeaderButton, HeaderTitle } from './FrameHeader'
import { SlotRow } from './SlotRow'
import { SectionDropLine } from './SectionDrag'
import { AddSectionMenu, insertSection } from '../shell/AddSection'

export function MixFrame() {
  const slots = useStore(currentSlots)
  const site = useStore((s) => s.site)
  const page = pageOf(site, useStore((s) => s.ui.pageId))
  const viewport = useStore((s) => s.ui.viewport)
  const focused = useStore((s) => s.ui.focusedSlotId)
  const selected = useStore((s) => s.ui.selectedFrameId === MIX_ID)
  const previewing = useStore((s) => s.ui.previewFrameId === MIX_ID)
  const head = useStore((s) => (s.head ? s.versions[s.head] : null))
  const draft = useStore((s) => s.drafts[s.draftId])
  const many = useStore((s) => Object.keys(s.drafts).length > 1)
  const guide = useResolvedGuide()
  const W = VIEW_W[viewport]
  const guideState = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const contract = useStore((s) => s.contract)
  const dirty = useMemo(
    () => !head || snapshotKey(head.snapshot) !== snapshotKey({ site, guide: guideState, content, contract }),
    [head, site, guideState, content, contract],
  )

  // The pink row: the section you're on, or the first after the nav.
  const focusedAt = slots.findIndex((s) => s.id === focused)
  const markAt = focusedAt >= 0 ? focusedAt : slots[0]?.type === 'nav' && slots.length > 1 ? 1 : 0
  const [addAt, setAddAt] = useState<number | null>(null)
  const closeAdd = useCallback(() => setAddAt(null), [])
  const st = useStore.getState
  // A bar hanging below the last section (its section bar, or a block's bar and menus): what sits under the page makes
  // exactly that much room, on screen.
  const room = useBarOverhang((s) => (previewing ? 0 : barRoomBelow(s, slots.at(-1)?.id)))
  const label = head ? (dirty ? `edited since ${head.letter}` : `saved as ${head.letter}`) : 'not saved yet'
  const name = draft?.name ?? 'Your mix'

  return (
    <div
      className="absolute left-0 top-0"
      style={{ width: W }}
      onPointerDown={() => st().setUi({ selectedFrameId: MIX_ID })}
      data-frame={MIX_ID}
    >
      <FrameHeader width={W} selected={selected} tint={undefined}>
        {/* The page's tracklist: the section you're on is pink, and lifts out while there are edits. */}
        <span title={dirty ? 'Edited since the last version' : 'Saved as a version'}>
          <MixMark types={slots.map((s) => s.type)} active={markAt} edited={dirty} />
        </span>
        <HeaderTitle
          title={site.pages.length > 1 ? `${name} · ${page.title}` : name}
          meta={`${many ? 'You’re working here · ' : ''}${site.pages.length > 1 ? `${page.path} · ` : ''}${label} · ${slots.length} sections`}
        />
        {page.template && <EntrySwitcher pageId={page.id} collection={page.template.collection} />}
        <span className="@max-[220px]:hidden">
        <HeaderButton
          icon={Eye}
          label={previewing ? 'Stop interacting' : 'Interact with the page'}
          active={previewing}
          onClick={() => st().setUi({ previewFrameId: previewing ? null : MIX_ID })}
        />
        </span>
      </FrameHeader>

      <div
        className="frame-r relative shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.06)] transition-shadow"
        style={{ background: guide.tokens['color.bg'] }}
      >
        {!previewing && site.shared.nav && !page.show.nav && <HiddenShared kind="nav" pageId={page.id} />}
        {!previewing && !site.shared.nav && slots.length > 0 && <MissingShared kind="nav" />}
        {slots.map((slot, i) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            index={i}
            count={slots.length}
            guide={guide.tokens}
            focused={focused === slot.id}
          />
        ))}
        {!previewing && site.shared.footer && !page.show.footer && <HiddenShared kind="footer" pageId={page.id} room={room} />}
        {!previewing && !site.shared.footer && slots.length > 0 && <MissingShared kind="footer" room={room} />}
        {!slots.length && (
          <div className="grid place-items-center py-40 text-center" style={{ fontSize: 'calc(16px / var(--z))' }}>
            <p className="text-zinc-400">This page is empty. Add a section to start.</p>
          </div>
        )}
      </div>

      {!previewing && <Seams onAdd={setAddAt} />}
      <SectionDropLine />
      {addAt !== null && <AddAt at={addAt} onClose={closeAdd} />}
      <AddSection width={W} onAdd={() => setAddAt(slots.length)} room={site.shared.footer && page.show.footer ? room : 0} />
    </div>
  )
}

/** The "+" at each gap between sections, in the gutter beside the rail. Opens Add section there. */
function Seams({ onAdd }: { onAdd: (at: number) => void }) {
  const slots = useStore(currentSlots)
  const rows = useLayout((s) => s.rows)
  const last = slots.length ? rows[slots[slots.length - 1].id] : undefined
  const ys = slots.map((s) => rows[s.id]?.top)
  if (last) ys.push(last.top + last.height)
  return (
    <>
      {ys.map((y, at) =>
        y === undefined ? null : (
          <div
            key={at}
            className="group/seam absolute right-full z-30"
            style={{ top: y, width: 'calc(40px / var(--z))', height: 'calc(20px / var(--z))', marginTop: 'calc(-10px / var(--z))' }}
            data-chrome
          >
            <button
              type="button"
              title="Add a section here"
              aria-label="Add a section here"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onAdd(at)
              }}
              className="absolute top-1/2 grid size-5 place-items-center rounded-full border border-zinc-950/12 bg-white text-zinc-700 opacity-0 shadow-sm transition-opacity duration-150 hover:text-zinc-950 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 pointer-coarse:size-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 group-hover/seam:opacity-100"
              style={{ right: 'calc(9px / var(--z))', transform: 'translate(50%, -50%) scale(min(calc(1 / var(--zl)), 3.4))' }}
            >
              <Plus size={12} strokeWidth={2.6} />
            </button>
          </div>
        ),
      )}
    </>
  )
}

/** The Add section menu, pinned at the gap it was opened from. */
function AddAt({ at, onClose }: { at: number; onClose: () => void }) {
  const slots = useStore(currentSlots)
  const rows = useLayout((s) => s.rows)
  const frameH = slots.length ? (rows[slots[slots.length - 1].id]?.top ?? 0) + (rows[slots[slots.length - 1].id]?.height ?? 0) : 0
  const y = at < slots.length ? (rows[slots[at].id]?.top ?? 0) : frameH
  const below = at >= slots.length
  return (
    <div
      className="absolute left-0 z-40 origin-top-left"
      style={{ top: y, transform: `scale(min(calc(1 / var(--zl)), 3.4))${below ? ' translateY(56px)' : ''}` }}
    >
      <div className="m-2">
        <AddSectionMenu at={at} onClose={onClose} />
      </div>
    </div>
  )
}

function AddSection({ width, onAdd, room }: { width: number; onAdd: () => void; room: number }) {
  return (
    <div
      className="@container absolute left-0 top-full origin-top-left transition-[padding] duration-200"
      style={{ width: `max(calc(${width}px * var(--z)), 48px)`, transform: 'scale(calc(1 / var(--z)))', paddingTop: room + 12 }}
      data-chrome
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onAdd}
          title="Add a section"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-zinc-400/60 bg-white/60 px-4 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-zinc-500 hover:bg-white active:scale-[0.97] @max-[150px]:px-2.5"
        >
          <Plus size={15} /> <span className="@max-[150px]:hidden">Add a section</span>
        </button>
      </div>
    </div>
  )
}

/** Where the nav or footer would be when the site has none yet: every page needs both, so offer the one that fits. */
function MissingShared({ kind, room = 0 }: { kind: 'nav' | 'footer'; room?: number }) {
  return (
    <div className="flex items-center justify-center border-y border-dashed border-zinc-950/10 bg-zinc-950/[0.02]" style={{ height: 'calc(44px / var(--z))', marginTop: room ? `calc(${room + 8}px / var(--z))` : 0 }} data-chrome>
      <div className="flex items-center gap-2 text-zinc-500" style={{ transform: 'scale(min(calc(1 / var(--zl)), 3.4))' }}>
        <span className="text-[12.5px]">No {kind} yet</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            insertSection(kind, kind === 'nav' ? 0 : currentSlots(useStore.getState()).length)
          }}
          className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 text-[12px] font-semibold text-zinc-700 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-[scale,color] duration-150 hover:text-zinc-950 active:scale-[0.97]"
        >
          <Plus size={12} strokeWidth={2.6} /> Add a {kind}
        </button>
      </div>
    </div>
  )
}

/** Where the shared nav or footer would be on a page that hides it, with a way to show it again. */
function HiddenShared({ kind, pageId, room = 0 }: { kind: 'nav' | 'footer'; pageId: string; room?: number }) {
  return (
    <div className="flex items-center justify-center border-y border-dashed border-zinc-950/10 bg-zinc-950/[0.02]" style={{ height: 'calc(44px / var(--z))', marginTop: room ? `calc(${room + 8}px / var(--z))` : 0 }} data-chrome>
      <div className="flex items-center gap-2 text-zinc-500" style={{ transform: 'scale(min(calc(1 / var(--zl)), 3.4))' }}>
        <span className="text-[12.5px]">No {kind} on this page</span>
        <span className="text-zinc-300">·</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => useStore.getState().updatePage(pageId, { show: { [kind]: true } })}
          className="cursor-pointer rounded-full px-2 py-0.5 text-[12.5px] font-semibold text-zinc-800 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97]"
        >
          Show
        </button>
      </div>
    </div>
  )
}

/** A collection's template page previews one entry at a time: step through them here. */
function EntrySwitcher({ pageId, collection }: { pageId: string; collection: string }) {
  const c = useCollections((s) => s.bySlug[collection])
  const picked = useStore((s) => s.ui.previewEntry)
  const shown = templateEntry({ id: pageId, template: { collection } }, picked, c ? { [collection]: c } : {})
  if (!c || !shown) return <span className="shrink-0 rounded-full bg-zinc-950/5 px-2 py-1 text-[11.5px] text-zinc-500">No entries in {c?.name ?? collection}</span>
  const list = sortedEntries(c)
  const at = list.findIndex((e) => e.id === shown.entry.id)
  const go = (d: 1 | -1) => {
    const next = list[(at + d + list.length) % list.length]
    useStore.getState().setUi({ previewEntry: { ...picked, [pageId]: next.id } })
  }
  const btn = 'grid size-7 cursor-pointer place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]'
  return (
    <span className="flex min-w-0 shrink items-center rounded-full bg-key-soft/60 pl-0.5 pr-0.5" title={`Previewing /${c.slug}/${shown.entry.slug}`}>
      <button type="button" aria-label="Previous entry" onClick={() => go(-1)} className={btn}>
        <ChevronLeft size={14} />
      </button>
      <span className="max-w-[180px] truncate px-1 text-[12px] font-semibold text-key-ink">{entryTitle(c, shown.entry)}</span>
      <span className="pr-1 text-[11px] tabular-nums text-key-ink/60">
        {at + 1}/{list.length}
      </span>
      <button type="button" aria-label="Next entry" onClick={() => go(1)} className={btn}>
        <ChevronRight size={14} />
      </button>
    </span>
  )
}

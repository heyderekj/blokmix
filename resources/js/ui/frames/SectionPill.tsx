import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, ChevronLeft, ChevronRight, GripVertical, Link2, Lock, LockOpen, Palette, Plus, Sparkles, Trash2, Type } from 'lucide-react'
import type { Slot, TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { GROUP_LABEL, primaryFamily } from '@/core/tokens'
import { library, slotClip } from '@/data/library'
import { Switch } from '../panels/parts'
import { updateSlotIn } from '@/core/site'
import { useStore, currentSlots } from '@/state/store'
import { MORPH } from '../shell/Island'
import { StyleRow, StyleSelect } from '../panels/StyleRows'
import { SliderPicker } from './SliderPicker'
import { DeviceSwitch, SectionSpacingRows, useDevice } from '../blocks/Spacing'
import { SectionMotionRows } from '../blocks/MotionMenu'
import { BackdropPicker } from '../dials/BackdropPicker'
import { DressUp } from '../jev/DressUp'
import { useResolvedGuide } from '@/state/derived'
import { bandTokens, SURFACES, SURFACE_LABEL, surfaceTokens, SECTION_WIDTHS, SECTION_WIDTH_LABEL } from '@/core/surface'
import { isBackdropId, readBackdrop } from '@/core/treatments'
import { runCommand } from '@/state/commands'
import { siteLibraryAvailable } from '@/lib/siteLibrary'
import { setStylePanel, useStylePanel } from '../panels/stylePanel'
import { PanelGroup } from '../blocks/BlockBar'
import { useDockLayouts } from '../shell/Dock'
import { pressSection, sectionMovable } from './SectionDrag'

type Tab = 'style' | 'source'

const TABS: { id: Tab; label: string; icon: typeof Type }[] = [
  { id: 'style', label: 'Style', icon: Palette },
  { id: 'source', label: 'Source', icon: Link2 },
]

/**
 * A section's label: what it is and where it sits, its moves, and tabs in words for everything else, which open only
 * when asked, so the bar stays short and nothing needs a tooltip to make sense.
 */
export function SectionPill({ slot, index, count, focused, pos, total }: { slot: Slot; index: number; count: number; focused: boolean; pos: number; total: number }) {
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip?.sourceId ?? '']
  const sheet = useStore((s) => s.ui.sheet)
  // The shared nav and footer: on how many pages (0 when the section is a page's own).
  const sharedOn = useStore((s) => {
    const kind = s.site.shared.nav?.id === slot.id ? 'nav' : s.site.shared.footer?.id === slot.id ? 'footer' : null
    return kind ? s.site.pages.filter((p) => p.show[kind]).length : 0
  })
  const multi = useStore((s) => s.site.pages.length > 1)
  const [tab, setTab] = useState<Tab | null>(null)
  const styling = useStylePanel((s) => s.open)
  const st = useStore.getState

  // One open surface at a time: losing focus or opening a sheet folds the tabs.
  useEffect(() => {
    if (!focused || sheet !== 'none') setTab(null)
  }, [focused, sheet])

  if (!clip) return null

  return (
    // A tab on the section's top edge, where you clicked into it even on a tall section (just inside on the first one,
    // clear of the frame's header).
    <div className="absolute left-0 top-0 z-30 origin-top-left" style={{ transform: 'scale(calc(1 / var(--z)))' }} data-chrome>
      <motion.div
        layout
        transition={MORPH}
        // The bottom toolbar's size and corners, solid and lifted so it reads over any section.
        style={{
          borderRadius: 16,
          backgroundColor: 'var(--lift)',
          boxShadow: '0 0 0 1px rgb(0 0 0 / 0.08), 0 12px 28px -12px rgb(0 0 0 / 0.35)',
        }}
        className={`glass-panel ml-3 w-max overflow-hidden ${index === 0 ? 'mt-2.5' : '-mt-[22px]'}`}
        onPointerDown={(e) => {
          e.stopPropagation()
          st().focusSlot(slot.id)
        }}
      >
        {/* one slim row: what it is, its tabs, its utilities, the one strong action */}
        <motion.div layout="position" transition={MORPH} className={`flex h-11 items-center gap-1 pr-1.5 ${sectionMovable(slot.id) ? 'pl-1.5' : 'pl-3.5'}`}>
          {sectionMovable(slot.id) && (
            <span
              role="button"
              tabIndex={-1}
              title="Drag to move this section (or ⌥↑ ⌥↓)"
              aria-label="Drag to move this section"
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                st().focusSlot(slot.id)
                pressSection(slot.id, e)
              }}
              className="grid h-8 w-6 cursor-grab place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700"
              style={{ touchAction: 'none' }}
            >
              <GripVertical size={15} />
            </span>
          )}
          <div className="mr-1 flex shrink-0 items-baseline gap-1.5 whitespace-nowrap" title={source?.name ?? ''}>
            <span className="text-[14px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]}</span>
            {sharedOn > 0 && multi ? (
              <span className="rounded-full bg-key-soft px-1.5 py-px text-[10.5px] font-semibold text-key-ink" title="Edits here show on every page that shows it">
                Shared · {sharedOn}
              </span>
            ) : null}
          </div>
          {total > 1 && <LayoutStepper slotId={slot.id} pos={pos} total={total} />}
          {focused && (
            <>
              <span className="mx-1 h-5 w-px bg-zinc-950/10" />
              {TABS.filter((t) => t.id !== 'source' || clip.origin !== 'layout' || !!(slot.inspiredBy ?? clip.inspiredBy)).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-expanded={t.id === 'style' ? styling : tab === t.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (t.id === 'style') {
                      setTab(null)
                      if (!styling) st().setUi({ sheet: 'none' })
                      setStylePanel(!styling)
                      return
                    }
                    if (tab !== t.id) {
                      st().setUi({ sheet: 'none' })
                      if (styling) setStylePanel(false)
                    }
                    setTab(tab === t.id ? null : t.id)
                  }}
                  className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,scale] active:scale-[0.97] ${(t.id === 'style' ? styling : tab === t.id) ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
                >
                  <t.icon size={15} /> {t.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={slot.locked}
                title={slot.locked ? 'Locked: Shuffle and agents leave this section alone. Click to unlock (L)' : 'Lock this section, so only you can change it (L)'}
                onClick={(e) => {
                  e.stopPropagation()
                  st().toggleLock(slot.id)
                }}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,scale] active:scale-[0.97] ${slot.locked ? 'bg-key-soft font-semibold text-key-ink' : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
              >
                {slot.locked ? <Lock size={15} strokeWidth={2.4} /> : <LockOpen size={15} />} {slot.locked ? 'Locked' : 'Lock'}
              </button>
              <span className="mx-1 h-5 w-px bg-zinc-950/10" />
              <Util
                label="Remove section (⌫)"
                disabled={count <= 1}
                danger
                onClick={() => {
                  st().removeSlot(slot.id)
                  st().showFlash(`Removed the ${TYPE_LABEL[slot.type].toLowerCase()} section`, { undo: true })
                }}
              >
                <Trash2 size={16} />
              </Util>
            </>
          )}
        </motion.div>

        <AnimatePresence initial={false} mode="popLayout">
          {focused && tab && (
            <motion.div
              key={tab}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { delay: 0.05, duration: 0.14 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.06 } }}
              className="bg-well p-3"
            >
              {tab === 'source' && <SourceTab slot={slot} />}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

/** This section's look: its band and width in words, then backdrop, spacing and motion. A captured section also offers its own look to the style guide. */
export function StyleTab({ slot }: { slot: Slot }) {
  const clip = library.clips[slot.clipId]
  const resolved = useResolvedGuide().tokens
  const t = clip.tokens
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <PanelGroup title="Background">
        {clip.origin !== 'layout' && (
          <div className="mb-1.5 flex min-h-8 items-center justify-between gap-3 text-[12px] font-medium text-zinc-600">
            Use its own look
            <Switch
              on={slot.keep.style}
              onChange={() => useStore.getState().toggleKeep(slot.id, 'style')}
              label="Use this section’s own captured look instead of the style guide"
            />
          </div>
        )}
        <div className="grid gap-1.5">
          {!slot.keep.style && <SurfacePicks slot={slot} />}
          <WidthPicks slot={slot} />
        </div>
        {slot.type === 'nav' && <BannerRow slot={slot} />}
        {clip.slider && <SliderPicker slot={slot} options={clip.slider} />}
        <div className="mt-2.5">
          <DressUp slot={slot} />
          <BackdropPicker slot={slot} tokens={slot.keep.style ? t : surfaceTokens(resolved, slot.surface)} />
          <BackdropNote slot={slot} />
        </div>
      </PanelGroup>
      <PanelGroup title="Spacing">
        <SpacingGroup slot={slot} />
      </PanelGroup>
      <PanelGroup title="Motion">
        <SectionMotionRows slot={slot} untitled />
      </PanelGroup>
      {clip.origin !== 'layout' && (
        <PanelGroup title="This section’s own look">
          <CapturedLook slot={slot} />
        </PanelGroup>
      )}
    </div>
  )
}

/** Says so when a backdrop changed the section's text or was softened, so the change doesn't look like a mistake. */
function BackdropNote({ slot }: { slot: Slot }) {
  const resolved = useResolvedGuide().tokens
  const fromGuide = useStore((s) => s.guide.sections?.[slot.type]?.backdrop)
  const value = slot.backdrop ?? fromGuide
  if (!value || slot.keep.style || !isBackdropId(value.id)) return null
  const { ink, softened } = readBackdrop(value, bandTokens(resolved, slot))
  if (!ink && !softened) return null
  return <p className="mt-2 text-[11.5px] leading-snug text-zinc-500">{softened ? 'Softened' : 'Text color changed'} so your words stay readable over this.</p>
}

/** A captured section's look, offered to the style guide whole or a group at a time. */
function CapturedLook({ slot }: { slot: Slot }) {
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip.sourceId]
  const t = clip.tokens
  const guide = useStore((s) => s.guide)
  const [groups, setGroups] = useState<TokenGroup[]>(['color', 'type'])
  const promoted = new Set(guide.candidates.filter((c) => c.clipId === clip.id).map((c) => c.group))
  const st = useStore.getState
  const names = groups.map((g) => GROUP_LABEL[g].toLowerCase()).join(', ')
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-12 w-14 shrink-0 place-items-center rounded-lg ring-1 ring-zinc-950/10" style={{ background: t['color.bg'] }}>
          <span
            style={{
              fontFamily: t['font.display'],
              color: t['color.text'],
              fontWeight: Number(t['type.displayWeight']),
            }}
            className="text-[18px]"
          >
            Aa
          </span>
        </span>
        <div className="min-w-0 text-[12.5px] text-zinc-600">
          <div className="font-medium text-zinc-900">{primaryFamily(t['font.display'])}</div>
          <div className="mt-1 flex items-center gap-1">
            {(['color.bg', 'color.primary', 'color.accent', 'color.text'] as const).map((c) => (
              <span key={c} className="size-4 rounded-full ring-1 ring-zinc-950/10" style={{ background: t[c] }} />
            ))}
            <span className="pl-1 text-zinc-500">radius {t['radius.base']}</span>
          </div>
        </div>
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1">
        {TOKEN_GROUPS.map((g) => {
          const on = groups.includes(g)
          return (
            <button
              key={g}
              type="button"
              aria-pressed={on}
              onClick={(e) => {
                e.stopPropagation()
                setGroups((x) => (on ? x.filter((y) => y !== g) : [...x, g]))
              }}
              className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition active:scale-[0.97] ${on ? 'bg-zinc-900 text-white' : 'bg-lift text-zinc-600 hover:text-zinc-900'}`}
            >
              {GROUP_LABEL[g]}
              {promoted.has(g) && <span className="size-1.5 rounded-full bg-key" title="Already a candidate" />}
            </button>
          )
        })}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!groups.length}
          onClick={(e) => {
            e.stopPropagation()
            st().promoteClip(clip.id, groups)
            st().showFlash(`${source.name} is now a candidate for ${names}`, {
              undo: true,
            })
          }}
          className="btn-quiet flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium"
        >
          <Plus size={14} /> Add as candidate
        </button>
        <button
          type="button"
          disabled={!groups.length}
          onClick={(e) => {
            e.stopPropagation()
            st().adoptClipDesign(clip.id, groups)
            st().showFlash(`Style guide now uses ${source.name} for ${names}`, {
              undo: true,
            })
          }}
          className="btn-quiet flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold"
        >
          <Sparkles size={14} /> Use these
        </button>
      </div>
    </div>
  )
}

/** Section spacing for desktop or phones, and the blocks this section hides on phones. */
function SpacingGroup({ slot }: { slot: Slot }) {
  const [device, setDevice] = useDevice()
  const edits = slot.edits?.[slot.clipId] ?? {}
  const hiddenOnPhones = Object.entries(edits).filter(([, e]) => e.mobile?.hidden && !e.hidden)
  // Show them all again as one undo step.
  const showAll = () =>
    useStore.setState((st) => ({
      site: updateSlotIn(st.site, slot.id, (x) => {
        const forClip = { ...x.edits?.[x.clipId] }
        for (const [id] of hiddenOnPhones) {
          const { mobile, ...rest } = forClip[id]
          const m = mobile?.style ? { style: mobile.style } : undefined
          const next = m ? { ...rest, mobile: m } : rest
          if (Object.keys(next).length) forClip[id] = next
          else delete forClip[id]
        }
        return { ...x, edits: { ...x.edits, [x.clipId]: forClip } }
      }),
    }))
  return (
    <div>
      <div className="mb-1 flex justify-end">
        <DeviceSwitch value={device} onChange={setDevice} />
      </div>
      <SectionSpacingRows slot={slot} device={device} />
      {hiddenOnPhones.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-[11.5px] text-zinc-500">
          Hidden on mobile ({hiddenOnPhones.length}) ·
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              showAll()
              useStore.getState().showFlash('Shown on mobile again', { undo: true })
            }}
            className="cursor-pointer font-medium text-zinc-700 hover:text-zinc-950"
          >
            Show
          </button>
        </div>
      )}
    </div>
  )
}

/** An announcement strip above the nav: the clip's own ticker, or one added to any nav. */
function BannerRow({ slot }: { slot: Slot }) {
  const banner = slotClip(slot).blocks.find((b) => b.kind === 'banner')
  const on = !!banner && !slot.edits?.[slot.clipId]?.[banner.id]?.hidden
  const st = useStore.getState
  return (
    <div className="mt-3.5 flex items-center gap-3 border-t border-zinc-950/6 pt-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-zinc-800">Announcement banner</div>
        <div className="text-[11.5px] text-zinc-500">{on ? 'Select it on the page for its look and messages' : 'A strip of short messages above the nav'}</div>
      </div>
      <Switch
        on={on}
        label="Announcement banner"
        onChange={() => {
          st().setBanner(slot.id, !on)
          if (!on)
            setTimeout(() => {
              const b = slotClip(currentSlots(useStore.getState()).find((s) => s.id === slot.id)!).blocks.find((x) => x.kind === 'banner')
              if (b) st().selectBlock(b.id)
            })
        }}
      />
    </div>
  )
}

function SourceTab({ slot }: { slot: Slot }) {
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip.sourceId]
  const inspired = slot.inspiredBy ?? clip.inspiredBy
  return (
    <div className="text-[12.5px] text-zinc-600">
      <div className="font-medium text-zinc-900">{clip.title}</div>
      <div className="mt-0.5 text-zinc-500">
        {source.name} · <span className="font-mono text-[11.5px]">{clip.capture.url.replace('https://', '')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded-md bg-lift px-1.5 py-0.5 font-mono text-zinc-600">{clip.layoutPattern}</span>
        <span className="rounded-md bg-lift px-1.5 py-0.5 text-zinc-600">
          Clipped{' '}
          {new Date(clip.capture.capturedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}{' '}
          at {clip.capture.viewport.width}px
        </span>
      </div>
      {clip.motionNotes && <p className="mt-2 leading-relaxed text-zinc-500">{clip.motionNotes}</p>}
      {inspired && <InspiredBy inspired={inspired} />}
    </div>
  )
}

/** The real site a section's layout was matched from: credit, a link, and its look for the style guide. */
function InspiredBy({ inspired }: { inspired: NonNullable<Slot['inspiredBy']> }) {
  // use_site_style finds a library site by its name too.
  const slug = siteLibraryAvailable() ? inspired.site : null
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-zinc-950/6 pt-2.5">
      <a
        href={inspired.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mr-auto inline-flex min-w-0 cursor-pointer items-center gap-1 truncate font-medium text-zinc-800 underline decoration-zinc-950/20 underline-offset-2 hover:decoration-zinc-950/60"
      >
        Inspired by {inspired.site} <ArrowUpRight size={12} className="shrink-0" />
      </a>
      {slug && (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation()
            try {
              await runCommand('use_site_style', { site: slug }, 'you')
              useStore.getState().showFlash(`${inspired.site}’s look is a style guide candidate`, { undo: true })
            } catch (err) {
              useStore.getState().showFlash(err instanceof Error ? err.message : String(err))
            }
          }}
          className="h-7 cursor-pointer rounded-full px-2.5 text-[12px] font-medium text-zinc-600 transition-[background-color,color,scale] active:scale-[0.97] hover:bg-zinc-950/5 hover:text-zinc-900"
        >
          Use its look
        </button>
      )}
    </div>
  )
}

/** The band the section sits on: the one it's on, its swatch painted as it would look with your style guide. */
function SurfacePicks({ slot }: { slot: Slot }) {
  const tokens = useResolvedGuide().tokens
  const fromGuide = useStore((s) => s.guide.sections?.[slot.type]?.surface)
  const on = slot.surface ?? fromGuide ?? 'page'
  return (
    <StyleRow label="Background">
      <StyleSelect
        label="Section background"
        value={on}
        options={SURFACES.map((v) => ({ v, label: SURFACE_LABEL[v] }))}
        lead={<span className="size-3.5 shrink-0 rounded-full ring-1 ring-zinc-950/15" style={{ background: surfaceTokens(tokens, on)['color.bg'] }} />}
        onChange={(v) => useStore.getState().setSurface(slot.id, v)}
      />
    </StyleRow>
  )
}

const WIDTH_SHARE: Record<(typeof SECTION_WIDTHS)[number], number> = {
  narrow: 46,
  standard: 64,
  wide: 82,
  full: 100,
}

/**
 * How far the section's content runs: a tiny page with the content inside it, as wide as it would be. Drag its edge or
 * click anywhere, and it snaps to the nearest of the four widths; the arrow keys step through them.
 */
function WidthPicks({ slot }: { slot: Slot }) {
  const on = slot.width ?? 'standard'
  const at = SECTION_WIDTHS.indexOf(on)
  const set = (w: (typeof SECTION_WIDTHS)[number]) => {
    if (w !== on) useStore.getState().setSectionWidth(slot.id, w)
  }
  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    // The content grows from the middle, so what counts is how far from the middle you are.
    const share = (Math.abs(e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 100
    const nearest = SECTION_WIDTHS.reduce((a, b) => (Math.abs(WIDTH_SHARE[b] - share) < Math.abs(WIDTH_SHARE[a] - share) ? b : a))
    set(nearest)
  }
  return (
    <StyleRow label="Width">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Section width"
        aria-valuemin={0}
        aria-valuemax={SECTION_WIDTHS.length - 1}
        aria-valuenow={at}
        aria-valuetext={SECTION_WIDTH_LABEL[on]}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          fromPointer(e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e)
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
          if (!step) return
          e.preventDefault()
          e.stopPropagation()
          set(SECTION_WIDTHS[Math.min(SECTION_WIDTHS.length - 1, Math.max(0, at + step))])
        }}
        className="relative h-9 cursor-ew-resize touch-none select-none rounded-lg bg-zinc-950/[0.05] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        {/* The four stops, as faint marks on the page either side of the middle. */}
        {SECTION_WIDTHS.filter((w) => w !== 'full').flatMap((w) =>
          [50 - WIDTH_SHARE[w] / 2, 50 + WIDTH_SHARE[w] / 2].map((x) => (
            <span key={`${w}${x}`} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-zinc-950/20" style={{ left: `${x}%` }} aria-hidden />
          )),
        )}
        <span
          className="absolute inset-y-1 flex items-center justify-between overflow-hidden rounded-md bg-lift px-1 text-[11.5px] font-medium text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.1)] transition-[left,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            left: `calc(${50 - WIDTH_SHARE[on] / 2}% + ${on === 'full' ? 4 : 0}px)`,
            width: `calc(${WIDTH_SHARE[on]}% - ${on === 'full' ? 8 : 0}px)`,
          }}
        >
          <span className="h-3 w-0.5 shrink-0 rounded-full bg-zinc-300" aria-hidden />
          <span className="min-w-0 truncate">{SECTION_WIDTH_LABEL[on]}</span>
          <span className="h-3 w-0.5 shrink-0 rounded-full bg-zinc-300" aria-hidden />
        </span>
      </div>
    </StyleRow>
  )
}

function Util({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`grid size-8 cursor-pointer place-items-center rounded-full text-zinc-600 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-25 ${
        danger ? 'hover:bg-problem-soft hover:text-problem-ink' : 'hover:bg-zinc-950/5 hover:text-zinc-900'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * A section's label at rest lives off the page, in the gutter on its left: a
 * quiet rail with the number and name, so the design itself is never covered.
 */
/**
 * The section's other layouts, a step at a time (← → do the same), like the block bar's ‹ Look ›. The label opens them
 * all in the dock.
 */
function LayoutStepper({ slotId, pos, total }: { slotId: string; pos: number; total: number }) {
  const st = useStore.getState
  const open = useDockLayouts((s) => s.slotId === slotId)
  const step = 'grid h-8 w-6 cursor-pointer place-items-center text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.94]'
  return (
    <div className="ml-1 flex items-center rounded-full">
      <button type="button" title="Previous layout (←)" aria-label="Previous layout" onClick={() => st().cycle(slotId, -1)} className={`${step} rounded-l-full`}>
        <ChevronLeft size={15} />
      </button>
      <button
        type="button"
        title="See every layout for this section"
        aria-expanded={open}
        onClick={() => {
          st().setUi({ sheet: 'none' })
          useDockLayouts.setState({ slotId: open ? null : slotId })
        }}
        className={`flex h-8 cursor-pointer items-center whitespace-nowrap px-1.5 text-[12.5px] font-medium tabular-nums transition active:scale-[0.97] ${open ? 'text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
      >
        Layout {pos} of {total}
      </button>
      <button type="button" title="Next layout (→)" aria-label="Next layout" onClick={() => st().cycle(slotId, 1)} className={`${step} rounded-r-full`}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

export function SectionRail({ slot, index, focused }: { slot: Slot; index: number; focused: boolean }) {
  const st = useStore.getState
  return (
    <div
      className={`group/rail absolute inset-y-0 right-full ${sectionMovable(slot.id) ? 'cursor-grab' : 'cursor-pointer'}`}
      style={{ width: 'calc(40px / var(--z))' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        st().focusSlot(slot.id)
        st().selectBlock(null)
        pressSection(slot.id, e)
      }}
      data-chrome
      title={sectionMovable(slot.id) ? `${TYPE_LABEL[slot.type]}: click to select, drag to move` : `${TYPE_LABEL[slot.type]}: click to select`}
    >
      {/* the rail's line, drawn in page space so it spans the whole section */}
      <div
        className={`absolute inset-y-[calc(4px/var(--z))] right-[calc(8px/var(--z))] rounded-full transition-colors ${focused ? 'bg-key' : 'bg-zinc-300 group-hover/row:bg-key/70 group-hover/rail:bg-key/70'}`}
        style={{ width: 'calc(2px / var(--z))' }}
      />
      {/* The label, at screen size, in exactly the height its section has on screen. A column that wraps into a clipped
          second column drops what doesn't fit whole, so a short section shows its number, then only its line. */}
      <div
        className="section-rail-label absolute right-[calc(14px/var(--z))] top-0 w-5 origin-top-right"
        style={{
          height: 'calc(100% * var(--z))',
          transform: 'scale(calc(1 / var(--z)))',
        }}
      >
        <div className="flex h-full w-5 flex-col flex-wrap content-start items-center gap-1.5 overflow-hidden pb-1 pt-3.5">
          <span className={`text-[11px] font-bold tabular-nums ${focused ? 'text-zinc-900' : 'text-zinc-400 group-hover/row:text-zinc-700'}`}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            className={`whitespace-nowrap text-[11.5px] font-semibold ${focused ? 'text-zinc-900' : 'text-zinc-500 group-hover/row:text-zinc-800'}`}
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {TYPE_LABEL[slot.type]}
          </span>
          {slot.locked && <Lock size={11} strokeWidth={2.4} className="text-key-ink" />}
        </div>
      </div>
    </div>
  )
}

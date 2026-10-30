import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, ArrowUpRight, Lock, LockOpen, Palette, PanelsTopLeft, Plus, Sparkles, Trash2, Type, Waves } from 'lucide-react'
import type { Keep, Slot, TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { GROUP_LABEL, primaryFamily } from '@/core/tokens'
import { library, slotClip } from '@/data/library'
import { Switch } from '../panels/parts'
import { updateSlotIn } from '@/core/site'
import { useStore, currentSlots } from '@/state/store'
import { MORPH } from '../shell/Island'
import { DeviceSwitch, SectionSpacingRows, useDevice } from '../blocks/Spacing'
import { SectionMotionRows } from '../blocks/MotionMenu'
import { useResolvedGuide } from '@/state/derived'
import { SURFACES, SURFACE_LABEL, surfaceTokens, SECTION_WIDTHS, SECTION_WIDTH_LABEL } from '@/core/surface'
import { runCommand } from '@/state/commands'
import { siteLibraryAvailable } from '@/lib/siteLibrary'

export const KEEPS: { key: keyof Keep; label: string; icon: typeof Type; on: string; off: string; n: number }[] = [
  { key: 'layout', label: 'Layout', icon: PanelsTopLeft, on: 'The agent reproduces this structure', off: 'Reference only; the agent may restructure it', n: 1 },
  { key: 'style', label: 'Style', icon: Palette, on: 'Keeps its own captured look', off: 'Uses your style guide', n: 2 },
  { key: 'content', label: 'Copy', icon: Type, on: 'Keeps the source copy', off: 'Your copy fills in', n: 3 },
  { key: 'motion', label: 'Motion', icon: Waves, on: 'Keeps the captured motion', off: 'Static', n: 4 },
]

type Tab = 'keep' | 'look' | 'source'

/**
 * A section's label, in two tiers: what it is (name, source, position) and the one
 * strong action (use its look). Everything else waits behind tabs that open only
 * when asked, so the card never gets tall.
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
  const st = useStore.getState

  // One open surface at a time: losing focus or opening a sheet folds the tabs.
  useEffect(() => {
    if (!focused || sheet !== 'none') setTab(null)
  }, [focused, sheet])

  if (!clip) return null
  const yours = KEEPS.filter((k) => (k.key === 'style' || k.key === 'content') && !slot.keep[k.key]).map((k) => k.label.toLowerCase())

  return (
    // Just below the section, like the block bar below a block: the section stays in view while you change it.
    <div className="absolute left-0 top-full z-30 origin-top-left" style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }} data-chrome>
      <motion.div
        layout
        transition={MORPH}
        style={{ borderRadius: 14 }}
        className={`glass-panel ml-3 mt-2.5 w-max overflow-hidden transition-opacity ${focused ? 'opacity-100' : 'opacity-75 group-hover/row:opacity-100'}`}
        onPointerDown={(e) => {
          e.stopPropagation()
          st().focusSlot(slot.id)
        }}
      >
        {/* one slim row: what it is, its tabs, its utilities, the one strong action */}
        <motion.div layout="position" transition={MORPH} className="flex h-10 items-center gap-1 pl-3 pr-1">
          <div
            className="mr-1 flex shrink-0 items-baseline gap-1.5 whitespace-nowrap"
            title={`${source?.name ?? ''}${yours.length ? ` · your ${yours.join(' & ')}` : ''}`}
          >
            <span className="text-[13.5px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]}</span>
            <span className="text-[11.5px] tabular-nums text-zinc-400">
              {pos}/{total}
            </span>
            {sharedOn > 0 && multi ? (
              <span className="rounded-full bg-key-soft px-1.5 py-px text-[10.5px] font-semibold text-key-ink" title="Edits here show on every page that shows it">
                Shared · {sharedOn}
              </span>
            ) : null}
          </div>
          {focused && (
            <>
              <span className="mx-0.5 h-4 w-px bg-zinc-950/10" />
              {(['keep', 'look', 'source'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-expanded={tab === k}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (tab !== k) st().setUi({ sheet: 'none' })
                    setTab(tab === k ? null : k)
                  }}
                  className={`h-7 cursor-pointer rounded-full px-2.5 text-[12px] font-medium transition-[background-color,color,scale] active:scale-[0.97] ${tab === k ? 'bg-well text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                  {k === 'keep' ? 'Keep' : k === 'look' ? 'Look' : 'Source'}
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-zinc-950/10" />
              <SurfaceDots slot={slot} />
              <span className="mx-0.5 h-4 w-px bg-zinc-950/10" />
              <WidthPicks slot={slot} />
              <span className="mx-0.5 h-4 w-px bg-zinc-950/10" />
              <Util label="Move up (⌥↑)" disabled={index === 0} onClick={() => st().moveSlot(slot.id, index - 1)}>
                <ArrowUp size={14} />
              </Util>
              <Util label="Move down (⌥↓)" disabled={index === count - 1} onClick={() => st().moveSlot(slot.id, index + 1)}>
                <ArrowDown size={14} />
              </Util>
              <Util
                label="Remove section (⌫)"
                disabled={count <= 1}
                danger
                onClick={() => {
                  st().removeSlot(slot.id)
                  st().showFlash(`Removed the ${TYPE_LABEL[slot.type].toLowerCase()} section`, { undo: true })
                }}
              >
                <Trash2 size={14} />
              </Util>
            </>
          )}
          <button
            type="button"
            aria-pressed={slot.locked}
            title={slot.locked ? 'Unlock (L): shuffle can change this section' : 'Lock (L): shuffle skips this section'}
            onClick={(e) => {
              e.stopPropagation()
              st().toggleLock(slot.id)
            }}
            className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-full transition active:scale-[0.97] ${slot.locked ? 'bg-key text-white' : 'text-zinc-500 hover:bg-zinc-950/5'}`}
          >
            {slot.locked ? <Lock size={13} strokeWidth={2.4} /> : <LockOpen size={13} />}
          </button>
          {focused && (
            <button
              type="button"
              title="Use this clip’s look as the style guide (P)"
              onClick={(e) => {
                e.stopPropagation()
                st().adoptClipDesign(slot.clipId)
                st().showFlash(`Style guide now follows ${source?.name}`, { undo: true })
              }}
              className="btn-lit ml-0.5 flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
            >
              <Sparkles size={12} /> Use look
            </button>
          )}
        </motion.div>

        <AnimatePresence initial={false} mode="popLayout">
          {focused && tab && (
            <motion.div
              key={tab}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.05, duration: 0.14 } }}
              exit={{ opacity: 0, transition: { duration: 0.06 } }}
              className="bg-well p-3"
            >
              {tab === 'keep' && <KeepTab slot={slot} />}
              {tab === 'look' && <LookTab slot={slot} />}
              {tab === 'source' && <SourceTab slot={slot} />}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function KeepTab({ slot }: { slot: Slot }) {
  const [hover, setHover] = useState<keyof Keep | null>(null)
  const st = useStore.getState
  const shown = KEEPS.find((k) => k.key === hover)
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {KEEPS.map((k) => {
          const on = slot.keep[k.key]
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={on}
              title={`${k.label} (${k.n})`}
              onMouseEnter={() => setHover(k.key)}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                st().toggleKeep(slot.id, k.key)
              }}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 transition active:scale-[0.97] ${on ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <k.icon size={16} />
              <span className="text-[11.5px] font-medium">{k.label}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 min-h-4 text-center text-[11.5px] text-zinc-500">
        {shown ? `${shown.label}: ${slot.keep[shown.key] ? shown.on : shown.off}` : 'Lit means kept from the clip. Off means yours.'}
      </p>
    </div>
  )
}

function LookTab({ slot }: { slot: Slot }) {
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
          <span style={{ fontFamily: t['font.display'], color: t['color.text'], fontWeight: Number(t['type.displayWeight']) }} className="text-[18px]">
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
            st().showFlash(`${source.name} is now a candidate for ${names}`, { undo: true })
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
            st().showFlash(`Style guide now uses ${source.name} for ${names}`, { undo: true })
          }}
          className="btn-quiet flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold"
        >
          <Sparkles size={14} /> Use just these
        </button>
      </div>
      {slot.type === 'nav' && <BannerRow slot={slot} />}
      <SpacingGroup slot={slot} />
      <div className="mt-3 border-t border-zinc-950/6 pt-3">
        <div className="mb-2 text-[11px] font-semibold text-zinc-400">Section motion</div>
        <SectionMotionRows slot={slot} />
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
    <div className="mt-3.5 border-t border-zinc-950/6 pt-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-400">
        Section spacing
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
          if (!on) setTimeout(() => {
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
          Clipped {new Date(clip.capture.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {clip.capture.viewport.width}px
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

/** The band the section sits on: one dot per surface, painted in what it would look like with your style guide. */
function SurfaceDots({ slot }: { slot: Slot }) {
  const tokens = useResolvedGuide().tokens
  const on = slot.surface ?? 'page'
  if (slot.keep.style) return null // a section keeping its own look keeps its own band
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Section surface">
      {SURFACES.map((sf) => {
        const t = surfaceTokens(tokens, sf)
        return (
          <button
            key={sf}
            type="button"
            role="radio"
            aria-checked={on === sf}
            title={`${SURFACE_LABEL[sf]} band`}
            onClick={(e) => {
              e.stopPropagation()
              useStore.getState().setSurface(slot.id, sf)
            }}
            className={`grid size-7 cursor-pointer place-items-center rounded-full transition-[background-color,scale] active:scale-[0.97] ${on === sf ? 'bg-zinc-950/[0.07]' : 'hover:bg-zinc-950/5'}`}
          >
            <span
              className={`grid size-4 place-items-center rounded-full ${on === sf ? 'ring-2 ring-zinc-900 ring-offset-1 ring-offset-transparent' : 'ring-1 ring-zinc-950/15'}`}
              style={{ background: t['color.bg'] }}
            >
              <span className="size-1.5 rounded-full" style={{ background: t['color.text'] }} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** How far the section's content runs: a frame per width, its bar as wide as the content would be. */
function WidthPicks({ slot }: { slot: Slot }) {
  const on = slot.width ?? 'standard'
  const bar = { narrow: 6, standard: 9, wide: 12, full: 14 } as const
  return (
    <div className="flex items-center" role="radiogroup" aria-label="Section width">
      {SECTION_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={on === w}
          title={`${SECTION_WIDTH_LABEL[w]} content`}
          onClick={(e) => {
            e.stopPropagation()
            useStore.getState().setSectionWidth(slot.id, w)
          }}
          className={`grid h-7 w-6 cursor-pointer place-items-center rounded-md transition-[background-color,scale] active:scale-[0.97] ${on === w ? 'bg-zinc-950/[0.07] text-zinc-900' : 'text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700'}`}
        >
          <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
            <rect x="0.5" y="0.5" width="15" height="11" rx="2" fill="none" stroke="currentColor" opacity="0.45" />
            <rect x={(16 - bar[w]) / 2} y="4" width={bar[w]} height="4" rx="1" fill="currentColor" />
          </svg>
        </button>
      ))}
    </div>
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
      className={`grid size-7 place-items-center rounded-full text-zinc-400 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-25 ${
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
export function SectionRail({ slot, index, focused }: { slot: Slot; index: number; focused: boolean }) {
  const st = useStore.getState
  return (
    <div
      className="group/rail absolute inset-y-0 right-full cursor-pointer"
      style={{ width: 'calc(40px / var(--z))' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        st().focusSlot(slot.id)
      }}
      data-chrome
      title={`${TYPE_LABEL[slot.type]}: click to work on this section`}
    >
      {/* the rail's line, drawn in page space so it spans the whole section */}
      <div
        className={`absolute inset-y-[calc(4px/var(--z))] right-[calc(8px/var(--z))] rounded-full transition-colors ${
          focused ? 'bg-key' : 'bg-zinc-300 group-hover/row:bg-key/70 group-hover/rail:bg-key/70'
        }`}
        style={{ width: 'calc(2px / var(--z))' }}
      />
      {/* the label, at screen size */}
      <div
        className="absolute right-[calc(14px/var(--z))] top-[calc(14px/var(--z))] origin-top-right"
        style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }}
      >
        <div className="flex w-5 flex-col items-center gap-1.5">
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

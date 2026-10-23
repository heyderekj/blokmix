import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Lock, LockOpen, Palette, PanelsTopLeft, Plus, Sparkles, Trash2, Type, Waves } from 'lucide-react'
import type { Keep, Slot, TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { GROUP_LABEL, primaryFamily } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { MORPH } from '../shell/Island'

export const KEEPS: { key: keyof Keep; label: string; icon: typeof Type; on: string; off: string; n: number }[] = [
  { key: 'layout', label: 'Layout', icon: PanelsTopLeft, on: 'The agent reproduces this structure', off: 'Reference only; the agent may restructure it', n: 1 },
  { key: 'style', label: 'Style', icon: Palette, on: 'Keeps its own captured look', off: 'Uses your style guide', n: 2 },
  { key: 'content', label: 'Copy', icon: Type, on: 'Keeps the source copy', off: 'Your copy fills in', n: 3 },
  { key: 'motion', label: 'Motion', icon: Waves, on: 'Keeps the captured motion', off: 'Static', n: 4 },
]

type Tab = 'keep' | 'look' | 'source'

/**
 * A track's label, in two tiers: what it is (name, source, position) and the one
 * strong action (use its look). Everything else waits behind tabs that open only
 * when asked, so the card never gets tall.
 */
export function TrackPill({ slot, index, count, focused, pos, total }: { slot: Slot; index: number; count: number; focused: boolean; pos: number; total: number }) {
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip?.sourceId ?? '']
  const sheet = useStore((s) => s.ui.sheet)
  const [tab, setTab] = useState<Tab | null>(null)
  const st = useStore.getState

  // One open surface at a time: losing focus or opening a sheet folds the tabs.
  useEffect(() => {
    if (!focused || sheet !== 'none') setTab(null)
  }, [focused, sheet])

  if (!clip) return null
  const yours = KEEPS.filter((k) => (k.key === 'style' || k.key === 'content') && !slot.keep[k.key]).map((k) => k.label.toLowerCase())

  return (
    <div className="absolute left-0 top-0 z-20 origin-top-left" style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }} data-chrome>
      <motion.div
        layout
        transition={MORPH}
        style={{ borderRadius: 16 }}
        className={`glass-panel m-2 overflow-hidden transition-opacity ${focused ? 'w-[420px] opacity-100' : 'w-fit opacity-75 group-hover/row:opacity-100'}`}
        onPointerDown={(e) => {
          e.stopPropagation()
          st().focusSlot(slot.id)
        }}
      >
        {/* tier 1: identity + one action */}
        <motion.div layout="position" transition={MORPH} className="flex items-center gap-2 py-2 pl-3 pr-2">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-tight text-zinc-900">{TYPE_LABEL[slot.type]}</div>
            <div className="truncate text-[12px] text-zinc-500">
              {source?.name} · {pos} of {total}
              {yours.length ? <span className="text-zinc-400"> · your {yours.join(' & ')}</span> : null}
            </div>
          </div>
          <button
            type="button"
            aria-pressed={slot.locked}
            title={slot.locked ? 'Unlock (L): shuffle can change this section' : 'Lock (L): shuffle skips this section'}
            onClick={(e) => {
              e.stopPropagation()
              st().toggleLock(slot.id)
            }}
            className={`grid size-8 shrink-0 place-items-center rounded-full transition active:scale-[0.97] ${slot.locked ? 'bg-key text-key-ink' : 'text-zinc-500 hover:bg-zinc-950/5'}`}
          >
            {slot.locked ? <Lock size={14} strokeWidth={2.4} /> : <LockOpen size={14} />}
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
              className="btn-lit flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold"
            >
              <Sparkles size={13} /> Use look
            </button>
          )}
        </motion.div>

        {/* tier 2: tabs on the left, track utilities on the right */}
        {focused && (
          <motion.div layout="position" transition={MORPH} className="flex items-end gap-0.5 border-t border-zinc-950/6 px-2 pt-1.5">
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
                className={`h-8 rounded-t-lg px-3 text-[12.5px] font-medium transition ${tab === k ? 'bg-well text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                {k === 'keep' ? 'Keep' : k === 'look' ? 'Look' : 'Source'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-0.5 pb-1">
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
            </div>
          </motion.div>
        )}

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
              {promoted.has(g) && <span className="size-1.5 rounded-full bg-tape" title="Already a candidate" />}
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
    </div>
  )
}

function SourceTab({ slot }: { slot: Slot }) {
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip.sourceId]
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
 * A track's label at rest lives off the page, in the gutter on its left: a
 * quiet rail with the number and name, so the design itself is never covered.
 */
export function TrackRail({ slot, index, focused }: { slot: Slot; index: number; focused: boolean }) {
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
      {/* the rail's line, drawn in page space so it spans the whole track */}
      <div
        className={`absolute inset-y-[calc(4px/var(--z))] right-[calc(8px/var(--z))] rounded-full transition-colors ${
          focused ? 'bg-tape' : 'bg-zinc-300 group-hover/row:bg-tape/70 group-hover/rail:bg-tape/70'
        }`}
        style={{ width: 'calc(2px / var(--z))' }}
      />
      {/* the label, at screen size */}
      <div
        className="absolute right-[calc(14px/var(--z))] top-[calc(6px/var(--z))] origin-top-right"
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

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, CircleHelp, Moon, Package, Redo2, RotateCcw, Sun, Undo2, X } from 'lucide-react'
import { useStore as useZustand } from 'zustand'
import { useStore, undo, redo, type Sheet } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'
import { openGroups } from '@/core/guide'
import { pressVersionAndFly } from '@/lib/actions'
import { GuidePanel } from '../panels/GuidePanel'
import { CopyPanel } from '../panels/CopyPanel'
import { PacketPanel } from '../panels/PacketPanel'
import { Divider, Island, MORPH } from './Island'
import { LogoTile } from './Logo'

export const toggleSheet = (s: Sheet) => {
  const st = useStore.getState()
  st.setUi({ sheet: st.ui.sheet === s ? 'none' : s })
}

/** Three islands across the top. Each one grows into the panel it controls. */
export function TopBar({ onHelp }: { onHelp: () => void }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-start gap-2 p-3">
      <div className="flex min-w-0 justify-start">
        <BrandIsland onHelp={onHelp} />
      </div>
      <ModeIsland />
      <div className="flex min-w-0 justify-end">
        <ShipIsland />
      </div>
    </header>
  )
}

/** Logo + tape name; grows into the small app menu. */
function BrandIsland({ onHelp }: { onHelp: () => void }) {
  const open = useStore((s) => s.ui.sheet === 'menu')
  const tapeName = useStore((s) => s.tapeName)
  const theme = useStore((s) => s.ui.theme)
  const st = useStore.getState
  return (
    <Island
      open={open}
      width={300}
      bar={
        <>
          <button type="button" onClick={() => toggleSheet('menu')} className="ml-0.5 rounded-lg transition active:scale-[0.97]" title="Menu" aria-label="Menu">
            <LogoTile size={30} />
          </button>
          <span className="pl-1.5 text-[15px] font-semibold tracking-tight text-zinc-900 max-lg:hidden">Mixtape</span>
          <span className="px-0.5 text-zinc-300 max-lg:hidden">/</span>
          <span className="max-md:hidden">
            <TapeName value={tapeName} onChange={(v) => st().renameTape(v)} />
          </span>
          {open && (
            <button
              type="button"
              onClick={() => toggleSheet('menu')}
              aria-label="Close menu"
              className="ml-auto grid size-8 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900"
            >
              <X size={15} />
            </button>
          )}
        </>
      }
    >
      <div className="p-1.5">
        <div className="px-2.5 pb-1 pt-1.5 md:hidden">
          <TapeName value={tapeName} onChange={(v) => st().renameTape(v)} />
        </div>
        <MenuItem icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Light chrome' : 'Dark chrome'} onClick={() => st().setUi({ theme: theme === 'dark' ? 'light' : 'dark' })} />
        <MenuItem
          icon={CircleHelp}
          label="Keyboard shortcuts"
          kbd="?"
          onClick={() => {
            st().setUi({ sheet: 'none' })
            onHelp()
          }}
        />
        <MenuItem
          icon={RotateCcw}
          label="Reset the demo tape"
          onClick={() => {
            st().resetDemo()
            st().showFlash('Demo tape reset', { undo: true })
          }}
        />
      </div>
    </Island>
  )
}

/** Captured / Unified. Unified means "your style and your copy", so this is where both are edited. */
function ModeIsland() {
  const open = useStore((s) => s.ui.sheet === 'guide')
  const mode = useStore((s) => s.ui.mode)
  const tab = useStore((s) => s.ui.guideTab)
  const decisions = openGroups(useResolvedGuide()).length
  const st = useStore.getState
  return (
    <Island
      open={open}
      width={440}
      bar={
        <>
          <Segmented
            value={mode}
            options={[
              { value: 'captured', label: 'Captured', title: 'Every section exactly as clipped (U)' },
              { value: 'unified', label: 'Unified', title: 'Your style guide and copy applied (U)' },
            ]}
            onChange={(v) => st().setUi({ mode: v })}
          />
          <button
            type="button"
            onClick={() => toggleSheet('guide')}
            title="Style & copy (G)"
            aria-expanded={open}
            className={`flex h-8 items-center gap-1.5 rounded-full pl-2 pr-1.5 text-[13px] font-medium transition active:scale-[0.97] ${
              decisions && !open ? 'bg-attention-soft text-attention-ink' : 'text-zinc-700 hover:bg-zinc-950/5'
            }`}
          >
            {decisions && !open ? (
              <>
                <span className="grid size-[18px] place-items-center rounded-full bg-attention text-[10.5px] font-bold text-white">{decisions}</span>
                <span className="max-md:hidden">to decide</span>
              </>
            ) : (
              <span className="pl-0.5">Style & copy</span>
            )}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={MORPH} className="grid">
              <ChevronDown size={15} />
            </motion.span>
          </button>
        </>
      }
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-950/5 bg-[color-mix(in_srgb,var(--lift)_80%,transparent)] px-4 py-2.5 backdrop-blur">
        <Segmented
          value={tab}
          options={[
            { value: 'style', label: 'Style guide', badge: decisions || undefined },
            { value: 'copy', label: 'Your copy' },
          ]}
          onChange={(v) => st().setUi({ guideTab: v })}
        />
      </div>
      {tab === 'style' ? <GuidePanel /> : <CopyPanel />}
    </Island>
  )
}

/** Undo, press a version, hand off. Hand off grows into the packet. */
function ShipIsland() {
  const open = useStore((s) => s.ui.sheet === 'packet')
  const canUndo = useZustand(useStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useZustand(useStore.temporal, (s) => s.futureStates.length > 0)
  return (
    <Island
      open={open}
      width={420}
      maxBody="min(76vh, 720px)"
      bar={
        <>
          <IconButton title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
            <Undo2 size={16} />
          </IconButton>
          <IconButton title="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
            <Redo2 size={16} />
          </IconButton>
          <Divider />
          <button
            type="button"
            onClick={() => toggleSheet('packet')}
            title="Hand off: the packet for your agent"
            aria-expanded={open}
            className={`flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition active:scale-[0.97] ${
              open ? 'bg-zinc-950/5 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-950/5'
            }`}
          >
            <Package size={15} />
            <span className="max-lg:hidden">Hand off</span>
          </button>
          <button
            type="button"
            onClick={() => pressVersionAndFly()}
            title="Press a version from the working mix (Enter)"
            className="btn-lit group ml-0.5 flex h-8 items-center gap-2 rounded-full pl-2.5 pr-3 text-[13px] font-semibold"
          >
            <span className="relative grid size-3.5 place-items-center">
              <span className="absolute inset-0 rounded-full bg-key-ink/25 group-hover:animate-ping" />
              <span className="size-2.5 rounded-full bg-key-ink" />
            </span>
            Press<span className="-ml-1 max-xl:hidden"> version</span>
          </button>
        </>
      }
    >
      <PacketPanel />
    </Island>
  )
}

function MenuItem({ icon: Icon, label, onClick, kbd }: { icon: typeof Sun; label: string; onClick: () => void; kbd?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-950/5 hover:text-zinc-900"
    >
      <Icon size={16} className="text-zinc-500" />
      <span className="flex-1">{label}</span>
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  )
}

function TapeName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() ? onChange(v.trim()) : setV(value))}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="rounded-lg bg-transparent px-1.5 py-1 text-[14px] font-medium text-zinc-500 outline-none transition hover:bg-zinc-950/5 focus:bg-zinc-950/5 focus:text-zinc-900"
      style={{ fieldSizing: 'content', minWidth: 60, maxWidth: 220 } as React.CSSProperties}
      aria-label="Tape name"
    />
  )
}

export function IconButton({ children, title, onClick, disabled, active }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 shrink-0 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30 ${
        active ? 'bg-zinc-950/5 text-zinc-900' : ''
      }`}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: React.ReactNode; title?: string; badge?: number }[]
  onChange: (v: T) => void
}) {
  const group = options.map((x) => x.value).join('-')
  return (
    <div className="relative flex h-8 shrink-0 items-center gap-0.5 rounded-lg bg-well p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition active:scale-[0.97] ${
            value === o.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {value === o.value && <motion.span layoutId={`seg-${group}`} transition={MORPH} className="absolute inset-0 rounded-md bg-lift shadow-sm" />}
          <span className="relative flex items-center gap-1.5">
            {o.label}
            {o.badge ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-attention px-1 text-[10px] font-bold text-white">{o.badge}</span> : null}
          </span>
        </button>
      ))}
    </div>
  )
}

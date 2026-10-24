import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { router } from '@inertiajs/react'
import { Bot, CircleHelp, Eye, LayoutGrid, LogOut, Users, MessageSquare, Moon, Package, Redo2, RotateCcw, Sun, SwatchBook, Undo2 } from 'lucide-react'
import { useStore, undo, redo, type Sheet } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'
import { openGroups } from '@/core/guide'
import { pressVersionAndFly } from '@/lib/actions'
import { GuidePanel } from '../panels/GuidePanel'
import { ContentPanel } from '../panels/ContentPanel'
import { PacketPanel } from '../panels/PacketPanel'
import { NotesPanel } from '../panels/NotesPanel'
import { outstanding } from '@/core/notes'
import { Divider, Island, MORPH } from './Island'
import { Avatar } from './Avatar'
import { Presence } from './Dock'
import { useMe } from '@/lib/people'
import { useAgentLink } from '@/lib/agentLink'
import { Switch } from '../panels/parts'
import { isHosted } from '@/lib/host'
import { canEdit, useAccount } from '@/lib/account'
import { flushMix } from '@/lib/mixSync'
import { SharePanel } from '../panels/SharePanel'
import { PagesPanel, PageSwitch } from './PagesMenu'
import { Lockup } from '../brand/Wordmark'
import { BrandIcon } from '../brand/BrandIcon'
import { SaveState } from './SaveState'

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

/** Logo + mix name; grows into the small app menu. */
function BrandIsland({ onHelp }: { onHelp: () => void }) {
  const sheet = useStore((s) => s.ui.sheet)
  const open = sheet === 'menu' || sheet === 'pages'
  const mixName = useStore((s) => s.mixName)
  const theme = useStore((s) => s.ui.theme)
  const st = useStore.getState
  return (
    <Island
      open={open}
      width={sheet === 'pages' ? 340 : 300}
      onClose={() => useStore.getState().setUi({ sheet: 'none' })}
      bar={
        <>
          <button
            type="button"
            onClick={() => toggleSheet('menu')}
            className="flex h-8 cursor-pointer items-center rounded-lg px-1.5 text-zinc-900 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97]"
            title="Menu"
            aria-label="Blokmix menu"
            aria-expanded={sheet === 'menu'}
          >
            <Lockup height={18} className="max-lg:hidden" />
            <span className="lg:hidden">
              <BrandIcon size={22} />
            </span>
          </button>
          <span className="px-0.5 text-zinc-300 max-lg:hidden">/</span>
          <span className="max-md:hidden">
            <MixName value={mixName} onChange={(v) => st().renameMix(v)} />
          </span>
          <span className="px-0.5 text-zinc-300 max-md:hidden">/</span>
          <PageSwitch />
          <SaveState />
        </>
      }
    >
      {sheet === 'pages' ? (
        <PagesPanel />
      ) : (
        <div className="p-1.5">
        <AccountRow />
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
        {isHosted() && (
          <>
            <MenuItem icon={LayoutGrid} label="All mixes" onClick={() => (st().setUi({ sheet: 'none' }), router.visit('/mixes'))} />
            <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
          </>
        )}
        <MenuItem icon={Undo2} label="Undo" kbd="⌘Z" onClick={undo} />
        <MenuItem icon={Redo2} label="Redo" kbd="⇧⌘Z" onClick={redo} />
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
        <div className="px-2.5 pb-1 pt-1.5 md:hidden">
          <MixName value={mixName} onChange={(v) => st().renameMix(v)} />
        </div>
        <AgentAccess />
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
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
          label="Reset the demo mix"
          onClick={() => {
            st().resetDemo()
            st().showFlash('Demo mix reset', { undo: true })
          }}
        />
        </div>
      )}
    </Island>
  )
}

/** Let a local agent (Claude Code over MCP) edit this mix, with what it's doing in plain view. */
function AgentAccess() {
  const on = useStore((s) => s.ui.agentAccess)
  const status = useAgentLink((s) => s.status)
  const last = useAgentLink((s) => s.lastCommand)
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-2.5 py-2">
      <Bot size={16} className="mt-0.5 shrink-0 text-agent" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-800">Let agents edit this mix</div>
        <div className="text-[11.5px] leading-snug text-zinc-500">
          {!on
            ? 'Claude Code and other MCP agents can use every tool you can.'
            : status === 'connected'
              ? `Connected${last ? ` · last: ${last.replace(/_/g, ' ')}` : ''}`
              : 'Waiting for the bridge: run npm run mcp, or add it to Claude Code.'}
        </div>
      </div>
      <Switch on={on} onChange={() => useStore.getState().setUi({ agentAccess: !on })} label="Let agents edit this mix" />
    </div>
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
      anchor="center"
      onClose={() => useStore.getState().setUi({ sheet: 'none' })}
      bar={
        <>
          <Segmented
            value={mode}
            options={[
              { value: 'captured', label: 'Original', title: 'Every section exactly as it was clipped (U)' },
              { value: 'unified', label: 'Your style', title: 'Your style guide and copy applied to every section (U)' },
            ]}
            onChange={(v) => st().setUi({ mode: v })}
          />
          <Divider />
          <button
            type="button"
            onClick={() => toggleSheet('guide')}
            title={decisions ? `Style guide: ${decisions} choice${decisions > 1 ? 's' : ''} to make (G)` : 'Style guide and content (G)'}
            aria-label={decisions ? `Style guide, ${decisions} to decide` : 'Style guide'}
            aria-expanded={open}
            className={`relative flex h-8 items-center rounded-full px-2 transition-colors active:scale-[0.97] ${
              open ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'
            }`}
          >
            <SwatchBook size={16} className="shrink-0" />
            {/* Opened, the icon grows into a labelled button so the panel is named. */}
            <AnimatePresence initial={false}>
              {open && (
                <motion.span
                  key="label"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1, transition: { width: MORPH, opacity: { delay: 0.06, duration: 0.14 } } }}
                  exit={{ width: 0, opacity: 0, transition: { width: { type: 'spring', stiffness: 700, damping: 56 }, opacity: { duration: 0.06 } } }}
                  className="overflow-hidden whitespace-nowrap text-[13px] font-medium"
                >
                  <span className="block pl-1.5 pr-0.5">Style guide</span>
                </motion.span>
              )}
            </AnimatePresence>
            {decisions > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-attention ring-2 ring-[var(--lift)]" style={open ? { right: 'auto', left: 18 } : undefined} />}
          </button>
        </>
      }
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-950/5 bg-[color-mix(in_srgb,var(--lift)_80%,transparent)] px-4 py-2.5 backdrop-blur">
        <Segmented
          value={tab}
          options={[
            { value: 'style', label: 'Style', badge: decisions || undefined },
            { value: 'content', label: 'Content' },
          ]}
          onChange={(v) => st().setUi({ guideTab: v })}
        />
      </div>
      {tab === 'style' ? <GuidePanel /> : <ContentPanel />}
    </Island>
  )
}

/** Export and Save version. Export grows into the packet for your agent. */
function ShipIsland() {
  const sheet = useStore((s) => s.ui.sheet)
  const open = sheet === 'packet' || sheet === 'notes' || sheet === 'share'
  const role = useAccount((s) => s.role)
  const notes = useStore((s) => s.notes)
  const todo = notes.filter(outstanding).length
  return (
    <Island
      open={open}
      width={420}
      anchor="right"
      onClose={() => useStore.getState().setUi({ sheet: 'none' })}
      maxBody="min(76vh, 720px)"
      bar={
        <>
          <Presence />
          <button
            type="button"
            onClick={() => toggleSheet('notes')}
            title={todo ? `${todo} note${todo > 1 ? 's' : ''} to do` : 'Notes'}
            aria-expanded={sheet === 'notes'}
            className={`relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition active:scale-[0.97] ${
              sheet === 'notes' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'
            }`}
          >
            <MessageSquare size={15} />
            {todo > 0 && <span className={`min-w-4 rounded-full px-1 text-[11px] font-bold tabular-nums ${sheet === 'notes' ? 'bg-white/20' : 'bg-problem text-white'}`}>{todo}</span>}
          </button>
          <button
            type="button"
            onClick={() => toggleSheet('packet')}
            title="Export code for your agent: Astro or Next.js"
            aria-expanded={sheet === 'packet'}
            className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition active:scale-[0.97] ${
              sheet === 'packet' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'
            }`}
          >
            <Package size={15} />
            Export
          </button>
          {isHosted() && (
            <button
              type="button"
              onClick={() => toggleSheet('share')}
              title="Share this mix"
              aria-expanded={sheet === 'share'}
              className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition active:scale-[0.97] ${
                sheet === 'share' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'
              }`}
            >
              <Users size={15} />
              Share
            </button>
          )}
          {canEdit(role) ? (
            <button
              type="button"
              onClick={() => pressVersionAndFly()}
              title="Save the working mix as a new version (⌘S)"
              className="btn-lit ml-0.5 flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold"
            >
              Save version
            </button>
          ) : (
            <span className="ml-0.5 flex h-8 items-center gap-1.5 rounded-full bg-zinc-950/5 px-3 text-[12.5px] font-semibold text-zinc-600" title="You can look and leave marks">
              <Eye size={14} /> View only
            </span>
          )}
        </>
      }
    >
      {sheet === 'notes' ? <NotesPanel /> : sheet === 'share' ? <SharePanel /> : <PacketPanel />}
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

function MixName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      aria-label="Mix name"
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

/** Signed in: who you are, and signing out. Otherwise, the name your marks carry. */
function AccountRow() {
  const user = useAccount((s) => s.user)
  const me = useMe()
  if (!user) return <NameField />
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
      <Avatar who={me} size={24} ring={false} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-zinc-900">{user.name}</span>
        <span className="block truncate text-[11.5px] text-zinc-400">{user.email}</span>
      </span>
      <button
        type="button"
        title="Sign out"
        aria-label="Sign out"
        onClick={() => void flushMix().finally(() => router.post('/logout'))}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-500 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
      >
        <LogOut size={15} />
      </button>
    </div>
  )
}

/** Your name drives your monogram on versions and in the dock (first and last initials). */
function NameField() {
  const name = useStore((s) => s.ui.myName)
  const me = useMe()
  return (
    <label className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
      <Avatar who={me} size={24} ring={false} />
      <input
        value={name}
        onChange={(e) => useStore.getState().setUi({ myName: e.target.value })}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        placeholder="Your name"
        className="h-8 min-w-0 flex-1 rounded-lg bg-well px-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/15"
        aria-label="Your name"
      />
    </label>
  )
}

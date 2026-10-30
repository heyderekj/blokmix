import { useEffect, useState, type ReactNode } from 'react'
import { confirmAction } from './Confirm'
import { motion } from 'motion/react'
import { router } from '@inertiajs/react'
import { Bot, ChevronLeft, ChevronRight, CircleHelp, Download, Eye, FileText, LayoutGrid, LogOut, MoreHorizontal, Upload, MessageSquare, Moon, Package, Redo2, RotateCcw, Sparkles, Sun, SwatchBook, Undo2, Users, X } from 'lucide-react'
import { useStore, undo, redo, STORAGE_KEY, type Sheet } from '@/state/store'
import { downloadMix, readMixFile, replaceLocalMix } from '@/lib/mixFile'
import { pickFile } from '@/lib/pickFile'
import { useResolvedGuide } from '@/state/derived'
import { openGroups } from '@/core/guide'
import { pressVersionAndFly } from '@/lib/actions'
import { GuidePanel } from '../panels/GuidePanel'
import { ContentPanel } from '../panels/ContentPanel'
import { PacketPanel } from '../panels/PacketPanel'
import { NotesPanel } from '../panels/NotesPanel'
import { outstanding } from '@/core/notes'
import { Island, MORPH } from './Island'
import { Avatar } from './Avatar'
import { Presence } from './Dock'
import { useMe } from '@/lib/people'
import { useAgentLink } from '@/lib/agentLink'
import { Switch } from '../panels/parts'
import { isHosted } from '@/lib/host'
import { canEdit, useAccount } from '@/lib/account'
import { flushMix, openMixId } from '@/lib/mixSync'
import { useStartFlow } from '../start/StartFlow'
import { SharePanel } from '../panels/SharePanel'
import { PagesPanel, PageSwitch } from './PagesMenu'
import { Wordmark } from '../brand/Wordmark'
import { BrandIcon } from '../brand/BrandIcon'
import { SaveState } from './SaveState'

export const toggleSheet = (s: Sheet) => {
  const st = useStore.getState()
  st.setUi({ sheet: st.ui.sheet === s ? 'none' : s })
}

/** Below this width the three islands don't fit side by side: the bar folds into one (CompactBar). */
const WIDE_BAR = '(min-width: 1120px)'

function useWideBar() {
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia(WIDE_BAR).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE_BAR)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

/**
 * Three islands across the top: where you are, your tools, what you do with the mix. Each grows into its panel.
 * On narrower windows and phones they fold into one compact bar.
 */
export function TopBar({ onHelp }: { onHelp: () => void }) {
  const wide = useWideBar()
  if (!wide)
    return (
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start p-3">
        <CompactBar onHelp={onHelp} />
      </header>
    )
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-start gap-2 p-3">
      <div className="flex min-w-0 justify-start">
        <BrandIsland onHelp={onHelp} />
      </div>
      <ToolsIsland />
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
            <Wordmark height={17} className="max-lg:hidden" />
            <span className="lg:hidden">
              <BrandIcon size={28} />
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
      {sheet === 'pages' ? <PagesPanel /> : <AppMenu onHelp={onHelp} />}
    </Island>
  )
}

/** Save version (or, for viewers, a note that they can only look). `short` for the compact bar. */
function SaveButton({ short }: { short?: boolean }) {
  const role = useAccount((s) => s.role)
  if (!canEdit(role))
    return (
      <span className="ml-0.5 flex h-8 items-center gap-1.5 rounded-full bg-zinc-950/5 px-3 text-[12.5px] font-semibold text-zinc-600" title="You can look and leave marks">
        <Eye size={14} /> {short ? 'View' : 'View only'}
      </span>
    )
  return (
    <button
      type="button"
      onClick={() => pressVersionAndFly()}
      title="Save the working mix as a new version (⌘S)"
      className="btn-lit ml-0.5 flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold"
    >
      {short ? 'Save' : 'Save version'}
    </button>
  )
}

const COMPACT_SHEETS: Sheet[] = ['menu', 'pages', 'more', 'guide', 'notes', 'packet', 'share']

/**
 * The top bar on narrower windows and phones: one pill with the logo menu, the page, ⋯ and Save. ⋯ lists Style guide,
 * Content, Notes, Share and Export; each opens in the same pill, with a way back to the list.
 */
function CompactBar({ onHelp }: { onHelp: () => void }) {
  const sheet = useStore((s) => s.ui.sheet)
  const tab = useStore((s) => s.ui.guideTab)
  const mode = useStore((s) => s.ui.mode)
  const todo = useStore((s) => s.notes.filter(outstanding).length)
  const decisions = openGroups(useResolvedGuide()).length
  const st = useStore.getState
  const open = COMPACT_SHEETS.includes(sheet)
  const inTool = sheet === 'guide' || sheet === 'notes' || sheet === 'packet' || sheet === 'share'
  const attention = decisions > 0 || todo > 0 || mode === 'captured'
  const row = (Icon: typeof Sun, label: string, onClick: () => void, extra?: ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[14px] font-medium text-zinc-800 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.99]"
    >
      <Icon size={17} className="shrink-0 text-zinc-500" />
      <span className="flex-1">{label}</span>
      {extra}
      <ChevronRight size={15} className="shrink-0 text-zinc-300" />
    </button>
  )
  const back = (label: string) => (
    <button
      type="button"
      onClick={() => st().setUi({ sheet: 'more' })}
      className="flex h-9 cursor-pointer items-center gap-1 px-3 text-[12.5px] font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
    >
      <ChevronLeft size={14} /> {label}
    </button>
  )
  return (
    <Island
      open={open}
      width={sheet === 'menu' ? 320 : 440}
      maxBody="min(76vh, 720px)"
      className="max-w-[calc(100vw-24px)]"
      onClose={() => st().setUi({ sheet: 'none' })}
      bar={
        <>
          <button
            type="button"
            onClick={() => toggleSheet('menu')}
            className="flex h-8 cursor-pointer items-center rounded-lg px-1 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97]"
            title="Menu"
            aria-label="Blokmix menu"
            aria-expanded={sheet === 'menu'}
          >
            <BrandIcon size={28} />
          </button>
          <PageSwitch />
          <SaveState />
          <button
            type="button"
            onClick={() => toggleSheet('more')}
            title="Style guide, content, notes, share and export"
            aria-label="Tools"
            aria-expanded={sheet === 'more' || inTool}
            className={`relative ml-1 grid size-8 cursor-pointer place-items-center rounded-full transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${
              sheet === 'more' || inTool ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'
            }`}
          >
            <MoreHorizontal size={17} />
            {attention && <span className="absolute right-1 top-1 size-2 rounded-full bg-attention ring-2 ring-white" aria-hidden />}
          </button>
          <SaveButton short />
        </>
      }
    >
      {sheet === 'menu' ? (
        <AppMenu onHelp={onHelp} showName />
      ) : sheet === 'pages' ? (
        <PagesPanel />
      ) : sheet === 'more' ? (
        <div className="p-1.5">
          {mode === 'captured' && (
            <button
              type="button"
              onClick={() => st().setUi({ mode: 'unified', sheet: 'none' })}
              className="mb-1 flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl bg-attention-soft px-3 text-left text-[13.5px] font-semibold text-attention-ink active:scale-[0.99]"
            >
              <X size={16} /> Showing as clipped: back to your style
            </button>
          )}
          {row(SwatchBook, 'Style guide', () => st().setUi({ sheet: 'guide', guideTab: 'style' }), decisions > 0 ? <span className="text-[12px] font-semibold text-attention-ink">{decisions} to decide</span> : undefined)}
          {row(FileText, 'Content', () => st().setUi({ sheet: 'guide', guideTab: 'content' }))}
          {row(MessageSquare, 'Notes', () => st().setUi({ sheet: 'notes' }), todo > 0 ? <span className="min-w-5 rounded-full bg-problem px-1.5 text-center text-[11px] font-bold tabular-nums text-white">{todo}</span> : undefined)}
          <div className="mx-3 my-1 h-px bg-zinc-950/6" />
          {isHosted() && row(Users, 'Share', () => st().setUi({ sheet: 'share' }), <Presence size={22} inline />)}
          {row(Package, 'Export for your agent', () => st().setUi({ sheet: 'packet' }))}
        </div>
      ) : (
        <>
          {back(sheet === 'guide' ? (tab === 'style' ? 'Style guide' : 'Content') : sheet === 'notes' ? 'Notes' : sheet === 'share' ? 'Share' : 'Export')}
          {sheet === 'notes' ? <NotesPanel /> : sheet === 'share' ? <SharePanel /> : sheet === 'packet' ? <PacketPanel /> : tab === 'style' ? <GuidePanel /> : <ContentPanel />}
        </>
      )}
    </Island>
  )
}

/** The logo's menu: your account, the mix as a file, undo, agents, theme, shortcuts. */
function AppMenu({ onHelp, showName }: { onHelp: () => void; showName?: boolean }) {
  const mixName = useStore((s) => s.mixName)
  const theme = useStore((s) => s.ui.theme)
  const st = useStore.getState
  return (
        <div className="p-1.5">
        <AccountRow />
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
        {isHosted() && (
          <>
            <MenuItem icon={LayoutGrid} label="All mixes" onClick={() => (st().setUi({ sheet: 'none' }), router.visit('/'))} />
            <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
          </>
        )}
        <MenuItem icon={Download} label="Export mix as a file" onClick={() => (st().setUi({ sheet: 'none' }), downloadMix())} />
        {!isHosted() && (
          <MenuItem
            icon={Upload}
            label="Import a mix file…"
            onClick={() =>
              pickFile('.json,application/json', async (f) => {
                try {
                  const file = await readMixFile(f)
                  if (file.clips?.length) return st().showFlash('This mix uses captured clips, which need an account: import it on your Blokmix mixes page.')
                  const ok = await confirmAction({
                    title: `Replace this mix with “${file.name}”?`,
                    body: 'The mix in this browser is replaced. Export it first if you want to keep it.',
                    confirm: 'Replace',
                    tone: 'caution',
                  })
                  if (ok) replaceLocalMix(file, STORAGE_KEY)
                } catch (e) {
                  st().showFlash(e instanceof Error ? e.message : String(e))
                }
              })
            }
          />
        )}
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
        <MenuItem icon={Undo2} label="Undo" kbd="⌘Z" onClick={undo} />
        <MenuItem icon={Redo2} label="Redo" kbd="⇧⌘Z" onClick={redo} />
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
        <div className={`px-2.5 pb-1 pt-1.5 ${showName ? '' : 'md:hidden'}`}>
          <MixName value={mixName} onChange={(v) => st().renameMix(v)} />
        </div>
        <AgentAccess />
        <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
        <MenuItem icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={() => st().setUi({ theme: theme === 'dark' ? 'light' : 'dark' })} />
        <MenuItem
          icon={CircleHelp}
          label="Keyboard shortcuts"
          kbd="?"
          onClick={() => {
            st().setUi({ sheet: 'none' })
            onHelp()
          }}
        />
        {(!isHosted() || openMixId() === 'local') && <MenuItem icon={Sparkles} label="Start a new mix" onClick={() => {
          st().setUi({ sheet: 'none' })
          useStartFlow.setState({ open: true })
        }} />}
        <MenuItem
          icon={RotateCcw}
          label="Reset the demo mix"
          onClick={() => {
            st().resetDemo()
            st().showFlash('Demo mix reset', { undo: true })
          }}
        />
        </div>
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

/**
 * Your tools: the style guide, the page's words and collections, and notes. Each grows into its panel. Whether the
 * canvas shows sections as clipped or in your style lives in the View menu (U); while it shows originals, a chip here
 * says so and takes you back.
 */
function ToolsIsland() {
  const sheet = useStore((s) => s.ui.sheet)
  const tab = useStore((s) => s.ui.guideTab)
  const mode = useStore((s) => s.ui.mode)
  const notes = useStore((s) => s.notes)
  const todo = notes.filter(outstanding).length
  const decisions = openGroups(useResolvedGuide()).length
  const open = sheet === 'guide' || sheet === 'notes'
  const st = useStore.getState
  const at = (which: 'style' | 'content' | 'notes') => (which === 'notes' ? sheet === 'notes' : sheet === 'guide' && tab === which)
  const go = (which: 'style' | 'content' | 'notes') => {
    if (at(which)) return st().setUi({ sheet: 'none' })
    st().setUi(which === 'notes' ? { sheet: 'notes' } : { sheet: 'guide', guideTab: which })
  }
  const tool = (which: 'style' | 'content' | 'notes', Icon: typeof Sun, label: string, title: string, badge?: ReactNode) => (
    <button
      type="button"
      onClick={() => go(which)}
      title={title}
      aria-expanded={at(which)}
      className={`relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${
        at(which) ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'
      }`}
    >
      <Icon size={15} className="shrink-0" />
      {label}
      {badge}
    </button>
  )
  return (
    <Island
      open={open}
      width={440}
      anchor="center"
      onClose={() => useStore.getState().setUi({ sheet: 'none' })}
      bar={
        <>
          {mode === 'captured' && (
            <button
              type="button"
              onClick={() => st().setUi({ mode: 'unified' })}
              title="The canvas shows every section as it was clipped. Back to your style (U)"
              aria-label="Showing sections as clipped. Back to your style"
              className="mr-0.5 flex h-8 cursor-pointer items-center gap-1 rounded-full bg-attention-soft pl-3 pr-2 text-[12.5px] font-semibold text-attention-ink transition-[scale] active:scale-[0.97]"
            >
              As clipped <X size={13} strokeWidth={2.4} />
            </button>
          )}
          {tool('style', SwatchBook, 'Style', decisions ? `Style guide: ${decisions} choice${decisions > 1 ? 's' : ''} to make (G)` : 'Style guide (G)', decisions > 0 ? <span className="size-2 rounded-full bg-attention" aria-label={`${decisions} to decide`} /> : undefined)}
          {tool('content', FileText, 'Content', 'The page’s words and your collections')}
          {tool(
            'notes',
            MessageSquare,
            'Notes',
            todo ? `${todo} note${todo > 1 ? 's' : ''} to do` : 'Notes',
            todo > 0 ? <span className={`min-w-4 rounded-full px-1 text-[11px] font-bold tabular-nums ${at('notes') ? 'bg-white/20' : 'bg-problem text-white'}`}>{todo}</span> : undefined,
          )}
        </>
      }
    >
      {sheet === 'notes' ? <NotesPanel /> : tab === 'style' ? <GuidePanel /> : <ContentPanel />}
    </Island>
  )
}

/** Share, Export and Save version: what you do with the mix. Export grows into the packet for your agent. */
function ShipIsland() {
  const sheet = useStore((s) => s.ui.sheet)
  const open = sheet === 'packet' || sheet === 'share'
  return (
    <Island
      open={open}
      width={420}
      anchor="right"
      onClose={() => useStore.getState().setUi({ sheet: 'none' })}
      maxBody="min(76vh, 720px)"
      bar={
        <>
          {/* Who's here sits inside Share (signed-out, browser-only mixes have no one to share with: just you). */}
          {isHosted() ? (
            <button
              type="button"
              onClick={() => toggleSheet('share')}
              title="Who's here, and share this mix"
              aria-expanded={sheet === 'share'}
              className={`flex h-8 cursor-pointer items-center gap-2 rounded-full pl-1 pr-3 text-[13px] font-medium transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.97] ${
                sheet === 'share' ? 'bg-zinc-900 text-white' : 'text-zinc-800 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] hover:bg-zinc-950/5'
              }`}
            >
              <Presence size={24} inline />
              Share
            </button>
          ) : (
            <Presence size={24} />
          )}
          <button
            type="button"
            onClick={() => toggleSheet('packet')}
            title="Export code for your agent: Astro or Next.js"
            aria-expanded={sheet === 'packet'}
            className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${
              sheet === 'packet' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900'
            }`}
          >
            <Package size={15} />
            Export
          </button>
          <SaveButton />
        </>
      }
    >
      {sheet === 'share' ? <SharePanel /> : <PacketPanel />}
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

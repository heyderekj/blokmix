import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { useEscape } from './keys'
import { openHelp } from './Overlays'
import { ChevronDown, ChevronUp, Dices, Hand, Library, Maximize, Minus, Monitor, MousePointer2, Plus, Smartphone, StickyNote, MessageSquarePlus, Keyboard, MoveHorizontal, Scan, Square, Wand2, Type, SwatchBook, MessageSquare } from 'lucide-react'
import { useStore, type Tool, currentSlots } from '@/state/store'
import { library } from '@/data/library'
import { canvasApi, onPaint } from '../canvas/Canvas'
import { Divider, Island, MORPH } from './Island'
import { Crate } from './Crate'
import { toggleSheet } from './TopBar'
import { toggleLeft, useDocked } from './LeftPanel'
import { useInsets } from '@/ui/canvas/insets'
import { outstanding } from '@/core/notes'
import { Avatar } from './Avatar'
import { ShareAvatar } from './ShareAvatar'
import { useAccount } from '@/lib/account'
import { useSave } from '@/lib/mixSync'
import { agent as agentP, useMe } from '@/lib/people'
import { SayBar, toggleSay, useSay } from '../jev/SayBar'
import { WordsSheet, WordsTray } from '../jev/WordsSheet'
import { NextSteps } from './NextSteps'

const TOOLS: { id: Tool; icon: typeof Hand; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand', key: 'H' },
  { id: 'note', icon: MessageSquarePlus, label: 'Note on a block', key: 'N' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky note', key: 'S' },
]

/** Which section's row of other layouts is open under its bar ("Layout n of m ▾", or a hint that asks). */
export const useDockLayouts = create<{ slotId: string | null }>()(() => ({ slotId: null }))

/** The dock: how you work the canvas. The Clips button grows it upward into the crate. */
export function Dock() {
  const sheet = useStore((s) => s.ui.sheet)
  // The Clips button grows the crate.
  const open = sheet === 'crate'
  const inset = useInsets()
  return (
    // Centered in the room beside the docked panels (Design, Content, Notes on the left; Style on the right), never over them.
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-3" style={{ paddingLeft: Math.max(12, inset.left), paddingRight: Math.max(12, inset.right) }} data-dock>
      <NextSteps />
      <FirstRunTip />
      <WordsTray />
      <WordsSheet />
      <SayBar />
      <Island
        open={open}
        width={open ? Math.min(760, window.innerWidth - 24) : undefined}
        grow="up"
        anchor="center"
        maxBody="min(52vh, 420px)"
        onClose={() => useStore.getState().setUi({ sheet: 'none' })}
        bar={
          <>
            <NarrowPanels />
            <ToolSwitcher />
            <Divider />
            <ShuffleButton />
            {/* A section's other layouts open from its bar's "Layout n of m ▾", not from here too. */}
            <button
              type="button"
              onClick={() => toggleSheet('crate')}
              title={`Crate: ${Object.keys(library.clips).length} sections (C)`}
              aria-label="Crate"
              aria-expanded={sheet === 'crate'}
              className={`grid size-8 place-items-center rounded-full transition active:scale-[0.97] ${sheet === 'crate' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
            >
              <Library size={16} />
            </button>
            <SayToggle />
            <Divider />
            <ViewMenu />
          </>
        }
      >
        {open ? <Crate /> : null}
      </Island>
    </div>
  )
}

/** On a phone there's no room for the left rail: Words, Look and Notes sit at the start of the dock instead. */
function NarrowPanels() {
  const wide = useDocked()
  const which = useStore((s) => s.ui.leftPanel)
  const todo = useStore((s) => s.notes.filter(outstanding).length)
  if (wide) return null
  const item = (id: 'words' | 'look' | 'notes', Icon: typeof Type, label: string, count = 0) => (
    <button
      type="button"
      onClick={() => toggleLeft(id)}
      title={label}
      aria-label={label}
      aria-pressed={which === id}
      className={`relative grid size-8 place-items-center rounded-full transition active:scale-[0.97] ${which === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
    >
      <Icon size={16} />
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-problem px-1 text-[10px] font-bold tabular-nums text-white">{count}</span>}
    </button>
  )
  return (
    <>
      {item('look', SwatchBook, 'Design')}
      {item('words', Type, 'Content')}
      {item('notes', MessageSquare, 'Notes', todo)}
      <Divider />
    </>
  )
}

/** Shows or hides the bar for saying what to change (⌘K), so it never sits over the page uninvited. */
function SayToggle() {
  const open = useSay((s) => s.open)
  return (
    <button
      type="button"
      onClick={toggleSay}
      title="Say what to change (⌘K)"
      aria-label="Say what to change"
      aria-pressed={open}
      data-say-toggle
      className={`grid size-8 place-items-center rounded-full transition active:scale-[0.97] ${open ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
    >
      <Wand2 size={16} />
    </button>
  )
}

function ShuffleButton() {
  const seq = useStore((s) => s.shuffleSeq)
  const [spin, setSpin] = useState(false)
  useEffect(() => {
    if (!seq) return
    setSpin(true)
    const t = window.setTimeout(() => setSpin(false), 300)
    return () => window.clearTimeout(t)
  }, [seq])
  const unusual = useStore((s) => s.ui.unusual ?? 1)
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEscape(menu, () => setMenu(false))
  useEffect(() => {
    if (!menu) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || (t instanceof Element && t.closest('[data-dock-menu]'))) return
      setMenu(false)
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [menu])
  return (
    <div ref={box} className="relative flex items-center">
      <button
        type="button"
        onClick={() => useStore.getState().shuffle()}
        title={`Mix: new layouts for unlocked sections (Space) · ${UNUSUAL_LABEL[unusual]}`}
        aria-label="Mix"
        className="grid size-8 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-950/5 active:scale-[0.97]"
      >
        <Dices size={16} className={`transition-transform duration-300 ${spin ? 'rotate-[360deg]' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }} />
      </button>
      <button
        type="button"
        onClick={() => setMenu(!menu)}
        aria-expanded={menu}
        title="How unusual Mix goes"
        aria-label="How unusual Mix goes"
        className={`-ml-1 grid h-8 w-4 place-items-center rounded-full transition ${unusual !== 1 ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-800'}`}
      >
        <ChevronUp size={12} />
      </button>
      {/* How unusual Mix goes, for layouts here and for Mix the rest in Design. */}
      <DockMenu anchor={box} open={menu} align="left">
        <div className="p-0.5">
          <div className="px-1 pb-1.5 text-[11.5px] font-semibold text-zinc-500">How unusual Mix goes</div>
          <div className="flex rounded-full bg-chip p-0.5" role="radiogroup" aria-label="How unusual">
            {([0, 1, 2] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={unusual === v}
                onClick={() => useStore.getState().setUi({ unusual: v })}
                className={`h-7 flex-1 cursor-pointer rounded-full text-[12px] font-semibold transition ${unusual === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                {UNUSUAL_LABEL[v]}
              </button>
            ))}
          </div>
          <p className="px-1 pt-1.5 text-[11.5px] leading-snug text-zinc-500">{UNUSUAL_LINE[unusual]}</p>
        </div>
      </DockMenu>
    </div>
  )
}

const UNUSUAL_LABEL = { 0: 'Safe', 1: 'A little', 2: 'Strange' } as const
const UNUSUAL_LINE = {
  0: 'Layouts and looks most sites like yours use.',
  1: 'Anything that fits, now and then a surprise.',
  2: 'The odd ones first: layouts and looks people don’t expect.',
} as const

/** The zoom on screen, as it changes (at most once a frame). */
function useLiveZoom() {
  const [pct, setPct] = useState(() => Math.round((useStore.getState().camera?.z ?? 0.3) * 100))
  useEffect(() => {
    let raf = 0
    let nextPct: number | undefined
    const off = onPaint((c) => {
      const p = Math.round(c.z * 100)
      if (p === nextPct) return
      nextPct = p
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          setPct(nextPct ?? p)
        })
    })
    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [])
  return pct
}

/** The zoom readout doubles as the view menu: page or canvas, device, zoom and fit, out of the way. */
function ViewMenu() {
  const pct = useLiveZoom()
  const [open, setOpen] = useState(false)
  const viewport = useStore((s) => s.ui.viewport)
  const mode = useStore((s) => s.ui.mode)
  const canvasMode = useStore((s) => s.ui.canvasMode ?? 'page')
  const sheet = useStore((s) => s.ui.sheet)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setOpen(false), [sheet])
  useOutsideClose(open, ref, () => setOpen(false))
  const row = (Icon: typeof Plus, label: string, kbd: string, run: () => void, keep = false) => (
    <button
      type="button"
      onClick={() => {
        run()
        if (!keep) setOpen(false)
      }}
      className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-zinc-700 transition hover:bg-zinc-950/5 hover:text-zinc-900"
    >
      <Icon size={15} className="text-zinc-500" />
      <span className="flex-1">{label}</span>
      <span className="kbd">{kbd}</span>
    </button>
  )
  const seg = (on: boolean) =>
    `flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition ${on ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`
  return (
    <div ref={ref} className="relative">
      <DockMenu anchor={ref} open={open} align="right">
            {/* How you move around: scroll the page like a website, or the free canvas with every version. */}
            <div className="mb-1 flex gap-0.5 rounded-lg bg-well p-0.5" role="radiogroup" aria-label="View">
              {(['page', 'canvas'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={canvasMode === m}
                  title={m === 'page' ? 'Scroll the page like a website (⌘0)' : 'Every version side by side (⇧1)'}
                  onClick={() => canvasApi.setMode(m)}
                  className={seg(canvasMode === m)}
                >
                  {m === 'page' ? 'Page' : 'Canvas'}
                </button>
              ))}
            </div>
            <div className="mb-1 flex gap-0.5 rounded-lg bg-well p-0.5">
              {(['desktop', 'mobile'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={viewport === v}
                  onClick={() => {
                    useStore.getState().setUi({ viewport: v })
                    setTimeout(() => canvasApi.fitMix(), 120)
                  }}
                  className={seg(viewport === v)}
                >
                  {v === 'desktop' ? <Monitor size={13} /> : <Smartphone size={13} />}
                  {v === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            {/* What the canvas shows: every section in your style guide, or each as it was clipped (U). */}
            <div className="mb-1 flex gap-0.5 rounded-lg bg-well p-0.5" role="radiogroup" aria-label="Sections show">
              {(['unified', 'captured'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  title={m === 'unified' ? 'Your style and words on every section (U)' : 'Every section as it came (U)'}
                  onClick={() => useStore.getState().setUi({ mode: m })}
                  className={seg(mode === m)}
                >
                  {m === 'unified' ? 'Your style' : 'Original'}
                </button>
              ))}
            </div>
            {row(Plus, 'Zoom in', '⌘+', () => canvasApi.zoomStep(1), true)}
            {row(Minus, 'Zoom out', '⌘−', () => canvasApi.zoomStep(-1), true)}
            {row(MoveHorizontal, 'Fit width', '⌘0', () => canvasApi.fitWidth())}
            {row(Square, '100%', '⌘1', () => canvasApi.zoomTo(1))}
            {row(Scan, 'Zoom to selection', '⇧2', () => {
              if (!canvasApi.zoomToSelection()) useStore.getState().showFlash('Select a section to zoom to it')
            })}
            {row(Maximize, 'Fit everything', '⇧1', () => canvasApi.fitAll())}
            <div className="my-1 border-t border-zinc-950/6" />
            {row(Keyboard, 'Keyboard shortcuts', '?', () => openHelp())}
      </DockMenu>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={canvasMode === 'page' ? 'View: the page, zoom and device' : 'View: the canvas, zoom and device'}
        className={`flex h-8 items-center gap-1 rounded-full pl-2.5 pr-2 text-[12.5px] font-medium tabular-nums transition ${open ? 'bg-zinc-950/5 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
      >
        {canvasMode === 'canvas' && <span className="mr-0.5 rounded-full bg-zinc-950/6 px-1.5 py-px text-[11px] font-semibold text-zinc-600">Canvas</span>}
        {pct}%
        <ChevronDown size={13} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

export function Presence({ size = 28, inline = false }: { size?: number; inline?: boolean }) {
  const agent = useStore((s) => s.agent)
  const me = useMe()
  const account = useAccount((s) => s.user)
  const owns = useAccount((s) => s.owns)
  const mixId = useSave((s) => s.mixId)
  const active = !!agent.versionId
  return (
    <div className={`flex items-center ${inline ? '' : 'pl-0.5 pr-1'}`}>
      <div className="flex -space-x-1.5">
        {account && mixId !== 'local'
          ? <ShareAvatar name={me.name} mixId={mixId} memberId={account.id} owner={owns} size={size} live />
          : <Avatar who={me} size={size} />}
        <AnimatePresence>
          {active && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={MORPH}
              className="relative grid animate-pulse-ring place-items-center rounded-full"
              title={`${agent.name} is building`}
            >
              <Avatar who={agentP(agent.name)} size={size} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** One quiet line above the dock until you've slid or shuffled once. */
function FirstRunTip() {
  const dismissed = useStore((s) => s.ui.hintDismissed)
  const sheetOpen = useStore((s) => s.ui.sheet !== 'none' || !!s.ui.focusedSlotId || !!s.ui.nextSteps)
  const seq = useStore((s) => s.shuffleSeq)
  const key = useStore((s) => currentSlots(s).map((x) => x.clipId).join())
  const [initial] = useState(key)
  const played = seq > 0 || key !== initial
  useEffect(() => {
    if (played && !dismissed) {
      const t = window.setTimeout(() => useStore.getState().setUi({ hintDismissed: true }), 1200)
      return () => window.clearTimeout(t)
    }
  }, [played, dismissed])
  return (
    <AnimatePresence>
      {!dismissed && !sheetOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="@container w-full text-center [@media(max-width:767px)_and_(pointer:coarse)]:hidden"
        >
          <ul aria-label="Canvas shortcuts" className="glass m-0 hidden list-none items-center whitespace-nowrap rounded-full px-3 py-1.5 align-middle text-xs font-medium text-zinc-600 @min-[9rem]:inline-flex">
            <li className="mr-3 hidden border-r border-zinc-950/10 pr-3 @min-[32rem]:block">Scroll to read</li>
            <li className="flex items-center gap-1.5">
              <span className="inline-flex gap-0.5"><kbd className="kbd">←</kbd><kbd className="kbd">→</kbd></span>
              Try layouts
            </li>
            <li className="ml-3 hidden items-center gap-1.5 border-l border-zinc-950/10 pl-3 @min-[16.5rem]:flex">
              <kbd className="kbd">Space</kbd> Mix
            </li>
            <li className="ml-3 hidden items-center gap-1.5 border-l border-zinc-950/10 pl-3 @min-[25.5rem]:flex">
              <kbd className="kbd">Enter</kbd> Save version
            </li>
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Menus that open from the dock. They render in a top layer anchored to their
 * button, because the dock clips its own overflow for its open/close animation.
 */
function DockMenu({ anchor, open, align, children }: { anchor: React.RefObject<HTMLElement | null>; open: boolean; align: 'left' | 'right'; children: React.ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!open) return
    const update = () => anchor.current && setRect(anchor.current.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open, anchor])
  return createPortal(
    <AnimatePresence>
      {open && rect && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.08 } }}
          transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
          className={`glass-menu fixed z-[60] w-56 rounded-2xl p-1.5 ${align === 'right' ? 'origin-bottom-right' : 'origin-bottom-left'}`}
          style={{
            bottom: window.innerHeight - rect.top + 12,
            ...(align === 'right' ? { right: window.innerWidth - rect.right - 6 } : { left: rect.left - 6 }),
          }}
          data-chrome
          data-dock-menu
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** One button for the canvas tool: shows the current tool, opens the other two. */
function ToolSwitcher() {
  const tool = useStore((s) => s.ui.tool)
  const sheet = useStore((s) => s.ui.sheet)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = TOOLS.find((t) => t.id === tool) ?? TOOLS[0]
  useEffect(() => setOpen(false), [sheet, tool])
  useOutsideClose(open, ref, () => setOpen(false))
  return (
    <div ref={ref}>
      <DockMenu anchor={ref} open={open} align="left">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tool === t.id}
            onClick={() => useStore.getState().setUi({ tool: t.id })}
            className={`flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition ${tool === t.id ? 'bg-zinc-950/5 font-medium text-zinc-900' : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
          >
            <t.icon size={15} className={tool === t.id ? 'text-zinc-900' : 'text-zinc-500'} />
            <span className="flex-1">{t.label}</span>
            <span className="kbd">{t.key}</span>
          </button>
        ))}
      </DockMenu>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Tool: ${current.label}`}
        title={`${current.label} (${current.key}). Click for other tools`}
        className="flex h-8 items-center gap-0.5 rounded-full bg-zinc-900 pl-2 pr-1.5 text-white transition active:scale-[0.97]"
      >
        <current.icon size={16} />
        <ChevronDown size={12} className={`opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

function useOutsideClose(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  // Esc closes the menu, and only the menu.
  useEscape(open, close)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || (t instanceof Element && t.closest('[data-dock-menu]'))) return
      close()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open, ref, close])
}

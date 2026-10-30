import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Dices, Disc3, Hand, LayoutTemplate, Library, Maximize, Minus, Monitor, MousePointer2, Plus, Smartphone, StickyNote, MessageSquarePlus } from 'lucide-react'
import { useStore, type Tool, currentSlots } from '@/state/store'
import { library } from '@/data/library'
import { canvasApi } from '../canvas/Canvas'
import { Divider, Island, MORPH } from './Island'
import { Crate } from './Crate'
import { Alternatives } from './Alternatives'
import { LooksTray } from '../blocks/LooksTray'
import { toggleSheet } from './TopBar'
import { Avatar } from './Avatar'
import { agent as agentP, useMe } from '@/lib/people'

const TOOLS: { id: Tool; icon: typeof Hand; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand', key: 'H' },
  { id: 'note', icon: MessageSquarePlus, label: 'Note on a block', key: 'N' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky note', key: 'S' },
]

/** The dock: how you work the canvas. The Clips button grows it upward into the crate. */
export function Dock() {
  const sheet = useStore((s) => s.ui.sheet)
  // The Clips button grows the crate; a block's Look button grows its looks (the block stays in view above).
  const open = sheet === 'crate' || sheet === 'looks'
  // On a section (and nothing else open) the dock offers that section's other layouts, but only grows them when asked:
  // focusing a section opens nothing, so the section's own card stays clear. Not while you're working on one of its
  // blocks, either: the clips would compete with it.
  const section = useStore((s) => (s.ui.sheet === 'none' && !s.ui.selectedBlockId ? currentSlots(s).find((x) => x.id === s.ui.focusedSlotId) : undefined))
  const [asked, setAsked] = useState<string | null>(null)
  const focused = section && asked === section.id ? section : undefined
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-3" data-dock>
      <FirstRunTip />
      <Island
        open={open || !!focused}
        width={open || focused ? Math.min(760, window.innerWidth - 24) : undefined}
        grow="up"
        anchor="center"
        maxBody="min(52vh, 420px)"
        onClose={() => (open ? useStore.getState().setUi({ sheet: 'none' }) : setAsked(null))}
        bar={
          <>
            <ToolSwitcher />
            <Divider />
            <ShuffleButton />
            {section && !focused && (
              <button
                type="button"
                onClick={() => setAsked(section.id)}
                title="Other layouts for this section"
                aria-label="Other layouts for this section"
                className="grid size-8 place-items-center rounded-full text-zinc-600 transition active:scale-[0.97] hover:bg-zinc-950/5"
              >
                <LayoutTemplate size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleSheet('crate')}
              title={`Clips: ${Object.keys(library.clips).length} sections (C)`}
              aria-label="Clips"
              aria-expanded={sheet === 'crate'}
              className={`grid size-8 place-items-center rounded-full transition active:scale-[0.97] ${sheet === 'crate' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
            >
              <Library size={16} />
            </button>
            <Divider />
            <ViewMenu />
          </>
        }
      >
        {sheet === 'looks' ? <LooksTray /> : open ? <Crate /> : focused ? <Alternatives slot={focused} /> : null}
      </Island>
    </div>
  )
}

function ShuffleButton() {
  const seq = useStore((s) => s.shuffleSeq)
  const [spin, setSpin] = useState(false)
  useEffect(() => {
    if (!seq) return
    setSpin(true)
    const t = window.setTimeout(() => setSpin(false), 500)
    return () => window.clearTimeout(t)
  }, [seq])
  return (
    <button
      type="button"
      onClick={() => useStore.getState().shuffle()}
      title="Shuffle unlocked sections (Space)"
      aria-label="Shuffle"
      className="grid size-8 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-950/5 active:scale-[0.97]"
    >
      <Dices size={16} className={`transition-transform duration-500 ${spin ? 'rotate-[360deg]' : ''}`} style={{ transitionTimingFunction: 'var(--ease-spring)' }} />
    </button>
  )
}

/** The zoom readout doubles as the view menu: device, zoom and fit, out of the way. */
function ViewMenu() {
  const [z, setZ] = useState(useStore.getState().camera?.z ?? 0.3)
  const [open, setOpen] = useState(false)
  const viewport = useStore((s) => s.ui.viewport)
  const mode = useStore((s) => s.ui.mode)
  const sheet = useStore((s) => s.ui.sheet)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => useStore.subscribe((s) => s.camera && setZ(s.camera.z)), [])
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
  return (
    <div ref={ref} className="relative">
      <DockMenu anchor={ref} open={open} align="right">
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
                  className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition ${viewport === v ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
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
                  title={m === 'unified' ? 'Your style guide and copy on every section (U)' : 'Every section exactly as it was clipped (U)'}
                  onClick={() => useStore.getState().setUi({ mode: m })}
                  className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition ${mode === m ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {m === 'unified' ? 'In your style' : 'As clipped'}
                </button>
              ))}
            </div>
            {row(Plus, 'Zoom in', '+', () => canvasApi.zoomBy(1.3), true)}
            {row(Minus, 'Zoom out', '−', () => canvasApi.zoomBy(1 / 1.3), true)}
            {row(Disc3, 'Back to the mix', '⇧0', () => canvasApi.fitMix())}
            {row(Maximize, 'Fit everything', '⇧1', () => canvasApi.fitAll())}
      </DockMenu>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="View: zoom and device"
        className={`flex h-8 items-center gap-1 rounded-full pl-2.5 pr-2 text-[12.5px] font-medium tabular-nums transition ${open ? 'bg-zinc-950/5 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
      >
        {Math.round(z * 100)}%
        <ChevronDown size={13} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

export function Presence({ size = 28, inline = false }: { size?: number; inline?: boolean }) {
  const agent = useStore((s) => s.agent)
  const me = useMe()
  const active = !!agent.versionId
  return (
    <div className={`flex items-center ${inline ? '' : 'pl-0.5 pr-1'}`}>
      <div className="flex -space-x-1.5">
        <Avatar who={me} size={size} />
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
  const sheetOpen = useStore((s) => s.ui.sheet !== 'none' || !!s.ui.focusedSlotId)
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
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="glass flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[12px] text-zinc-600 max-md:hidden"
        >
          <span className="kbd">←</span>
          <span className="kbd">→</span> slide a section
          <span className="text-zinc-300">·</span>
          <span className="kbd">Space</span> shuffle
          <span className="text-zinc-300">·</span>
          <span className="kbd">Enter</span> save a version
        </motion.p>
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

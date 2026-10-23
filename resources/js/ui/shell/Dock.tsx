import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Dices, Hand, Library, Maximize, Minus, Monitor, MousePointer2, Plus, Smartphone, StickyNote, X } from 'lucide-react'
import { useStore, type Tool } from '@/state/store'
import { library } from '@/data/library'
import { canvasApi } from '../canvas/Canvas'
import { Divider, Island, MORPH } from './Island'
import { Crate } from './Crate'
import { Alternatives } from './Alternatives'
import { IconButton, Segmented, toggleSheet } from './TopBar'
import { Avatar } from './Avatar'
import { agent as agentP, ME } from '@/lib/people'

const TOOLS: { id: Tool; icon: typeof Hand; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand', key: 'H' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky note', key: 'S' },
]

/** The dock: how you work the canvas. The Clips button grows it upward into the crate. */
export function Dock() {
  const tool = useStore((s) => s.ui.tool)
  const open = useStore((s) => s.ui.sheet === 'crate')
  const viewport = useStore((s) => s.ui.viewport)
  // On a track (and nothing else open), the dock grows that track's alternatives.
  const focused = useStore((s) => (s.ui.sheet === 'none' ? s.slots.find((x) => x.id === s.ui.focusedSlotId) : undefined))
  const st = useStore.getState
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-3">
      <FirstRunTip />
      <Island
        open={open || !!focused}
        width={open ? Math.min(760, window.innerWidth - 24) : undefined}
        grow="up"
        maxBody="min(52vh, 420px)"
        bar={
          <>
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={`${t.label} (${t.key})`}
                aria-label={t.label}
                aria-pressed={tool === t.id}
                onClick={() => st().setUi({ tool: t.id })}
                className={`relative grid size-8 place-items-center rounded-full transition active:scale-[0.97] ${tool === t.id ? 'text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
              >
                {tool === t.id && <motion.span layoutId="dock-tool" transition={MORPH} className="absolute inset-0 rounded-full bg-zinc-900" />}
                <t.icon size={16} className="relative" />
              </button>
            ))}
            <Divider />
            <ShuffleButton />
            <button
              type="button"
              onClick={() => toggleSheet('crate')}
              title="Clips (C)"
              aria-expanded={open}
              className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition active:scale-[0.97] ${
                open ? 'bg-zinc-950/5 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-950/5'
              }`}
            >
              {open ? <X size={15} /> : <Library size={15} />}
              Clips
              <span className="rounded-full bg-chip px-1.5 text-[11px] font-semibold tabular-nums text-zinc-600">{Object.keys(library.clips).length}</span>
            </button>
            <Divider />
            <Segmented
              value={viewport}
              options={[
                { value: 'desktop', label: <Monitor size={14} />, title: 'Desktop, 1280px' },
                { value: 'mobile', label: <Smartphone size={14} />, title: 'Mobile, 390px' },
              ]}
              onChange={(v) => {
                st().setUi({ viewport: v })
                setTimeout(() => canvasApi.fitMix(), 120)
              }}
            />
            <ZoomControls />
            <Presence />
          </>
        }
      >
        {open ? <Crate /> : focused ? <Alternatives slot={focused} /> : null}
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
      title="Shuffle unlocked tracks (Space)"
      className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-950/5 active:scale-[0.97]"
    >
      <Dices size={16} className={`transition-transform duration-500 ${spin ? 'rotate-[360deg]' : ''}`} style={{ transitionTimingFunction: 'var(--ease-spring)' }} />
      <span className="max-md:hidden">Shuffle</span>
    </button>
  )
}

function ZoomControls() {
  const [z, setZ] = useState(useStore.getState().camera?.z ?? 0.3)
  useEffect(() => useStore.subscribe((s) => s.camera && setZ(s.camera.z)), [])
  return (
    <div className="flex items-center max-md:hidden">
      <IconButton title="Zoom out (−)" onClick={() => canvasApi.zoomBy(1 / 1.3)}>
        <Minus size={15} />
      </IconButton>
      <button
        type="button"
        className="h-8 w-11 rounded-full text-center text-[12px] font-medium tabular-nums text-zinc-600 transition hover:bg-zinc-950/5"
        title="Back to the working mix (⇧0)"
        onClick={() => canvasApi.fitMix()}
      >
        {Math.round(z * 100)}%
      </button>
      <IconButton title="Zoom in (+)" onClick={() => canvasApi.zoomBy(1.3)}>
        <Plus size={15} />
      </IconButton>
      <IconButton title="Fit everything (⇧1)" onClick={() => canvasApi.fitAll()}>
        <Maximize size={14} />
      </IconButton>
    </div>
  )
}

function Presence() {
  const agent = useStore((s) => s.agent)
  const active = !!agent.versionId
  return (
    <div className="flex items-center pl-0.5 pr-1">
      <div className="flex -space-x-1.5">
        <Avatar who={ME} />
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
              <Avatar who={agentP(agent.name)} />
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
  const key = useStore((s) => s.slots.map((x) => x.clipId).join())
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
          <span className="kbd">→</span> slide a track
          <span className="text-zinc-300">·</span>
          <span className="kbd">Space</span> shuffle
          <span className="text-zinc-300">·</span>
          <span className="kbd">Enter</span> save a version
        </motion.p>
      )}
    </AnimatePresence>
  )
}

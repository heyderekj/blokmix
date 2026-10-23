import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore, undo } from '@/state/store'

export function Flash() {
  const flash = useStore((s) => s.flash)
  const [shown, setShown] = useState<typeof flash>(null)
  useEffect(() => {
    if (!flash) return
    setShown(flash)
    const t = window.setTimeout(() => setShown(null), flash.undo ? 4500 : 2600)
    return () => window.clearTimeout(t)
  }, [flash])
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[124px] z-50 flex justify-center">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ y: 10, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 6, opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-full bg-zinc-900 py-1.5 pl-4 text-sm text-white shadow-lg ${shown.undo ? 'pr-1.5' : 'pr-4'}`}
          >
            {shown.text}
            {shown.undo && (
              <button
                type="button"
                onClick={() => {
                  undo()
                  setShown(null)
                }}
                className="rounded-full px-3 py-1 text-sm font-semibold text-key transition hover:bg-white/10 active:scale-[0.97] night:text-[color-mix(in_srgb,var(--key),black_40%)]"
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const HELP: [string, [string, string][]][] = [
  [
    'Mixing',
    [
      ['← →', 'Slide the focused section'],
      ['↑ ↓', 'Move between sections'],
      ['Space', 'Shuffle unlocked sections (hold + drag to pan)'],
      ['L', 'Lock / unlock section'],
      ['⌥↑ ⌥↓', 'Move section up / down'],
      ['1 2 3 4', 'Keep layout · style · copy · motion'],
      ['P', 'Use this section’s design as the style guide'],
      ['⌫', 'Remove section'],
    ],
  ],
  [
    'Versions',
    [
      ['Enter / ⌘S', 'Save a version'],
      ['U', 'Original ↔ Your style'],
      ['⌘Z / ⇧⌘Z', 'Undo / redo'],
    ],
  ],
  [
    'Canvas',
    [
      ['V H S', 'Select · hand · sticky note'],
      ['⇧1 / ⇧0', 'Fit everything / back to the mix'],
      ['+ −', 'Zoom'],
      ['C', 'Open the clip crate'],
      ['G', 'Open the style guide'],
      ['Esc', 'Close, stop interacting, deselect'],
    ],
  ],
]

export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] grid place-items-center bg-zinc-950/30 backdrop-blur-sm" onClick={onClose} data-chrome>
          <motion.div
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-[560px] rounded-3xl p-6"
          >
            <h2 className="mb-1 text-[18px] font-bold text-zinc-900">Keyboard</h2>
            <p className="mb-5 text-[13px] text-zinc-500">Everything in the loop has a key. Nothing asks if you’re sure; ⌘Z undoes it.</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              {HELP.map(([group, rows]) => (
                <div key={group}>
                  <h3 className="eyebrow mb-2">{group}</h3>
                  <div className="space-y-1.5">
                    {rows.map(([k, l]) => (
                      <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                        <span className="text-zinc-600">{l}</span>
                        <span className="kbd shrink-0">{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

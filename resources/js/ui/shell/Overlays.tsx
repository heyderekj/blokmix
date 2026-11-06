import { useEffect, useState } from 'react'
import { undoCollections } from '@/state/collections'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { useStore, undo } from '@/state/store'
import { useEscape } from './keys'

export function Flash() {
  const flash = useStore((s) => s.flash)
  const [shown, setShown] = useState<typeof flash>(null)
  const [bottom, setBottom] = useState(66)
  // Just above whatever the dock is showing: the toolbar, its hint, or a grown shelf, and it follows when that changes.
  useEffect(() => {
    const dock = document.querySelector('[data-dock]')
    if (!dock) return
    const place = () => setBottom(window.innerHeight - dock.getBoundingClientRect().top + 10)
    place()
    const ro = new ResizeObserver(place)
    ro.observe(dock)
    window.addEventListener('resize', place)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [])
  useEffect(() => {
    if (!flash) return
    setShown(flash)
    const t = window.setTimeout(() => setShown(null), flash.undo ? 4500 : 2600)
    return () => window.clearTimeout(t)
  }, [flash])
  return (
    <div className="pointer-events-none absolute inset-x-0 z-50 flex justify-center" style={{ bottom }}>
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
                  if (shown.undo === 'collections') undoCollections()
                  else undo()
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
    'Sections',
    [
      ['← →', 'Try another layout (or, on a block, another look)'],
      ['↑ ↓', 'Move between sections'],
      ['Space', 'Shuffle unlocked sections (hold and drag to pan)'],
      ['L', 'Lock or unlock a section'],
      ['⌥↑ ⌥↓', 'Move a section up or down'],
      ['1 2 3 4', 'Use the original layout · style · words · motion'],
      ['⌫', 'Remove a section'],
    ],
  ],
  [
    'Blocks and words',
    [
      ['Click', 'Select the block under the pointer'],
      ['↵ / double-click', 'Edit the words'],
      ['[ ]', 'Other ways to say them'],
      ['⌘D', 'Duplicate a list item'],
      ['⌥ arrows', 'Move a list item'],
      ['⌫', 'Remove a list item, or hide a block'],
      ['Esc', 'Close a menu, or select what’s around it'],
    ],
  ],
  [
    'Versions',
    [
      ['⌘K', 'Change something (“roomier”, “FAQ above pricing”)'],
      ['↵ / ⌘S', 'Save a version'],
      ['U', 'Original ↔ Your style'],
      ['⌘Z / ⇧⌘Z', 'Undo / redo'],
    ],
  ],
  [
    'Canvas',
    [
      ['V H N S', 'Select · hand · note · sticky note'],
      ['Scroll', 'Read the page; pinch out for the canvas'],
      ['PgUp PgDn', 'Scroll a screen (↑ ↓ with nothing selected)'],
      ['⌘+ ⌘− / + −', 'Zoom in and out'],
      ['⌘0 / ⌘1', 'Fit the width / 100%'],
      ['⇧1 / ⇧2', 'Fit everything / zoom to the selection'],
      ['Esc', 'Back from the canvas to the page'],
      ['C', 'Open the crate'],
      ['G', 'Open the style guide'],
      ['?', 'This sheet'],
    ],
  ],
]

/** The keyboard sheet: opened with ?, from the logo menu, or from the dock's view menu. */
export const useHelpSheet = create<{ open: boolean }>()(() => ({ open: false }))
export const openHelp = () => useHelpSheet.setState({ open: true })
export const toggleHelp = () => useHelpSheet.setState((s) => ({ open: !s.open }))

export function HelpOverlay() {
  const open = useHelpSheet((s) => s.open)
  const onClose = () => useHelpSheet.setState({ open: false })
  useEscape(open, onClose)
  // While it's open the sheet takes the keyboard: nothing behind it moves.
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Escape') return
      e.stopPropagation()
      if (e.key === '?') onClose()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [open])
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
            <p className="mb-5 text-[13px] text-zinc-500">Almost everything has a key, and ⌘Z undoes it.</p>
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

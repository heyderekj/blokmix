import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, X } from 'lucide-react'
import { currentSlots, mixClipIds, useStore } from '@/state/store'
import { library, slotClip } from '@/data/library'
import { cycleIds } from '@/core/library'
import { pageOwnership, firstSample } from '@/core/ownWords'
import { refId, themeList } from '@/core/skins'
import { dismissStep, nextSteps, type NextStep } from '@/core/nextSteps'
import type { ScoreCheck } from '@/core/score'
import { scoreStart } from '@/lib/start'
import { canvasApi } from '../canvas/Canvas'
import { useDockLayouts } from './Dock'

/** Right after a start: a few quiet hints above the dock, each with why it matters. The page stays the main thing. */
export function NextSteps() {
  const state = useStore((s) => s.ui.nextSteps)
  const busy = useStore((s) => s.ui.sheet !== 'none' || !!s.ui.focusedSlotId || s.ui.leftPanel !== 'none')
  const slots = useStore(currentSlots)
  const content = useStore((s) => s.content)
  const skin = useStore((s) => refId(s.guide.skin) ?? null)
  const mixClips = useStore((s) => mixClipIds(s).join(' '))
  const checks = useFirstScreen(!!state)

  const steps = useMemo(() => {
    if (!state) return []
    const { yours, total } = pageOwnership(slots, slotClip, content)
    const opener = slots.find((s) => s.type === 'hero') ?? slots.find((s) => s.type !== 'nav')
    return nextSteps({
      state,
      slots,
      sample: { left: total - yours, total },
      skin,
      openerLayouts: opener ? cycleIds(library, opener.type, mixClips.split(' '), opener.clipId).length : 0,
      themes: themeList().length,
      checks,
    })
  }, [state, slots, content, skin, mixClips, checks])

  // All done or set aside: forget the hints for this site on this device.
  useEffect(() => {
    if (state && !steps.length) useStore.getState().setUi({ nextSteps: null })
  }, [state, steps.length])

  return (
    <AnimatePresence>
      {!busy && steps.length > 0 && (
        <motion.ul
          aria-label="What to try next"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6, transition: { duration: 0.14 } }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="glass pointer-events-auto m-0 flex w-full max-w-[440px] list-none flex-col gap-0.5 rounded-2xl p-1.5"
          data-next-steps
        >
          {steps.map((step) => (
            <Step key={step.id} step={step} />
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  )
}

function Step({ step }: { step: NextStep }) {
  const dismiss = () => {
    const st = useStore.getState()
    st.setUi({ nextSteps: dismissStep(st.ui.nextSteps, step.id) })
  }
  const go = () => {
    dismiss()
    follow(step)
  }
  return (
    <li className="group flex items-start gap-1 rounded-xl hover:bg-zinc-950/[0.04]">
      <button type="button" onClick={go} className="min-w-0 flex-1 cursor-pointer rounded-xl px-2.5 py-1.5 text-left active:scale-[0.99]">
        <span className="flex items-center gap-1 text-[13px] font-semibold text-zinc-900">
          {step.label} <ArrowRight size={13} className="text-zinc-500 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="block text-pretty text-[12px] leading-snug text-zinc-600">{step.why}</span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Not now: ${step.label}`}
        title="Not now"
        className="mr-0.5 mt-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 active:scale-[0.97] pointer-coarse:size-10"
      >
        <X size={13} />
      </button>
    </li>
  )
}

/** Take a hint: open the place it names, on the right spot. */
function follow(step: NextStep) {
  const st = useStore.getState()
  const a = step.action
  if (a.kind === 'words') {
    st.setUi({ sheet: 'none', leftPanel: 'words' })
    const spot = firstSample(currentSlots(st), slotClip, st.content)
    if (!spot) return
    canvasApi.revealRow(spot.slotId, 'top')
    // Once Content has drawn, its first sample field takes the cursor.
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-words-scroll] [data-field="${CSS.escape(`${spot.slotId}:${spot.field}`)}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus({ preventScroll: true })
    }, 260)
  } else if (a.kind === 'layouts') {
    st.focusSlot(a.slotId)
    useDockLayouts.setState({ slotId: a.slotId })
    canvasApi.revealRow(a.slotId, 'top')
  } else {
    st.setUi({ sheet: 'none', leftPanel: 'look', guideView: 'look' })
  }
}

/** How the open page's first screen holds up, measured once the board has settled (the hints' "why"). */
function useFirstScreen(on: boolean): ScoreCheck[] | undefined {
  const [checks, setChecks] = useState<ScoreCheck[]>()
  useEffect(() => {
    if (!on || checks) return
    let live = true
    const t = window.setTimeout(() => {
      const { site, guide, content } = useStore.getState()
      scoreStart({ site, guide, content })
        .then((s) => live && setChecks(s.checks))
        .catch(() => {})
    }, 1500)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [on, checks])
  return checks
}

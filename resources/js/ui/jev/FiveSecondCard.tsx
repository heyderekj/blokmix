import { useEffect, useState } from 'react'
import { Check, Minus, RotateCcw, Wand2, X } from 'lucide-react'
import { jevOn } from '@/lib/jev'
import { fiveSecondTest, type FiveSecond } from '@/state/commands/jev'
import { useStore } from '@/state/store'

/**
 * Before you hand it off: what a visitor would make of the first screen in five seconds, Jev standing in for
 * them, with the measured checks (does the headline and button show, does anything spill). Hidden when Jev is off.
 */
export function FiveSecondCard() {
  const pageId = useStore((s) => s.ui.pageId)
  const [on, setOn] = useState(false)
  const [state, setState] = useState<{ busy: boolean; result: FiveSecond | null }>({ busy: false, result: null })
  const [run, setRun] = useState(0)

  useEffect(() => {
    let live = true
    jevOn().then((v) => live && setOn(v))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!on) return
    let live = true
    setState((s) => ({ ...s, busy: true }))
    fiveSecondTest(pageId ?? undefined)
      .then((result) => live && setState({ busy: false, result }))
      .catch(() => live && setState({ busy: false, result: null }))
    return () => {
      live = false
    }
  }, [on, pageId, run])

  if (!on) return null
  const r = state.result
  const checks = r?.score.checks ?? []
  return (
    <div className="mx-3 mb-3 rounded-xl bg-well px-3 py-2.5 ring-1 ring-zinc-950/5">
      <div className="flex items-center gap-2">
        <Wand2 size={14} className="shrink-0 text-zinc-500" />
        <span className="text-[12.5px] font-semibold text-zinc-900">Is it clear?</span>
        {r && <span className="ml-auto text-[11.5px] tabular-nums text-zinc-500">{r.score.score}/100</span>}
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          disabled={state.busy}
          className={`${r ? '' : 'ml-auto'} grid size-6 cursor-pointer place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 active:scale-[0.97] disabled:opacity-40`}
          title="Check again"
          aria-label="Check again"
        >
          <RotateCcw size={12} className={state.busy ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-zinc-700">
        {state.busy && !r ? 'What a first-time visitor would think…' : (r?.read?.words ?? 'No answer this time.')}
      </p>
      {checks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {checks
            .filter((c) => c.id !== 'five-second')
            .map((c) => (
              <li key={c.id} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-zinc-600">
                {c.ok ? <Check size={12} className="mt-px shrink-0 text-emerald-600" /> : c.weight ? <X size={12} className="mt-px shrink-0 text-attention" /> : <Minus size={12} className="mt-px shrink-0 text-zinc-400" />}
                {c.words}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

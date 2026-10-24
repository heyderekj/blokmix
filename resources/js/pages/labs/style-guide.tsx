import { useLayoutEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { RotateCcw } from 'lucide-react'
import Board from '@/pages/board'
import { library } from '@/data/library'
import { buildSeed } from '@/state/seed'
import { useStore } from '@/state/store'
import { openSandbox } from '@/lib/mixSync'
import { useLabs, type GuideVariant } from '@/lib/labs'
import { GUIDE_VARIANT_LABEL } from '@/ui/panels/guide'

/**
 * Labs (local only): style guide directions on the real board. A throwaway copy of the
 * demo mix, never saved, so every choice works and nothing touches a real mix.
 */
export default function StyleGuideLabs() {
  const [ready, setReady] = useState(false)
  const variant = useLabs((s) => s.guide)
  const reset = () => {
    openSandbox(buildSeed(library))
    useStore.getState().setUi({ sheet: 'guide', mode: 'unified', guideTab: 'style' })
  }
  useLayoutEffect(() => {
    const v = new URLSearchParams(location.search).get('v') as GuideVariant | null
    if (v && v in GUIDE_VARIANT_LABEL) useLabs.setState({ guide: v })
    reset()
    setReady(true)
    return () => useLabs.setState({ guide: 'now' })
  }, [])
  const pick = (v: GuideVariant) => {
    useLabs.setState({ guide: v })
    history.replaceState(null, '', `?v=${v}`)
    useStore.getState().setUi({ sheet: 'guide' })
  }
  return (
    <>
      <Head title="Labs · Style guide" />
      {ready && <Board />}
      <div className="pointer-events-auto fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-full bg-zinc-900/95 p-1 text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)] backdrop-blur" data-chrome>
        <span className="px-2.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-white/50">Labs</span>
        {(Object.keys(GUIDE_VARIANT_LABEL) as GuideVariant[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => pick(v)}
            className={`h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-semibold transition-[background-color,color] duration-150 ${variant === v ? 'bg-white text-zinc-900' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            {GUIDE_VARIANT_LABEL[v]}
          </button>
        ))}
        <button type="button" onClick={reset} title="Start over with the demo mix's open decisions" className="grid size-8 cursor-pointer place-items-center rounded-full text-white/70 transition-[background-color,color] duration-150 hover:bg-white/10 hover:text-white">
          <RotateCcw size={14} />
        </button>
      </div>
    </>
  )
}

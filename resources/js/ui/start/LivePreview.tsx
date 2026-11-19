import { useEffect, useRef, useState } from 'react'
import type { SectionType } from '@/core/types'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { library } from '@/data/library'
import type { PagePlan } from '@/state/jevPage'
import { wordsCandidates } from '@/lib/startFromText'
import { SkinPreview } from '@/ui/skins/SkinPreview'

const HEIGHT = 620
/** Wait this long after a change before drawing, so a run of picks draws once. */
const SETTLE = 200
/** How long the new page waits to paint before it fades in over the old one. */
const PAINT = 160
const FADE = 240

interface Layer {
  id: number
  start: StartCandidate
  shown: boolean
}

/**
 * The real page the description adds up to, from the first blank: the best start for it in the look that fits best.
 * Two pages stacked: the new one draws under cover and fades in over the old, so a change never flashes. It scrolls to
 * what just changed and says why underneath.
 */
export function LivePreview({ input, plan, focus, lines, reading }: { input: StartInput; plan?: PagePlan; focus?: SectionType | null; lines: string[]; reading?: boolean }) {
  const [layers, setLayers] = useState<Layer[]>([])
  const count = useRef(0)
  const timers = useRef<number[]>([])
  const key = JSON.stringify([input, plan?.lines.length ?? 0])

  useEffect(() => {
    const t = window.setTimeout(() => {
      let start: StartCandidate | undefined
      try {
        start = plan ? wordsCandidates(input, plan)[0] : startCandidates(input, library, 1)[0]
      } catch {
        return
      }
      if (!start) return
      const id = ++count.current
      setLayers((ls) => [...ls.filter((l) => l.shown).slice(-1), { id, start: start!, shown: !ls.length }])
      timers.current.push(
        window.setTimeout(() => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, shown: true } : l))), PAINT),
        window.setTimeout(() => setLayers((ls) => ls.filter((l) => l.id >= id)), PAINT + FADE),
      )
    }, SETTLE)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  return (
    <div>
      <div className="relative overflow-hidden rounded-[16px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_24px_48px_-28px_rgb(23_18_26/0.35)]" style={{ height: HEIGHT }}>
        {layers.map((l) => {
          const slot = focus ? l.start.site.pages[0]?.slots.find((x) => x.type === focus)?.id : undefined
          return (
            <div key={l.id} aria-hidden={!l.shown || undefined} className={`absolute inset-0 transition-opacity duration-[240ms] ease-out ${l.shown ? 'opacity-100' : 'opacity-0'}`}>
              <SkinPreview site={l.start.site} guide={l.start.guide} content={l.start.content} title="Your page so far" height={HEIGHT} scrollable focusSlot={slot} />
            </div>
          )
        })}
        {!layers.length && <div className="grid h-full place-items-center text-[13px] text-[#6B5F68] motion-safe:animate-pulse">Drawing your page…</div>}
      </div>
      <p role="status" className="mt-3 min-h-[2lh] text-center text-[12.5px] text-[#6B5F68] [text-wrap:pretty]">
        {reading ? 'Reading what you wrote…' : lines.join(' ') || 'Your page so far. Every blank you fill changes it.'}
      </p>
    </div>
  )
}

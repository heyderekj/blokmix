import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { SectionType } from '@/core/types'
import { SECTION_TYPES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { suggestClip, suggestTypes } from '@/core/suggest'
import { library } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { Preview, TYPE_ICON } from './Preview'
import { keepInView } from '../canvas/inView'

/** Insert a section at `at`, picking the clip or layout that suits that spot best. */
export function insertSection(type: SectionType, at: number) {
  const st = useStore.getState()
  const slots = currentSlots(st)
  // A nav always sits at the top and a footer at the bottom, whichever gap it was added from.
  const spot = type === 'nav' ? 0 : type === 'footer' ? slots.length : at
  const best = suggestClip(type, slots, spot, library)[0]
  if (best) st.addSlot(type, best.clipId, spot)
}

/**
 * Add a section at a spot in the page. Section types on the left, the ones that
 * usually go here first; the right shows a live preview of the best pick for
 * the highlighted type and why it fits. ↑/↓ to move, ↵ to add.
 */
export function AddSectionMenu({ at, onClose }: { at: number; onClose: () => void }) {
  const slots = useStore(currentSlots)
  const ranked = useMemo(() => suggestTypes(slots, at), [slots, at])
  const usable = (t: SectionType) => library.byType[t].length > 0
  const suggested = ranked.filter((s) => s.allowed && s.score > 0 && usable(s.type)).slice(0, 3)
  const rest = ranked.filter((s) => !suggested.includes(s)).sort((a, b) => SECTION_TYPES.indexOf(a.type) - SECTION_TYPES.indexOf(b.type))
  const order = [...suggested, ...rest]
  const pickable = order.filter((s) => s.allowed && usable(s.type))

  const [active, setActive] = useState<SectionType | undefined>(pickable[0]?.type)
  const info = ranked.find((r) => r.type === active)
  const best = useMemo(() => (active ? suggestClip(active, slots, active === 'nav' ? 0 : active === 'footer' ? slots.length : at, library)[0] : undefined), [active, slots, at])
  const ref = useRef<HTMLDivElement>(null)

  const add = (type: SectionType) => {
    insertSection(type, at)
    onClose()
  }

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (!['Escape', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') return onClose()
      if (e.key === 'Enter') return active && add(active)
      const i = pickable.findIndex((s) => s.type === active)
      const next = pickable[(i + (e.key === 'ArrowDown' ? 1 : -1) + pickable.length) % pickable.length]
      if (next) setActive(next.type)
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key, true)
    }
  })

  // Opened low on the screen, the menu would sit under the dock: nudge the canvas up so it's all in view.
  useLayoutEffect(() => keepInView(ref.current), [])

  const clip = best ? library.clips[best.clipId] : undefined

  return (
    <div
      ref={ref}
      className="glass-menu flex w-[560px] animate-pop gap-1.5 overflow-hidden rounded-2xl p-1.5"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      data-chrome
      data-scroll-ok
    >
      <div className="thin-scroll max-h-[372px] w-[184px] shrink-0 overflow-y-auto" role="listbox" aria-label="Section types">
        {suggested.length > 0 && <div className="px-2 pb-1 pt-1 text-[11px] font-semibold text-zinc-400">Suggested here</div>}
        {order.map((s, i) => {
          const Icon = TYPE_ICON[s.type]
          const on = s.type === active
          return (
            <div key={s.type}>
              {i === suggested.length && suggested.length > 0 && <div className="mx-2 my-1 h-px bg-zinc-950/6" />}
              <button
                type="button"
                role="option"
                aria-selected={on}
                // Not here: it keeps its tooltip, which says why.
                aria-disabled={!s.allowed || !usable(s.type) || undefined}
                title={!s.allowed ? s.reason : !usable(s.type) ? `No ${TYPE_LABEL[s.type].toLowerCase()} layouts you can use yet` : undefined}
                onMouseEnter={() => setActive(s.type)}
                onFocus={() => setActive(s.type)}
                onClick={() => s.allowed && usable(s.type) && add(s.type)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium transition focus-visible:outline-none ${
                  !s.allowed || !usable(s.type) ? 'cursor-default opacity-35' : on ? 'cursor-pointer bg-zinc-950/6 text-zinc-900' : 'cursor-pointer text-zinc-700'
                }`}
              >
                <Icon size={14} className={`shrink-0 ${on ? 'text-zinc-700' : 'text-zinc-400'}`} />
                <span className="flex-1 truncate">{TYPE_LABEL[s.type]}</span>
                {i < suggested.length && <Sparkles size={11} className="shrink-0 text-key-ink" />}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-zinc-950/[0.03] p-2.5">
        {active && best && clip ? (
          <>
            <div className="overflow-hidden rounded-lg ring-1 ring-zinc-950/10">
              <Preview clip={clip} width={338} height={204} />
            </div>
            <div className="mt-2.5 text-[14px] font-semibold text-zinc-900">{TYPE_LABEL[active]}</div>
            <div className="text-[12.5px] leading-snug text-zinc-500">{info?.reason}</div>
            <div className="mt-auto flex items-center gap-2 pt-3">
              <span className="truncate text-[11.5px] text-zinc-400" title={best.reason}>
                {clip.origin === 'layout' ? `Layout · ${clip.title}` : `From ${library.sources[clip.sourceId].name}`}
              </span>
              <button
                type="button"
                onClick={() => add(active)}
                className="btn-lit btn-ink cursor-pointer ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold"
              >
                Add {TYPE_LABEL[active]} <ArrowRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-4 text-center text-[12.5px] text-zinc-400">Point at a type on the left to see it here.</div>
        )}
      </div>
    </div>
  )
}

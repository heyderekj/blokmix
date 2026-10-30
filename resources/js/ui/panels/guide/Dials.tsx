import { Moon, Sun } from 'lucide-react'
import { DIAL_NAMES, DIALS, readDials, setTone, toneOfGuide } from '@/core/dials'
import { useStore } from '@/state/store'
import { useGuideData } from './shared'

/**
 * Feel: a few dials that move several tokens at once (spacing, type size, roundness, weight) and a light/dark switch,
 * for tuning the style guide without knowing token names. The group tiles below stay for finer control.
 */
export function Dials() {
  const { tokens } = useGuideData()
  const values = readDials(tokens)
  const tone = toneOfGuide(tokens)
  const st = useStore.getState
  return (
    <div className="col-span-2 rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-zinc-900">Feel</span>
        <div className="flex rounded-full bg-chip p-0.5" role="radiogroup" aria-label="Light or dark">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tone === t}
              onClick={() => st().chooseTokens(setTone(tokens, t))}
              className={`flex h-6 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                tone === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 [@media(hover:hover)_and_(pointer:fine)]:hover:text-zinc-800'
              }`}
            >
              {t === 'light' ? <Sun size={12} /> : <Moon size={12} />}
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2.5">
        {DIAL_NAMES.map((d) => {
          const dial = DIALS[d]
          return (
            <label key={d} className="grid gap-1">
              <span className="flex items-baseline justify-between text-[11.5px]">
                <span className="font-medium text-zinc-700">{dial.label}</span>
                <span className="text-[10.5px] text-zinc-400">
                  {dial.ends[0]} – {dial.ends[1]}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={values[d]}
                aria-label={dial.label}
                onChange={(e) => st().chooseTokens(dial.write(Number(e.target.value)))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}

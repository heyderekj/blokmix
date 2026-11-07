import { ColorButton } from '@/ui/color/ColorPicker'
import { useResolvedGuide } from '@/state/derived'
import { Moon, Sun, X } from 'lucide-react'
import { DIAL_NAMES, DIALS, readDials, setTone, toneOfGuide } from '@/core/dials'
import { useStore } from '@/state/store'
import { useGuideData } from './shared'
import { ColorsByFeel } from '../../jev/ColorsByFeel'

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
      <BrandColor fallback={tokens['color.primary']} />
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
      <ColorsByFeel />
    </div>
  )
}

/**
 * One brand color: a whole palette that reads (AA) is made from it, and trying another theme keeps it. The color
 * lands once you close the picker, as one undo step.
 */
export function BrandColor({ fallback }: { fallback: string }) {
  const brand = useStore((s) => s.guide.brand?.color)
  const mode = toneOfGuide(useResolvedGuide().tokens)
  const draft = brand ?? fallback
  const pick = (hex: string) => {
    useStore.getState().setBrandColor(hex)
    useStore.getState().showFlash('Made a palette from your brand color', { undo: true })
  }
  return (
    <div className="mb-3 flex items-center gap-2">
      <ColorButton
        value={draft}
        onPick={pick}
        palette={mode}
        title="Brand color"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left transition-[background-color] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-950/5"
      >
        <span className="size-6 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: draft }} />
        <span className="grid leading-tight">
          <span className="text-[11.5px] font-medium text-zinc-700">
            Brand color {brand && <span className="font-mono text-[10.5px] uppercase text-zinc-400">{brand}</span>}
          </span>
          <span className="text-[10.5px] text-zinc-400">{brand ? 'Your palette, kept when you try themes' : 'Pick one or paste a hex: the whole palette follows'}</span>
        </span>
      </ColorButton>
      {brand && (
        <button
          type="button"
          title="Forget the brand color (the colors stay; themes bring their own again)"
          aria-label="Forget the brand color"
          onClick={() => useStore.getState().setBrandColor(null)}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-zinc-400 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

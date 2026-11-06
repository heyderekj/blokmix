import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import type { Palette } from '@/core/palette'
import type { Ranked } from '@/core/jev/palettes'
import { swatchSvg } from '@/core/jev/swatch'
import { svgDataUri } from '@/core/media'
import { suggestPalettes } from '@/state/jevColors'

const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'

/**
 * Colors by feel, in the guided start: the sentence you described the site in (or any feel you type) becomes three
 * palettes Jev rates best, every one readable by construction. A click dresses the page in it.
 */
export function FeelColors({ feel: first, site, mode, picked, onPick }: { feel: string; site: string; mode?: 'light' | 'dark'; picked: Palette | null; onPick: (p: Palette, brand: string) => void }) {
  const [feel, setFeel] = useState(first)
  const [busy, setBusy] = useState(false)
  const [picks, setPicks] = useState<Ranked[] | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const find = async (words: string) => {
    if (!words.trim()) return
    setBusy(true)
    setNote(null)
    const r = await suggestPalettes({ feel: words.trim(), mode, site: { site } })
    setBusy(false)
    if (!r?.length) setNote('No answer this time. Try again.')
    setPicks(r)
  }

  // A described site starts with colors for that description.
  useEffect(() => {
    if (first.trim()) void find(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mt-5 rounded-2xl bg-white/80 p-3 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void find(feel)
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          <Sparkles size={15} className={busy ? 'motion-safe:animate-pulse' : 'text-[#9A8E97]'} /> Colors by feel
        </span>
        <input
          value={feel}
          onChange={(e) => setFeel(e.target.value)}
          placeholder="A cozy bakery, late-night jazz…"
          aria-label="Describe the feel"
          className="h-10 min-w-0 flex-1 basis-56 rounded-xl bg-white px-3 text-[14px] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] outline-none placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4]"
        />
        <button type="submit" disabled={busy || !feel.trim()} className={`h-10 rounded-full bg-[#17121A] px-4 text-[13px] font-semibold text-white disabled:opacity-40 ${PRESS}`}>
          {busy ? 'Looking…' : 'Find colors'}
        </button>
      </form>
      {note && <p className="pt-2 text-[13px] text-[#6B5F68]">{note}</p>}
      {picks && picks.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {picks.map((p) => {
            const on = picked === p.palette
            return (
              <button
                key={p.id + p.brand}
                type="button"
                onClick={() => onPick(p.palette, p.brand)}
                title={p.words}
                aria-pressed={on}
                className={`relative overflow-hidden rounded-xl text-left ${on ? 'shadow-[0_0_0_2px_#FF69B4]' : 'shadow-[0_0_0_1px_rgb(23_18_26/0.1)]'} ${PRESS}`}
              >
                <img src={svgDataUri(swatchSvg(p.palette))} alt="" className="block aspect-[7/4] w-full" />
                {on && (
                  <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-white text-[#FF69B4]">
                    <Check size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

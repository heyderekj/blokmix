import { useEffect, useState } from 'react'
import { ImagePlus, Wand2 } from 'lucide-react'
import type { Ranked } from '@/core/jev/palettes'
import { swatchSvg } from '@/core/jev/swatch'
import { svgDataUri } from '@/core/media'
import { jevOn } from '@/lib/jev'
import { pickFile } from '@/lib/pickFile'
import { suggestPalettes } from '@/state/jevColors'
import { useTokenPreview } from '@/state/derived'
import { runCommand } from '@/state/commands'
import { useJevTools } from '@/state/jevSay'
import { useStore } from '@/state/store'

/**
 * Colors by feel: say the feel ("a cozy bakery", "late-night jazz") or pick a logo or photo, and see three palettes
 * Jev thinks fit, every one readable (AA) by construction. Hover shows one on the page; a click puts it on.
 */
export function ColorsByFeel() {
  const [on, setOn] = useState(false)
  const asked = useJevTools((s) => (s.open === 'colors' ? s.text : undefined))
  const [feel, setFeel] = useState('')
  const [busy, setBusy] = useState(false)
  const [picks, setPicks] = useState<Ranked[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const preview = useTokenPreview((s) => s.setPatch)

  useEffect(() => {
    let live = true
    jevOn().then((v) => live && setOn(v))
    return () => {
      live = false
      preview(null)
    }
  }, [preview])

  const find = async (ask: { feel?: string; picture?: Blob }) => {
    setBusy(true)
    setNote(null)
    const r = await suggestPalettes(ask)
    setBusy(false)
    if (!r?.length) setNote('No answer this time. Try again.')
    setPicks(r)
  }

  // Said in Say it ("warmer colors", "colors like the ocean"): start from those words.
  useEffect(() => {
    if (!asked || !on) return
    setFeel(asked)
    useJevTools.setState({ open: null, text: undefined })
    void find({ feel: asked })
  }, [asked, on])

  if (!on) return null
  return (
    <div className="mt-3 border-t border-zinc-950/6 pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-700">
        <Wand2 size={12} className="text-zinc-500" /> Colors by feel
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (feel.trim()) void find({ feel: feel.trim() })
        }}
        className="flex items-center gap-1.5"
      >
        <input
          value={feel}
          onChange={(e) => setFeel(e.target.value)}
          placeholder="A cozy bakery, late-night jazz…"
          aria-label="Describe the feel"
          className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2.5 text-[12.5px] text-zinc-900 outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
        />
        <button type="submit" disabled={busy || !feel.trim()} className="h-8 cursor-pointer rounded-full bg-zinc-900 px-3 text-[12px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-40">
          {busy ? 'Looking…' : 'Find'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => pickFile('image/png,image/jpeg,image/webp', (file) => void find({ feel: feel.trim() || undefined, picture: file }))}
          title="Match a logo or photo"
          aria-label="Match a logo or photo"
          className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97] disabled:opacity-40"
        >
          <ImagePlus size={14} />
        </button>
      </form>
      {note && <p className="pt-1.5 text-[11.5px] text-zinc-500">{note}</p>}
      {picks && picks.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1.5" onMouseLeave={() => preview(null)}>
          {picks.map((p) => (
            <button
              key={p.id + p.brand}
              type="button"
              onMouseEnter={() => preview(p.palette)}
              onFocus={() => preview(p.palette)}
              onClick={() => {
                preview(null)
                runCommand('set_palette', { colors: p.palette }, 'you')
                useStore.getState().showFlash(`New colors: ${p.words}`, { undo: true })
              }}
              title={p.words}
              className="cursor-pointer overflow-hidden rounded-lg text-left ring-1 ring-zinc-950/10 transition hover:ring-zinc-400 active:scale-[0.97]"
            >
              <img src={svgDataUri(swatchSvg(p.palette))} alt="" className="block aspect-[7/4] w-full" />
              <span className="block truncate px-1.5 py-1 text-[10.5px] text-zinc-600">{p.words.split(', ')[2]?.replace(/ buttons$/, '') ?? p.words}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { ICON_NAMES, ICON_SETS, iconSvg } from '@/core/icons'
import { useResolvedGuide } from '@/state/derived'

/** An icon drawn in a set, for the chrome. The SVG comes from our own bundled packs. */
export function IconGlyph({ name, set, size = 18 }: { name: string; set: string; size?: number }) {
  const svg = useMemo(() => iconSvg(name, set, [['width', String(size)], ['height', String(size)]]), [name, set, size])
  return svg ? <span className="inline-grid place-items-center" dangerouslySetInnerHTML={{ __html: svg }} /> : null
}

const label = (n: string) => n.replace(/-/g, ' ')

/**
 * Choose the icon in an icon block, drawn in your style guide's set. Hovering
 * one shows it on the page.
 */
export function IconMenu({ current, original, onHover, onPick }: { current?: string; original?: string; onHover: (name: string | null) => void; onPick: (name: string | null) => void }) {
  const set = useResolvedGuide().tokens['icon.set']
  const [q, setQ] = useState('')
  const names = ICON_NAMES.filter((n) => !q || n.includes(q.trim().toLowerCase()))
  const chosen = current ?? original
  return (
    <div className="glass-menu w-[320px] animate-pop rounded-2xl p-2">
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-white px-2 ring-1 ring-zinc-950/10 focus-within:ring-zinc-400">
        <Search size={13} className="text-zinc-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons" className="h-8 flex-1 bg-transparent text-[12.5px] outline-none" />
      </div>
      <div className="grid max-h-56 grid-cols-7 gap-0.5 overflow-y-auto thin-scroll" onMouseLeave={() => onHover(null)}>
        {names.map((n) => (
          <button
            key={n}
            type="button"
            title={label(n)}
            onMouseEnter={() => onHover(n)}
            onClick={() => onPick(n)}
            className={`grid aspect-square place-items-center rounded-lg text-zinc-800 transition active:scale-[0.95] ${chosen === n ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-950/6'}`}
          >
            <IconGlyph name={n} set={set} />
          </button>
        ))}
        {!names.length && <p className="col-span-7 px-1 py-3 text-[12px] text-zinc-500">No icon called “{q}”.</p>}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-zinc-950/6 px-1 pt-2 text-[11px] text-zinc-500">
        <span>
          Drawn in <span className="font-semibold text-zinc-700">{ICON_SETS.find((s) => s.id === set)?.label}</span> (style guide)
        </span>
        {current && (
          <button type="button" onClick={() => onPick(null)} className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900">
            <RotateCcw size={11} /> {original ? label(original) : 'Original'}
          </button>
        )}
      </div>
    </div>
  )
}

const SAMPLE = ['star', 'mail', 'heart', 'settings', 'arrow-right']

/** Pick the style guide's icon set, each shown drawing a few icons. */
export function IconSetPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-0.5">
      {ICON_SETS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${value === s.id ? 'bg-zinc-950/[0.07]' : 'hover:bg-zinc-950/[0.04]'}`}
        >
          <span className="flex gap-1.5 text-zinc-800">
            {SAMPLE.map((n) => (
              <IconGlyph key={n} name={n} set={s.id} size={16} />
            ))}
          </span>
          <span className="flex-1 text-[12.5px] font-medium text-zinc-700">{s.label}</span>
          {value === s.id && <span className="size-1.5 rounded-full bg-key" />}
        </button>
      ))}
    </div>
  )
}

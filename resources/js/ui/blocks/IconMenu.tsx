import { useMemo, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { ICON_NAMES, ICON_PACKS, iconSet, iconSvg, sameStyleIn, setsInPack } from '@/core/icons'
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
            className={`grid aspect-square place-items-center rounded-lg text-zinc-800 transition active:scale-[0.97] ${chosen === n ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-950/6'}`}
          >
            <IconGlyph name={n} set={set} />
          </button>
        ))}
        {!names.length && <p className="col-span-7 px-1 py-3 text-[12px] text-zinc-500">No icon called “{q}”.</p>}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-zinc-950/6 px-1 pt-2 text-[11px] text-zinc-500">
        <span>
          Drawn in <span className="font-semibold text-zinc-700">{iconSet(set).label}</span> (style guide)
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

/**
 * Pick the style guide's icons: a pack first (each row draws a few icons in it, at the weight you have now), then
 * one of that pack's styles. Every icon on the site redraws in the pick.
 */
export function IconSetPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const now = iconSet(value)
  const styles = setsInPack(now.pack)
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-0.5" role="radiogroup" aria-label="Icon pack">
        {ICON_PACKS.map((p) => {
          const id = p.id === now.pack ? now.id : sameStyleIn(p.id, value)
          const on = p.id === now.pack
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={`${p.label}: ${p.hint}`}
              onClick={() => onChange(id)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition active:scale-[0.97] ${on ? 'bg-zinc-950/[0.07]' : 'hover:bg-zinc-950/[0.04]'}`}
            >
              <span className="flex gap-1.5 text-zinc-800">
                {SAMPLE.map((n) => (
                  <IconGlyph key={n} name={n} set={id} size={16} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-zinc-700">{p.label}</span>
                <span className="block truncate text-[11px] text-zinc-400">{p.hint}</span>
              </span>
              {on && <span className="size-1.5 shrink-0 rounded-full bg-key" />}
            </button>
          )
        })}
      </div>
      <div>
        <div className="mb-1.5 px-0.5 text-[11px] font-semibold text-zinc-400">Style</div>
        <div className="flex rounded-full bg-chip p-0.5" role="radiogroup" aria-label={`${ICON_PACKS.find((p) => p.id === now.pack)?.label} style`}>
          {styles.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={x.id === now.id}
              title={x.label}
              onClick={() => onChange(x.id)}
              className={`flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-full px-1 text-[11.5px] font-semibold transition ${x.id === now.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {styles.length <= 4 && <IconGlyph name="star" set={x.id} size={12} />}
              <span className="truncate">{x.short}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

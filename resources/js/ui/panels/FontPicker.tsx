import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { FontSource, TokenKey } from '@/core/types'
import { FONT_LIBRARY, PROVIDER_LABEL, VIBES, fontStack, type FontProvider, type FontRole, type FontVibe, type LibraryFont } from '@/core/fonts'
import { FONTSOURCE_CDN, primaryFamily } from '@/core/tokens'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { FONT_CATALOG, useTokenPreview } from '@/state/derived'

const ROLE: Record<string, FontRole> = { 'font.display': 'display', 'font.body': 'body', 'font.mono': 'mono' }
const ROLE_VIBE: Record<FontRole, FontVibe | 'all'> = { display: 'display', body: 'sans', mono: 'mono' }

/** A row in the picker: a library font, or one that came with your clips. */
interface Row {
  family: string
  provider: FontProvider
  styles: number
  stack: string
  lib?: LibraryFont
  clip?: FontSource
}

/* ---------- loading previews in the app itself ---------- */

const loaded = new Set<string>()
function loadPreview(row: Row, text: string) {
  let href: string
  if (row.provider === 'fontshare') href = `https://api.fontshare.com/v2/css?f[]=${row.lib!.slug}@${row.lib!.weights.join(',')}&display=swap`
  else if (row.provider === 'fontsource') href = `${FONTSOURCE_CDN}/${row.lib!.slug}/400.css`
  else {
    // Google can send just the letters a preview needs: tiny, fast files.
    const fam = row.clip?.css2 ?? row.family.replace(/ /g, '+')
    href = `https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent([...new Set(text)].join(''))}&display=swap`
  }
  if (loaded.has(href)) return
  loaded.add(href)
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

/** A clip's own stack for a family (keeps its fallbacks), else one that fits the kind of font. */
function stackFor(family: string, k: TokenKey): string {
  for (const s of Object.values(library.sources))
    for (const key of ['font.display', 'font.body', 'font.mono'] as const) if (primaryFamily(s.tokens[key]) === family) return s.tokens[key]
  return fontStack(family, ROLE[k])
}

/**
 * The style guide's font control: the current font drawn in itself, opening
 * into a library of free fonts by vibe (after "Usable Google Fonts"), each
 * previewed with your brand's own name (Pica's logo previews). Hover one to see
 * it on the page; click to use it.
 */
export function FontField({ k, value, onChange }: { k: TokenKey; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  // The font actually chosen, not one you're hovering in the list.
  const guide = useStore((s) => s.guide)
  const fam = primaryFamily(open ? resolveGuide(guide).tokens[k] : value)
  const lib = FONT_LIBRARY.find((f) => f.family === fam)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-zinc-950/10 bg-white px-2.5 text-left transition hover:border-zinc-950/25 active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-900" style={{ fontFamily: value }}>
          {fam}
        </span>
        <span className="shrink-0 text-[10.5px] font-semibold text-zinc-400">{lib ? PROVIDER_LABEL[lib.provider] : 'From your clips'}</span>
        <ChevronDown size={13} className={`shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <FontPicker
          k={k}
          current={fam}
          onPick={(v) => onChange(v)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function FontPicker({ k, current, onPick, onClose }: { k: TokenKey; current: string; onPick: (stack: string) => void; onClose: () => void }) {
  const role = ROLE[k]
  const brand = useStore((s) => s.content.brand) || 'Mixtape'
  const line = useStore((s) => s.content.fields.hero?.headline) || 'Clip the web. Mix your site.'
  const [q, setQ] = useState('')
  const [vibe, setVibe] = useState<FontVibe | 'all' | 'clips'>(ROLE_VIBE[role])
  const [provider, setProvider] = useState<FontProvider | 'all'>('all')
  const preview = useTokenPreview((s) => s.set)
  const box = useRef<HTMLDivElement>(null)

  // What a row says in its font: your brand for headings, a line of your copy for text.
  const sample = role === 'display' ? brand : role === 'mono' ? `${brand} v1.0 → 200 OK` : line
  const text = `${sample}${current}`

  const rows = useMemo<Row[]>(() => {
    const ql = q.trim().toLowerCase()
    const fromClips: Row[] = [...new Map(FONT_CATALOG.map((f) => [f.family, f])).values()]
      .filter((f) => !FONT_LIBRARY.some((l) => l.family === f.family))
      .map((f) => ({ family: f.family, provider: 'google', styles: (f.css2.match(/\d{3}/g) ?? ['400']).length, stack: stackFor(f.family, k), clip: f }))
    const lib: Row[] = FONT_LIBRARY.map((f) => ({ family: f.family, provider: f.provider, styles: f.weights.length, stack: stackFor(f.family, k), lib: f }))
    const pool = vibe === 'clips' ? fromClips : [...lib, ...(vibe === 'all' ? fromClips : [])]
    return pool.filter(
      (r) =>
        (!ql || r.family.toLowerCase().includes(ql)) &&
        (provider === 'all' || r.provider === provider) &&
        (vibe === 'all' || vibe === 'clips' || ql !== '' || r.lib?.vibes.includes(vibe)),
    )
  }, [q, vibe, provider, k])

  useEffect(() => () => preview(null), [preview])
  useEffect(() => {
    const down = (e: PointerEvent) => !box.current?.parentElement?.contains(e.target as Node) && onClose()
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [onClose])

  return (
    <div ref={box} className="mt-1.5 overflow-hidden rounded-xl border border-zinc-950/10 bg-white shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]">
      <div className="space-y-2 border-b border-zinc-950/6 p-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-zinc-950/[0.04] px-2 focus-within:ring-2 focus-within:ring-zinc-900/10">
          <Search size={13} className="text-zinc-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder={`Search ${FONT_LIBRARY.length} free fonts`}
            className="h-8 flex-1 bg-transparent text-[12.5px] outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['all', 'All'],
              ...VIBES.map((v) => [v.id, v.label] as const),
              ['clips', 'From your clips'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              title={VIBES.find((v) => v.id === id)?.hint}
              onClick={() => setVibe(id)}
              className={`h-6 rounded-full px-2 text-[11.5px] font-medium transition active:scale-[0.97] ${vibe === id ? 'bg-zinc-900 text-white' : 'bg-zinc-950/[0.04] text-zinc-600 hover:text-zinc-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-500">
          {(['all', 'google', 'fontshare', 'fontsource'] as const).map((p) => (
            <button key={p} type="button" onClick={() => setProvider(p)} className={`rounded-md px-1.5 py-0.5 font-semibold transition ${provider === p ? 'bg-zinc-950/[0.07] text-zinc-900' : 'hover:text-zinc-900'}`}>
              {p === 'all' ? 'Every source' : PROVIDER_LABEL[p]}
            </button>
          ))}
          <span className="ml-auto tabular-nums">{rows.length}</span>
        </div>
      </div>
      <div className="max-h-[340px] overflow-y-auto overscroll-contain p-1 thin-scroll" data-scroll-ok onMouseLeave={() => preview(null)}>
        {rows.map((r) => (
          <FontRow
            key={r.family}
            row={r}
            sample={sample}
            text={text}
            display={role === 'display'}
            on={r.family === current}
            onHover={() => preview({ key: k, value: r.stack })}
            onPick={() => {
              preview(null)
              onPick(r.stack)
            }}
          />
        ))}
        {!rows.length && <p className="px-2 py-4 text-[12px] text-zinc-500">No free font called “{q}”. Try another name or a different vibe.</p>}
      </div>
      <p className="border-t border-zinc-950/6 px-3 py-2 text-[10.5px] leading-snug text-zinc-400">
        All free for commercial use: Google Fonts and Fontsource under the SIL Open Font License, Fontshare under the ITF Free Font License. Exports load them from the same places.
      </p>
    </div>
  )
}

function FontRow({ row, sample, text, display, on, onHover, onPick }: { row: Row; sample: string; text: string; display: boolean; on: boolean; onHover: () => void; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  // Load the font only once its row scrolls into view.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        loadPreview(row, text + row.family + 'Aa')
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [row, text])
  return (
    <button
      ref={ref}
      type="button"
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onPick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition active:scale-[0.99] ${on ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/[0.04]'}`}
    >
      {/* The font's character at a glance, the way font managers show it. */}
      <span
        aria-hidden
        className={`grid size-11 shrink-0 place-items-center rounded-[10px] text-[21px] leading-none ring-1 ${on ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-zinc-950/[0.035] text-zinc-900 ring-zinc-950/[0.06]'}`}
        style={{ fontFamily: `'${row.family}', system-ui` }}
      >
        Aa
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate leading-tight text-zinc-900 ${display ? 'text-[22px]' : 'text-[14.5px]'}`} style={{ fontFamily: `'${row.family}', system-ui` }}>
          {sample}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-700" style={{ fontFamily: `'${row.family}', system-ui` }}>
            {row.family}
          </span>
          <span>·</span>
          <span className="truncate">{row.clip ? 'From your clips' : (row.lib?.maker && row.lib.provider !== 'fontshare' ? row.lib.maker : PROVIDER_LABEL[row.provider])}</span>
          <span>·</span>
          <span>
            {row.styles} weight{row.styles > 1 ? 's' : ''}
          </span>
        </span>
      </span>
      {on && <Check size={14} className="shrink-0 text-zinc-900" />}
    </button>
  )
}

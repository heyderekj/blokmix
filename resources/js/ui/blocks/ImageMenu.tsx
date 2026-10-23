import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Search, Shuffle, Trash2, Upload } from 'lucide-react'
import type { BlockInfo, MediaFill, PlaceholderStyle, StockPhoto } from '@/core/types'
import { PLACEHOLDER_STYLES } from '@/core/types'
import { PLACEHOLDER_LABEL, parseUnsplash, placeholderSvg, svgDataUri, unsplashSearchUrl } from '@/core/media'
import { useResolvedGuide } from '@/state/derived'
import { addImage, removeAsset, useAssets } from '@/lib/assets'
import { Steps } from './Spacing'

type Tab = 'placeholder' | 'upload' | 'stock'

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined

/**
 * What fills an image block: a placeholder in your palette, something you
 * upload or paste, or a stock photo. Hovering an option shows it on the page.
 */
export function ImageMenu({
  block,
  fill,
  onHover,
  onPick,
}: {
  block: BlockInfo
  fill?: MediaFill
  onHover: (m: MediaFill | null) => void
  onPick: (m: MediaFill | null) => void
}) {
  const [tab, setTab] = useState<Tab>(fill?.source ?? 'placeholder')
  const set = (m: Partial<MediaFill>) => onPick({ ...(fill ?? { source: 'placeholder' }), ...m } as MediaFill)

  return (
    <div className="glass-menu w-[352px] animate-pop rounded-2xl p-2">
      <div className="mb-2 flex rounded-full bg-chip p-0.5">
        {(['placeholder', 'upload', 'stock'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-7 flex-1 rounded-full text-[12px] font-semibold transition ${tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            {t === 'placeholder' ? 'Placeholder' : t === 'upload' ? 'Upload' : 'Stock'}
            {fill?.source === t && <span className="ml-1 inline-block size-1.5 rounded-full bg-tape align-middle" />}
          </button>
        ))}
      </div>

      {tab === 'placeholder' && <Placeholders block={block} fill={fill} onHover={onHover} onPick={onPick} />}
      {tab === 'upload' && <Uploads fill={fill} onHover={onHover} onPick={onPick} />}
      {tab === 'stock' && <Stock block={block} fill={fill} onHover={onHover} onPick={onPick} />}

      {fill && (
        <div className="mt-2 space-y-2 border-t border-zinc-950/6 px-1 pt-2">
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-400">Describe it (alt text)</span>
            <input
              defaultValue={fill.alt ?? ''}
              key={`${fill.source}${fill.asset ?? fill.stock?.id ?? fill.seed}`}
              onBlur={(e) => e.target.value !== (fill.alt ?? '') && set({ alt: e.target.value || undefined })}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder={fill.source === 'placeholder' ? 'Decorative? Leave it empty' : 'What’s in the picture, for people who can’t see it'}
              className="mt-1 w-full rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] text-zinc-900 outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">Crop</span>
            <div className="flex-1">
              <Steps
                options={[
                  { v: 'cover', label: 'Fill the frame' },
                  { v: 'contain', label: 'Show it all' },
                ]}
                value={fill.fit ?? 'cover'}
                onPick={(v) => set({ fit: v === 'cover' ? undefined : v })}
              />
            </div>
            <button type="button" onClick={() => onPick(null)} title="Back to the clip’s own art" className="grid size-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Placeholders({ block, fill, onHover, onPick }: { block: BlockInfo; fill?: MediaFill; onHover: (m: MediaFill | null) => void; onPick: (m: MediaFill) => void }) {
  const tokens = useResolvedGuide().tokens
  const [seed, setSeed] = useState(fill?.source === 'placeholder' ? (fill.seed ?? 1) : 1)
  const styles = useMemo(() => {
    // Portraits first for avatars and people; scenes first elsewhere.
    const people = /avatar|portrait|photo|member/i.test(block.media ?? '') || block.ratio === '1/1'
    return people ? (['portrait', ...PLACEHOLDER_STYLES.filter((s) => s !== 'portrait')] as PlaceholderStyle[]) : [...PLACEHOLDER_STYLES]
  }, [block])
  const make = (style: PlaceholderStyle): MediaFill => ({ source: 'placeholder', style, seed, alt: fill?.source === 'placeholder' ? fill.alt : undefined, fit: fill?.fit })
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5" onMouseLeave={() => onHover(null)}>
        {styles.map((style) => {
          const on = fill?.source === 'placeholder' && fill.style === style
          return (
            <button key={style} type="button" onMouseEnter={() => onHover(make(style))} onClick={() => onPick(make(style))} className="group flex flex-col gap-1 text-left active:scale-[0.97]">
              <img
                alt=""
                src={svgDataUri(placeholderSvg(style, seed, tokens, block.ratio))}
                className={`aspect-[4/3] w-full rounded-lg object-cover transition ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10 group-hover:ring-zinc-950/30'}`}
              />
              <span className={`px-0.5 text-[11px] ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{PLACEHOLDER_LABEL[style]}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          const next = seed + 1
          setSeed(next)
          if (fill?.source === 'placeholder') onPick({ ...fill, seed: next })
        }}
        className="mt-1.5 flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-950/5"
      >
        <Shuffle size={12} /> Shuffle
      </button>
      <p className="px-1 pt-1 text-[11px] leading-snug text-zinc-400">Drawn from your palette, so they change with your style guide.</p>
    </div>
  )
}

function Uploads({ fill, onHover, onPick }: { fill?: MediaFill; onHover: (m: MediaFill | null) => void; onPick: (m: MediaFill) => void }) {
  const assets = useAssets((s) => s.assets)
  const list = Object.values(assets).sort((a, b) => b.addedAt - a.addedAt)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const take = async (files: FileList | File[] | null) => {
    const f = files && [...files].find((x) => x.type.startsWith('image/'))
    if (!f) return
    setBusy(true)
    try {
      const a = await addImage(f, f.name)
      onPick({ source: 'upload', asset: a.id, fit: fill?.fit })
    } finally {
      setBusy(false)
    }
  }
  // Paste an image straight in while this tab is open.
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.some((f) => f.type.startsWith('image/'))) {
        e.preventDefault()
        void take(files)
      }
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  })
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void take(e.dataTransfer.files)
        }}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-4 text-center transition ${over ? 'border-zinc-900 bg-zinc-950/5' : 'border-zinc-300 hover:border-zinc-500'}`}
      >
        {busy ? <Upload size={18} className="animate-pulse text-zinc-500" /> : <ImagePlus size={18} className="text-zinc-500" />}
        <span className="text-[12.5px] font-semibold text-zinc-800">{busy ? 'Adding…' : 'Drop, paste or choose an image'}</span>
        <span className="text-[11px] text-zinc-400">Kept in this browser, resized to 1,600px</span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void take(e.target.files)} />
      {list.length > 0 && (
        <div className="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto thin-scroll" onMouseLeave={() => onHover(null)}>
          {list.map((a) => {
            const on = fill?.source === 'upload' && fill.asset === a.id
            const m: MediaFill = { source: 'upload', asset: a.id, fit: fill?.fit }
            return (
              <div key={a.id} className="group relative">
                <button type="button" onMouseEnter={() => onHover(m)} onClick={() => onPick(m)} className="block w-full active:scale-[0.97]">
                  <img alt={a.name} src={a.dataUrl} className={`aspect-square w-full rounded-lg object-cover ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`} />
                </button>
                <button
                  type="button"
                  title="Remove from this browser"
                  onClick={() => void removeAsset(a.id)}
                  className="absolute right-0.5 top-0.5 hidden size-5 place-items-center rounded-full bg-white/90 text-zinc-600 shadow-sm group-hover:grid"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stock({ block, fill, onHover, onPick }: { block: BlockInfo; fill?: MediaFill; onHover: (m: MediaFill | null) => void; onPick: (m: MediaFill) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<(StockPhoto & { track: string })[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  if (!UNSPLASH_KEY)
    return (
      <div className="rounded-xl bg-zinc-950/[0.04] px-3 py-3 text-[12px] leading-relaxed text-zinc-600">
        Stock photos come from Unsplash. Add a free access key to <code className="rounded bg-white px-1 font-mono text-[11px]">.env.local</code> as{' '}
        <code className="rounded bg-white px-1 font-mono text-[11px]">VITE_UNSPLASH_ACCESS_KEY</code> and restart the dev server.
      </div>
    )
  const search = async () => {
    if (!q.trim()) return
    setState('loading')
    try {
      const res = await fetch(unsplashSearchUrl(q.trim(), block.ratio), { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } })
      if (!res.ok) throw new Error(String(res.status))
      setResults(parseUnsplash(await res.json()))
      setState('idle')
    } catch {
      setState('error')
    }
  }
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
        className="flex items-center gap-1.5 rounded-lg bg-white px-2 ring-1 ring-zinc-950/10 focus-within:ring-zinc-400"
      >
        <Search size={13} className="text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Unsplash" className="h-8 flex-1 bg-transparent text-[12.5px] outline-none" />
      </form>
      {state === 'error' && <p className="px-1 pt-2 text-[12px] text-problem-ink">Unsplash didn’t answer. Check the key and try again.</p>}
      <div className="mt-2 grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto thin-scroll" onMouseLeave={() => onHover(null)}>
        {results.map((p) => {
          const m: MediaFill = { source: 'stock', stock: p, fit: fill?.fit }
          const on = fill?.source === 'stock' && fill.stock?.id === p.id
          return (
            <button
              key={p.id}
              type="button"
              title={`${p.description ?? ''} · ${p.author}`}
              onMouseEnter={() => onHover(m)}
              onClick={() => {
                onPick(m)
                // Unsplash asks apps to count a download when a photo is used.
                void fetch(p.track, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(() => {})
              }}
              className="active:scale-[0.97]"
            >
              <img alt={p.description ?? ''} src={p.thumb} className={`aspect-[4/3] w-full rounded-lg object-cover ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`} />
            </button>
          )
        })}
      </div>
      {fill?.source === 'stock' && fill.stock && (
        <p className="px-1 pt-1.5 text-[11px] text-zinc-500">
          Photo by{' '}
          <a href={`${fill.stock.authorUrl}?utm_source=mixtape&utm_medium=referral`} target="_blank" rel="noreferrer" className="underline">
            {fill.stock.author}
          </a>{' '}
          on Unsplash
        </p>
      )}
    </div>
  )
}

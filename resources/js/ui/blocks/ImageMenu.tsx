import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Search, Shuffle, Trash2, Upload } from 'lucide-react'
import type { BlockInfo, MediaFill, MediaPlay, PlaceholderStyle, StockPhoto } from '@/core/types'
import { PLACEHOLDER_STYLES } from '@/core/types'
import { PLACEHOLDER_LABEL, detectLink, embedPoster, parseUnsplash, placeholderSvg, svgDataUri, unsplashSearchUrl } from '@/core/media'
import { useResolvedGuide } from '@/state/derived'
import { addFile, addImage, removeAsset, useAssets, type Asset } from '@/lib/assets'
import { Steps } from './Spacing'
import { Switch } from '../panels/parts'

type Tab = 'placeholder' | 'upload' | 'link' | 'stock'

const tabOf = (f?: MediaFill): Tab =>
  !f ? 'placeholder' : f.source === 'embed' || (f.link && !f.asset) ? 'link' : f.source === 'video' || f.source === 'lottie' || f.source === 'upload' ? 'upload' : f.source

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
  const [tab, setTab] = useState<Tab>(tabOf(fill))
  const set = (m: Partial<MediaFill>) => onPick({ ...(fill ?? { source: 'placeholder' }), ...m } as MediaFill)

  return (
    <div className="glass-menu w-[352px] animate-pop rounded-2xl p-2">
      <div className="mb-2 flex rounded-full bg-chip p-0.5">
        {(['placeholder', 'upload', 'link', 'stock'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-7 flex-1 rounded-full text-[12px] font-semibold transition ${tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            {t === 'placeholder' ? 'Placeholder' : t === 'upload' ? 'Upload' : t === 'link' ? 'Link' : 'Stock'}
            {fill && tabOf(fill) === t && <span className="ml-1 inline-block size-1.5 rounded-full bg-key align-middle" />}
          </button>
        ))}
      </div>

      {tab === 'placeholder' && <Placeholders block={block} fill={fill} onHover={onHover} onPick={onPick} />}
      {tab === 'upload' && <Uploads fill={fill} onHover={onHover} onPick={onPick} />}
      {tab === 'link' && <LinkTab fill={fill} onPick={onPick} />}
      {tab === 'stock' && <Stock block={block} fill={fill} onHover={onHover} onPick={onPick} />}
      {fill && (fill.source === 'video' || fill.source === 'lottie' || fill.source === 'embed') && <Playback fill={fill} set={set} />}
      {fill && fill.source !== 'video' && fill.source !== 'lottie' && fill.source !== 'embed' && (
        <div className="mt-2 flex items-center justify-between px-1 text-[12px] text-zinc-600">
          Opens larger in a lightbox
          <Switch on={!!fill.lightbox} onChange={() => set({ lightbox: !fill.lightbox || undefined })} label="Lightbox" />
        </div>
      )}

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
  const [error, setError] = useState<string | null>(null)
  const take = async (files: FileList | File[] | null) => {
    const f = files && [...files][0]
    if (!f) return
    setBusy(true)
    setError(null)
    try {
      onPick(fillFor(await addFile(f), fill))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  // Paste an image straight in while this tab is open.
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
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
        <span className="text-[12.5px] font-semibold text-zinc-800">{busy ? 'Adding…' : 'Drop, paste or choose a file'}</span>
        <span className="text-[11px] text-zinc-400">Images, videos or Lotties (.lottie, .json), kept in this browser</span>
      </button>
      <input ref={input} type="file" accept="image/*,video/*,.lottie,.json" hidden onChange={(e) => void take(e.target.files)} />
      {error && <p className="px-1 pt-1.5 text-[12px] text-problem-ink">{error}</p>}
      {list.length > 0 && (
        <div className="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto thin-scroll" onMouseLeave={() => onHover(null)}>
          {list.map((a) => {
            const on = fill?.asset === a.id
            const m: MediaFill = fillFor(a, fill)
            return (
              <div key={a.id} className="group relative">
                <button type="button" onMouseEnter={() => onHover(m)} onClick={() => onPick(m)} className="block w-full active:scale-[0.97]">
                  {a.dataUrl || a.poster ? (
                    <img alt={a.name} src={a.dataUrl ?? a.poster} className={`aspect-square w-full rounded-lg object-cover ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`} />
                  ) : (
                    <span className={`grid aspect-square w-full place-items-center rounded-lg bg-zinc-950/5 text-[10px] font-semibold uppercase text-zinc-500 ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`}>Lottie</span>
                  )}
                  {a.kind === 'video' && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-zinc-900/75 px-1 text-[9px] font-semibold text-white">Video</span>}
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
          <a href={`${fill.stock.authorUrl}?utm_source=blokmix&utm_medium=referral`} target="_blank" rel="noreferrer" className="underline">
            {fill.stock.author}
          </a>{' '}
          on Unsplash
        </p>
      )}
    </div>
  )
}

/** A stored file as a fill, keeping the crop and description you'd set. */
function fillFor(a: Asset, prev?: MediaFill): MediaFill {
  const keep = { fit: prev?.fit, alt: prev?.alt, lightbox: prev?.lightbox }
  if (a.kind === 'video') return { source: 'video', asset: a.id, play: 'inview', loop: true, ...keep }
  if (a.kind === 'lottie') return { source: 'lottie', asset: a.id, play: 'inview', loop: true, ...keep }
  return { source: 'upload', asset: a.id, ...keep }
}

/** Paste a link to a video file, a Lottie, or a YouTube/Vimeo page. */
function LinkTab({ fill, onPick }: { fill?: MediaFill; onPick: (m: MediaFill) => void }) {
  const [url, setUrl] = useState(fill?.link?.url ?? '')
  const found = url.trim() ? detectLink(url) : null
  const what = found ? (found.source === 'embed' ? (found.link.provider === 'youtube' ? 'YouTube video' : 'Vimeo video') : found.source === 'video' ? 'Video file' : 'Lottie animation') : null
  const use = () => {
    if (!found) return
    onPick({ source: found.source, link: found.link, play: found.source === 'embed' ? 'click' : 'inview', loop: found.source !== 'embed', lightbox: found.source === 'embed' ? true : fill?.lightbox, alt: fill?.alt, fit: fill?.fit })
  }
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          use()
        }}
        className="flex items-center gap-1.5"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a video, Lottie, YouTube or Vimeo link"
          className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2.5 text-[12.5px] outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
        />
        <button type="submit" disabled={!found} className="btn-lit btn-ink h-8 rounded-lg px-3 text-[12px] font-semibold">
          Use
        </button>
      </form>
      <p className="px-1 pt-1.5 text-[11px] text-zinc-500">
        {url.trim() ? (what ? `${what}. ${found!.source === 'embed' ? 'Shows its poster and plays on click, so the player only loads when asked.' : 'Plays right on the page.'}` : 'Not a link I can play: try an .mp4, .webm, .lottie or .json file, or a YouTube or Vimeo page.') : 'Videos and animations hosted elsewhere stay there; nothing is copied.'}
      </p>
    </div>
  )
}

const PLAY_LABEL: Record<MediaPlay, string> = { autoplay: 'Always', hover: 'On hover', inview: 'In view', click: 'On click', scrub: 'With scroll' }

/** When moving media plays, whether it loops, and whether a click opens it large. */
function Playback({ fill, set }: { fill: MediaFill; set: (m: Partial<MediaFill>) => void }) {
  const plays: MediaPlay[] = fill.source === 'embed' ? ['click'] : fill.source === 'lottie' ? ['autoplay', 'inview', 'hover', 'click', 'scrub'] : ['autoplay', 'inview', 'hover', 'click']
  const play = fill.play ?? (fill.source === 'embed' ? 'click' : 'inview')
  return (
    <div className="mt-2 space-y-2 border-t border-zinc-950/6 px-1 pt-2">
      {fill.source !== 'embed' && (
        <div>
          <div className="mb-1 text-[11px] font-semibold text-zinc-400">Plays</div>
          <div className="flex flex-wrap gap-1">
            {plays.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set({ play: p })}
                className={`h-7 rounded-full px-2.5 text-[12px] font-semibold transition active:scale-[0.97] ${play === p ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'}`}
              >
                {PLAY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      )}
      {fill.source !== 'embed' && play !== 'scrub' && play !== 'click' && (
        <div className="flex items-center justify-between text-[12px] text-zinc-600">
          Loops
          <Switch on={fill.loop !== false} onChange={() => set({ loop: fill.loop === false })} label="Loop" />
        </div>
      )}
      <div className="flex items-center justify-between text-[12px] text-zinc-600">
        {fill.source === 'embed' ? 'Plays in a lightbox (off: plays in place)' : 'Click opens it larger in a lightbox'}
        <Switch on={!!fill.lightbox} onChange={() => set({ lightbox: !fill.lightbox })} label="Lightbox" />
      </div>
      <Thumbnail fill={fill} set={set} />
      <p className="text-[11px] leading-snug text-zinc-400">With reduced motion, nothing plays by itself: the thumbnail shows until someone clicks.</p>
    </div>
  )
}

/** The still shown before it plays (and as the lightbox's cover): automatic, or an image of your own. */
function Thumbnail({ fill, set }: { fill: MediaFill; set: (m: Partial<MediaFill>) => void }) {
  const assets = useAssets((s) => s.assets)
  const images = Object.values(assets).filter((a) => a.kind !== 'video' && a.kind !== 'lottie' && a.dataUrl).sort((a, b) => b.addedAt - a.addedAt)
  const input = useRef<HTMLInputElement>(null)
  const auto = fill.asset ? assets[fill.asset]?.poster : fill.source === 'embed' && fill.link ? embedPoster(fill.link) : undefined
  const own = fill.poster ? (assets[fill.poster]?.dataUrl ?? fill.poster) : undefined
  const shown = own ?? auto
  const choose = async (files: FileList | null) => {
    const f = files?.[0]
    if (f?.type.startsWith('image/')) set({ poster: (await addImage(f, f.name)).id })
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-400">
        Thumbnail
        {fill.poster && (
          <button type="button" onClick={() => set({ poster: undefined })} className="font-medium text-zinc-500 hover:text-zinc-900">
            Back to automatic
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 thin-scroll">
        <span className="grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-950/5 ring-2 ring-zinc-900">
          {shown ? <img alt="" src={shown} className="size-full object-cover" /> : <span className="text-[10px] text-zinc-500">First frame</span>}
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-500 hover:text-zinc-900"
          title="Upload a thumbnail"
        >
          <ImagePlus size={15} />
        </button>
        {images.slice(0, 8).map((a) => (
          <button key={a.id} type="button" onClick={() => set({ poster: a.id })} title={a.name} className="shrink-0 active:scale-[0.97]">
            <img alt={a.name} src={a.dataUrl} className={`h-12 w-12 rounded-lg object-cover ${fill.poster === a.id ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`} />
          </button>
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void choose(e.target.files)} />
    </div>
  )
}

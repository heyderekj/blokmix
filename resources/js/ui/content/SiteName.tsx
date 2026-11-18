import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { addFile, useAssets } from '@/lib/assets'
import { useStore } from '@/state/store'

/**
 * The name, changed everywhere it's written once you're done typing (Enter or leaving the field), so a half-typed name
 * never lands in your headlines. One undo step.
 */
export function SiteName({ brand, className }: { brand: string; className: string }) {
  const [draft, setDraft] = useState(brand)
  useEffect(() => setDraft(brand), [brand])
  const commit = () => {
    const next = draft.trim()
    if (!next || next === brand.trim()) return setDraft(brand)
    const n = useStore.getState().setBrand(next)
    useStore.getState().showFlash(n ? `Renamed to ${next} in ${n} place${n > 1 ? 's' : ''}` : `Renamed to ${next}`, { undo: true })
  }
  return (
    <input
      value={draft}
      aria-label="Your site’s name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(brand)
      }}
      className={className}
    />
  )
}

/** Your logo once: it fills the nav's and footer's logo wherever they have no picture of their own. */
export function SiteLogo() {
  const errorId = useId()
  const logo = useStore((s) => s.content.logo)
  const src = useAssets((s) => (logo?.asset ? s.assets[logo.asset]?.dataUrl : undefined))
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const take = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setError(null)
    try {
      const a = await addFile(f)
      useStore.getState().setLogo({ source: 'upload', asset: a.id, fit: 'contain', alt: useStore.getState().content.brand })
      useStore.getState().showFlash('Your logo is on the nav and footer', { undo: true })
    } catch (e) {
      setError((e as Error).message)
      useStore.getState().showFlash((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={busy}
        title={logo ? 'Change site logo' : 'Add site logo'}
        aria-label={logo ? 'Change site logo' : 'Add site logo'}
        aria-describedby={error ? errorId : undefined}
        onClick={() => input.current?.click()}
        className={`flex size-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border bg-white transition hover:border-zinc-400 hover:bg-zinc-100 focus-visible:outline-key-ink disabled:opacity-60 ${src ? 'border-zinc-950/10' : 'border-dashed border-zinc-300 text-zinc-700'}`}
      >
        {src ? <img alt="" src={src} className="max-h-9 max-w-9 object-contain" /> : <><ImagePlus size={16} /><span className="text-[10px] leading-tight font-semibold">{busy ? 'Adding…' : 'Logo'}</span></>}
      </button>
      {logo && (
        <button
          type="button"
          title="Remove logo" disabled={busy}
          aria-label="Remove logo"
          onClick={() => useStore.getState().setLogo(null)}
          className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]"
        >
          <X size={13} />
        </button>
      )}
      <input ref={input} type="file" accept="image/*,.svg" hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = '' }} />
      {error && <span id={errorId} role="alert" className="sr-only">{error}</span>}
    </div>
  )
}

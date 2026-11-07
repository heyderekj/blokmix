import { useEffect, useRef, useState } from 'react'
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
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-[12.5px] font-medium text-zinc-700 transition-[background-color,scale] hover:bg-zinc-950/5 active:scale-[0.97]"
      >
        {src ? <img alt="" src={src} className="h-5 max-w-16 object-contain" /> : <ImagePlus size={14} className="text-zinc-400" />}
        {busy ? 'Adding…' : logo ? 'Change logo' : 'Add your logo'}
      </button>
      {logo && (
        <button
          type="button"
          title="Take the logo away (the name shows in words)"
          aria-label="Take the logo away"
          onClick={() => useStore.getState().setLogo(null)}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-zinc-400 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]"
        >
          <X size={13} />
        </button>
      )}
      <input ref={input} type="file" accept="image/*,.svg" hidden onChange={(e) => void take(e.target.files?.[0])} />
      {error && <p className="text-[12px] text-problem-ink">{error}</p>}
    </div>
  )
}

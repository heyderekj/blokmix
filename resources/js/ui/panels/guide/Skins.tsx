import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock, Shuffle, X } from 'lucide-react'
import { applySkin, skinList, skinOpen, type Skin } from '@/core/skins'
import { emptyContract } from '@/core/contract'
import { pageOf } from '@/core/site'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { SkinPreview } from '@/ui/skins/SkinPreview'

const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale] duration-150 active:scale-[0.97]'

/** A whole look in one click, over the same layouts. The contract says what a swap leaves alone; ⌘Z takes it back. */
export function Skins() {
  const on = useStore((s) => s.guide.skin)
  const [comparing, setComparing] = useState(false)
  const put = (skin: Skin) => {
    const st = useStore.getState()
    if (st.applySkin(skin.id)) st.showFlash(`${skin.name} is on`, { undo: true })
  }
  const surprise = () => {
    const st = useStore.getState()
    const words = st.surpriseMe()
    st.showFlash(words ?? 'Nothing to surprise you with: the contract keeps every area', words ? { undo: true } : undefined)
  }
  return (
    <div className="col-span-2 rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] font-semibold text-zinc-900">Theme{on ? `: ${on.name}` : ''}</span>
        <button type="button" onClick={surprise} className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-chip px-2.5 text-[11.5px] font-semibold text-zinc-700 ${PRESS}`}>
          <Shuffle size={12} /> Surprise me
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {skinList().map((skin) => {
          const here = on?.id === skin.id
          return (
            <button key={skin.id} type="button" onClick={() => put(skin)} aria-pressed={here} title={skin.words} className={`flex h-9 items-center gap-2 rounded-xl bg-white px-2 text-left text-[11.5px] font-medium text-zinc-800 ${PRESS} ${here ? 'shadow-[0_0_0_2px_var(--color-accent,#ff69b4)]' : 'shadow-[0_0_0_1px_rgb(0_0_0/0.08)]'}`}>
              <span className="flex shrink-0 overflow-hidden rounded-full shadow-[0_0_0_1px_rgb(0_0_0/0.1)]" aria-hidden>
                <span className="size-3" style={{ background: skin.tokens['color.bg'] }} />
                <span className="size-3" style={{ background: skin.tokens['color.primary'] }} />
              </span>
              <span className="min-w-0 flex-1 truncate">{skin.name}</span>
              {here ? <Check size={12} className="shrink-0" /> : !skinOpen(library, skin) && <Lock size={11} className="shrink-0 text-zinc-400" />}
            </button>
          )
        })}
      </div>
      <button type="button" onClick={() => setComparing(true)} className={`mt-2 h-8 w-full rounded-full text-[11.5px] font-semibold text-zinc-600 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-950/5 ${PRESS}`}>
        Compare on this page
      </button>
      {comparing && <Compare onClose={() => setComparing(false)} onPick={(s) => { put(s); setComparing(false) }} />}
    </div>
  )
}

/** This page under every skin, side by side, as a swap would really leave it. */
function Compare({ onClose, onPick }: { onClose: () => void; onPick: (s: Skin) => void }) {
  const site = useStore((s) => s.site)
  const pageId = useStore((s) => s.ui.pageId)
  const guide = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const contract = useStore((s) => s.contract)
  // previewHtml draws a site's first page, so the open page goes first.
  const shown = useMemo(() => {
    const here = pageOf(site, pageId)
    return { ...site, pages: [here, ...site.pages.filter((p) => p.id !== here.id)] }
  }, [site, pageId])
  // On the body: the panel it opens from has its own stacking and transforms, which would trap a fixed overlay inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/30 p-3 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Compare themes" onClick={(e) => e.stopPropagation()} className="flex h-[min(860px,100%)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_40px_80px_-32px_rgb(0_0_0/0.5)]">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-950/5 px-5 py-3">
          <span className="text-[15px] font-semibold text-zinc-900">Same page, every theme</span>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-zinc-500 ${PRESS}`}><X size={18} /></button>
        </header>
        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {skinList().map((skin) => (
            <button key={skin.id} type="button" onClick={() => onPick(skin)} className={`overflow-hidden rounded-2xl bg-white text-left shadow-[0_0_0_1px_rgb(0_0_0/0.08)] ${PRESS}`}>
              <SkinPreview site={shown} guide={applySkin(guide, skin, contract ?? emptyContract())} content={content} title={skin.name} height={200} />
              <span className="block p-3">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-zinc-900">{skin.name}{!skinOpen(library, skin) && <Lock size={11} className="text-zinc-400" />}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-zinc-500">{skin.words}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

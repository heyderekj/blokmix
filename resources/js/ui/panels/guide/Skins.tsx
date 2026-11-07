import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock, X } from 'lucide-react'
import type { GuideState, TokenSet } from '@/core/types'
import { applySkin, skinList, skinOpen, skinRefOf, type Skin } from '@/core/skins'
import { emptyContract } from '@/core/contract'
import { resolveGuide } from '@/core/guide'
import { pageOf } from '@/core/site'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { SkinSpecimen } from '@/ui/skins/SkinSpecimen'
import { FontLinks } from './shared'

const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale] duration-150 active:scale-[0.97]'

export interface SkinLook {
  skin: Skin
  tokens: TokenSet
  components: GuideState['components']
}

/** Every theme as a swap would leave this mix: what you keep (your brand color, kept areas) shows on every card. */
export function useSkinLooks(): SkinLook[] {
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  return useMemo(
    () =>
      skinList().map((skin) => {
        const g = applySkin(guide, skin, contract ?? emptyContract())
        return { skin, tokens: resolveGuide(g).tokens, components: g.components }
      }),
    [guide, contract],
  )
}

/** Put a theme on, as one undo step. */
export function putSkin(skin: Skin) {
  const st = useStore.getState()
  if (st.applySkin(skin.id)) st.showFlash(`${skin.name} is on`, { undo: true })
}

/** A theme drawn in its own look, with its name under it. Also used for a mix, which has no skin of its own. */
export function SkinCard({ label, words, tokens, components, here, locked, onPick }: { label: string; words: string; tokens: TokenSet; components?: GuideState['components']; here: boolean; locked: boolean; onPick: () => void }) {
  const brand = useStore((s) => s.content.brand)
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={here}
      aria-label={`${label}: ${words}`}
      title={words}
      className="group/skin grid min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)] gap-1 rounded-[13px] text-left transition-[scale] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#ff69b4)]"
    >
      <span className={`block min-w-0 rounded-[12px] transition-[box-shadow] duration-150 ${here ? 'shadow-[0_0_0_2px_var(--color-accent,#ff69b4)]' : 'shadow-[0_0_0_1px_rgb(0_0_0/0.06)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/skin:shadow-[0_0_0_1px_rgb(0_0_0/0.18)]'}`}>
        <SkinSpecimen tokens={tokens} components={components} name={brand?.trim() || 'Your site'} />
      </span>
      <span className="flex items-center justify-between gap-1 px-1 text-[11.5px] font-semibold text-zinc-800">
        <span className="truncate">{label}</span>
        {here ? <Check size={12} className="shrink-0" /> : locked && <Lock size={11} className="shrink-0 text-zinc-400" aria-label="Mix pack" />}
      </span>
    </button>
  )
}

/** Theme cards in a grid, with every theme's fonts loaded. */
export function SkinGrid({ looks, cols = 2 }: { looks: SkinLook[]; cols?: 2 | 3 }) {
  const on = useStore((s) => s.guide.skin)
  return (
    <>
      <FontLinks tokens={looks.map((l) => l.tokens)} />
      <div className={`grid gap-x-2 gap-y-2.5 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {looks.map(({ skin, tokens, components }) => (
          <SkinCard key={skin.id} label={skin.name} words={skin.words} tokens={tokens} components={components} here={skinRefOf(on)?.id === skin.id} locked={!skinOpen(library, skin)} onPick={() => putSkin(skin)} />
        ))}
      </div>
    </>
  )
}

/** Every theme, and a way to see this page under each of them side by side. */
export function AllThemes() {
  const looks = useSkinLooks()
  const [comparing, setComparing] = useState(false)
  return (
    <div className="grid gap-2">
      <SkinGrid looks={looks} />
      <button type="button" onClick={() => setComparing(true)} className={`h-8 w-full rounded-full text-[11.5px] font-semibold text-zinc-600 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-950/5 ${PRESS}`}>
        Compare on this page
      </button>
      {comparing && <Compare onClose={() => setComparing(false)} onPick={(s) => { putSkin(s); setComparing(false) }} />}
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
                <span className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-zinc-500 [text-wrap:pretty]">{skin.words}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

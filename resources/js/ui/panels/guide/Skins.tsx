import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { GuideState, TokenSet } from '@/core/types'
import { applySkin, themeList, type Skin } from '@/core/skins'
import { emptyContract } from '@/core/contract'
import { resolveGuide } from '@/core/guide'
import { pageOf } from '@/core/site'
import { useStore } from '@/state/store'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { runCommand } from '@/state/commands'

const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale] duration-150 active:scale-[0.97]'

export interface SkinLook {
  skin: Skin
  tokens: TokenSet
  guide: GuideState
}

/** Every theme as a swap would leave this mix: what you keep (your brand color, kept areas) shows on every card. */
export function useSkinLooks(): SkinLook[] {
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  return useMemo(
    () =>
      themeList().map((skin) => {
        const g = applySkin(guide, skin, contract ?? emptyContract())
        return { skin, tokens: resolveGuide(g).tokens, guide: g }
      }),
    [guide, contract],
  )
}

/** Put a theme on, as one undo step. */
export function putSkin(skin: Skin) {
  const st = useStore.getState()
  runCommand('apply_skin', { skin: skin.id }, 'you')
  st.showFlash(`${skin.name} is on`, { undo: true })
}

/** This page under every skin, side by side, as a swap would really leave it. */
function LazyPreview(props: Parameters<typeof SkinPreview>[0]) {
  const el = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!el.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '120px' })
    observer.observe(el.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={el} style={{height: props.height}}>{visible && <SkinPreview {...props} />}</div>
}

export function Compare({ onClose, onPick }: { onClose: () => void; onPick: (s: Skin) => void }) {
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
          {themeList().map((skin) => (
            <button key={skin.id} type="button" onClick={() => onPick(skin)} className={`overflow-hidden rounded-2xl bg-white text-left shadow-[0_0_0_1px_rgb(0_0_0/0.08)] ${PRESS}`}>
              <LazyPreview site={shown} guide={applySkin(guide, skin, contract ?? emptyContract())} content={content} title={skin.name} height={200} />
              <span className="block p-3">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-zinc-900">{skin.name}</span>
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

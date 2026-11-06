import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/state/store'
import { pageOf } from '@/core/site'
import { CollectionsPanel } from '@/ui/panels/collections/CollectionsPanel'
import { useWideBar } from '@/ui/shell/TopBar'
import { OwnershipCount, PageDoc, TrayColumn } from './PageDoc'
import { SiteLogo, SiteName } from './SiteName'

/** Whether Content has the main area (the Content tool on a wide window; narrower ones keep it in the top bar's pill). */
export function useContentOpen() {
  const asked = useStore((s) => s.ui.sheet === 'guide' && s.ui.guideTab === 'content')
  const wide = useWideBar()
  return asked && wide
}

/**
 * Content in place of the canvas: the page's words as a document you read and type into, Words to place beside it,
 * and your collections a tab away. Escape, the Content tool or a section's name takes you back to the page.
 */
export function ContentDoc() {
  const open = useContentOpen()
  const view = useStore((s) => s.ui.contentView)
  const brand = useStore((s) => s.content.brand)
  const page = useStore((s) => pageOf(s.site, s.ui.pageId))
  const st = useStore.getState
  const close = () => st().setUi({ sheet: 'none' })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      // Escape in a field leaves the field first.
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return t.blur()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  const show = (slotId: string) => {
    close()
    st().focusSlot(slotId)
  }
  return (
    <div className="absolute inset-0 z-30 animate-pop overflow-y-auto bg-[var(--canvas-bg)] pt-[72px]" data-content-doc data-scroll-ok>
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-6 pb-40 lg:grid-cols-[minmax(0,720px)_280px] lg:justify-center">
        <article className="min-w-0 rounded-[28px] bg-white px-6 py-8 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_24px_48px_-32px_rgb(0_0_0/0.25)] sm:px-12 sm:py-10 dark:bg-zinc-900">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <SiteName brand={brand} className="min-w-0 rounded-md bg-transparent px-1.5 text-[13px] font-semibold text-zinc-900 outline-none [field-sizing:content] hover:bg-zinc-950/[0.04] focus:bg-zinc-950/[0.04]" />
            <span className="text-[13px] text-zinc-400">{page ? `${page.title} · ${page.path}` : ''}</span>
            <span className="flex-1" />
            <div className="flex rounded-full bg-zinc-950/[0.05] p-0.5" role="tablist">
              {(['words', 'collections'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => st().setUi({ contentView: v })}
                  className={`h-7 cursor-pointer rounded-full px-3 text-[12px] font-semibold transition ${view === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {v === 'words' ? 'This page' : 'Collections'}
                </button>
              ))}
            </div>
            <button type="button" onClick={close} aria-label="Back to the page" title="Back to the page (Esc)" className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]">
              <X size={16} />
            </button>
          </header>
          {view === 'words' ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <OwnershipCount />
                <SiteLogo />
              </div>
              <PageDoc onShowSection={show} />
            </>
          ) : (
            <div className="-mx-4 mt-4">
              <CollectionsPanel />
            </div>
          )}
        </article>
        {view === 'words' && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <TrayColumn />
          </div>
        )}
      </div>
    </div>
  )
}

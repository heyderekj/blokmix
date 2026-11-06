import { useStore } from '@/state/store'
import { CollectionsPanel } from './collections/CollectionsPanel'
import { OwnershipCount, PageDoc } from '@/ui/content/PageDoc'
import { SiteLogo, SiteName } from '@/ui/content/SiteName'

export { wordLabel } from '@/ui/content/PageDoc'

/**
 * Content in the narrow window's pill: the same document as the wide view (ContentDoc), sized down. Your site's name
 * and logo, then every word on the page by section, typed into in place, with what's not yours yet marked; your
 * collections a tab away.
 */
export function ContentPanel() {
  const view = useStore((s) => s.ui.contentView)
  const brand = useStore((s) => s.content.brand)
  return (
    <div>
      <div className="flex items-center gap-2 px-3 pt-3" role="tablist">
        <div className="flex rounded-full bg-chip p-0.5">
          {(['words', 'collections'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => useStore.getState().setUi({ contentView: v })}
              className={`h-7 cursor-pointer rounded-full px-3 text-[12px] font-semibold transition ${view === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {v === 'words' ? 'This page' : 'Collections'}
            </button>
          ))}
        </div>
        {view === 'words' && <OwnershipCount />}
      </div>
      {view === 'words' ? (
        <>
          <div className="px-4 pt-3">
            <SiteName brand={brand} className="block h-8 w-full rounded-lg border border-zinc-950/10 bg-white px-2.5 text-[12.5px] text-zinc-800 outline-none focus:border-zinc-400" />
            <SiteLogo />
          </div>
          <PageDoc compact />
        </>
      ) : (
        <CollectionsPanel />
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { briefOf, kindOf } from '@/core/brief'
import { rankDirections, type RankedDirection } from '@/core/directions'
import { pageView } from '@/core/site'
import { noteTaste } from '@/core/taste'
import { guideInDirection, siteInDirection } from '@/core/tryDirection'
import { library } from '@/data/library'
import '@/data/directions'
import { useStore } from '@/state/store'
import { canAddDraft } from '@/state/slices/drafts'
import { canvasApi } from '../canvas/Canvas'
import { SkinPreview } from '../skins/SkinPreview'

const PRESS = 'cursor-pointer transition-[background-color,color,scale,box-shadow] duration-150 active:scale-[0.97]'

/**
 * Try another direction: your own pages, words and all, in a few other layouts and looks, each a click from being a new
 * draft beside this one. Ones you passed on at the start stay out; Others shows a fresh few and remembers these as passed.
 */
export function OtherDirections() {
  const room = useStore(canAddDraft)
  const site = useStore((s) => s.site)
  const guide = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const contract = useStore((s) => s.contract)
  const [round, setRound] = useState(0)

  const row = useMemo<RankedDirection[]>(() => {
    const brief = briefOf(content)
    const home = site.pages[0]
    const sections = home ? pageView(site, home.id).map((s) => s.type) : undefined
    // What you already picked (the start's version, other drafts) is here already.
    const picked = (content.taste?.events ?? []).filter((e) => e.kind === 'picked' && e.ref).map((e) => e.ref!)
    return rankDirections({
      input: { kind: content.kind ?? kindOf(brief), brief, sections, brand: guide.brand?.color ?? null, variant: guide.brand?.variant, mode: guide.mode },
      lib: library,
      taste: content.taste,
      exclude: picked,
      count: 3,
    })
    // Ranked when the panel opens and on Others, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  if (!room || !row.length) return null
  const others = () => {
    const st = useStore.getState()
    useStore.setState({ content: { ...st.content, taste: noteTaste(st.content.taste, ...row.map((r) => ({ kind: 'passed' as const, traits: r.traits, ref: r.direction.id, source: 'you' as const }))) } })
    setRound((n) => n + 1)
  }
  const pick = (r: RankedDirection) => {
    const st = useStore.getState()
    const id = st.tryDirection(r.direction)
    if (!id) return
    st.showFlash(`Made ${st.drafts[id]?.name ?? 'a new draft'} beside the others, with your words. The one you were in stays as it was.`, { undo: true })
    st.setUi({ sheet: 'none' })
    setTimeout(() => canvasApi.fitMix(), 60)
  }

  return (
    <section className="mb-5" aria-label="Try another direction">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="draft-subtitle m-0">Try another direction</h3>
        <button type="button" onClick={others} className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`}>
          <Shuffle size={13} /> Others
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
        {row.map((r) => (
          <Option key={`${round}-${r.direction.id}`} r={r} site={site} guide={guide} content={content} contract={contract} onPick={() => pick(r)} />
        ))}
      </div>
    </section>
  )
}

function Option({ r, site, guide, content, contract, onPick }: {
  r: RankedDirection
  site: ReturnType<typeof useStore.getState>['site']
  guide: ReturnType<typeof useStore.getState>['guide']
  content: ReturnType<typeof useStore.getState>['content']
  contract: ReturnType<typeof useStore.getState>['contract']
  onPick: () => void
}) {
  // Your Home as it would land: your words in its layouts and look.
  const preview = useMemo(() => {
    const home = site.pages[0]
    const s = siteInDirection(site, r.direction, library, contract)
    return { site: home ? { ...s, pages: [s.pages[0]] } : s, guide: guideInDirection(guide, r.direction, contract) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.direction.id])
  return (
    <button
      type="button"
      onClick={onPick}
      title={`New draft: ${r.direction.name}`}
      className={`group flex min-w-0 flex-col overflow-hidden rounded-xl bg-white text-left shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.22)] motion-safe:animate-pop ${PRESS}`}
    >
      <SkinPreview site={preview.site} guide={preview.guide} content={content} title={r.direction.name} height={130} peek />
      <span className="block p-2.5">
        <strong className="block truncate text-[13px] font-semibold">{r.direction.name}</strong>
        <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-zinc-500">{r.why}</span>
      </span>
    </button>
  )
}

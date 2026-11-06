import { memo, useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { resolveGuide } from '@/core/guide'
import { composeSite } from '@/core/compose'
import { allSlots, mapSlots, pageOf } from '@/core/site'
import { referenceHtml } from '@/core/export/reference-html'
import { library } from '@/data/library'
import { uploadData } from '@/lib/assets'
import { bindContextFor, useCollections } from '@/state/collections'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { VIEWPORT_VH } from '@/state/derived'
import { PageFrame } from '@/frame/PageFrame'
import { openDraft } from '../drafts/open'
import type { DraftPlacement } from '../canvas/geometry'
import { FrameHeader, HeaderTitle, StatusRing } from './FrameHeader'

/**
 * A draft you're not in, beside the one you are: its page as it stands (the same page you're on, when it has one), to
 * compare at a glance. Open it to work on it; the one you leave keeps its own copy.
 */
export const DraftFrame = memo(function DraftFrame({ p }: { p: DraftPlacement }) {
  const d = p.draft
  const body = d.body!
  const viewport = useStore((s) => s.ui.viewport)
  const here = useStore((s) => pageOf(s.site, s.ui.pageId).path)
  const setFrameHeight = useLayout((s) => s.setFrameHeight)
  const collections = useCollections((s) => s.bySlug)
  const page = body.site.pages.find((x) => x.path === here) ?? body.site.pages[0]
  const srcdoc = useMemo(() => {
    const composed = composeSite({
      site: mapSlots(body.site, (s) => (library.clips[s.clipId] ? s : null)),
      guide: resolveGuide(body.guide),
      content: body.content,
      library,
      page: body.guide,
      uploads: uploadData,
      bind: bindContextFor(body.site, collections),
    })
    return referenceHtml(composed, { vh: VIEWPORT_VH[viewport], tagSlots: true, pageId: page?.id })
  }, [body, viewport, page?.id, collections])
  const sections = allSlots(body.site).length
  return (
    <div className="absolute" style={{ left: p.x, top: p.y, width: p.w }} data-frame={d.id}>
      <FrameHeader width={p.w}>
        <StatusRing letter={d.letter} status={d.status ?? 'in-progress'} />
        <HeaderTitle title={d.name} meta={`${page && body.site.pages.length > 1 ? `${page.title} · ` : ''}${sections} sections`} />
        <button type="button" onClick={() => openDraft(d.id)} className="btn-quiet flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold active:scale-[0.97]">
          Open <ArrowRight size={13} />
        </button>
      </FrameHeader>
      <button
        type="button"
        onClick={() => openDraft(d.id)}
        aria-label={`Open ${d.name}`}
        className="group frame-r relative block w-full cursor-pointer overflow-hidden bg-white text-left shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.06)]"
        style={{ minHeight: 600 }}
      >
        <PageFrame srcdoc={srcdoc} width={p.w} title={d.name} interactive={false} onHeight={(h) => setFrameHeight(d.id, h)} />
        <span className="pointer-events-none absolute inset-0 bg-zinc-950/0 transition-colors duration-200 group-hover:bg-zinc-950/[0.04]" />
      </button>
    </div>
  )
})

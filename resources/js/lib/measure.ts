import { useEffect } from 'react'
import { composePage } from '@/core/compose'
import { referenceHtml } from '@/core/export/reference-html'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout, type BlockRects } from '@/state/layout'
import { VIEWPORT_VH } from '@/state/derived'
import { uploadData } from './assets'

/** The widths the checklist measures at: a laptop and a phone. */
export const MEASURE_WIDTHS = { desktop: 1280, mobile: 390 } as const
export type MeasureWidth = (typeof MEASURE_WIDTHS)[keyof typeof MEASURE_WIDTHS]

/** The page as it ships (the reference build), with each section tagged so blocks can be found by id. */
function pageHtml(width: MeasureWidth): string {
  const st = useStore.getState()
  const page = composePage({
    slots: st.slots.filter((s) => library.clips[s.clipId]),
    guide: resolveGuide(st.guide),
    content: st.content,
    library,
    title: st.content.brand,
    page: st.guide,
    uploads: uploadData,
    keepBlockIds: true,
  })
  return referenceHtml(page, { vh: VIEWPORT_VH[width === MEASURE_WIDTHS.mobile ? 'mobile' : 'desktop'], tagSlots: true })
}

const frames = new Map<number, HTMLIFrameElement>()
const queue = new Map<number, Promise<unknown>>()

/** One hidden, off-screen iframe per width, reused. Same-origin and script-free, so we read its layout directly. */
function frameFor(width: number): HTMLIFrameElement {
  let f = frames.get(width)
  if (f?.isConnected) return f
  f = document.createElement('iframe')
  f.setAttribute('sandbox', 'allow-same-origin')
  f.setAttribute('aria-hidden', 'true')
  f.tabIndex = -1
  Object.assign(f.style, { position: 'fixed', left: '-20000px', top: '0', width: `${width}px`, height: '900px', border: '0', visibility: 'hidden', pointerEvents: 'none' })
  document.body.appendChild(f)
  frames.set(width, f)
  return f
}

function load(f: HTMLIFrameElement, html: string): Promise<Document> {
  return new Promise((resolve, reject) => {
    const done = () => (f.contentDocument ? resolve(f.contentDocument) : reject(new Error('The measuring frame didn’t load')))
    f.addEventListener('load', done, { once: true })
    f.srcdoc = html
  })
}

/** Every block's box per section, read once fonts have loaded. Blocks that don't show (hidden at this width) are left out. */
function readRects(doc: Document): BlockRects {
  const out: BlockRects = {}
  for (const sec of doc.querySelectorAll<HTMLElement>('[data-mx-slot]')) {
    const slot = sec.dataset.mxSlot!
    const origin = sec.getBoundingClientRect()
    const rects: BlockRects[string] = {}
    // The section root can itself be a block (a nav's banner sits before it, a block on the root).
    for (const el of [sec, ...sec.querySelectorAll<HTMLElement>('[data-mx-b]')]) {
      const id = el.dataset.mxB
      if (!id || rects[id]) continue
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) continue
      rects[id] = { x: Math.round(r.left - origin.left), y: Math.round(r.top - origin.top), w: Math.round(r.width), h: Math.round(r.height) }
    }
    out[slot] = rects
  }
  return out
}

/**
 * Lays the page out at a width in a hidden iframe and returns every block's
 * box, cached in useLayout.blockRects until the page changes. Calls for the
 * same width wait their turn.
 */
export function measurePage(width: MeasureWidth): Promise<BlockRects> {
  // Nothing to lay out with outside a browser: the checklist runs without measurements.
  if (typeof document === 'undefined') return Promise.resolve({})
  const run = async () => {
    const html = pageHtml(width)
    const hit = useLayout.getState().blockRects[width]
    if (hit?.key === html) return hit.rects
    const doc = await load(frameFor(width), html)
    await doc.fonts?.ready
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const rects = readRects(doc)
    useLayout.getState().setBlockRects(width, html, rects)
    return rects
  }
  const next = (queue.get(width) ?? Promise.resolve()).then(run, run)
  queue.set(width, next)
  return next
}

/** Both widths, for the checklist. */
export async function measureWidths(widths: MeasureWidth[] = [MEASURE_WIDTHS.desktop, MEASURE_WIDTHS.mobile]): Promise<Record<number, BlockRects>> {
  const all = await Promise.all(widths.map((w) => measurePage(w).then((r) => [w, r] as const)))
  return Object.fromEntries(all)
}

/** Keeps the measured boxes fresh while something is watching them (the block bar), a moment after the page settles. */
export function useMeasuredPage(on: boolean) {
  const slots = useStore((s) => s.slots)
  const guide = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  useEffect(() => {
    if (!on) return
    const t = setTimeout(() => void measureWidths().catch(() => {}), 400)
    return () => clearTimeout(t)
  }, [on, slots, guide, content])
}

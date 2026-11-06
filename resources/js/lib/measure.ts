import { useEffect } from 'react'
import { bindContextFor } from '@/state/collections'
import { composeSite } from '@/core/compose'
import { mapSlots } from '@/core/site'
import { referenceHtml } from '@/core/export/reference-html'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import type { GuideState, ProjectContent, Site } from '@/core/types'
import type { PageMeasure } from '@/core/score'
import { useStore, currentSlots } from '@/state/store'
import { useLayout, type BlockRects } from '@/state/layout'
import { VIEWPORT_VH } from '@/state/derived'
import { uploadData } from './assets'

/** The widths the checklist measures at: a laptop and a phone. */
export const MEASURE_WIDTHS = { desktop: 1280, mobile: 390 } as const
export type MeasureWidth = (typeof MEASURE_WIDTHS)[keyof typeof MEASURE_WIDTHS]

type PageData = { site: Site; guide: GuideState; content: ProjectContent }

/** The page as it ships (the reference build), with each section tagged so blocks can be found by id. */
function pageHtml(width: number, pageId?: string | null, data?: PageData): string {
  const st = data ?? useStore.getState()
  const page = composeSite({
    site: mapSlots(st.site, (s) => (library.clips[s.clipId] ? s : null)),
    guide: resolveGuide(st.guide),
    content: st.content,
    library,
    title: st.content.brand,
    page: st.guide,
    uploads: uploadData,
    keepBlockIds: true,
    bind: bindContextFor(st.site),
  })
  const current = data ? null : useStore.getState().ui.pageId
  return referenceHtml(page, { vh: VIEWPORT_VH[width < 760 ? 'mobile' : 'desktop'], tagSlots: true, pageId: pageId ?? current ?? undefined })
}

const frames = new Map<number, HTMLIFrameElement>()
const queue = new Map<number, Promise<unknown>>()

/** A mix's first page as it ships, at a width: what the guided start shows in its previews. */
export const previewHtml = (data: PageData, width: number) => pageHtml(width, data.site.pages[0]?.id, data)

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
export function measurePage(width: MeasureWidth, pageId?: string | null): Promise<BlockRects> {
  // Nothing to lay out with outside a browser: the checklist runs without measurements.
  if (typeof document === 'undefined') return Promise.resolve({})
  const run = async () => {
    const html = pageHtml(width, pageId)
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

/**
 * Lays a mix's page out at a width (and a screen height for the fold) and reads
 * what the first screen shows: the nav's bottom edge, the opening section's
 * headline and first button, and whether anything spills sideways. For mixes
 * that aren't open, like the guided start's candidates.
 */
export async function measureFirstScreen(data: PageData, width: number, height: number, pageId?: string): Promise<PageMeasure> {
  const pg = (pageId && data.site.pages.find((p) => p.id === pageId)) || data.site.pages[0]
  const html = pageHtml(width, pg?.id, data)
  const run = async (): Promise<PageMeasure> => {
    const doc = await load(frameFor(width), html)
    await doc.fonts?.ready
    // A frame to settle in; a hidden tab skips frames, so don't wait on one for long.
    await new Promise((r) => {
      requestAnimationFrame(() => r(null))
      setTimeout(r, 50)
    })
    const box = (el: Element | null | undefined) => (el ? el.getBoundingClientRect() : null)
    const top = (doc.scrollingElement ?? doc.documentElement).scrollTop
    const nav = data.site.shared.nav && pg?.show.nav ? box(doc.querySelector(`[data-mx-slot="${data.site.shared.nav.id}"]`)) : null
    const opening = pg?.slots.find((s) => s.type === 'hero' || s.type === 'header')
    const blocks = opening ? (library.clips[opening.clipId]?.blocks ?? []) : []
    const pick = (kind: string, field: string) => blocks.find((b) => b.kind === kind && b.field === field) ?? blocks.find((b) => b.kind === kind)
    const section = opening ? doc.querySelector(`[data-mx-slot="${opening.id}"]`) : null
    const within = (id?: string) => (id && section ? (section.matches(`[data-mx-b="${id}"]`) ? section : section.querySelector(`[data-mx-b="${id}"]`)) : null)
    const head = within(pick('heading', opening?.type === 'header' ? 'heading' : 'headline')?.id)
    const btn = within(pick('button', 'ctaPrimary')?.id)
    const hb = box(head)
    const bb = box(btn)
    const lineHeight = head ? parseFloat(getComputedStyle(head).lineHeight) || parseFloat(getComputedStyle(head).fontSize) * 1.2 : 0
    // What starts above the fold, top to bottom.
    const shown: { slot: string; block: string; y: number }[] = []
    for (const sec of doc.querySelectorAll<HTMLElement>('[data-mx-slot]')) {
      for (const el of [sec, ...sec.querySelectorAll<HTMLElement>('[data-mx-b]')]) {
        const r = el.getBoundingClientRect()
        if (!el.dataset.mxB || (!r.width && !r.height) || r.top + top >= height) continue
        shown.push({ slot: sec.dataset.mxSlot!, block: el.dataset.mxB, y: r.top + top })
      }
    }
    shown.sort((a, b) => a.y - b.y)
    return {
      width,
      height,
      scrollWidth: doc.documentElement.scrollWidth,
      docHeight: doc.documentElement.scrollHeight,
      navBottom: nav ? Math.round(nav.bottom + top) : 0,
      headline: hb && hb.height ? { top: Math.round(hb.top + top), bottom: Math.round(hb.bottom + top), lines: Math.max(1, Math.round(hb.height / lineHeight)) } : undefined,
      button: bb && bb.height ? { top: Math.round(bb.top + top), bottom: Math.round(bb.bottom + top) } : undefined,
      shown: shown.map(({ slot, block }) => ({ slot, block })),
    }
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
  const slots = useStore(currentSlots)
  const guide = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  useEffect(() => {
    if (!on) return
    const t = setTimeout(() => void measureWidths().catch(() => {}), 400)
    return () => clearTimeout(t)
  }, [on, slots, guide, content])
}

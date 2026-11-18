import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { GuideState, ProjectContent, Site } from '@/core/types'
import { previewHtml } from '@/lib/measure'

const PREVIEW_WIDTH = 1280

/** A real page at desktop width, scaled to the card. The idle view stays on the hero. */
export function SkinPreview({ site, guide, content, title, height = 260, peek = false, scrollable = false, viewportWidth = PREVIEW_WIDTH, focusSlot }: { site: Site; guide: GuideState; content: ProjectContent; title: string; height?: number; peek?: boolean; scrollable?: boolean; viewportWidth?: number; focusSlot?: string }) {
  const html = useMemo(() => previewHtml({ site, guide, content }, viewportWidth), [site, guide, content, viewportWidth])
  const [scale, setScale] = useState(0.3)
  const [pageHeight, setPageHeight] = useState(0)
  const frame = useRef<HTMLSpanElement>(null)
  const pageObserver = useRef<ResizeObserver | null>(null)
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const fit = (w: number) => w > 0 && setScale(w / viewportWidth)
    fit(el.clientWidth)
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width))
    ro.observe(el)
    return () => {
      ro.disconnect()
      pageObserver.current?.disconnect()
    }
  }, [viewportWidth])

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const reveal = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !focusSlot) return
    const section = doc.querySelector<HTMLElement>(`[data-mx-slot="${CSS.escape(focusSlot)}"]`)
    if (section) doc.defaultView?.scrollTo(0, section.getBoundingClientRect().top + (doc.defaultView?.scrollY ?? 0))
  }
  useLayoutEffect(reveal, [focusSlot, scale])

  const onLoad = (iframe: HTMLIFrameElement) => {
    const body = iframe.contentDocument?.body
    if (!body) return
    pageObserver.current?.disconnect()
    const measure = () => setPageHeight(body.offsetHeight)
    measure()
    pageObserver.current = new ResizeObserver(measure)
    pageObserver.current.observe(body)
  }

  const travel = Math.min(height * 1.5, Math.max(0, pageHeight * scale - height))
  const style = {
    width: viewportWidth,
    height: (peek ? height * 2.5 : height) / scale,
    transform: `scale(${scale})`,
    '--peek-distance': `-${travel}px`,
  } as CSSProperties

  return (
    <span ref={frame} className="relative block overflow-hidden bg-zinc-50" style={{ height }}>
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        tabIndex={scrollable ? 0 : -1}
        loading="lazy"
        scrolling={scrollable ? 'auto' : 'no'}
        onLoad={(e) => { if (peek) onLoad(e.currentTarget); reveal() }}
        className={`${scrollable ? '' : 'pointer-events-none'} absolute left-0 top-0 origin-top-left border-0 ${peek ? 'motion-safe:transition-[translate] motion-safe:duration-300 motion-safe:ease-out [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:[translate:0_var(--peek-distance)] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:delay-500 [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:duration-[3600ms] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:ease-in-out' : ''}`}
        style={style}
      />
    </span>
  )
}

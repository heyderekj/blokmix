import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { GuideState, ProjectContent, Site } from '@/core/types'
import { previewHtml } from '@/lib/measure'

const PREVIEW_WIDTH = 1280

/** A real page at desktop width, scaled to the card. The idle view stays on the hero. */
export function SkinPreview({ site, guide, content, title, height = 260, peek = false }: { site: Site; guide: GuideState; content: ProjectContent; title: string; height?: number; peek?: boolean }) {
  const html = useMemo(() => previewHtml({ site, guide, content }, PREVIEW_WIDTH), [site, guide, content])
  const [scale, setScale] = useState(0.3)
  const [pageHeight, setPageHeight] = useState(0)
  const frame = useRef<HTMLSpanElement>(null)
  const pageObserver = useRef<ResizeObserver | null>(null)
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const fit = (w: number) => w > 0 && setScale(w / PREVIEW_WIDTH)
    fit(el.clientWidth)
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width))
    ro.observe(el)
    return () => {
      ro.disconnect()
      pageObserver.current?.disconnect()
    }
  }, [])

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
    width: PREVIEW_WIDTH,
    height: (peek ? height * 2.5 : height) / scale,
    transform: `scale(${scale})`,
    '--peek-distance': `-${travel}px`,
  } as CSSProperties

  return (
    <span ref={frame} className="relative block overflow-hidden bg-zinc-50" style={{ height }}>
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        tabIndex={-1}
        loading="lazy"
        scrolling="no"
        onLoad={peek ? (e) => onLoad(e.currentTarget) : undefined}
        className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 ${peek ? 'motion-safe:transition-[translate] motion-safe:duration-300 motion-safe:ease-out [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:[translate:0_var(--peek-distance)] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:delay-500 [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:duration-[3600ms] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:ease-in-out' : ''}`}
        style={style}
      />
    </span>
  )
}

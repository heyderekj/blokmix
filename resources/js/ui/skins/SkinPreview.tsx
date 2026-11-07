import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GuideState, ProjectContent, Site } from '@/core/types'
import { previewHtml } from '@/lib/measure'

/**
 * A real page under one style guide: its first screen on a laptop, scaled to fit its card. Looks only, no clicks. With `peek`, the frame holds a few screens and pans down them while the
 * card it's in (a `group`) is hovered, so you see more than the first screen without opening it.
 */
export function SkinPreview({ site, guide, content, title, height = 260, peek = false }: { site: Site; guide: GuideState; content: ProjectContent; title: string; height?: number; peek?: boolean }) {
  const html = useMemo(() => previewHtml({ site, guide, content }, 1280), [site, guide, content])
  const [scale, setScale] = useState(0.3)
  const frame = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    // A frame not laid out yet measures 0 wide; keep the last scale rather than dividing by it.
    const fit = (w: number) => w > 0 && setScale(w / 1280)
    fit(el.clientWidth)
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={frame} className="relative overflow-hidden bg-zinc-50" style={{ height }}>
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        tabIndex={-1}
        loading="lazy"
        className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 ${peek ? 'motion-safe:transition-[translate] motion-safe:duration-[2400ms] motion-safe:ease-[cubic-bezier(0.45,0,0.2,1)] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:[translate:0_calc(-100%*2/3*var(--peek-scale))]' : ''}`}
        style={{ width: 1280, height: (peek ? height * 3 : height) / scale, transform: `scale(${scale})`, ['--peek-scale' as string]: scale }}
      />
    </div>
  )
}

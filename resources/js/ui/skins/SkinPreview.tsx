import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GuideState, ProjectContent, Site } from '@/core/types'
import { previewHtml } from '@/lib/measure'

/** A real page under one style guide: its first screen on a laptop, scaled to fit its card. Looks only, no clicks. */
export function SkinPreview({ site, guide, content, title, height = 260 }: { site: Site; guide: GuideState; content: ProjectContent; title: string; height?: number }) {
  const html = useMemo(() => previewHtml({ site, guide, content }, 1280), [site, guide, content])
  const [scale, setScale] = useState(0.3)
  const frame = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    setScale(el.clientWidth / 1280)
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1280))
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
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{ width: 1280, height: height / scale, transform: `scale(${scale})` }}
      />
    </div>
  )
}

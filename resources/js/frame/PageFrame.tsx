import { memo, useEffect, useRef, useState } from 'react'
import { registerFrame } from './bridge'

interface Props {
  srcdoc?: string
  src?: string
  width: number
  interactive?: boolean
  title: string
  onSections?: (s: { slot: string; top: number; height: number }[]) => void
  onHeight?: (h: number) => void
  /** A live preview's full height, when the agent reported it (a cross-origin page can't tell us). */
  srcHeight?: number
}

const BRIDGE_TAIL = `<script>(function(){var last=-1;function r(){var h=Math.ceil(document.body.getBoundingClientRect().height);if(h!==last){last=h;parent.postMessage({ns:'mx',height:h},'*');}var s=[];document.querySelectorAll('[data-mx-slot]').forEach(function(el){s.push({slot:el.getAttribute('data-mx-slot'),top:el.offsetTop,height:el.offsetHeight})});parent.postMessage({ns:'mx',sections:s},'*');}new ResizeObserver(r).observe(document.body);if(document.fonts)document.fonts.ready.then(r);r();})();</script><style>html,body{overflow:hidden}</style>`

/** A whole composed page (a version or build) in one sandboxed iframe. */
export const PageFrame = memo(function PageFrame({ srcdoc, src, srcHeight, width, interactive, title, onSections, onHeight }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [measured, setHeight] = useState(src ? 2400 : 1200)
  const height = src && srcHeight ? srcHeight : measured
  const cb = useRef({ onSections, onHeight })
  cb.current = { onSections, onHeight }

  useEffect(() => {
    const win = ref.current?.contentWindow
    if (!win || src) return
    return registerFrame(win, (d) => {
      if (typeof d.height === 'number' && d.height > 0) {
        setHeight(d.height)
        cb.current.onHeight?.(d.height)
      }
      if (d.sections) cb.current.onSections?.(d.sections)
    })
  }, [srcdoc, src])

  useEffect(() => {
    if (src) cb.current.onHeight?.(height)
  }, [src, height])

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox={src ? 'allow-scripts allow-same-origin allow-forms allow-popups' : 'allow-scripts'}
      srcDoc={src ? undefined : srcdoc?.replace('</body>', `${BRIDGE_TAIL}</body>`)}
      src={src}
      style={{ width, height, border: 0, display: 'block', pointerEvents: interactive ? 'auto' : 'none', background: 'transparent' }}
    />
  )
})

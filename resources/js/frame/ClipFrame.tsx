import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Clip } from '@/core/types'
import { buildSrcdoc } from './srcdoc'
import { postState, registerFrame, type FrameState } from './bridge'

interface Props {
  clip: Clip
  width: number
  state: FrameState
  /** Bump to replay entrance animations (e.g. when a clip slides into view). */
  replayKey?: number
  interactive?: boolean
  onHeight?: (h: number) => void
  className?: string
}

/**
 * A clip rendered at a real viewport width inside a sandboxed iframe. The srcdoc
 * is built once per clip + width; every later change goes over postMessage so the
 * frame never reloads (no flash while you drag a knob or flip Unified).
 */
export const ClipFrame = memo(function ClipFrame({ clip, width, state, replayKey, interactive, onHeight, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const [height, setHeight] = useState(640)
  const onHeightRef = useRef(onHeight)
  onHeightRef.current = onHeight
  const sent = useRef('')

  const srcdoc = useMemo(
    () =>
      buildSrcdoc({
        html: clip.html,
        css: clip.css,
        motionCss: clip.motionCss,
        tokensCss: stateRef.current.css,
        fontHrefs: stateRef.current.fonts,
        motion: stateRef.current.motion,
        outline: stateRef.current.outline,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clip.id, clip.hash, width],
  )

  useEffect(() => {
    const win = ref.current?.contentWindow
    if (!win) return
    return registerFrame(win, (d) => {
      if (d.ready) {
        sent.current = ''
        push()
      }
      if (typeof d.height === 'number' && d.height > 0) {
        setHeight(d.height)
        onHeightRef.current?.(d.height)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcdoc])

  const push = () => {
    const s = stateRef.current
    const key = JSON.stringify(s)
    if (key === sent.current) return
    sent.current = key
    postState(ref.current?.contentWindow, s)
  }

  useEffect(() => {
    const id = requestAnimationFrame(push)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.css, state.motion, state.fields, state.fonts, state.outline])

  useEffect(() => {
    if (replayKey) postState(ref.current?.contentWindow, { replay: true })
  }, [replayKey])

  return (
    <iframe
      ref={ref}
      title={clip.title}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      className={className}
      style={{ width, height, border: 0, display: 'block', pointerEvents: interactive ? 'auto' : 'none', background: 'transparent' }}
    />
  )
})

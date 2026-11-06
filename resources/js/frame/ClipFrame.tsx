import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Clip } from '@/core/types'
import { buildSrcdoc } from './srcdoc'
import { sectionClip } from '@/core/lists'
import { postState, registerFrame, type BlockEvent, type FrameState } from './bridge'
import { SHADERS_JS } from '@/core/export/shaders'
import { uploadData } from '@/lib/assets'
import { openLightbox } from '@/ui/shell/Lightbox'
import { openPagePath, revealSection } from '@/lib/actions'

interface Props {
  clip: Clip
  width: number
  state: FrameState
  /** Bump to replay entrance animations (e.g. when a clip slides into view). */
  replayKey?: number
  interactive?: boolean
  onHeight?: (h: number) => void
  className?: string
  /** Edit mode: blocks can be hovered, picked and edited in place; events come back here. */
  edit?: {
    /** Hover, select and edit blocks (or mark them, in note mode). Off = only report tracked rects. */
    active: boolean
    selected: string | null
    editText?: { id: string; n: number } | null
    /** Marking feedback instead of editing: click a block or drag an area. */
    noteMode?: boolean
    /** Blocks whose position the parent needs (pins). */
    track?: string[]
    onEvent: (e: BlockEvent) => void
  } | null
}

/**
 * A clip rendered at a real viewport width inside a sandboxed iframe. The srcdoc
 * is built once per clip + width; every later change goes over postMessage so the
 * frame never reloads (no flash while you drag a knob or flip Unified).
 */
export const ClipFrame = memo(function ClipFrame({ clip, width, state, replayKey, interactive, onHeight, className, edit }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const [height, setHeight] = useState(640)
  const onHeightRef = useRef(onHeight)
  onHeightRef.current = onHeight
  const sent = useRef('')
  const editRef = useRef(edit)
  editRef.current = edit

  const srcdoc = useMemo(
    () =>
      buildSrcdoc({
        // Blocks stamped with their ids (and marquee copies marked), so list changes can patch in place.
        html: sectionClip(clip).html,
        css: clip.css,
        motionCss: clip.motionCss,
        tokensCss: stateRef.current.css,
        fontHrefs: stateRef.current.fonts,
        motion: stateRef.current.motion,
        outline: stateRef.current.outline,
        blocksCss: stateRef.current.blocks?.css,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clip.id, clip.hash, width],
  )

  // A frame moved in the page (a section dragged to another place) reloads as a new window: count loads, so it's
  // listened to again and sent everything it had.
  const [loads, setLoads] = useState(0)
  const ready = (win: Window) => {
    sent.current = ''
    blobsSent.current = new Set()
    push()
    const e = editRef.current
    if (e) postState(win, { edit: e.active, select: e.active ? e.selected : null, noteMode: e.active && !!e.noteMode, track: e.track ?? [] })
  }
  useEffect(() => {
    const win = ref.current?.contentWindow
    if (!win) return
    // Its "ready" went out before this listened: catch up now.
    if (loads) ready(win)
    return registerFrame(win, (d) => {
      if (d.ready) ready(win)
      if (typeof d.height === 'number' && d.height > 0) {
        setHeight(d.height)
        onHeightRef.current?.(d.height)
      }
      if (d.lightbox) openLightbox(d.lightbox, d.asset ?? undefined)
      // The shader player loads only in frames that show a shader.
      if (d.needShaders) postState(win, { shadersJs: SHADERS_JS })
      if (d.wheel) forwardWheel(ref.current, d.wheel)
      // Following a link while previewing: sections on the page come into view, the rest open in a tab.
      if (d.goto) revealSection(d.goto)
      if (d.open && /^(https?:|mailto:|tel:)/.test(d.open)) window.open(d.open, '_blank', 'noopener')
      else if (d.open?.startsWith('/')) openPagePath(d.open)
      if ('hover' in d || 'pick' in d || 'selRect' in d || d.word || 'editing' in d || d.key || 'notePick' in d || 'drag' in d || d.area || d.rects || d.words || d.dragItem || d.dragMove || d.dragEnd) editRef.current?.onEvent(d)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcdoc, loads])

  // Uploaded videos and Lotties travel as files: a sandboxed frame can't read this page's blob URLs,
  // but it can make its own from a Blob it's sent.
  const blobsSent = useRef(new Set<string>())
  const push = () => {
    const s = stateRef.current
    const key = JSON.stringify(s)
    if (key === sent.current) return
    sent.current = key
    const blobs: Record<string, Blob> = {}
    for (const m of Object.values(s.media ?? {})) {
      if (!m.asset || blobsSent.current.has(m.asset)) continue
      const a = uploadData(m.asset)
      if (a?.bytes) {
        blobs[m.asset] = new Blob([a.bytes], { type: a.mime })
        blobsSent.current.add(m.asset)
      }
    }
    postState(ref.current?.contentWindow, Object.keys(blobs).length ? { ...s, blobs } : s)
  }

  useEffect(() => {
    const id = requestAnimationFrame(push)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.css, state.motion, state.fields, state.fonts, state.outline, state.slider, state.blocks, state.media, state.backdrop, state.icons, state.lists, state.links])

  // Edit mode and the selection travel separately from the look, so they never re-send tokens.
  const editing = !!edit?.active
  const selected = edit?.selected ?? null
  useEffect(() => {
    postState(ref.current?.contentWindow, { edit: editing, select: editing ? selected : null })
  }, [editing, selected, srcdoc, loads])
  const noteMode = editing && !!edit?.noteMode
  useEffect(() => {
    postState(ref.current?.contentWindow, { noteMode })
  }, [noteMode, srcdoc, loads])
  const trackKey = (edit?.track ?? []).join(',')
  useEffect(() => {
    if (trackKey) postState(ref.current?.contentWindow, { track: trackKey.split(',') })
  }, [trackKey, srcdoc, loads])
  const editText = edit?.editText
  useEffect(() => {
    if (editText) postState(ref.current?.contentWindow, { editText: editText.id })
  }, [editText])

  useEffect(() => {
    if (replayKey) postState(ref.current?.contentWindow, { replay: true })
  }, [replayKey])

  return (
    <iframe
      ref={ref}
      title={clip.title}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      onLoad={() => setLoads((n) => n + 1)}
      className={className}
      style={{ width, height, border: 0, display: 'block', pointerEvents: interactive || edit?.active ? 'auto' : 'none', background: 'transparent' }}
    />
  )
})

/**
 * A wheel event from inside a frame, replayed on the frame's element in page
 * coordinates, so the canvas pans or zooms as if the frame weren't there. Where
 * nothing takes it (a frame in a scrolling list), the list scrolls instead.
 */
function forwardWheel(frame: HTMLIFrameElement | null, w: NonNullable<Parameters<Parameters<typeof registerFrame>[1]>[0]['wheel']>) {
  if (!frame) return
  const r = frame.getBoundingClientRect()
  const scale = frame.offsetWidth ? r.width / frame.offsetWidth : 1
  const e = new WheelEvent('wheel', {
    deltaX: w.dx,
    deltaY: w.dy,
    deltaMode: w.mode,
    clientX: r.left + w.x * scale,
    clientY: r.top + w.y * scale,
    ctrlKey: w.ctrl,
    metaKey: w.meta,
    shiftKey: w.shift,
    bubbles: true,
    cancelable: true,
  })
  if (!frame.dispatchEvent(e)) return
  for (let el = frame.parentElement; el; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY
    if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollBy({ left: w.dx, top: w.dy })
      return
    }
  }
}

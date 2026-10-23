import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Clip } from '@/core/types'
import { buildSrcdoc } from './srcdoc'
import { sectionClip } from '@/core/lists'
import { postState, registerFrame, type BlockEvent, type FrameState } from './bridge'
import { uploadData } from '@/lib/assets'
import { openLightbox } from '@/ui/shell/Lightbox'

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

  useEffect(() => {
    const win = ref.current?.contentWindow
    if (!win) return
    return registerFrame(win, (d) => {
      if (d.ready) {
        sent.current = ''
        blobsSent.current = new Set()
        push()
        const e = editRef.current
        if (e) postState(win, { edit: e.active, select: e.active ? e.selected : null, noteMode: e.active && !!e.noteMode, track: e.track ?? [] })
      }
      if (typeof d.height === 'number' && d.height > 0) {
        setHeight(d.height)
        onHeightRef.current?.(d.height)
      }
      if (d.lightbox) openLightbox(d.lightbox, d.asset ?? undefined)
      if ('hover' in d || 'pick' in d || 'selRect' in d || d.word || 'editing' in d || d.key || 'notePick' in d || 'drag' in d || d.area || d.rects || d.words) editRef.current?.onEvent(d)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcdoc])

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
  }, [state.css, state.motion, state.fields, state.fonts, state.outline, state.blocks, state.media, state.icons, state.lists])

  // Edit mode and the selection travel separately from the look, so they never re-send tokens.
  const editing = !!edit?.active
  const selected = edit?.selected ?? null
  useEffect(() => {
    postState(ref.current?.contentWindow, { edit: editing, select: editing ? selected : null })
  }, [editing, selected, srcdoc])
  const noteMode = editing && !!edit?.noteMode
  useEffect(() => {
    postState(ref.current?.contentWindow, { noteMode })
  }, [noteMode, srcdoc])
  const trackKey = (edit?.track ?? []).join(',')
  useEffect(() => {
    if (trackKey) postState(ref.current?.contentWindow, { track: trackKey.split(',') })
  }, [trackKey, srcdoc])
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
      className={className}
      style={{ width, height, border: 0, display: 'block', pointerEvents: interactive || edit?.active ? 'auto' : 'none', background: 'transparent' }}
    />
  )
})

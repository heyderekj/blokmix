import { useEffect } from 'react'
import type { Keep } from '@/core/types'
import { useStore, undo, redo } from '@/state/store'
import { canvasApi } from '@/ui/canvas/Canvas'
import { pressVersionAndFly } from '@/lib/actions'
import { library } from '@/data/library'

const KEEP_KEYS: (keyof Keep)[] = ['layout', 'style', 'content', 'motion']

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** Keyboard-first: everything in the core loop has a key. */
export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      const st = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const focused = st.slots.find((s) => s.id === st.ui.focusedSlotId)
      const k = e.key

      if (mod && k.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && k.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && k.toLowerCase() === 's') {
        e.preventDefault()
        pressVersionAndFly()
        return
      }
      if (e.altKey && !mod && (k === 'ArrowUp' || k === 'ArrowDown') && focused) {
        e.preventDefault()
        const i = st.slots.indexOf(focused)
        st.moveSlot(focused.id, i + (k === 'ArrowUp' ? -1 : 1))
        return
      }
      if (mod || e.altKey) return

      if (e.shiftKey && (e.code === 'Digit1' || k === '!')) return void (e.preventDefault(), canvasApi.fitAll())
      if (e.shiftKey && (e.code === 'Digit0' || k === ')')) return void (e.preventDefault(), canvasApi.fitMix())

      switch (k) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault()
          const target = focused ?? st.slots[0]
          if (!target) return
          if (!focused) st.focusSlot(target.id)
          st.cycle(target.id, k === 'ArrowRight' ? 1 : -1)
          return
        }
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault()
          st.focusNext(k === 'ArrowDown' ? 1 : -1)
          return
        case 'Enter':
          e.preventDefault()
          pressVersionAndFly()
          return
        case 'l':
        case 'L':
          if (focused) st.toggleLock(focused.id)
          return
        case '1':
        case '2':
        case '3':
        case '4':
          if (focused) st.toggleKeep(focused.id, KEEP_KEYS[Number(k) - 1])
          return
        case 'p':
        case 'P':
          if (focused) {
            st.adoptClipDesign(focused.clipId)
            const clip = library.clips[focused.clipId]
            st.showFlash(`Style guide now follows ${library.sources[clip.sourceId]?.name}`, { undo: true })
          }
          return
        case 'u':
        case 'U':
          st.setUi({ mode: st.ui.mode === 'unified' ? 'captured' : 'unified' })
          return
        case 'v':
        case 'V':
          st.setUi({ tool: 'select' })
          return
        case 'h':
        case 'H':
          st.setUi({ tool: 'hand' })
          return
        case 's':
        case 'S':
          st.setUi({ tool: st.ui.tool === 'sticky' ? 'select' : 'sticky' })
          return
        case 'Backspace':
        case 'Delete':
          if (focused && st.slots.length > 1) st.removeSlot(focused.id)
          return
        case 'Escape':
          if (st.ui.sheet !== 'none') st.setUi({ sheet: 'none' })
          else st.setUi({ tool: 'select', previewFrameId: null, focusedSlotId: null })
          return
        case '=':
        case '+':
          canvasApi.zoomBy(1.25)
          return
        case '-':
        case '_':
          canvasApi.zoomBy(0.8)
          return
        case 'c':
        case 'C':
          st.setUi({ sheet: st.ui.sheet === 'crate' ? 'none' : 'crate' })
          return
        case 'g':
        case 'G':
          st.setUi({ sheet: st.ui.sheet === 'guide' ? 'none' : 'guide' })
          return
        case '?':
          onHelp()
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHelp])
}

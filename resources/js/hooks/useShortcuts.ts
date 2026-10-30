import { useEffect } from 'react'
import { useTiles } from '@/ui/frames/tiles'
import type { Keep } from '@/core/types'
import { useStore, undo, redo, currentSlots } from '@/state/store'
import { canvasApi } from '@/ui/canvas/Canvas'
import { pressVersionAndFly } from '@/lib/actions'
import { library, slotClip } from '@/data/library'
import { tileNeighbor, listContext } from '@/core/lists'
import { wordChoices, currentWords } from '@/core/words'

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
      const focused = currentSlots(st).find((s) => s.id === st.ui.focusedSlotId)
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
      const clip = focused ? slotClip(focused) : null
      // ⌥ + arrows move the item the selection is in (an item itself, or a heading or button inside one).
      let inItem = st.ui.selectedBlockId
      for (let b = clip?.blocks.find((x) => x.id === inItem); b && b.kind !== 'item'; b = clip!.blocks.find((x) => x.id === b!.parent)) inItem = b.parent
      const tile = focused && clip && inItem ? listContext(clip, focused, inItem) : null
      if (focused && tile?.item && e.altKey && !mod && k.startsWith('Arrow')) {
        e.preventDefault()
        // Like a sliding tile: trade places with the item on screen in that direction (the one below in a grid);
        // with no tile there, step through the list order.
        const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const)[k as 'ArrowUp']
        const tiles = useTiles.getState()
        const next = tiles.slotId === focused.id ? tileNeighbor(tiles.rects, tiles.ids, tile.item.id, dir) : null
        if (next) st.editList(focused.id, { op: 'swap', itemId: tile.item.id, withId: next })
        else st.editList(focused.id, { op: 'move', itemId: tile.item.id, to: tile.index + (k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 1) })
        return
      }
      // A selected list item: duplicate and remove it in place.
      const item = focused && clip && st.ui.selectedBlockId ? listContext(clip, focused, st.ui.selectedBlockId) : null
      if (focused && item?.item) {
        if (mod && k.toLowerCase() === 'd') {
          e.preventDefault()
          const r = st.editList(focused.id, { op: 'duplicate', itemId: item.item.id })
          if (r?.itemId) st.selectBlock(r.itemId)
          return
        }
        if (!mod && !e.altKey && (k === 'Backspace' || k === 'Delete')) {
          e.preventDefault()
          if (st.editList(focused.id, { op: 'remove', itemId: item.item.id })) {
            st.selectBlock(item.list.id)
            st.showFlash('Item removed', { undo: true })
          }
          return
        }
      }
      // [ and ]: the selected words' other options.
      if (focused && st.ui.selectedBlockId && !mod && !e.altKey && (k === '[' || k === ']')) {
        const clip = slotClip(focused)
        const field = clip.blocks.find((b) => b.id === st.ui.selectedBlockId)?.field
        if (field) {
          e.preventDefault()
          const choices = wordChoices(clip, focused, st.content, field)
          const now = currentWords(clip, focused, st.content, field)
          if (choices.length > 1 || (choices.length && !choices.some((c) => c.text.trim() === now.trim()))) {
            const at = choices.findIndex((c) => c.text.trim() === now.trim())
            const d = k === ']' ? 1 : -1
            const i = at < 0 ? (d > 0 ? 0 : choices.length - 1) : (at + d + choices.length) % choices.length
            st.chooseWords(focused.id, field, choices[i].text)
          }
          return
        }
      }
      if (e.altKey && !mod && (k === 'ArrowUp' || k === 'ArrowDown') && focused) {
        e.preventDefault()
        const i = currentSlots(st).indexOf(focused)
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
          const target = focused ?? currentSlots(st)[0]
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
        case 'n':
        case 'N':
          st.setUi({ tool: st.ui.tool === 'note' ? 'select' : 'note', openNoteId: null })
          return
        case 's':
        case 'S':
          st.setUi({ tool: st.ui.tool === 'sticky' ? 'select' : 'sticky' })
          return
        case 'Backspace':
        case 'Delete':
          if (focused && st.ui.selectedBlockId) {
            st.editBlock(focused.id, st.ui.selectedBlockId, { hidden: true })
            st.selectBlock(null)
            st.showFlash('Block hidden', { undo: true })
            return
          }
          if (focused && currentSlots(st).length > 1) st.removeSlot(focused.id)
          return
        case 'Escape':
          if (st.ui.openNoteId) st.setUi({ openNoteId: null })
          else if (st.ui.tool === 'note') st.setUi({ tool: 'select' })
          else if (focused && st.ui.selectedBlockId) {
            // Step out one level, like Figma.
            const block = slotClip(focused).blocks.find((b) => b.id === st.ui.selectedBlockId)
            st.selectBlock(block?.parent ?? null)
          } else if (st.ui.sheet !== 'none') st.setUi({ sheet: 'none' })
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

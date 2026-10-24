// Content script: injected on demand (the toolbar button or the panel's "Pick a
// section"), starts the picker and hands snapshots to the background worker.

import { startPicker } from './picker'
import type { Snapshot } from './capture/types'
import type { SectionType } from '@/core/types'

declare global {
  interface Window {
    __blokmixClipper?: { stop: (() => void) | null }
  }
}

const state = (window.__blokmixClipper ??= { stop: null })

if (!(window as unknown as { __blokmixListening?: boolean }).__blokmixListening) {
  ;(window as unknown as { __blokmixListening?: boolean }).__blokmixListening = true
  chrome.runtime.onMessage.addListener((msg: { type: string }) => {
    if (msg.type !== 'blokmix:pick') return
    state.stop?.()
    state.stop = startPicker({
      fetchCss: async (urls) => (await chrome.runtime.sendMessage({ type: 'blokmix:fetch-css', urls })) as string[],
      onCapture: async (snapshot: Snapshot, sectionType: SectionType) => {
        await chrome.runtime.sendMessage({ type: 'blokmix:captured', snapshot, sectionType })
        state.stop = null
      },
    })
  })
}

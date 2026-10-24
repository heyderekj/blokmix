// Background worker: opens the side panel, injects the picker, fetches the
// stylesheets a page can't read itself, and keeps captures in storage.

import type { Snapshot } from './capture/types'
import type { SectionType } from '@/core/types'

export interface StoredCapture {
  id: string
  snapshot: Snapshot
  type: SectionType
  sourceId?: string
  variant?: string
}

async function startPicker(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  await chrome.tabs.sendMessage(tabId, { type: 'blokmix:pick' })
}

chrome.action.onClicked.addListener((tab) => {
  // Open the panel first, while the click still counts as a user gesture.
  if (tab.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId })
  if (tab.id !== undefined) startPicker(tab.id).catch((err) => console.warn('[blokmix] can’t clip this page', err))
})

chrome.runtime.onMessage.addListener((msg: { type: string; [k: string]: unknown }, _sender, reply) => {
  if (msg.type === 'blokmix:start-pick') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
      if (!tab?.id || !/^https?:|^file:/.test(tab.url ?? '')) return reply({ ok: false, error: 'Open a web page to clip from it.' })
      startPicker(tab.id)
        .then(() => reply({ ok: true }))
        .catch((err: Error) => reply({ ok: false, error: err.message }))
    })
    return true
  }
  if (msg.type === 'blokmix:fetch-css') {
    Promise.all((msg.urls as string[]).map((u) => fetch(u).then((r) => (r.ok ? r.text() : '')).catch(() => ''))).then(reply)
    return true
  }
  if (msg.type === 'blokmix:captured') {
    const capture: StoredCapture = { id: crypto.randomUUID(), snapshot: msg.snapshot as Snapshot, type: msg.sectionType as SectionType }
    chrome.storage.local.get('captures').then(({ captures = [] }) => {
      chrome.storage.local.set({ captures: [capture, ...(captures as StoredCapture[])] }).then(() => reply({ ok: true }))
    })
    return true
  }
})

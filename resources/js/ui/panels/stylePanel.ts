import { create } from 'zustand'
import { leaveBeside } from '../canvas/inView'

/**
 * The Style panel, docked at the window's side: it shows whatever is selected (a section, or a block in it) and stays
 * open as the selection moves, so it lives outside any one section's or block's bar.
 */
export const useStylePanel = create<{ open: boolean }>()(() => ({ open: false }))

export function setStylePanel(open: boolean) {
  if (useStylePanel.getState().open === open) return
  useStylePanel.setState({ open })
  if (!open) leaveBeside()
}

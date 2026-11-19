import { currentSlots, useStore } from '@/state/store'
import { landedSteps } from '@/core/nextSteps'
import { refId } from '@/core/skins'

/** A start just landed: show the page alone (no panel thrown open), with hints for what to try next above the dock. */
export function landOnPage() {
  const st = useStore.getState()
  st.setUi({ leftPanel: 'none', sheet: 'none', nextSteps: landedSteps(currentSlots(st), refId(st.guide.skin) ?? null) })
}

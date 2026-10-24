import { type CommandInput } from '@/core/commands/schema'
import { slotClip } from '@/data/library'
import { useStore } from '../store'
import { findSection, adviceFor } from './refs'

/** The design checklist, run over the page or one section. */
export const read = {
  review: (i: CommandInput<'review'>) => {
    const st = useStore.getState()
    const slots = i.section !== undefined ? [findSection(i.section)] : st.slots
    return slots.flatMap((s) => {
      const blocks = slotClip(s).blocks
      return adviceFor(s).map((a) => ({ section: s.id, block: blocks.find((b) => b.id === a.blockId)?.label, ...a }))
    })
  },
}

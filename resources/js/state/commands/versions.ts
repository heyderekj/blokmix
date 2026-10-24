import { type CommandInput } from '@/core/commands/schema'
import { pressVersionAndFly } from '@/lib/actions'
import { useStore } from '../store'

/** Versions of the mix. */
export const write = {
  save_version: (i: CommandInput<'save_version'>) => {
    pressVersionAndFly()
    const st = useStore.getState()
    const v = st.head ? st.versions[st.head] : null
    if (v && i.title) st.renameVersion(v.id, i.title)
    return v ? { version: v.letter, title: i.title ?? v.title } : null
  },
}

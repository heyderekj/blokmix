import type { CommandInput } from '@/core/commands/schema'
import { contractMarkdown, emptyContract } from '@/core/contract'
import { skinById, skinList } from '@/core/skins'
import { useStore } from '../store'
import { CommandError } from './refs'

const contractNow = () => {
  const st = useStore.getState()
  const contract = st.contract ?? emptyContract()
  return { ...contract, markdown: contractMarkdown(contract, st.guide.skin) }
}

export const read = {
  list_skins: () => {
    const on = useStore.getState().guide.skin
    return {
      current: on ?? null,
      skins: skinList().map((s) => ({ id: s.id, name: s.name, words: s.words, tier: s.tier, mode: s.mode, on: on?.id === s.id })),
    }
  },
  get_contract: () => contractNow(),
}

export const write = {
  apply_skin: (i: CommandInput<'apply_skin'>) => {
    if (!skinById(i.skin)) throw new CommandError(`No skin called "${i.skin}". Skins: ${skinList().map((s) => s.id).join(', ')}`)
    useStore.getState().applySkin(i.skin)
    return { skin: useStore.getState().guide.skin ?? null, contract: useStore.getState().contract?.areas ?? {} }
  },
  surprise_me: (i: CommandInput<'surprise_me'>) => {
    const words = useStore.getState().surpriseMe(i.seed)
    if (!words) throw new CommandError('Nothing to surprise you with: the contract keeps every area, or no other skins are available.')
    return { words, skin: useStore.getState().guide.skin ?? null }
  },
  set_contract: (i: CommandInput<'set_contract'>) => {
    const st = useStore.getState()
    const now = st.contract ?? emptyContract()
    st.setContract({ areas: { ...now.areas, ...i.areas }, ...(i.keep ? { keep: i.keep } : {}), ...(i.surprise ? { surprise: i.surprise } : {}) })
    return contractNow()
  },
}

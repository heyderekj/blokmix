import type { CommandInput } from '@/core/commands/schema'
import { contractMarkdown, emptyContract } from '@/core/contract'
import { skinById, skinList, skinRefOf } from '@/core/skins'
import { NUDGE_LABEL, nudgeTokens, themesFor } from '@/core/feel'
import { resolveGuide } from '@/core/guide'
import { readDials, toneOfGuide } from '@/core/dials'
import { useStore } from '../store'
import { CommandError } from './refs'

const contractNow = () => {
  const st = useStore.getState()
  const contract = st.contract ?? emptyContract()
  return { ...contract, markdown: contractMarkdown(contract, st.guide.skin) }
}

export const read = {
  list_skins: () => {
    const on = skinRefOf(useStore.getState().guide.skin)
    return {
      current: on ?? null,
      skins: skinList().map((s) => ({ id: s.id, name: s.name, words: s.words, mode: s.mode, on: on?.id === s.id })),
    }
  },
  get_contract: () => contractNow(),
  suggest_themes: (i: CommandInput<'suggest_themes'>) => {
    const on = skinRefOf(useStore.getState().guide.skin)
    return { themes: themesFor(i.words, skinList(), { different: i.different, count: i.count }).map((s) => ({ id: s.id, name: s.name, words: s.words, feel: s.feel, on: on?.id === s.id })) }
  },
}

export const write = {
  apply_skin: (i: CommandInput<'apply_skin'>) => {
    if (!skinById(i.skin)) throw new CommandError(`No skin called "${i.skin}". Skins: ${skinList().map((s) => s.id).join(', ')}`)
    useStore.getState().applySkin(i.skin)
    return { skin: skinRefOf(useStore.getState().guide.skin) ?? null, contract: useStore.getState().contract?.areas ?? {} }
  },
  nudge_look: (i: CommandInput<'nudge_look'>) => {
    const st = useStore.getState()
    const values = nudgeTokens(resolveGuide(st.guide).tokens, i.nudge)
    if (!values) throw new CommandError(`Can’t go any ${NUDGE_LABEL[i.nudge].toLowerCase()}: it’s already as far as it goes.`)
    st.chooseTokens(values)
    const tokens = resolveGuide(useStore.getState().guide).tokens
    return { nudge: i.nudge, dials: readDials(tokens), tone: toneOfGuide(tokens) }
  },
  surprise_me: (i: CommandInput<'surprise_me'>) => {
    const words = useStore.getState().surpriseMe(i.seed)
    if (!words) throw new CommandError('Nothing to surprise you with: the contract keeps every area, or no other skins are available.')
    return { words, skin: skinRefOf(useStore.getState().guide.skin) ?? null }
  },
  set_contract: (i: CommandInput<'set_contract'>) => {
    const st = useStore.getState()
    const now = st.contract ?? emptyContract()
    st.setContract({ areas: { ...now.areas, ...i.areas }, ...(i.keep ? { keep: i.keep } : {}), ...(i.surprise ? { surprise: i.surprise } : {}) })
    return contractNow()
  },
}

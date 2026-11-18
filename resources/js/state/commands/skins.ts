import { rankThemes } from '@/core/themeRanking'
import { listParts } from '@/core/themeParts'
import type { CommandInput } from '@/core/commands/schema'
import { contractMarkdown, emptyContract } from '@/core/contract'
import { refId, swapThemeParts, type ThemeParts, skinById, skinList, skinRefOf } from '@/core/skins'
import { NUDGE_LABEL, nudgeTokens } from '@/core/feel'
import { resolveGuide } from '@/core/guide'
import { readDials, toneOfGuide } from '@/core/dials'
import { useStore } from '../store'
import { CommandError } from './refs'

const contractNow = () => {
  const st = useStore.getState()
  const contract = st.contract ?? emptyContract()
  return { ...contract, markdown: contractMarkdown(contract, st.guide.skin) }
}

function applyParts(parts: ThemeParts) {
  const st = useStore.getState()
  const guide = swapThemeParts(st.guide, parts, st.contract)
  useStore.setState({ guide })
  return { parts }
}

export const read = {
  list_theme_parts: (i: CommandInput<'list_theme_parts'>) => {
    const st = useStore.getState()
    return listParts(st.guide, st.contract, i.area)
  },
  list_skins: () => {
    const on = skinRefOf(useStore.getState().guide.skin)
    return {
      current: on ?? null,
      skins: skinList().map((s) => ({
        id: s.id,
        name: s.name,
        words: s.words,
        mode: s.mode,
        industries: s.industries,
        formats: s.formats,
        feel: s.feel,
        flavors: s.flavors,
        on: on?.id === s.id,
      })),
    }
  },
  get_contract: () => contractNow(),
  suggest_themes: (i: CommandInput<'suggest_themes'>) => {
    const st = useStore.getState()
    const brief = { ...st.content.brief, ...(i.industry && { industry: i.industry }), ...(i.format && { format: i.format }) }
    return {
      themes: rankThemes({ ...i, brief, guide: st.guide, contract: st.contract }).map(({ skin, reason }) => ({
        id: skin.id,
        name: skin.name,
        words: skin.words,
        feel: skin.feel,
        reason,
        on: refId(st.guide.skin) === skin.id,
      })),
    }
  },
}

export const write = {
  set_theme_part: (i: CommandInput<'set_theme_part'>) => applyParts({ [i.area]: i.part }),
  set_theme_parts: (i: CommandInput<'set_theme_parts'>) => applyParts(i.parts),
  apply_skin: (i: CommandInput<'apply_skin'>) => {
    const id = i.flavor ? `${i.skin}/${i.flavor}` : i.skin
    if (!skinById(id))
      throw new CommandError(
        `No skin called "${i.skin}". Skins: ${skinList()
          .map((s) => s.id)
          .join(', ')}`,
      )
    useStore.getState().applySkin(id)
    return { skin: skinRefOf(useStore.getState().guide.skin) ?? null, contract: useStore.getState().contract?.areas ?? {} }
  },
  nudge_look: (i: CommandInput<'nudge_look'>) => {
    const st = useStore.getState()
    const values = nudgeTokens(resolveGuide(st.guide).tokens, i.nudge)
    if (!values) throw new CommandError(`Can’t go any ${NUDGE_LABEL[i.nudge].toLowerCase()}: it’s already as far as it goes.`)
    if (i.nudge === 'darker' || i.nudge === 'lighter') st.setThemeTone(i.nudge === 'darker' ? 'dark' : 'light')
    else st.chooseTokens(values)
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

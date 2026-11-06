import { briefContext, briefOf, type Brief } from '@/core/brief'
import type { Choice, Keep, TokenKey } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { resolveGuide } from '@/core/guide'
import { DIALS, readDials, setTone } from '@/core/dials'
import { library } from '@/data/library'
import { findLibraryFont, fontStack } from '@/core/fonts'
import { editedTextStyles, resolveTextStyles, TEXT_STYLE_LABEL, TEXT_STYLES } from '@/core/textStyles'
import { useStore } from '../store'
import { allSlots } from '@/core/site'
import { CommandError, findPage, findSection, findBlock, describeSection, clean, positionOf } from './refs'

/** The page as a whole: its sections, what each keeps, and the style guide tokens. */
export const write = {
  add_section: (i: CommandInput<'add_section'>) => {
    const st = useStore.getState()
    if (i.clip_id && library.clips[i.clip_id]?.type !== i.type) throw new CommandError(`${i.clip_id} isn’t a ${i.type} clip`)
    const page = findPage(i.page)
    if ((i.type === 'nav' || i.type === 'footer') && st.site.shared[i.type]) {
      // One nav and one footer for the site: adding one shows the shared one here.
      st.updatePage(page.id, { show: { [i.type]: true } })
      const shared = useStore.getState().site.shared[i.type]!
      return { ...describeSection(shared, positionOf(shared, page.id)), shared: true, note: `The site already has a ${i.type}; it now shows on ${page.title}. swap_section changes its clip on every page.` }
    }
    const before = new Set(allSlots(st.site).map((s) => s.id))
    st.addSlot(i.type, i.clip_id, i.at, page.id)
    const added = allSlots(useStore.getState().site).find((s) => !before.has(s.id))
    if (!added) throw new CommandError(`No ${i.type} clips or layouts available`)
    return describeSection(added, positionOf(added, page.id))
  },
  remove_section: (i: CommandInput<'remove_section'>) => {
    const slot = findSection(i.section)
    useStore.getState().removeSlot(slot.id)
    return { removed: slot.id }
  },
  move_section: (i: CommandInput<'move_section'>) => {
    const slot = findSection(i.section, i.page)
    if (slot.type === 'nav' || slot.type === 'footer') {
      if (useStore.getState().site.shared[slot.type]?.id === slot.id) throw new CommandError(`The shared ${slot.type} stays at the ${slot.type === 'nav' ? 'top' : 'bottom'} of every page`)
    }
    useStore.getState().moveSlot(slot.id, i.to - 1)
    return { moved: slot.id, position: positionOf(slot) }
  },
  swap_section: (i: CommandInput<'swap_section'>) => {
    const slot = findSection(i.section)
    const clip = library.clips[i.clip_id]
    if (!clip || clip.type !== slot.type) throw new CommandError(`${i.clip_id} isn’t a ${slot.type} clip. See get_options.`)
    useStore.getState().setClip(slot.id, clip.id)
    return { section: slot.id, clip: clip.id }
  },
  set_keep: (i: CommandInput<'set_keep'>) => {
    const slot = findSection(i.section)
    const want: Partial<Keep> = clean({ layout: i.layout, style: i.style, content: i.copy, motion: i.motion })
    for (const [k, v] of Object.entries(want) as [keyof Keep, boolean][]) if (slot.keep[k] !== v) useStore.getState().toggleKeep(slot.id, k)
    return { keep: findSection(slot.id).keep }
  },
  set_dial: (i: CommandInput<'set_dial'>) => {
    useStore.getState().chooseTokens(DIALS[i.dial].write(i.value))
    return { dials: readDials(resolveGuide(useStore.getState().guide).tokens) }
  },
  set_tone: (i: CommandInput<'set_tone'>) => {
    useStore.getState().chooseTokens(setTone(resolveGuide(useStore.getState().guide).tokens, i.tone))
    const tokens = resolveGuide(useStore.getState().guide).tokens
    return { tone: i.tone, colors: Object.fromEntries(Object.entries(tokens).filter(([k]) => k.startsWith('color.'))) }
  },
  update_text_style: (i: CommandInput<'update_text_style'>) => {
    const { style, reset, ...patch } = i
    const st = useStore.getState()
    if (reset) st.setTextStyle(style, null)
    if (Object.keys(patch).length) st.setTextStyle(style, patch)
    return { style, label: TEXT_STYLE_LABEL[style], ...resolveTextStyles(useStore.getState().guide.textStyles)[style] }
  },
  set_token: (i: CommandInput<'set_token'>) => {
    // A bare family from the library ("Satoshi") becomes a full stack with a fitting fallback.
    let value = i.value
    if (value && i.key.startsWith('font.') && !value.includes(',')) {
      const lib = findLibraryFont(value)
      if (lib) value = fontStack(lib.family, i.key === 'font.mono' ? 'mono' : i.key === 'font.body' ? 'body' : 'display')
    }
    const choice: Choice | null = value === null ? null : { kind: 'custom', value }
    useStore.getState().chooseToken(i.key as TokenKey, choice)
    return { key: i.key, value: resolveGuide(useStore.getState().guide).tokens[i.key as TokenKey] }
  },
  set_brand: (i: CommandInput<'set_brand'>) => {
    const changed = useStore.getState().setBrand(i.name)
    return { name: useStore.getState().content.brand, changed }
  },
  set_brief: (i: CommandInput<'set_brief'>) => {
    const patch: Partial<Brief> = {}
    if (i.format !== undefined) patch.format = i.format
    if (i.industry !== undefined) patch.industry = i.industry
    if (i.industry_words !== undefined) patch.industryWords = i.industry_words
    if (i.goals !== undefined) patch.goals = i.goals
    if (i.goals_other !== undefined) patch.goalsOther = i.goals_other
    if (i.who !== undefined) patch.who = i.who
    if (i.what !== undefined) patch.what = i.what
    if (i.main_action !== undefined) patch.mainAction = i.main_action
    useStore.getState().setBrief(patch)
    return briefOut()
  },
  set_brand_color: (i: CommandInput<'set_brand_color'>) => {
    useStore.getState().setBrandColor(i.color)
    const t = resolveGuide(useStore.getState().guide).tokens
    return { brand: i.color, primary: t['color.primary'], onPrimary: t['color.onPrimary'], text: t['color.text'], bg: t['color.bg'] }
  },
  set_logo: (i: CommandInput<'set_logo'>) => {
    if (i.remove) {
      useStore.getState().setLogo(null)
      return { logo: null }
    }
    if (i.section === undefined || !i.block) throw new CommandError('Give the section and block of a picture to use as the logo, or remove: true')
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    const media = slot.edits?.[slot.clipId]?.[b.id]?.media
    if (b.kind !== 'image' || !media) throw new CommandError(`${b.label} has no picture of its own to use as the logo`)
    useStore.getState().setLogo(media)
    return { logo: media }
  },
  add_brand_colour: (i: CommandInput<'add_brand_colour'>) => {
    useStore.getState().addSwatch(i.name, i.value)
    return { use: `x:${i.name}` }
  },
}

export const textStyleRead = {
  list_text_styles: () => {
    const edits = useStore.getState().guide.textStyles
    const all = resolveTextStyles(edits)
    const edited = editedTextStyles(edits)
    return { styles: TEXT_STYLES.map((id) => ({ id, label: TEXT_STYLE_LABEL[id], edited: edited.has(id), ...all[id] })) }
  },
}

/** The brief as agents read it. */
export function briefOut() {
  const c = useStore.getState().content
  const b = briefOf(c)
  return {
    format: b.format ?? null,
    industry: b.industry ?? null,
    industry_words: b.industryWords ?? null,
    goals: b.goals ?? [],
    goals_other: b.goalsOther ?? null,
    who: b.who ?? null,
    what: b.what ?? null,
    main_action: b.mainAction ?? null,
    kind: c.kind ?? null,
    in_a_sentence: briefContext(c),
  }
}

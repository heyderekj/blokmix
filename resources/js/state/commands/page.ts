import type { Choice, Keep, TokenKey } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import { findLibraryFont, fontStack } from '@/core/fonts'
import { useStore } from '../store'
import { allSlots } from '@/core/site'
import { CommandError, findPage, findSection, describeSection, clean, positionOf } from './refs'

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
  add_brand_colour: (i: CommandInput<'add_brand_colour'>) => {
    useStore.getState().addSwatch(i.name, i.value)
    return { use: `x:${i.name}` }
  },
}

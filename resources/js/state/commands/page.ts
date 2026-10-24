import type { Choice, Keep, TokenKey } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import { findLibraryFont, fontStack } from '@/core/fonts'
import { useStore } from '../store'
import { CommandError, findSection, describeSection, clean } from './refs'

/** The page as a whole: its sections, what each keeps, and the style guide tokens. */
export const write = {
  add_section: (i: CommandInput<'add_section'>) => {
    const st = useStore.getState()
    if (i.clip_id && library.clips[i.clip_id]?.type !== i.type) throw new CommandError(`${i.clip_id} isn’t a ${i.type} clip`)
    const before = new Set(st.slots.map((s) => s.id))
    st.addSlot(i.type, i.clip_id, i.at)
    const added = useStore.getState().slots.find((s) => !before.has(s.id))
    if (!added) throw new CommandError(`No ${i.type} clips or layouts available`)
    return describeSection(added, useStore.getState().slots.indexOf(added) + 1)
  },
  remove_section: (i: CommandInput<'remove_section'>) => {
    const slot = findSection(i.section)
    useStore.getState().removeSlot(slot.id)
    return { removed: slot.id }
  },
  move_section: (i: CommandInput<'move_section'>) => {
    const slot = findSection(i.section)
    useStore.getState().moveSlot(slot.id, i.to - 1)
    return { moved: slot.id, position: useStore.getState().slots.findIndex((s) => s.id === slot.id) + 1 }
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

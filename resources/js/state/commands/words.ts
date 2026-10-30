import { type CommandInput } from '@/core/commands/schema'
import { slotClip } from '@/data/library'
import { type ListOp } from '@/core/lists'
import { contentJson, type OutlineNode } from '@/core/outline'
import { keepOption, putBackOption, retireOption, showWords, wordChoices } from '@/core/words'
import { useStore } from '../store'
import { CommandError, findSection, wordsFor, findList, outlineOf, findOutlineList, changeList, putSlot, itemsOf } from './refs'

/** Words and lists: rewriting, options, and adding or reordering items. */
export const write = {
  set_words: (i: CommandInput<'set_words'>) => {
    const slot = findSection(i.section)
    const fields = Object.keys(slotClip(slot).fields)
    for (const [field, text] of Object.entries(i.words)) {
      if (!fields.includes(field)) throw new CommandError(`No field "${field}" in this ${slot.type}. Fields: ${fields.join(', ')}`)
      useStore.getState().setWord(slot.id, field, text === '' ? null : text)
    }
    return { words: wordsFor(findSection(slot.id)) }
  },
  word_options: (i: CommandInput<'word_options'>) => {
    let slot = findSection(i.section)
    const clip = slotClip(slot)
    if (clip.fields[i.field] == null) throw new CommandError(`No field "${i.field}" in this ${slot.type}. Fields: ${Object.keys(clip.fields).join(', ')}`)
    const content = useStore.getState().content
    for (const t of i.keep ?? []) slot = keepOption(slot, i.field, t, 'agent')
    for (const t of i.retire ?? []) slot = retireOption(slot, i.field, t)
    for (const t of i.put_back ?? []) slot = putBackOption(slot, i.field, t)
    if (i.use) {
      if (!wordChoices(clip, slot, content, i.field).some((c) => c.text.trim() === i.use!.trim())) slot = keepOption(slot, i.field, i.use, 'agent')
      slot = showWords(slot, clip, content, i.field, i.use)
    }
    putSlot(slot)
    const live = findSection(slot.id)
    return { field: i.field, showing: wordsFor(live)[i.field], choices: wordChoices(clip, live, content, i.field).map((c) => ({ text: c.text, kind: c.kind, by: c.option?.by })) }
  },
  edit_list: (i: CommandInput<'edit_list'>) => {
    const slot = findSection(i.section)
    const list = findList(slot, i.list)
    const items = itemsOf(slot, list.id)
    const item = () => {
      if (i.item == null) throw new CommandError(`Say which item (1–${items.length}).`)
      const hit = items[i.item - 1]
      if (!hit) throw new CommandError(`${list.label} has ${items.length} items.`)
      return hit.id
    }
    const change: ListOp =
      i.op === 'add' || i.op === 'reset'
        ? { op: i.op, listId: list.id }
        : i.op === 'move'
          ? { op: 'move', itemId: item(), to: (i.to ?? 1) - 1 }
          : i.op === 'swap'
            ? { op: 'swap', itemId: item(), withId: items[(i.to ?? 0) - 1]?.id ?? '' }
            : { op: i.op, itemId: item() }
    putSlot(changeList(slot, change))
    const live = findSection(slot.id)
    return { list: list.label, items: itemsOf(live, list.id).map((b, n) => ({ position: n + 1, block: b.id, label: b.label })), content: contentJson(outlineOf(live), wordsFor(live)) }
  },
  set_list: (i: CommandInput<'set_list'>) => {
    let slot = findSection(i.section)
    const list = findList(slot, i.list)
    if (!list.listKey) throw new CommandError(`${list.label}’s items are set by the layout; set its words with set_words instead.`)
    // Match the number of items first (new ones copy the first item), then write their words.
    while (itemsOf(slot, list.id).length < i.items.length) slot = changeList(slot, { op: 'add', listId: list.id })
    while (itemsOf(slot, list.id).length > i.items.length) {
      const items = itemsOf(slot, list.id)
      slot = changeList(slot, { op: 'remove', itemId: items[items.length - 1].id })
    }
    const node = findOutlineList(outlineOf(slot), list.id)
    if (!node) throw new CommandError(`Couldn’t read ${list.label}.`)
    const words = { ...slot.words }
    i.items.forEach((value, n) => {
      const it = node.items[n]
      const fields = it.nodes.filter((x): x is Extract<OutlineNode, { t: 'field' }> => x.t === 'field')
      if (typeof value === 'string') {
        if (fields.length !== 1) throw new CommandError(`Item ${n + 1} has fields ${fields.map((f) => f.key).join(', ')}: give an object.`)
        words[fields[0].field] = value
      } else
        for (const [k, v] of Object.entries(value)) {
          const f = fields.find((x) => x.key === k)
          if (!f) throw new CommandError(`Item ${n + 1} has no "${k}". Its fields: ${fields.map((x) => x.key).join(', ')}`)
          words[f.field] = v
        }
    })
    slot = { ...slot, words }
    putSlot(slot)
    return { list: list.label, content: contentJson(outlineOf(slot), wordsFor(findSection(slot.id))) }
  },
}

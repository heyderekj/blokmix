// Words with options: every field in a section can keep other ways of saying
// it, to switch between on the canvas. Borrowed from Koati: Keep, Retire,
// Put it back, "Another way to say it".

import type { Clip, ProjectContent, Slot, WordOption } from './types'
import { resolveFields } from './content'

export interface WordChoice {
  text: string
  /** Where it comes from: your copy for the page, the clip's own words, or an option you kept. */
  kind: 'copy' | 'source' | 'kept'
  option?: WordOption
}

/** The words a field shows without this section's own words: your copy, or the clip's. */
export function fallbackWords(clip: Pick<Clip, 'type' | 'fields'>, slot: Pick<Slot, 'keep'>, content: ProjectContent, field: string): string {
  return resolveFields(clip.type, clip.fields, content, slot.keep.content).fields[field] ?? ''
}

/** What a field shows now. */
export function currentWords(clip: Pick<Clip, 'type' | 'fields'>, slot: Pick<Slot, 'keep' | 'words'>, content: ProjectContent, field: string): string {
  return resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields[field] ?? ''
}

/**
 * The ways a field can read, in cycling order: the page's copy, the clip's own
 * words, then the options you kept. Retired options are left out.
 */
export function wordChoices(clip: Pick<Clip, 'type' | 'fields'>, slot: Pick<Slot, 'keep' | 'options'>, content: ProjectContent, field: string): WordChoice[] {
  const out: WordChoice[] = []
  const add = (c: WordChoice) => {
    const t = c.text.trim()
    if (t && !out.some((o) => o.text.trim() === t)) out.push(c)
  }
  const copy = content.fields[clip.type]?.[field]
  if (copy && !slot.keep.content) add({ text: copy, kind: 'copy' })
  if (clip.fields[field] != null) add({ text: clip.fields[field], kind: 'source' })
  for (const o of slot.options?.[field] ?? []) if (!o.retiredAt) add({ text: o.text, kind: 'kept', option: o })
  return out
}

/** Keep words as an option (putting a retired copy back if there is one). */
export function keepOption(slot: Slot, field: string, text: string, by: WordOption['by'] = 'you', now = Date.now()): Slot {
  const t = text.trim()
  if (!t) return slot
  const list = slot.options?.[field] ?? []
  const same = list.find((o) => o.text.trim() === t)
  const next = same ? list.map((o) => (o === same ? { ...o, retiredAt: undefined } : o)) : [...list, { text: t, by, keptAt: now }]
  return { ...slot, options: { ...slot.options, [field]: next.map(clean) } }
}

/** Retire an option: out of the cycler, still listed in Content to put back. */
export function retireOption(slot: Slot, field: string, text: string, now = Date.now()): Slot {
  const list = slot.options?.[field]
  if (!list) return slot
  return { ...slot, options: { ...slot.options, [field]: list.map((o) => (o.text === text ? { ...o, retiredAt: now } : o)) } }
}

export function putBackOption(slot: Slot, field: string, text: string): Slot {
  const list = slot.options?.[field]
  if (!list) return slot
  return { ...slot, options: { ...slot.options, [field]: list.map((o) => (o.text === text ? clean({ ...o, retiredAt: undefined }) : o)) } }
}

/** Show these words: as the section's own words, unless they're what it shows anyway. */
export function showWords(slot: Slot, clip: Pick<Clip, 'type' | 'fields'>, content: ProjectContent, field: string, text: string): Slot {
  const words = { ...slot.words }
  if (text === fallbackWords(clip, slot, content, field)) delete words[field]
  else words[field] = text
  return { ...slot, words }
}

function clean(o: WordOption): WordOption {
  const { retiredAt, ...rest } = o
  return retiredAt ? { ...rest, retiredAt } : rest
}

import { needOf, type Need } from '@/core/reader/need'
import { keywordNeed } from '@/core/reader/local'
import { PAGE_TEMPLATES } from '@/core/site'
import { TYPE_LABEL } from '@/core/content'
import { suggestClip } from '@/core/suggest'
import type { SectionType } from '@/core/types'
import { library } from '@/data/library'
import { askReader } from '@/lib/reader'
import { currentSlots, useStore } from './store'

export type NeedRead = Need & { from: 'reader' | 'keywords' }

/**
 * "I need a [page | section] that [does what]", read: by the reader when it's on (it knows clauses and context), else by
 * keywords, so it never dead-ends. What was asked for (a page or a section) stays what the sentence said.
 */
export async function readNeed(text: string, what: 'page' | 'section', signal?: AbortSignal): Promise<NeedRead | null> {
  const st = useStore.getState()
  const sections = currentSlots(st).map((s) => s.type).filter((t) => t !== 'nav' && t !== 'footer') as Exclude<SectionType, 'nav' | 'footer'>[]
  const read = await askReader('need', text, { ...(st.content.kind ? { kind: st.content.kind } : {}), sections }, { signal }).catch(() => null)
  const fromReader = needOf(read ? { ...read, what } : null)
  if (fromReader && (fromReader.sections.length || (what === 'page' && fromReader.template !== 'blank'))) return { ...fromReader, from: 'reader' }
  const kw = needOf(keywordNeed(text, what))
  return kw && (kw.sections.length || kw.template !== 'blank') ? { ...kw, from: 'keywords' } : null
}

/** The sections a need asks for that Blokmix has layouts for, best first. */
const usable = (n: Need) => n.sections.filter((t) => library.byType[t]?.length > 0)

/**
 * Add the section a need asks for, at `at` on the open page (by default the end, before the footer), in the layout
 * that suits that spot best. One undo step. Returns what it added and what else would have done.
 */
export function addNeededSection(n: Need, at?: number): { type: SectionType; others: SectionType[] } | null {
  const [type, ...others] = usable(n)
  if (!type) return null
  const st = useStore.getState()
  const slots = currentSlots(st)
  const end = slots.length - (slots.at(-1)?.type === 'footer' ? 1 : 0)
  const spot = Math.max(0, Math.min(at ?? end, end))
  const best = suggestClip(type, slots, spot, library)[0]
  if (!best) return null
  st.addSlot(type, best.clipId, spot)
  return { type, others }
}

/**
 * Add the page a need asks for: a template's page when it names one, else a page of the sections it asks for (under
 * a page header), opened. One undo step. Returns its id and what's on it.
 */
export function addNeededPage(n: Need, title?: string): { pageId: string; sections: SectionType[] } {
  const st = useStore.getState()
  const t = n.template && n.template !== 'blank' ? PAGE_TEMPLATES[n.template] : null
  const types: SectionType[] = t ? [...t.types] : (['header', ...usable(n)] as SectionType[]).filter((x, i, a) => a.indexOf(x) === i)
  const name = title ?? (t ? t.title : usable(n)[0] ? TYPE_LABEL[usable(n)[0]] : undefined)
  // Its address from what it is (/about, /gallery); the store keeps it free of the pages there already.
  const slug = (n.template && n.template !== 'blank' ? n.template : (name ?? 'new page')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = st.addPage({ title: name, path: `/${slug || 'new-page'}` })
  for (const type of types) useStore.getState().addSlot(type, undefined, Number.MAX_SAFE_INTEGER, id)
  return { pageId: id, sections: types }
}

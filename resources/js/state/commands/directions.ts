import type { CommandInput } from '@/core/commands/schema'
import { anotherTake } from '@/state/takes'
import { MAX_DRAFTS } from '@/core/drafts'
import { briefOf, kindOf } from '@/core/brief'
import { directionById, directionList, directionStart, rankDirections, type RankDirectionOptions } from '@/core/directions'
import { pageView } from '@/core/site'
import { cleanTaste, dropLean, leanOf, noteTaste, tasteWords, traitsFromWords, type Taste, type TasteEvent } from '@/core/taste'
import { traitsOf, type Trait } from '@/core/traits'
import { skinById } from '@/core/skins'
import { library } from '@/data/library'
import '@/data/directions'
import { useStore } from '../store'
import { CommandError } from './refs'
import type { Caller } from './index'

/** What a row of directions is ranked for: this site's brief, its kind and Home's sections, with your brand color. */
function siteInput(): RankDirectionOptions['input'] {
  const st = useStore.getState()
  const brief = briefOf(st.content)
  const home = st.site.pages[0]
  const sections = home ? pageView(st.site, home.id).map((s) => s.type) : undefined
  return { kind: st.content.kind ?? kindOf(brief), brief, sections, brand: st.guide.brand?.color ?? null, variant: st.guide.brand?.variant, mode: st.guide.mode }
}

const tasteNow = () => useStore.getState().content.taste
function setTaste(next: Taste | undefined) {
  const st = useStore.getState()
  const { taste: _, ...rest } = st.content
  const clean = cleanTaste(next)
  useStore.setState({ content: clean ? { ...rest, taste: clean } : rest })
}

/** A direction's traits as it would land on this site. */
function traitsOfDirection(id: string): Trait[] {
  const d = directionById(id)
  if (!d) throw new CommandError(`No direction "${id}". Try list_directions.`)
  const input = { ...siteInput(), name: useStore.getState().content.brand }
  const start = directionStart(d, input, library)
  const ids = (start.site.pages[0] ? pageView(start.site, start.site.pages[0].id) : []).map((s) => s.clipId)
  return traitsOf(start.guide, ids, library, { feel: skinById(d.theme)?.feel, odd: d.odd })
}

const describe = (t: Taste | undefined) => {
  const lean = leanOf(t, briefOf(useStore.getState().content))
  return { line: tasteWords(lean), lean, words: t?.words ?? null, events: t?.events.length ?? 0 }
}

export const read = {
  list_directions: (i: CommandInput<'list_directions'>) => ({
    directions: directionList()
      .filter((d) => (!i.industry || d.industries?.includes(i.industry)) && (!i.format || d.formats?.includes(i.format)))
      .map((d) => ({ id: d.id, name: d.name, why: d.why, theme: d.theme, layouts: d.layouts, industries: d.industries ?? [], formats: d.formats ?? [], odd: d.odd ?? 0 })),
  }),
  suggest_directions: (i: CommandInput<'suggest_directions'>) => {
    const fromWords = i.words ? traitsFromWords(i.words) : { more: [], less: [] }
    const more = [...(i.more ?? []), ...fromWords.more] as Trait[]
    const less = [...(i.less ?? []), ...fromWords.less] as Trait[]
    // This row's leans count as said just now, without being saved.
    const taste = noteTaste(tasteNow(), { kind: 'more', traits: more, source: 'you' }, { kind: 'less', traits: less, source: 'you' })
    const row = rankDirections({ input: siteInput(), lib: library, taste, count: i.count, exclude: i.exclude, odd: i.odd, pin: i.pin })
    return {
      leaning: tasteWords(leanOf(taste, briefOf(useStore.getState().content))),
      directions: row.map((r) => ({ id: r.direction.id, name: r.direction.name, why: r.why, theme: r.direction.theme, traits: r.traits, score: r.score, ...(r.stretch ? { stretch: true } : {}) })),
    }
  },
  get_taste: () => describe(tasteNow()),
}

export const write = {
  note_taste: (i: CommandInput<'note_taste'>, by: Caller = 'you') => {
    const source = by === 'agent' ? 'agent' : 'you'
    const events: Omit<TasteEvent, 'at'>[] = []
    if (i.more?.length) events.push({ kind: 'more', traits: i.more as Trait[], source })
    if (i.less?.length) events.push({ kind: 'less', traits: i.less as Trait[], source })
    if (i.words) {
      const read = traitsFromWords(i.words)
      if (read.more.length) events.push({ kind: 'more', traits: read.more, source })
      if (read.less.length) events.push({ kind: 'less', traits: read.less, source })
    }
    if (i.ref) events.push({ kind: i.reaction ?? 'more', traits: traitsOfDirection(i.ref), ref: i.ref, source })
    if (!events.length && !i.words) throw new CommandError('Nothing to note: give more, less, words, or a ref with a reaction.')
    const next = noteTaste(tasteNow(), ...events)
    setTaste(i.words ? { ...next, words: i.words } : next)
    return describe(tasteNow())
  },
  try_direction: (i: CommandInput<'try_direction'>) => {
    const d = directionById(i.direction)
    if (!d) throw new CommandError(`No direction "${i.direction}". Try suggest_directions.`)
    const id = useStore.getState().tryDirection(d)
    if (!id) throw new CommandError('This site already has 6 drafts. Delete one first (delete_draft).')
    const draft = useStore.getState().drafts[id]
    return { draft: { id, letter: draft.letter, name: draft.name }, direction: d.id, theme: d.theme }
  },
  another_take: () => {
    const st = useStore.getState()
    if (Object.keys(st.drafts).length >= MAX_DRAFTS) throw new CommandError('This site already has 6 drafts. Delete one first (delete_draft).')
    const took = anotherTake(st)
    if (!took) throw new CommandError('Every direction that fits has been tried. Try suggest_directions with odd 2, or change the brief.')
    const draft = useStore.getState().drafts[took.id]
    return { draft: { id: took.id, letter: draft.letter, name: draft.name }, direction: took.direction.direction.id, theme: took.direction.direction.theme, why: took.direction.why }
  },
  drop_taste: (i: CommandInput<'drop_taste'>) => {
    setTaste(dropLean(tasteNow(), i.trait as Trait))
    return describe(tasteNow())
  },
  clear_taste: () => {
    setTaste(undefined)
    return describe(tasteNow())
  },
}

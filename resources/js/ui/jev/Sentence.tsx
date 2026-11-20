import { Dropdown } from '@/ui/controls/Dropdown'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, X } from 'lucide-react'
import type { Kind } from '@/core/types'
import { groupsOf, openBlanks, orderOptions, type Blank, type Choice, type Matched, type Pick, type Picks, type Segment } from '@/core/jev/sentence'
import { isParagraph, matchOption, saidNot, splitList } from '@/core/jev/blankList'

/**
 * A sentence with blanks, after the motion menu: "I'm making a site for [what it is] called [its name]…". Each empty blank
 * says what it asks for. Tap one and a few options open under the sentence. The same field searches or takes your own words (Jev maps them to the nearest
 * option, and your words still stand). Picking moves on to the next empty blank, and Enter moves on to the next blank
 * (an empty one after this first, else the one after it), so the sentence fills from the keyboard; Escape closes.
 */
export function Sentence({
  segments,
  picks,
  onPicks,
  order,
  kind,
  match,
  size = 'lg',
  autoOpen = true,
  onOwnWords,
  onPasteText,
  from = [],
}: {
  segments: Segment[]
  picks: Picks
  onPicks: (p: Picks) => void
  /** Jev's order for each blank's options (ids, best first). */
  order?: Record<string, string[]>
  /** The kind of site, for the order before Jev answers. */
  kind?: Kind | null
  /** Map your own words to an option; null when Jev is off. */
  match?: (blank: Blank, words: string) => Promise<Matched | null>
  size?: 'lg' | 'sm'
  /** Open the first empty blank on its own. */
  autoOpen?: boolean
  /**
   * Your own words went into a blank (a read can fill the other blanks from them). `now` is the sentence with them in
   * it; `list` says they were taken as a list, one pick per item.
   */
  onOwnWords?: (blank: Blank, words: string, now: Picks, list: boolean) => void
  /** A paragraph pasted into any blank: read as a whole instead of landing in that blank. */
  onPasteText?: (text: string) => void
  /** Blanks filled from what you wrote, marked as such. */
  from?: string[]
}) {
  const blanks = useMemo(() => segments.flatMap((s) => ('blank' in s ? [s.blank] : [])), [segments])
  const [openId, setOpenId] = useState<string | null>(() => (autoOpen ? (openBlanks(segments, picks)[0]?.id ?? null) : null))
  const [closest, setClosest] = useState<Record<string, string[]>>({})
  // Where to go on from: a blank just set (or Entered), handled once the sentence has its new picks (and maybe a new blank).
  const advance = useRef<string | null>(null)
  const [moves, setMoves] = useState(0)
  const open = blanks.find((b) => b.id === openId) ?? null

  // Before paint, so keys typed right after Enter never land in the blank just left.
  useLayoutEffect(() => {
    const from = advance.current
    if (!from) return
    advance.current = null
    const order = segments.flatMap((s) => ('blank' in s ? [s.blank.id] : []))
    const at = order.indexOf(from)
    const empty = openBlanks(segments, picks).map((b) => b.id)
    // The next empty blank after this one, then any empty one, then simply the next blank; none after the last.
    const next = empty.find((id) => order.indexOf(id) > at) ?? empty.find((id) => id !== from) ?? order[at + 1] ?? null
    setOpenId(next)
  }, [segments, picks, moves])

  /** On to the next blank from this one. */
  const moveOn = (id: string) => {
    advance.current = id
    setMoves((n) => n + 1)
  }

  const set = (id: string, list: Picks[string], next = true) => {
    if (next) moveOn(id)
    onPicks({ ...picks, [id]: list })
  }
  const choose = (b: Blank, c: Choice) => {
    if (b.many) {
      const now = picks[b.id] ?? []
      if (now.some((p) => p.id === c.id)) return set(b.id, now.filter((p) => p.id !== c.id), false)
      return set(b.id, [...now, { id: c.id, words: c.label }], false)
    }
    set(b.id, [{ id: c.id, words: c.label }])
  }
  const own = async (b: Blank, words: string) => {
    const w = words.trim()
    if (!w) return
    const exact = b.options.find((o) => o.label.toLowerCase() === w.toLowerCase())
    if (exact) return choose(b, exact)
    if (b.searchOnly) return
    // A list ("menu, opening hours, a map and reviews"): one pick per item, each matched on its own, in the order
    // written; an item said with a "no" is left for the read to steer away from. Taken as a list only when some item
    // matches, so "black and white" with nothing to match stays your words, whole.
    const items = b.list ? splitList(w) : null
    const listed = items?.filter((i) => !saidNot(i)).map((i) => ({ words: i, choice: matchOption(b, i) }))
    if (listed?.some((x) => x.choice)) {
      const fresh: Pick[] = []
      for (const { words: iw, choice } of listed) if (!choice || !fresh.some((p) => p.id === choice.id)) fresh.push(choice ? { id: choice.id, words: iw } : { words: iw })
      const kept = b.many ? (picks[b.id] ?? []).filter((p) => !p.id || !fresh.some((f) => f.id === p.id)) : []
      const now = { ...picks, [b.id]: [...kept, ...fresh] }
      set(b.id, now[b.id], !b.many)
      onOwnWords?.(b, w, now, true)
      // Items nothing matched still go to Jev, one by one; your words stand either way.
      if (!match) return
      for (const { words: iw } of listed.filter((x) => !x.choice)) {
        const m = await match(b, iw)
        if (m?.id) onPicksLater(b.id, iw, m.id)
      }
      return
    }
    // One item: matched here when it plainly means an option ("menu" → our menu), still in your words.
    const near = b.ownOnly ? null : matchOption(b, w)
    const mine: Pick = near ? { id: near.id, words: w } : { words: w }
    const list = b.many ? [...(picks[b.id] ?? []).filter((p) => !mine.id || p.id !== mine.id), mine] : [mine]
    set(b.id, list, !b.many)
    onOwnWords?.(b, w, { ...picks, [b.id]: list }, false)
    if (!match || b.ownOnly || near) return
    const m = await match(b, w)
    if (!m) return
    setClosest((x) => ({ ...x, [b.id]: m.closest }))
    // Your words stand; when Jev is sure, they count as that option too (its kind, its sections, its looks).
    if (m.id) onPicksLater(b.id, w, m.id)
  }
  // The match comes back after the pick: update that pick if it's still there.
  const latest = useRef(picks)
  latest.current = picks
  const onPicksLater = (id: string, words: string, matched: string) => {
    const now = latest.current
    const list = (now[id] ?? []).map((p) => (p.words === words && !p.id ? { ...p, id: matched } : p))
    onPicks({ ...now, [id]: list })
  }

  const big = size === 'lg'
  return (
    <div>
      <p className={big ? 'text-[22px] font-semibold leading-[1.5] tracking-[-0.02em] text-[#17121A] [text-wrap:pretty] sm:text-[27px]' : 'text-[14px] font-medium leading-[1.95] text-[#17121A]'}>
        {segments.map((s, i) => (
          <Fragment key={i}>
            {'text' in s ? (
              <span>{(s.text === '.' || s.text === ',' ? '' : ' ') + s.text}</span>
            ) : (
              <>
                {' '}
                <BlankWords blank={s.blank} picks={picks} read={from.includes(s.blank.id)} open={openId === s.blank.id} onOpen={() => setOpenId(openId === s.blank.id ? null : s.blank.id)} onDrop={(i) => set(s.blank.id, (picks[s.blank.id] ?? []).filter((_, k) => k !== i), false)} />
              </>
            )}
          </Fragment>
        ))}
      </p>
      {open && (
        <Options
          key={open.id}
          blank={open}
          picks={picks}
          order={order?.[open.id]}
          kind={kind ?? null}
          closest={closest[open.id] ?? []}
          big={big}
          onType={open.ownOnly ? (words) => set(open.id, words ? [{ words }] : [], false) : undefined}
          onChoose={(c) => choose(open, c)}
          onOwn={(w) => void own(open, w)}
          onDone={() => setOpenId(null)}
          onNext={() => moveOn(open.id)}
          onPasteText={onPasteText && ((t) => (setOpenId(null), onPasteText(t)))}
        />
      )}
    </div>
  )
}

/**
 * A blank in a fill-in-the-blanks sentence. It uses a neutral hover and a blush fill while open.
 * Empty blanks name what goes there. Your own words are underlined in ink.
 */
export const BLANK = 'mx-[0.02em] rounded-[0.2em] px-[0.15em] underline decoration-[0.09em] underline-offset-[0.16em] [text-decoration-skip-ink:none] transition-[background-color,color] duration-150'
export const blankLook = (on: boolean, filled: boolean, own = false) =>
  on
    ? 'bg-[#FFD4E8] text-[#17121A] decoration-transparent'
    : `${filled ? 'text-[#17121A]' : 'text-[#B3A7AE]'} ${own ? 'decoration-[#17121A]' : 'decoration-[#FF69B4]'} hover:bg-zinc-950/[0.06] hover:text-zinc-900`

/** A blank in the sentence: its words once filled, what it asks for while empty; several picks read as a list. */
function BlankWords({ blank, picks, read, open, onOpen, onDrop }: { blank: Blank; picks: Picks; read?: boolean; open: boolean; onOpen: () => void; onDrop: (i: number) => void }) {
  const list = (picks[blank.id] ?? []).filter((p) => p.words.trim() && (!blank.searchOnly || blank.options.some((o) => o.id === p.id)))
  const base = BLANK
  const look = blankLook
  const own = (p: { id?: string }) => !p.id
  if (blank.many && list.length) {
    return (
      <>
        {list.map((p, i) => (
          <Fragment key={`${p.words}${i}`}>
            <span className={`group/m relative ${base} ${look(false, true, own(p))}`}>
              {shortWords(p.words)}
              <button type="button" onClick={() => onDrop(i)} aria-label={`Drop ${p.words}`} className="absolute -right-2 -top-1.5 grid size-5 cursor-pointer place-items-center rounded-full bg-white text-zinc-500 opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-opacity hover:text-zinc-900 group-hover/m:opacity-100 focus-visible:opacity-100">
                <X size={11} />
              </button>
            </span>
            {i < list.length - 1 ? ', ' : ' and '}
          </Fragment>
        ))}
        <button type="button" onClick={onOpen} onFocus={() => !open && onOpen()} className={`cursor-pointer ${base} ${look(open, false)}`}>
          + more
        </button>
      </>
    )
  }
  return (
    // Inline, not a button box: a long answer flows on with the sentence instead of breaking it into a block.
    <span
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      aria-expanded={open}
      title={read ? 'From what you wrote' : list.some((p) => p.words.length > SHORT) ? list.map((p) => p.words).join(', ') : undefined}
      className={`cursor-pointer outline-none [box-decoration-break:clone] focus-visible:bg-[#FFD4E8] ${base} ${look(open, list.length > 0, list.length > 0 && list.every(own))} ${read && !open ? 'decoration-dotted' : ''}`}
    >
      {list.length ? shortWords(list.map((p) => p.words).join(', ')) : (blank.ask ?? blank.placeholder)}
    </span>
  )
}

/** Past this, a blank shows the start of your words (all of them are kept): a long answer never breaks the sentence. */
const SHORT = 42
const shortWords = (w: string) => (w.length > SHORT ? `${w.slice(0, SHORT).replace(/[\s,;:.]+\S*$/, '')}…` : w)

/** Pasted text that reads as a paragraph, not an answer: read as a whole. */
export { isParagraph } from '@/core/jev/blankList'

/**
 * A blank's options. The guided start shows a shortlist and can browse one category at a time. The bar uses a
 * sideways row. The order is taken when the options open and
 * stays put while your pointer is on them; a newer order fades in.
 */
function Options({
  blank,
  picks,
  order,
  kind,
  closest,
  big,
  onChoose,
  onType,
  onOwn,
  onDone,
  onNext,
  onPasteText,
}: {
  blank: Blank
  picks: Picks
  order?: string[]
  kind: Kind | null
  closest: string[]
  big: boolean
  onChoose: (c: Choice) => void
  onType?: (words: string) => void
  onOwn: (words: string) => void
  onDone: () => void
  /** Enter with nothing typed: on to the next blank. */
  onNext: () => void
  onPasteText?: (text: string) => void
}) {
  const [query, setQuery] = useState('')
  const words = onType ? (picks[blank.id]?.[0]?.words ?? '') : query
  const [hovering, setHovering] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const sorted = useMemo(() => orderOptions(blank, order, kind), [blank, order, kind])
  // Never reorder under the pointer.
  const [shown, setShown] = useState(sorted)
  const [fade, setFade] = useState(false)
  useEffect(() => {
    if (hovering || sorted === shown) return
    setFade(true)
    const t = window.setTimeout(() => {
      setShown(sorted)
      setFade(false)
    }, 150)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, hovering])

  // The field takes the keys as a blank opens, so you can type, Enter, and type the next (a phone's keyboard only on a name).
  // At once, before the screen updates, so keys typed right after Enter land here; and again a frame later if a window
  // that focuses itself as it opens took it back.
  useLayoutEffect(() => {
    if (!blank.ownOnly && !matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const take = () => field.current && document.activeElement !== field.current && field.current.focus({ preventScroll: true })
    take()
    const raf = requestAnimationFrame(take)
    return () => cancelAnimationFrame(raf)
  }, [blank])

  const selected = picks[blank.id] ?? []
  const chosen = new Set(selected.map((p) => p.id).filter(Boolean))
  const q = words.trim().toLowerCase()
  const list = (big ? shown : sorted).filter((o) => o.label.toLowerCase().includes(q))
  const near = closest.map((id) => blank.options.find((o) => o.id === id)).filter((o): o is Choice => !!o)
  const grouped = big && !!blank.groups?.length
  const groups = grouped ? groupsOf(blank, shown.map((o) => o.id)) : []

  const chip = (o: Choice, hint?: boolean, key = '') => (
    <button
      key={`${key}${hint ? 'n' : ''}${o.id}`}
      type="button"
      onClick={() => onChoose(o)}
      data-on={chosen.has(o.id) || undefined}
      aria-pressed={chosen.has(o.id)}
      className={`shrink-0 cursor-pointer snap-start rounded-full font-medium transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97] ${big ? 'h-9 px-3.5 text-[13.5px]' : 'h-8 px-3 text-[12.5px]'} ${
        chosen.has(o.id) ? 'bg-zinc-900 text-white' : hint ? 'bg-[#FF69B4]/12 text-zinc-900 shadow-[0_0_0_1px_rgb(255_105_180/0.5)]' : 'bg-white text-zinc-800 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] [@media(hover:hover)]:hover:shadow-[0_0_0_1px_rgb(0_0_0/0.3)]'
      }`}
    >
      {o.label}
    </button>
  )
  const label = (text: string) => <span className={`font-semibold text-zinc-500 ${big ? 'text-[12px]' : 'text-[11.5px]'}`}>{text}</span>
  const ask = blank.ask ?? blank.placeholder
  const submitted = blank.searchOnly ? list.find((o) => o.label.toLowerCase() === q) ?? (list.length === 1 ? list[0] : undefined) : undefined

  const own = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (submitted) onChoose(submitted)
        else if (words.trim() && !blank.searchOnly) {
          onOwn(words)
          setQuery('')
        } else if (!words.trim()) onNext()
      }}
      className={`flex items-center gap-2 ${blank.ownOnly || grouped ? '' : 'mt-2'}`}
    >
      <input
        ref={field}
        value={words}
        onChange={(e) => {
          if (onType) onType(e.target.value)
          else setQuery(e.target.value)
          setShowAll(false)
        }}
        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onDone())}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text')
          if (!onPasteText || !isParagraph(t)) return
          e.preventDefault()
          onPasteText(t)
        }}
        placeholder={blank.ownOnly ? `Type ${ask}` : blank.searchOnly ? 'Search options' : grouped ? 'Search or type your own' : 'or say it your way'}
        aria-label={blank.ownOnly ? ask : blank.searchOnly ? `Search options for ${ask}` : grouped ? 'Search or type your own' : 'Your own words'}
        className={`min-w-0 flex-1 rounded-full bg-white outline-none shadow-[0_0_0_1px_rgb(0_0_0/0.1)] placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4] ${big ? 'h-10 px-4 text-[14.5px]' : 'h-8 px-3 text-[12.5px]'}`}
      />
      {words.trim() && (!blank.searchOnly || submitted) && (
        <button type="submit" aria-label={blank.searchOnly ? `Choose ${submitted?.label}` : 'Use my words'} className={`grid shrink-0 cursor-pointer place-items-center rounded-full bg-zinc-900 text-white transition-[scale] active:scale-[0.97] ${grouped ? 'h-10 px-3 text-[13px] font-semibold' : big ? 'size-10' : 'size-8'}`}>
          {grouped ? 'Use' : <CornerDownLeft size={big ? 15 : 13} />}
        </button>
      )}
    </form>
  )

  if (grouped) {
    const ranked = !!kind || !!order?.length
    const examples = ranked && blank.id !== 'business' ? shown : groups.map((group) => group.options[0])
    const top = [...near, ...examples.filter((o) => !near.some((n) => n.id === o.id))].slice(0, 6)
    const browsing = !q && category !== null
    const options = q ? list : browsing ? groups.find((group) => group.name === category)?.options ?? [] : top
    const exact = q && list.some((o) => o.label.toLowerCase() === q)
    const visible = showAll ? options : options.slice(0, 8)
    const heading = q ? 'Matching options' : browsing ? 'Category' : near.length ? 'Closest to your words' : ranked ? 'Suggestions' : 'Examples'
    const link = 'min-h-8 shrink-0 cursor-pointer rounded-md px-1 text-[12px] font-semibold text-[#665762] underline decoration-[#B9AAB4] underline-offset-4 hover:text-[#17121A]'

    return (
      <div className="mt-3 grid gap-2.5 rounded-2xl bg-zinc-50 p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] motion-safe:animate-pop">
        {own}
        <div
          className={`grid min-w-0 gap-2 transition-opacity duration-150 ${fade ? 'opacity-40' : ''}`}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            {label(heading)}
            {!q && groups.length > 1 && (
              <button type="button" aria-expanded={browsing} onClick={() => {
                setCategory(browsing ? null : groups[0].name)
                setShowAll(false)
              }} className={link}>
                {browsing ? 'Back to suggestions' : 'Browse categories'}
              </button>
            )}
          </div>
          {browsing && (
            <Dropdown
              label="Category"
              value={category ?? ''}
              options={groups.map((group) => ({ v: group.name, label: group.name }))}
              onChange={(next) => {
                setCategory(next)
                setShowAll(false)
              }}
              className="min-h-9 w-full"
            />
          )}
          {(visible.length > 0 || (q && !blank.searchOnly)) && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={ask}>
              {q && !exact && !blank.searchOnly && <UseMine words={words} big={big} onUse={() => (onOwn(words), setQuery(''))} />}
              {visible.map((o) => chip(o, !q && !browsing && near.some((n) => n.id === o.id)))}
            </div>
          )}
          {options.length > 8 && (
            <button type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)} className={`${link} justify-self-start`}>
              {showAll ? 'Show fewer' : `Show all ${options.length}`}
            </button>
          )}
          {blank.many && selected.length > 0 && <button type="button" onClick={onDone} className={`${link} justify-self-end`}>Done</button>}
        </div>
      </div>
    )
  }

  if (!big) {
    return (
      <div className="mt-2">
        <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto p-1" role="group" aria-label={ask}>
          {list.map((o) => chip(o))}
          {!list.length && <span role="status" className="px-1 text-[12px] text-zinc-600">{q ? 'No matching options.' : 'No options available.'}</span>}
        </div>
        {blank.options.length > 5 || !blank.searchOnly ? own : null}
      </div>
    )
  }

  return (
    <div className={`animate-pop ${big ? 'mt-4' : 'mt-2'}`}>
      {!blank.ownOnly && (
        <div
          className={`-mx-1 -my-1 flex snap-x gap-2 overflow-x-auto px-1 py-1.5 transition-opacity duration-150 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${fade ? 'opacity-40' : ''}`}
          style={{ maskImage: 'linear-gradient(to right, #000 calc(100% - 32px), transparent 100%)' }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          role="listbox"
          aria-label={ask}
        >
          {near.length > 0 && !q && (
            <>
              <span className={`flex shrink-0 items-center text-zinc-400 ${big ? 'text-[13px]' : 'text-[11.5px]'}`}>Closest to your words</span>
              {near.map((o) => chip(o, true))}
              <span className="w-2 shrink-0" />
            </>
          )}
          {q && !blank.searchOnly && !list.some((o) => o.label.toLowerCase() === q) && <UseMine words={words} big={big} onUse={() => (onOwn(words), setQuery(''))} />}
          {list.map((o) => chip(o))}
        </div>
      )}
      {own}
    </div>
  )
}

/** Your own words as the first option: they always count, whatever the list holds. */
function UseMine({ words, big, onUse }: { words: string; big: boolean; onUse: () => void }) {
  return (
    <button
      type="button"
      onClick={onUse}
      className={`max-w-full shrink-0 cursor-pointer snap-start truncate rounded-full bg-zinc-900 font-semibold text-white transition-[scale] duration-150 active:scale-[0.97] ${big ? 'h-9 px-3.5 text-[13.5px]' : 'h-8 px-3 text-[12.5px]'}`}
    >
      Use “{shortWords(words.trim())}”
    </button>
  )
}

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, X } from 'lucide-react'
import type { Kind } from '@/core/types'
import { groupsOf, openBlanks, orderOptions, suggestedFor, type Blank, type Choice, type Matched, type Picks, type Segment } from '@/core/jev/sentence'

/**
 * A sentence with blanks, after the motion menu: "I'm making a site for [what it is] called [its name]…". Each empty blank
 * says what it asks for. Tap one and its options open under the sentence (in groups, with a few to try first); the field at its end takes your own words (Jev maps them to the nearest
 * option, and your words still stand). Picking moves on to the next empty blank; Tab steps between blanks.
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
}) {
  const blanks = useMemo(() => segments.flatMap((s) => ('blank' in s ? [s.blank] : [])), [segments])
  const [openId, setOpenId] = useState<string | null>(() => (autoOpen ? (openBlanks(segments, picks)[0]?.id ?? null) : null))
  const [closest, setClosest] = useState<Record<string, string[]>>({})
  const advance = useRef(false)
  const open = blanks.find((b) => b.id === openId) ?? null

  // After a pick, on to the next empty blank (the sentence may have grown one).
  useEffect(() => {
    if (!advance.current) return
    advance.current = false
    const next = openBlanks(segments, picks)[0]
    setOpenId(next?.id ?? null)
  }, [segments, picks])

  const set = (id: string, list: Picks[string], next = true) => {
    advance.current = next
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
    const mine = { words: w }
    const list = b.many ? [...(picks[b.id] ?? []), mine] : [mine]
    set(b.id, list, !b.many)
    if (!match || b.ownOnly) return
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
                <BlankWords blank={s.blank} picks={picks} open={openId === s.blank.id} onOpen={() => setOpenId(openId === s.blank.id ? null : s.blank.id)} onDrop={(i) => set(s.blank.id, (picks[s.blank.id] ?? []).filter((_, k) => k !== i), false)} />
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
          onChoose={(c) => choose(open, c)}
          onOwn={(w) => void own(open, w)}
          onDone={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

/**
 * A blank in any fill-in-the-blanks sentence, as on blokmix.com: a pink underline, a pink tint on hover, blush while it's
 * open. Empty, it names what goes there in a quieter voice; your own words (not one of the options) are underlined in ink.
 */
export const BLANK = 'mx-[0.02em] rounded-[0.2em] px-[0.15em] underline decoration-[0.09em] underline-offset-[0.16em] [text-decoration-skip-ink:none] transition-[background-color,color] duration-150'
export const blankLook = (on: boolean, filled: boolean, own = false) =>
  on
    ? 'bg-[#FFD4E8] text-[#17121A] decoration-transparent'
    : `${filled ? 'text-[#17121A]' : 'text-[#B3A7AE]'} ${own ? 'decoration-[#17121A]' : 'decoration-[#FF69B4]'} [@media(hover:hover)]:hover:bg-[#FF69B4]/12`

/** A blank in the sentence: its words once filled, what it asks for while empty; several picks read as a list. */
function BlankWords({ blank, picks, open, onOpen, onDrop }: { blank: Blank; picks: Picks; open: boolean; onOpen: () => void; onDrop: (i: number) => void }) {
  const list = (picks[blank.id] ?? []).filter((p) => p.words.trim())
  const base = BLANK
  const look = blankLook
  const own = (p: { id?: string }) => !p.id
  if (blank.many && list.length) {
    return (
      <>
        {list.map((p, i) => (
          <Fragment key={`${p.words}${i}`}>
            <span className={`group/m relative ${base} ${look(false, true, own(p))}`}>
              {p.words}
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
    <button type="button" onClick={onOpen} aria-expanded={open} className={`cursor-pointer ${base} ${look(open, list.length > 0, list.length > 0 && list.every(own))}`}>
      {list.length ? list.map((p) => p.words).join(', ') : (blank.ask ?? blank.placeholder)}
    </button>
  )
}

/**
 * A blank's options. In the start (big) they come in groups, with a few to try first once there's something to go on; in
 * the bar, one sideways row. A field for your own words sits at the end. The order is taken when the options open and
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
  onOwn,
  onDone,
}: {
  blank: Blank
  picks: Picks
  order?: string[]
  kind: Kind | null
  closest: string[]
  big: boolean
  onChoose: (c: Choice) => void
  onOwn: (words: string) => void
  onDone: () => void
}) {
  const [words, setWords] = useState('')
  const [hovering, setHovering] = useState(false)
  const [more, setMore] = useState<Set<string>>(new Set())
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

  useEffect(() => {
    if (blank.ownOnly) field.current?.focus()
  }, [blank])

  const chosen = new Set((picks[blank.id] ?? []).map((p) => p.id).filter(Boolean))
  const q = words.trim().toLowerCase()
  const hits = (o: Choice) => !q || o.label.toLowerCase().includes(q)
  const list = shown.filter(hits)
  const near = closest.map((id) => blank.options.find((o) => o.id === id)).filter((o): o is Choice => !!o)
  const ids = shown.map((o) => o.id)
  const grouped = big && !!blank.groups?.length
  const suggested = grouped ? suggestedFor(blank, order?.length || kind ? ids : undefined) : []
  // A group shows its first few; "+ n more" only when that hides more than a couple.
  const SHOW = 6
  const groups = grouped ? groupsOf(blank, ids) : []

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

  const own = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (words.trim()) {
          onOwn(words)
          setWords('')
        } else onDone()
      }}
      className={`flex items-center gap-2 ${blank.ownOnly ? '' : grouped ? 'border-t border-zinc-950/[0.06] pt-3' : 'mt-2'}`}
    >
      <input
        ref={field}
        value={words}
        onChange={(e) => setWords(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onDone())}
        placeholder={blank.ownOnly ? `Type ${ask}` : grouped ? 'Not here? Say it your way' : 'or say it your way'}
        aria-label={blank.ownOnly ? ask : 'Your own words'}
        className={`min-w-0 flex-1 rounded-full bg-white outline-none shadow-[0_0_0_1px_rgb(0_0_0/0.1)] placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4] ${big ? 'h-10 px-4 text-[14.5px]' : 'h-8 px-3 text-[12.5px]'}`}
      />
      {words.trim() && (
        <button type="submit" aria-label="Use my words" className={`grid shrink-0 cursor-pointer place-items-center rounded-full bg-zinc-900 text-white transition-[scale] active:scale-[0.97] ${big ? 'size-10' : 'size-8'}`}>
          <CornerDownLeft size={big ? 15 : 13} />
        </button>
      )}
    </form>
  )

  if (grouped) {
    // A few to try first, unless they'd only repeat the top of one group.
    const top = q ? [] : near.length ? near : new Set(suggested.map((o) => o.group)).size > 1 ? suggested : []
    const matching = groups.map((g) => ({ ...g, options: g.options.filter(hits) })).filter((g) => g.options.length)
    return (
      <div className="mt-4 animate-pop rounded-2xl bg-zinc-50 p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
        <div
          className={`thin-scroll max-h-[340px] overflow-y-auto px-1 pb-3 pt-1 transition-opacity duration-150 ${fade ? 'opacity-40' : ''}`}
          data-scroll-ok
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          role="listbox"
          aria-label={ask}
        >
          {top.length > 0 && (
            <div className="mb-4">
              {label(near.length ? 'Closest to your words' : 'Try one of these')}
              <div className="mt-1.5 flex flex-wrap gap-2">{top.map((o) => chip(o, near.length > 0, 'top'))}</div>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] gap-x-4 gap-y-4">
            {matching.map((g) => {
              const rest = g.options.length - SHOW
              const all = more.has(g.name) || !!q || rest <= 2
              return (
                <div key={g.name} className="min-w-0">
                  {label(g.name)}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(all ? g.options : g.options.slice(0, SHOW)).map((o) => chip(o))}
                    {!all && rest > 0 && (
                      <button type="button" onClick={() => setMore((m) => new Set(m).add(g.name))} className="h-9 cursor-pointer rounded-full px-2.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-900">
                        + {rest} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {q && !matching.length && <p className="text-[13px] text-zinc-500">Nothing like that here. Enter keeps your words.</p>}
        </div>
        {own}
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
          {list.map((o) => chip(o))}
          {q && !list.length && <span className={`flex shrink-0 items-center text-zinc-400 ${big ? 'text-[13px]' : 'text-[11.5px]'}`}>Nothing like that here: Enter keeps your words</span>}
        </div>
      )}
      {own}
    </div>
  )
}

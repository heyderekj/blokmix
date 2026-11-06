import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, X } from 'lucide-react'
import type { Kind } from '@/core/types'
import { defaultOrder, openBlanks, type Blank, type Choice, type Matched, type Picks, type Segment } from '@/core/jev/sentence'

/**
 * A sentence with blanks, after the motion menu: "I'm making a site for [a bakery] called [Fern & Co]…". Tap a blank and
 * a row of options opens under the sentence; the field at its end takes your own words (Jev maps them to the nearest
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
      <p className={big ? 'text-[22px] font-medium leading-[1.9] tracking-tight text-zinc-500 [text-wrap:pretty] sm:text-[26px]' : 'text-[14px] leading-[1.95] text-zinc-500'}>
        {segments.map((s, i) => (
          <Fragment key={i}>
            {'text' in s ? (
              <span>{(s.text === '.' || s.text === ',' ? '' : ' ') + s.text}</span>
            ) : (
              <>
                {' '}
                <BlankWords blank={s.blank} picks={picks} open={openId === s.blank.id} big={big} onOpen={() => setOpenId(openId === s.blank.id ? null : s.blank.id)} onDrop={(i) => set(s.blank.id, (picks[s.blank.id] ?? []).filter((_, k) => k !== i), false)} />
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

/** A blank in the sentence: its words once filled, its placeholder while empty; several picks read as a list. */
function BlankWords({ blank, picks, open, big, onOpen, onDrop }: { blank: Blank; picks: Picks; open: boolean; big: boolean; onOpen: () => void; onDrop: (i: number) => void }) {
  const list = (picks[blank.id] ?? []).filter((p) => p.words.trim())
  const base = `rounded-lg underline decoration-dotted decoration-[1.5px] underline-offset-[6px] transition-[background-color,color] duration-150 ${big ? 'px-1.5' : 'px-1'}`
  const look = (on: boolean, filled: boolean) =>
    on ? 'bg-zinc-900 text-white decoration-transparent' : filled ? 'bg-[#FF69B4]/10 text-zinc-900 decoration-[#FF69B4] [@media(hover:hover)]:hover:bg-[#FF69B4]/20' : 'text-zinc-400 decoration-zinc-300 [@media(hover:hover)]:hover:bg-zinc-950/5 [@media(hover:hover)]:hover:text-zinc-700'
  if (blank.many && list.length) {
    return (
      <>
        {list.map((p, i) => (
          <Fragment key={`${p.words}${i}`}>
            <span className={`group/m relative inline-flex items-center ${base} ${look(false, true)}`}>
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
    <button type="button" onClick={onOpen} aria-expanded={open} className={`cursor-pointer ${base} ${look(open, list.length > 0)}`}>
      {list.length ? list.map((p) => p.words).join(', ') : blank.placeholder}
    </button>
  )
}

/**
 * A blank's options in one sideways row, Jev's best first, and a field for your own words at the end. The order is taken
 * when the row opens and stays put while your pointer is on it; a newer order fades in.
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
  const field = useRef<HTMLInputElement>(null)
  const sorted = useMemo(() => {
    if (!order?.length) return defaultOrder(blank.options, kind)
    const at = new Map(order.map((id, i) => [id, i]))
    return [...blank.options].sort((a, b) => (at.get(a.id) ?? 999) - (at.get(b.id) ?? 999))
  }, [blank, order, kind])
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
  const list = q ? shown.filter((o) => o.label.toLowerCase().includes(q)) : shown
  const near = closest.map((id) => blank.options.find((o) => o.id === id)).filter((o): o is Choice => !!o)
  const chip = (o: Choice, hint?: boolean) => (
    <button
      key={`${hint ? 'n' : ''}${o.id}`}
      type="button"
      onClick={() => onChoose(o)}
      data-on={chosen.has(o.id) || undefined}
      aria-pressed={chosen.has(o.id)}
      className={`shrink-0 cursor-pointer snap-start rounded-full font-medium transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97] ${big ? 'h-10 px-4 text-[14.5px]' : 'h-8 px-3 text-[12.5px]'} ${
        chosen.has(o.id) ? 'bg-zinc-900 text-white' : hint ? 'bg-[#FF69B4]/12 text-zinc-900 shadow-[0_0_0_1px_rgb(255_105_180/0.5)]' : 'bg-white text-zinc-800 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] [@media(hover:hover)]:hover:shadow-[0_0_0_1px_rgb(0_0_0/0.3)]'
      }`}
    >
      {o.label}
    </button>
  )
  return (
    <div className={`animate-pop ${big ? 'mt-4' : 'mt-2'}`}>
      {!blank.ownOnly && (
        <div
          className={`-mx-1 -my-1 flex snap-x gap-2 overflow-x-auto px-1 py-1.5 transition-opacity duration-150 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${fade ? 'opacity-40' : ''}`}
          style={{ maskImage: 'linear-gradient(to right, #000 calc(100% - 32px), transparent 100%)' }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          role="listbox"
          aria-label={blank.placeholder}
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
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (words.trim()) {
            onOwn(words)
            setWords('')
          } else onDone()
        }}
        className={`flex items-center gap-2 ${blank.ownOnly ? '' : 'mt-2'}`}
      >
        <input
          ref={field}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onDone())}
          placeholder={blank.ownOnly ? `Type it: ${blank.placeholder}` : 'or say it your way'}
          aria-label={blank.ownOnly ? blank.placeholder : 'Your own words'}
          className={`min-w-0 flex-1 rounded-full bg-white outline-none shadow-[0_0_0_1px_rgb(0_0_0/0.1)] placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4] ${big ? 'h-10 px-4 text-[14.5px]' : 'h-8 px-3 text-[12.5px]'}`}
        />
        {words.trim() && (
          <button type="submit" aria-label="Use my words" className={`grid shrink-0 cursor-pointer place-items-center rounded-full bg-zinc-900 text-white transition-[scale] active:scale-[0.97] ${big ? 'size-10' : 'size-8'}`}>
            <CornerDownLeft size={big ? 15 : 13} />
          </button>
        )}
      </form>
    </div>
  )
}

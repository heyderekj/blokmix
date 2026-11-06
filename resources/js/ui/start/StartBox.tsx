import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import type { Kind, SectionType } from '@/core/types'
import { KINDS } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { KIND_LABEL } from '@/core/start'
import { OPTIONAL, placeSection, textMode } from '@/core/jev/describe'
import { skinById } from '@/core/skins'
import { askJev, askLatest, jevOn } from '@/lib/jev'
import { noteWants } from '@/lib/jevWants'
import { hearStart, looksOnOffer, sectionsForKind, type Heard } from '@/lib/startFromText'
import { fillStart, matchRequest, openBlanks, rankRequest, readMatch, readRank, startSentence, type Blank, type Picks, type StartFill } from '@/core/jev/sentence'
import { Sentence } from '@/ui/jev/Sentence'

const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
const CHIP = `inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-medium shadow-[0_0_0_1px_rgb(23_18_26/0.1)]`
/** Sections a start always has: the chips can't drop them. */
const FIXED: SectionType[] = ['nav', 'hero', 'footer']

/** What the box holds, and what Jev made of it. The flow keeps it so Back comes back to it. */
export interface BoxState {
  name: string
  /** Words pasted (or typed) below the sentence: they take the paste path, or describe the site. */
  text: string
  /** The sentence's blanks as you filled them. */
  picks: Picks
  heard: Heard | null
  /** The kind you picked on the chip, over Jev's. */
  kind: Kind | null
  /** Sections after your ✕ and +, over Jev's. */
  sections: SectionType[] | null
  /** The main button's words, from what the site should help people do. */
  button?: string
  /** "cozy bakery": the feel and the business, for colors by feel. */
  feel?: string
}

export const emptyBox: BoxState = { name: '', text: '', picks: {}, heard: null, kind: null, sections: null }

/** The kind and sections a box will start with: yours where you changed them, else Jev's. */
export function boxChoice(box: BoxState): { kind: Kind | null; sections: SectionType[] | null } {
  const h = box.heard
  const kind = box.kind ?? h?.kind ?? h?.kinds[0] ?? null
  if (!kind) return { kind: null, sections: null }
  if (h?.mode === 'paste') return { kind, sections: null }
  return { kind, sections: box.sections ?? sectionsForKind(kind, h) }
}

/** What the sentence says, as Jev would have heard it: certain, since every blank came from Blokmix's own lists. */
function heardFrom(f: StartFill): Heard | null {
  if (!f.kind || !f.sections) return null
  const open = new Set(looksOnOffer().map((l) => l.id))
  return { mode: 'describe', kind: f.kind, kinds: [f.kind], sections: f.sections, looks: f.looks.filter((id) => open.has(id)).slice(0, 2) }
}

/**
 * The start's first step: a sentence to fill in ("I'm making a site for [a bakery] called [Fern & Co]…"), each blank a row
 * of options Jev puts in order from what you've said so far, and your own words welcome in any of them. Or paste what you
 * already have below it, and it's placed word for word. What it adds up to shows underneath, yours to change.
 */
export function StartBox({ box, onBox, onJevOff }: { box: BoxState; onBox: (b: BoxState) => void; onJevOff: (off: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  const [order, setOrder] = useState<Record<string, string[]>>({})
  // The latest box, for answers that come back after more typing.
  const latest = useRef(box)
  latest.current = box
  // The words the answer on show was for, so coming Back doesn't ask again.
  const heardFor = useRef<string | null>(box.heard ? box.text.trim() || fillStart(box.picks).text : null)

  useEffect(() => {
    let live = true
    jevOn().then((v) => {
      if (!live) return
      setOff(!v)
      onJevOff(!v)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pasted (or typed) words below the sentence: asked a quarter second after the last key; only the latest are answered.
  const text = box.text.trim()
  useEffect(() => {
    if (off || text.length < 3) return
    if (heardFor.current === text) return
    setBusy(true)
    const t = window.setTimeout(() => {
      hearStart(text, box.kind ?? undefined).then((h) => {
        if (latest.current.text.trim() !== text) return
        heardFor.current = text
        setBusy(false)
        onBox({ ...latest.current, heard: h, sections: null })
      })
    }, 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, off])

  // The sentence: what's filled decides the start at once; Jev puts the open blanks' options in order.
  const segments = useMemo(() => startSentence(box.picks), [box.picks])
  const fill = useMemo(() => fillStart(box.picks), [box.picks])
  const said = fill.text
  useEffect(() => {
    if (off) return
    const open = openBlanks(segments, box.picks)
    if (!open.some((b) => !b.ownOnly)) return
    let live = true
    askLatest('start-sentence', rankRequest(said, open)).then((res) => live && res && setOrder((o) => ({ ...o, ...readRank(res, open) })))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, off])

  const onPicks = (picks: Picks) => {
    const f = fillStart(picks)
    const sure = heardFrom(f)
    const next: BoxState = { ...latest.current, picks, name: f.name, button: f.button, feel: f.feel, sections: null }
    if (!latest.current.text.trim()) next.heard = sure
    onBox(next)
    if (f.wants.length && !off) void noteWants(f.wants, 'start', undefined, f.kind ?? undefined)
    // A business in your own words that Jev couldn't place: let it read the whole sentence.
    const business = picks.business?.[0]
    if (!sure && business?.words.trim() && !business.id && !off && !latest.current.text.trim()) {
      setBusy(true)
      hearStart(f.text).then((h) => {
        setBusy(false)
        if (fillStart(latest.current.picks).text !== f.text || latest.current.text.trim()) return
        heardFor.current = f.text
        onBox({ ...latest.current, heard: h })
      })
    }
  }
  const match = async (b: Blank, words: string) => (off ? null : readMatch(await askJev(matchRequest(b, words, said))))

  const mode = text ? textMode(text) : null
  const choice = boxChoice(box)
  const h = box.heard

  return (
    <section>
      <h1 className="text-[15px] font-semibold text-[#6B5F68]">What are you making?</h1>
      <div className="mt-3 max-w-[860px]">
        <Sentence segments={segments} picks={box.picks} onPicks={onPicks} order={order} kind={fill.kind} match={off ? undefined : match} />
      </div>
      <textarea
        value={box.text}
        onChange={(e) => onBox({ ...box, text: e.target.value, ...(e.target.value.trim() ? {} : { heard: heardFrom(fillStart(box.picks)) }) })}
        rows={mode === 'paste' ? 8 : 2}
        aria-label="Or paste what you already have"
        placeholder="Or paste what you already have: an About page, a menu, your old site. Nothing is reworded."
        className="thin-scroll mt-6 block w-full resize-y rounded-2xl bg-white/80 px-4 py-3 text-[15px] leading-relaxed shadow-[0_0_0_1px_rgb(23_18_26/0.08)] outline-none transition-shadow placeholder:text-zinc-400 focus:bg-white focus:shadow-[0_0_0_2px_#FF69B4]"
      />

      <div className="mt-4 min-h-[112px]" aria-live="polite">
        {off && text ? (
          <p className="rounded-xl bg-white/80 px-4 py-3 text-[14px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">Jev is off here, so it can’t read pasted words. Fill in the sentence instead.</p>
        ) : busy && !h ? (
          <p className="flex items-center gap-2 text-[14px] text-[#6B5F68]">
            <Sparkles size={15} className="motion-safe:animate-pulse" /> Reading…
          </p>
        ) : h === null && !busy && text ? (
          <p className="text-[14px] text-[#6B5F68]">Jev didn’t answer that time. Keep typing, or fill in the sentence.</p>
        ) : h ? (
          <div className={`space-y-3 transition-opacity duration-150 ${busy ? 'opacity-60' : ''}`}>
            <Row label={h.mode === 'paste' || text ? 'Jev hears' : 'Your start'}>
              <KindChip value={choice.kind} kinds={h.kinds} onPick={(k) => onBox({ ...box, kind: k, sections: null })} />
              {h.mode === 'paste' && (
                <span className="text-[13.5px] text-[#6B5F68]">
                  {h.lines} lines: {h.placed} land on the page{h.waiting ? `, ${h.waiting} wait for you to place` : ''}
                </span>
              )}
            </Row>
            <Row label="Sections">
              {h.mode === 'paste'
                ? h.sections.map((t, i) => (
                    <span key={`${t}${i}`} className={CHIP}>
                      {TYPE_LABEL[t]}
                    </span>
                  ))
                : choice.sections && (
                    <SectionChips
                      sections={choice.sections}
                      onChange={(sections) => onBox({ ...box, sections })}
                    />
                  )}
            </Row>
            {h.looks.length > 0 && (
              <Row label="Looks that fit">
                {h.looks.map((id) => (
                  <span key={id} className={CHIP}>
                    {skinById(id)?.name ?? id}
                  </span>
                ))}
              </Row>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-28 shrink-0 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-[#9A8E97]">{label}</span>
      {children}
    </div>
  )
}

/** The kind, as a chip you can change. */
function KindChip({ value, kinds, onPick }: { value: Kind | null; kinds: Kind[]; onPick: (k: Kind) => void }) {
  const order = [...kinds, ...KINDS.filter((k) => !kinds.includes(k))]
  return (
    <label className="relative inline-flex h-8 items-center gap-1 rounded-full bg-[#17121A] pl-3 pr-2.5 text-[13px] font-semibold text-white">
      {value ? KIND_LABEL[value].name : 'Pick what it is'}
      <span aria-hidden className="text-[10px] opacity-70">▾</span>
      <select value={value ?? ''} onChange={(e) => onPick(e.target.value as Kind)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="What kind of site">
        {!value && <option value="">Pick what it is</option>}
        {order.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k].name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Sections as chips: ✕ drops one (not the nav, hero or footer), + adds one where it belongs on the page. */
function SectionChips({ sections, onChange }: { sections: SectionType[]; onChange: (s: SectionType[]) => void }) {
  const addable = OPTIONAL.filter((t) => !sections.includes(t))
  return (
    <>
      {sections
        .filter((t) => t !== 'nav' && t !== 'footer')
        .map((t) => (
          <span key={t} className={`${CHIP} ${FIXED.includes(t) ? '' : 'pr-1'}`}>
            {TYPE_LABEL[t]}
            {!FIXED.includes(t) && (
              <button type="button" onClick={() => onChange(sections.filter((x) => x !== t))} aria-label={`Drop ${TYPE_LABEL[t]}`} className={`grid size-6 place-items-center rounded-full text-[#9A8E97] ${HOVER}bg-zinc-950/5 ${HOVER}text-[#17121A] ${PRESS}`}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      {addable.length > 0 && (
        <label className={`${CHIP} relative border-dashed text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}>
          <Plus size={13} /> Add
          <select value="" onChange={(e) => e.target.value && onChange(placeSection(sections, e.target.value as SectionType))} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Add a section">
            <option value="">Add a section</option>
            {addable.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}

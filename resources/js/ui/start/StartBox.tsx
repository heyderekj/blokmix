import { useEffect, useRef, useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import type { Kind, SectionType } from '@/core/types'
import { KINDS } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { KIND_LABEL } from '@/core/start'
import { OPTIONAL, placeSection, textMode } from '@/core/jev/describe'
import { skinById } from '@/core/skins'
import { jevOn } from '@/lib/jev'
import { hearStart, sectionsForKind, type Heard } from '@/lib/startFromText'

const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
const CHIP = `inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-medium shadow-[0_0_0_1px_rgb(23_18_26/0.1)]`
/** Sections a start always has: the chips can't drop them. */
const FIXED: SectionType[] = ['nav', 'hero', 'footer']

/** What the box holds, and what Jev made of it. The flow keeps it so Back comes back to it. */
export interface BoxState {
  name: string
  text: string
  heard: Heard | null
  /** The kind you picked on the chip, over Jev's. */
  kind: Kind | null
  /** Sections after your ✕ and +, over Jev's. */
  sections: SectionType[] | null
}

export const emptyBox: BoxState = { name: '', text: '', heard: null, kind: null, sections: null }

/** The kind and sections a box will start with: yours where you changed them, else Jev's. */
export function boxChoice(box: BoxState): { kind: Kind | null; sections: SectionType[] | null } {
  const h = box.heard
  const kind = box.kind ?? h?.kind ?? h?.kinds[0] ?? null
  if (!kind) return { kind: null, sections: null }
  if (h?.mode === 'paste') return { kind, sections: null }
  return { kind, sections: box.sections ?? sectionsForKind(kind, h) }
}

/**
 * The start's first step: one box. A sentence describes the site and Jev picks the kind, sections and looks; pasted
 * copy is placed word for word. As you type, what Jev heard shows underneath, every part of it yours to change.
 */
export function StartBox({ box, onBox, onJevOff }: { box: BoxState; onBox: (b: BoxState) => void; onJevOff: (off: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  // The latest box, for answers that come back after more typing.
  const latest = useRef(box)
  latest.current = box
  // The words the answer on show was for, so coming Back doesn't ask again.
  const heardFor = useRef<string | null>(box.heard ? box.text.trim() : null)

  useEffect(() => {
    let live = true
    jevOn().then((v) => {
      if (!live) return
      setOff(!v)
      onJevOff(!v)
    })
    area.current?.focus()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ask a quarter second after the last key; only the latest words are answered.
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

  const mode = text ? textMode(text) : null
  const choice = boxChoice(box)
  const h = box.heard

  return (
    <section>
      <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">What are you making?</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">
        Say it in a sentence, or paste what you already have: an About page, a menu, your old site. Jev reads it and picks the sections and the look. Your words are never rewritten.
      </p>
      <label className="mt-6 grid max-w-sm gap-1.5">
        <span className="text-[14px] font-semibold">What’s it called?</span>
        <input
          value={box.name}
          onChange={(e) => onBox({ ...box, name: e.target.value })}
          placeholder="Fern & Co"
          maxLength={80}
          className="h-11 rounded-xl bg-white px-4 text-[15px] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4]"
        />
      </label>
      <textarea
        ref={area}
        value={box.text}
        onChange={(e) => onBox({ ...box, text: e.target.value })}
        rows={mode === 'paste' ? 9 : 4}
        aria-label="What you’re making, or what you already have"
        placeholder={'A bakery on Elm Street that takes pre-orders, with our menu and opening hours\n\nOr paste what you already have…'}
        className="thin-scroll mt-4 block w-full resize-y rounded-2xl bg-white px-4 py-3.5 text-[16px] leading-relaxed shadow-[0_0_0_1px_rgb(23_18_26/0.1),0_16px_32px_-24px_rgb(23_18_26/0.35)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4,0_16px_32px_-24px_rgb(255_105_180/0.5)]"
      />

      <div className="mt-4 min-h-[112px]" aria-live="polite">
        {off ? (
          <p className="rounded-xl bg-white/80 px-4 py-3 text-[14px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">Jev is off here, so it can’t read this. Answer three questions instead, below.</p>
        ) : !text ? null : busy && !h ? (
          <p className="flex items-center gap-2 text-[14px] text-[#6B5F68]">
            <Sparkles size={15} className="motion-safe:animate-pulse" /> Reading…
          </p>
        ) : h === null && !busy ? (
          <p className="text-[14px] text-[#6B5F68]">Jev didn’t answer that time. Keep typing, or answer three questions instead.</p>
        ) : h ? (
          <div className={`space-y-3 transition-opacity duration-150 ${busy ? 'opacity-60' : ''}`}>
            <Row label="Jev hears">
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

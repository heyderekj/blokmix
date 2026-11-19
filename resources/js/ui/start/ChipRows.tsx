import { useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import type { SectionType } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { actionChoices, FORMAT_LABEL, FORMATS, GOAL_LABEL, GOALS, INDUSTRIES, INDUSTRY_LABEL, type Brief, type Goal } from '@/core/brief'
import { OPTIONAL, placeSection } from '@/core/jev/describe'
import { dropAvoid, setBrief, type StartState, type StartView } from '@/core/startFlow'
import { HOVER, PINK, PRESS } from './parts'

export const CHIP = `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${PRESS}`
export const CHIP_ON = 'bg-[#17121A] text-white'
export const CHIP_OFF = `bg-white text-[#3F363D] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] ${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.22)]`
const INPUT =
  'w-full rounded-xl bg-white px-4 text-[15px] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4]'
/** Sections a start always has: the chips can't drop them. */
const FIXED: SectionType[] = ['nav', 'hero', 'footer']

type Row = 'kind' | 'goals' | 'action' | 'sections'

/**
 * What the sentence (and any read of your words) understood, one row each, already filled in. A row's value changes in
 * place: Change opens its choices right there, and the page beside follows.
 */
export function ChipRows({ s, v, onChange, paste }: { s: StartState; v: StartView; onChange: (next: StartState) => void; paste: boolean }) {
  const [open, setOpen] = useState<Row | null>(null)
  const toggle = (r: Row) => setOpen((o) => (o === r ? null : r))
  const b = v.brief
  const patch = (p: Partial<Brief>) => onChange(setBrief(s, p))
  const read = (k: keyof Brief) => s.read[k] !== undefined && s.brief[k] === undefined
  const goals = [...(b.goals ?? []).map((g) => GOAL_LABEL[g]), ...(b.goalsOther ? [b.goalsOther] : [])]
  const action = b.mainAction ?? actionChoices(b)[0]
  const sections = v.sections

  return (
    <div className="grid gap-1.5" aria-label="What it understood">
      <ChipRow label="Kind of site" value={b.format || b.industry ? [b.format && FORMAT_LABEL[b.format], b.industry && INDUSTRY_LABEL[b.industry]].filter(Boolean).join(' · ') : 'Not sure yet'} from={read('format') || read('industry')} open={open === 'kind'} onToggle={() => toggle('kind')}>
        <Chips label="Kind">
          {FORMATS.map((f) => (
            <Chip key={f} on={b.format === f} onClick={() => patch({ format: f })}>
              {FORMAT_LABEL[f]}
            </Chip>
          ))}
        </Chips>
        <Chips label="Industry">
          {INDUSTRIES.map((i) => (
            <Chip key={i} on={b.industry === i} onClick={() => patch({ industry: i })}>
              {INDUSTRY_LABEL[i]}
            </Chip>
          ))}
        </Chips>
      </ChipRow>

      <ChipRow label="It should" value={goals.join(', ') || 'Not sure yet'} from={read('goals')} open={open === 'goals'} onToggle={() => toggle('goals')}>
        <Chips>
          {GOALS.map((g) => {
            const on = !!b.goals?.includes(g)
            return (
              <Chip key={g} on={on} onClick={() => patch({ goals: on ? (b.goals ?? []).filter((x) => x !== g) : [...(b.goals ?? []), g as Goal].slice(-4) })}>
                {GOAL_LABEL[g]}
              </Chip>
            )
          })}
        </Chips>
        <input value={s.brief.goalsOther ?? ''} onChange={(e) => patch({ goalsOther: e.target.value })} placeholder="Something else, in your words" maxLength={120} className={`${INPUT} h-10 text-[14px]`} />
      </ChipRow>

      <ChipRow label="Main button" value={action} from={read('mainAction')} open={open === 'action'} onToggle={() => toggle('action')}>
        <Chips>
          {actionChoices(b).map((w) => (
            <Chip key={w} on={action === w} onClick={() => patch({ mainAction: w, mainActionTyped: false })}>
              {w}
            </Chip>
          ))}
        </Chips>
        <input
          defaultValue={b.mainActionTyped ? b.mainAction : ''}
          onBlur={(e) => e.target.value.trim() && patch({ mainAction: e.target.value.trim(), mainActionTyped: true })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="Or your own words"
          maxLength={40}
          className={`${INPUT} h-10 text-[14px]`}
        />
      </ChipRow>

      <ChipRow
        label="On the page"
        value={paste && !s.sections ? 'Your words decide the sections' : sections.filter((t) => !FIXED.includes(t)).map((t) => TYPE_LABEL[t]).join(', ') || 'Just the opener'}
        open={open === 'sections'}
        onToggle={() => toggle('sections')}
      >
        <SectionChips sections={sections} onChange={(next) => onChange({ ...s, sections: next })} />
      </ChipRow>

      <label className="flex min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3.5 py-1.5 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
        <span className="w-[92px] shrink-0 text-[12.5px] text-[#6B5F68]">For</span>
        <input
          value={b.who ?? ''}
          onChange={(e) => patch({ who: e.target.value })}
          placeholder="Who it’s for (optional)"
          maxLength={200}
          className="h-8 min-w-0 flex-1 bg-transparent text-[13.5px] font-medium outline-none placeholder:font-normal placeholder:text-zinc-400"
        />
        {read('who') && <FromYou />}
      </label>

      {(s.avoidWords.length > 0 || (b.feelWords?.length ?? 0) > 0) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white/80 px-3.5 py-2 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
          <span className="w-[92px] shrink-0 text-[12.5px] text-[#6B5F68]">Feel</span>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {b.feelWords?.map((w) => (
              <span key={w} className="rounded-full bg-[#FFD4E8]/60 px-2.5 py-1 text-[12.5px] font-medium">{w}</span>
            ))}
            {s.avoidWords.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 rounded-full bg-zinc-950/[0.05] py-1 pl-2.5 pr-1 text-[12.5px] font-medium">
                not {w}
                <button type="button" onClick={() => onChange(dropAvoid(s, w))} aria-label={`Stop steering away from ${w}`} className={`grid size-5 place-items-center rounded-full text-zinc-500 ${HOVER}bg-zinc-950/5 ${PRESS}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

const FromYou = () => (
  <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: '#B8327A', background: 'rgb(255 105 180 / 0.12)' }}>
    From what you wrote
  </span>
)

/** One thing it understood, on one line, with its choices folded under it. */
function ChipRow({ label, value, from, open, onToggle, children }: { label: string; value: string; from?: boolean; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl bg-white/80 shadow-[0_0_0_1px_rgb(23_18_26/0.06)] ${open ? 'bg-white' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3.5 py-2 text-left ${HOVER}bg-white ${PRESS} active:scale-[0.99]`}>
        <span className="w-[92px] shrink-0 text-[12.5px] text-[#6B5F68]">{label}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{value}</span>
        {from && <FromYou />}
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-medium text-[#6B5F68]" style={open ? { color: PINK } : undefined}>
          {open ? 'Done' : 'Change'}
        </span>
      </button>
      {open && <div className="grid gap-3 px-3.5 pb-3.5 pt-1 motion-safe:animate-pop">{children}</div>}
    </div>
  )
}

function Chips({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      {label && <span className="text-[12px] font-semibold text-[#6B5F68]">{label}</span>}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
      {children}
    </button>
  )
}

/** The page's sections as chips: ✕ takes one out (the nav, opener and footer stay), + adds one where it belongs. */
function SectionChips({ sections, onChange }: { sections: SectionType[]; onChange: (s: SectionType[]) => void }) {
  const [adding, setAdding] = useState(false)
  const more = OPTIONAL.filter((t) => !sections.includes(t))
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {sections.map((t) => (
          <span key={t} className={`${CHIP} ${CHIP_OFF} cursor-default`}>
            {TYPE_LABEL[t]}
            {!FIXED.includes(t) && (
              <button type="button" onClick={() => onChange(sections.filter((x) => x !== t))} aria-label={`Take out ${TYPE_LABEL[t]}`} className={`-mr-1.5 grid size-6 place-items-center rounded-full text-zinc-500 ${HOVER}bg-zinc-950/5 ${PRESS}`}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {more.length > 0 && (
          <button type="button" onClick={() => setAdding((x) => !x)} aria-expanded={adding} className={`${CHIP} ${CHIP_OFF}`}>
            <Plus size={13} /> Add
          </button>
        )}
      </div>
      {adding && (
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-zinc-50 p-2 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
          {more.map((t) => (
            <button key={t} type="button" onClick={() => (onChange(placeSection(sections, t)), setAdding(false))} className={`${CHIP} ${CHIP_OFF}`}>
              <Plus size={13} /> {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

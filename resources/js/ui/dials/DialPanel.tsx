import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, RotateCcw, Shuffle } from 'lucide-react'
import type { TokenKey, TokenSet } from '@/core/types'
import { COLOR_ROLES, changedParams, clampParams, randomParams, type ColorRole, type ParamSpec, type ParamValues, type TreatmentInfo, type TreatmentValue } from '@/core/treatments'
import { Switch } from '../panels/parts'
import { Slider, StyleRow, StyleSelect } from '../panels/StyleRows'

const ROLE_LABEL: Record<ColorRole, string> = { bg: 'Page', surface: 'Surface', text: 'Text', muted: 'Muted', border: 'Border', primary: 'Primary', onPrimary: 'On primary', accent: 'Accent' }
const isRole = (v: string): v is ColorRole => (COLOR_ROLES as readonly string[]).includes(v)
const hexOf = (v: string, tokens: TokenSet) => (isRole(v) ? tokens[`color.${v}` as TokenKey] : v)

/**
 * A treatment's dials, DialKit-style and compact: presets, sliders you can scrub from their label, colors that open
 * their palette only when asked, choices and switches, plus Shuffle and Reset. A dial that can't do anything right now
 * stays out of the way. Dragging previews on the page; letting go commits one undo step.
 */
export function DialPanel({
  info,
  value,
  tokens,
  onPreview,
  onCommit,
  seeded = true,
}: {
  info: TreatmentInfo
  value: TreatmentValue
  tokens: TokenSet
  onPreview: (v: TreatmentValue | null) => void
  onCommit: (v: TreatmentValue) => void
  /** Whether a new seed draws a new variation (generative ones); effects have no seed. */
  seeded?: boolean
}) {
  const committed = clampParams(info.params, value.params)
  const [draft, setDraft] = useState<ParamValues>(committed)
  const live = useRef(false)
  const key = JSON.stringify(committed)
  // A new value from outside (undo, an agent, a preset) resets the dials.
  useEffect(() => {
    if (!live.current) setDraft(JSON.parse(key) as ParamValues)
  }, [key])

  const make = (params: ParamValues, extra: Partial<TreatmentValue> = {}): TreatmentValue => ({
    id: info.id,
    params: changedParams(info.params, params),
    ...(value.seed !== undefined ? { seed: value.seed } : {}),
    ...extra,
  })
  /** While a dial moves: show it, don't keep it yet. */
  const nudge = (k: string, v: ParamValues[string]) => {
    live.current = true
    const next = { ...draft, [k]: v }
    setDraft(next)
    onPreview(make(next))
  }
  /** A hover that ended without a pick: back to what's kept. */
  const cancel = () => {
    live.current = false
    setDraft(committed)
    onPreview(null)
  }
  /** A dial let go (or a click): keep it, as one undo step. */
  const settle = (k?: string, v?: ParamValues[string]) => {
    const next = k ? { ...draft, [k]: v! } : draft
    live.current = false
    setDraft(next)
    onPreview(null)
    onCommit(make(next))
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-0.5" onMouseLeave={() => !live.current && onPreview(null)}>
        {info.presets.map((p) => {
          const on = value.preset === p.id
          const params = { ...committed, ...p.values }
          return (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => onPreview(make(params, { preset: p.id }))}
              onClick={(e) => {
                e.stopPropagation()
                onPreview(null)
                onCommit(make({ ...clampParams(info.params, {}), ...p.values }, { preset: p.id }))
              }}
              className={`h-7 cursor-pointer rounded-md px-2 text-[12px] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${on ? 'bg-zinc-950/[0.08] text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              {p.label}
            </button>
          )
        })}
        <span className="ml-auto flex items-center gap-0.5">
          <IconButton
            title={seeded ? 'New variation' : 'Shuffle the dials'}
            onClick={() => {
              if (seeded) onCommit({ ...make(committed), seed: (value.seed ?? 1) + 1 })
              else onCommit(make(clampParams(info.params, randomParams(info.params, (value.seed ?? 1) + Date.now() % 997))))
            }}
          >
            <Shuffle size={13} />
          </IconButton>
          <IconButton title="Reset to the defaults" onClick={() => onCommit({ id: info.id, ...(value.seed !== undefined ? { seed: value.seed } : {}) })}>
            <RotateCcw size={13} />
          </IconButton>
        </span>
      </div>
      {Object.entries(info.params)
        .filter(([k]) => matters(k, info.params, draft))
        .map(([k, spec]) => (
          <Dial key={k} spec={spec} value={draft[k]} tokens={tokens} onNudge={(v) => nudge(k, v)} onSettle={(v) => settle(k, v)} onCancel={cancel} />
        ))}
    </div>
  )
}

/** Whether a dial does anything right now: what's behind needs a fill behind; following the guide's own leaves only its strength. */
function matters(k: string, params: TreatmentInfo['params'], v: ParamValues): boolean {
  if (k === 'base' && 'fill' in params) return !!v.fill
  if ('guide' in params && v.guide) return k === 'guide' || k === 'strength' || k === 'fill' || k === 'base'
  return true
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="grid size-7 cursor-pointer place-items-center rounded-full text-zinc-500 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
    >
      {children}
    </button>
  )
}

function Dial({
  spec,
  value,
  tokens,
  onNudge,
  onSettle,
  onCancel,
}: {
  spec: ParamSpec
  value: ParamValues[string]
  tokens: TokenSet
  onNudge: (v: ParamValues[string]) => void
  onSettle: (v: ParamValues[string]) => void
  onCancel: () => void
}) {
  if (spec.kind === 'slider') return <SliderDial spec={spec} value={value as number} onNudge={onNudge} onSettle={onSettle} />
  if (spec.kind === 'toggle')
    return (
      <div className="flex min-h-8 items-center justify-between gap-3 text-[12px] font-medium text-zinc-600">
        {spec.label}
        <Switch on={!!value} onChange={() => onSettle(!value)} label={spec.label} />
      </div>
    )
  if (spec.kind === 'choice')
    return (
      <StyleRow label={spec.label}>
        <StyleSelect label={spec.label} value={value as string} options={spec.options.map((o) => ({ v: o.id, label: o.label }))} onChange={(v) => onSettle(v)} />
      </StyleRow>
    )
  if (spec.kind === 'color') return <ColorDial label={spec.label} value={value as string} tokens={tokens} onHover={(v) => (v ? onNudge(v) : onCancel())} onPick={onSettle} />
  return <StopsDial spec={spec} value={value as string[]} tokens={tokens} onSettle={onSettle} />
}

/** A slider with a readout; drag its label left or right to scrub. */
function SliderDial({ spec, value, onNudge, onSettle }: { spec: Extract<ParamSpec, { kind: 'slider' }>; value: number; onNudge: (v: number) => void; onSettle: (v: number) => void }) {
  const step = spec.step ?? 1
  const snap = (n: number) => Math.min(spec.max, Math.max(spec.min, Math.round(n / step) * step))
  const fix = (n: number) => Number(n.toFixed(4))
  const scrub = useRef<{ x: number; v: number; last: number } | null>(null)
  return (
    <div className="grid min-h-8 grid-cols-[72px_minmax(0,1fr)_38px] items-center gap-2">
      <span
        className="cursor-ew-resize select-none truncate text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
        title="Drag to scrub"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          scrub.current = { x: e.clientX, v: value, last: value }
        }}
        onPointerMove={(e) => {
          const s = scrub.current
          if (!s) return
          const v = fix(snap(s.v + ((e.clientX - s.x) / 220) * (spec.max - spec.min)))
          if (v !== s.last) {
            s.last = v
            onNudge(v)
          }
        }}
        onPointerUp={() => {
          const s = scrub.current
          scrub.current = null
          if (s && s.last !== s.v) onSettle(s.last)
        }}
      >
        {spec.label}
      </span>
      <Slider label={spec.label} value={value} min={spec.min} max={spec.max} step={step} onChange={(n) => onNudge(fix(n))} onCommit={() => onSettle(value)} />
      <span className="text-right text-[11.5px] tabular-nums text-zinc-500">
        {value}
        {spec.unit ?? ''}
      </span>
    </div>
  )
}

const colorName = (v: string) => (isRole(v) ? ROLE_LABEL[v] : v)

/** One color: a small chip naming it, opening its palette only when you want to change it. */
function ColorDial({ label, value, tokens, onHover, onPick }: { label: string; value: string; tokens: TokenSet; onHover?: (v: string | null) => void; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="grid gap-1.5">
      <StyleRow label={label}>
        <button
          type="button"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-lift pl-2.5 pr-2 text-[12px] font-medium text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.2)]"
        >
          <span className="size-3.5 shrink-0 rounded-full ring-1 ring-zinc-950/15" style={{ background: hexOf(value, tokens) }} />
          <span className="min-w-0 flex-1 truncate text-left">{colorName(value)}</span>
          <ChevronDown size={14} className={`shrink-0 text-zinc-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>
      </StyleRow>
      {open && (
        <div className="pl-[80px]">
          <ColorPick value={value} tokens={tokens} onHover={onHover} onPick={(v) => { onPick(v); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

/** The palette's roles first (so it re-themes), then your own color. */
export function ColorPick({ value, tokens, onHover, onPick }: { value: string; tokens: TokenSet; onHover?: (v: string | null) => void; onPick: (v: string) => void }) {
  return (
    <div className="flex items-center gap-[3px]" onMouseLeave={() => onHover?.(null)}>
      {COLOR_ROLES.map((r) => (
        <button
          key={r}
          type="button"
          title={ROLE_LABEL[r]}
          aria-label={ROLE_LABEL[r]}
          aria-pressed={value === r}
          onMouseEnter={() => onHover?.(r)}
          onClick={(e) => {
            e.stopPropagation()
            onPick(r)
          }}
          className={`size-5 cursor-pointer rounded-full transition-[scale,box-shadow] duration-150 active:scale-[0.97] ${value === r ? 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-[var(--lift)]' : 'ring-1 ring-zinc-950/15 hover:scale-110'}`}
          style={{ background: tokens[`color.${r}` as TokenKey] }}
        />
      ))}
      <label
        title="Your own color"
        className={`relative grid size-5 cursor-pointer place-items-center overflow-hidden rounded-full ${isRole(value) ? 'ring-1 ring-dashed ring-zinc-950/30' : 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-[var(--lift)]'}`}
        style={isRole(value) ? undefined : { background: value }}
      >
        {isRole(value) && <Plus size={11} className="text-zinc-500" />}
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(hexOf(value, tokens)) ? hexOf(value, tokens) : '#000000'} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  )
}

/** Gradient stops: the gradient itself, with a dot per stop. Pick one to change or remove it; the end adds another. */
function StopsDial({ spec, value, tokens, onSettle }: { spec: Extract<ParamSpec, { kind: 'stops' }>; value: string[]; tokens: TokenSet; onSettle: (v: string[]) => void }) {
  const [at, setAt] = useState<number | null>(null)
  const i = at === null ? null : Math.min(at, value.length - 1)
  return (
    <div className="grid gap-1.5">
      <StyleRow label={spec.label}>
        <div className="flex h-8 items-center gap-1.5">
          <span className="flex h-full min-w-0 flex-1 items-center justify-between rounded-lg px-1.5 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" style={{ background: `linear-gradient(90deg, ${value.map((c) => hexOf(c, tokens)).join(', ')})` }}>
            {value.map((c, k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === i}
                aria-label={`Stop ${k + 1}: ${colorName(c)}`}
                title={colorName(c)}
                onClick={(e) => {
                  e.stopPropagation()
                  setAt(k === i ? null : k)
                }}
                className={`size-[18px] cursor-pointer rounded-full transition-[box-shadow,scale] duration-150 active:scale-[0.9] ${k === i ? 'shadow-[0_0_0_2px_#fff,0_0_0_3.5px_rgb(24_24_27)]' : 'shadow-[0_0_0_2px_#fff,0_1px_3px_rgb(0_0_0/0.3)]'}`}
                style={{ background: hexOf(c, tokens) }}
              />
            ))}
          </span>
          {value.length < spec.max && (
            <button
              type="button"
              title="Add a color"
              aria-label="Add a color"
              onClick={(e) => {
                e.stopPropagation()
                onSettle([...value, value[value.length - 1]])
                setAt(value.length)
              }}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-500 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
            >
              <Plus size={13} />
            </button>
          )}
        </div>
      </StyleRow>
      {i !== null && (
        <div className="grid gap-1 pl-[80px]">
          <ColorPick value={value[i]} tokens={tokens} onPick={(c) => onSettle(value.map((x, k) => (k === i ? c : x)))} />
          {value.length > spec.min && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSettle(value.filter((_, x) => x !== i))
                setAt(null)
              }}
              className="w-fit cursor-pointer text-[11.5px] font-medium text-zinc-500 hover:text-zinc-900"
            >
              Remove this color
            </button>
          )}
        </div>
      )}
    </div>
  )
}

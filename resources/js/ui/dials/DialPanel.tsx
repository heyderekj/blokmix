import { useEffect, useRef, useState } from 'react'
import { Dices, Plus, RotateCcw, Shuffle, X } from 'lucide-react'
import type { TokenKey, TokenSet } from '@/core/types'
import { COLOR_ROLES, changedParams, clampParams, randomParams, type ColorRole, type ParamSpec, type ParamValues, type TreatmentInfo, type TreatmentValue } from '@/core/treatments'
import { Switch } from '../panels/parts'
import { Steps } from '../blocks/Spacing'

const ROLE_LABEL: Record<ColorRole, string> = { bg: 'Page', surface: 'Surface', text: 'Text', muted: 'Muted', border: 'Border', primary: 'Primary', onPrimary: 'On primary', accent: 'Accent' }
const isRole = (v: string): v is ColorRole => (COLOR_ROLES as readonly string[]).includes(v)
const hexOf = (v: string, tokens: TokenSet) => (isRole(v) ? tokens[`color.${v}` as TokenKey] : v)

/**
 * A treatment's dials, DialKit-style: presets, sliders you can scrub from their
 * label, palette colors, choices and switches, plus Shuffle (a new variation),
 * Randomize and Reset. Dragging previews on the page; letting go commits one
 * undo step.
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
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => !live.current && onPreview(null)}>
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
              className={`h-7 cursor-pointer rounded-full px-2.5 text-[11.5px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-600 hover:text-zinc-900'}`}
            >
              {p.label}
            </button>
          )
        })}
        <span className="ml-auto flex items-center gap-0.5">
          {seeded && (
            <IconButton title="New variation (same dials)" onClick={() => onCommit({ ...make(committed), seed: (value.seed ?? 1) + 1 })}>
              <Shuffle size={13} />
            </IconButton>
          )}
          <IconButton
            title="Randomize the dials"
            onClick={() => {
              const seed = (value.seed ?? 1) + 1
              onCommit({ ...make(clampParams(info.params, randomParams(info.params, seed + Date.now() % 997))), ...(seeded ? { seed } : {}) })
            }}
          >
            <Dices size={13} />
          </IconButton>
          <IconButton title="Reset to the defaults" onClick={() => onCommit({ id: info.id, ...(value.seed !== undefined ? { seed: value.seed } : {}) })}>
            <RotateCcw size={13} />
          </IconButton>
        </span>
      </div>
      {Object.entries(info.params).map(([k, spec]) => (
        <Dial key={k} spec={spec} value={draft[k]} tokens={tokens} onNudge={(v) => nudge(k, v)} onSettle={(v) => settle(k, v)} onCancel={cancel} />
      ))}
    </div>
  )
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
      <div className="flex items-center justify-between gap-3 text-[12px] text-zinc-600">
        {spec.label}
        <Switch on={!!value} onChange={() => onSettle(!value)} label={spec.label} />
      </div>
    )
  if (spec.kind === 'choice')
    return (
      <Row label={spec.label}>
        <Steps options={spec.options.map((o) => ({ v: o.id, label: o.label }))} value={value as string} onPick={(v) => onSettle(v)} />
      </Row>
    )
  if (spec.kind === 'color')
    return (
      <Row label={spec.label}>
        <ColorPick value={value as string} tokens={tokens} onHover={(v) => (v ? onNudge(v) : onCancel())} onPick={onSettle} />
      </Row>
    )
  return <StopsDial spec={spec} value={value as string[]} tokens={tokens} onSettle={onSettle} />
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-center gap-2">
      <span className="truncate text-[12px] text-zinc-600">{label}</span>
      {children}
    </div>
  )
}

/** A slider with a readout; drag its label left or right to scrub. */
function SliderDial({ spec, value, onNudge, onSettle }: { spec: Extract<ParamSpec, { kind: 'slider' }>; value: number; onNudge: (v: number) => void; onSettle: (v: number) => void }) {
  const step = spec.step ?? 1
  const snap = (n: number) => Math.min(spec.max, Math.max(spec.min, Math.round(n / step) * step))
  const fix = (n: number) => Number(n.toFixed(4))
  const scrub = useRef<{ x: number; v: number; last: number } | null>(null)
  return (
    <div className="grid grid-cols-[76px_1fr_48px] items-center gap-2">
      <span
        className="cursor-ew-resize select-none truncate text-[12px] text-zinc-600 hover:text-zinc-900"
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
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={step}
        value={value}
        aria-label={spec.label}
        onChange={(e) => onNudge(fix(Number(e.target.value)))}
        onPointerUp={(e) => onSettle(fix(Number((e.target as HTMLInputElement).value)))}
        onKeyUp={(e) => onSettle(fix(Number((e.target as HTMLInputElement).value)))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
      />
      <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500">
        {value}
        {spec.unit ?? ''}
      </span>
    </div>
  )
}

/** The palette's roles first (so it re-themes), then your own color. */
export function ColorPick({ value, tokens, onHover, onPick }: { value: string; tokens: TokenSet; onHover?: (v: string | null) => void; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => onHover?.(null)}>
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
          className={`size-[22px] cursor-pointer rounded-full transition-[scale,box-shadow] duration-150 active:scale-[0.94] ${value === r ? 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-[var(--lift)]' : 'ring-1 ring-zinc-950/15 hover:scale-110'}`}
          style={{ background: tokens[`color.${r}` as TokenKey] }}
        />
      ))}
      <label
        title="Your own color"
        className={`relative grid size-[22px] cursor-pointer place-items-center overflow-hidden rounded-full ${isRole(value) ? 'ring-1 ring-dashed ring-zinc-950/30' : 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-[var(--lift)]'}`}
        style={isRole(value) ? undefined : { background: value }}
      >
        {isRole(value) && <Plus size={11} className="text-zinc-500" />}
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(hexOf(value, tokens)) ? hexOf(value, tokens) : '#000000'} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  )
}

/** Gradient stops: pick one to change its color, add or take away stops. */
function StopsDial({ spec, value, tokens, onSettle }: { spec: Extract<ParamSpec, { kind: 'stops' }>; value: string[]; tokens: TokenSet; onSettle: (v: string[]) => void }) {
  const [at, setAt] = useState(0)
  const i = Math.min(at, value.length - 1)
  return (
    <div className="grid gap-1.5">
      <Row label={spec.label}>
        <div className="flex items-center gap-1">
          <span className="flex h-6 flex-1 overflow-hidden rounded-md ring-1 ring-zinc-950/10" style={{ background: `linear-gradient(90deg, ${value.map((c) => hexOf(c, tokens)).join(', ')})` }} />
          {value.map((c, k) => (
            <button
              key={k}
              type="button"
              title={`Stop ${k + 1}: ${isRole(c) ? ROLE_LABEL[c] : c}`}
              onClick={(e) => {
                e.stopPropagation()
                setAt(k)
              }}
              className={`relative size-6 cursor-pointer rounded-md transition-[box-shadow] duration-150 ${k === i ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/15'}`}
              style={{ background: hexOf(c, tokens) }}
            >
              {k === i && value.length > spec.min && (
                <span
                  role="button"
                  aria-label="Remove this stop"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSettle(value.filter((_, x) => x !== k))
                  }}
                  className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-zinc-900 text-white"
                >
                  <X size={8} />
                </span>
              )}
            </button>
          ))}
          {value.length < spec.max && (
            <button
              type="button"
              title="Add a stop"
              onClick={(e) => {
                e.stopPropagation()
                onSettle([...value, value[value.length - 1]])
                setAt(value.length)
              }}
              className="grid size-6 cursor-pointer place-items-center rounded-md text-zinc-500 ring-1 ring-dashed ring-zinc-950/25 hover:text-zinc-900"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </Row>
      <div className="pl-[84px]">
        <ColorPick value={value[i]} tokens={tokens} onPick={(c) => onSettle(value.map((x, k) => (k === i ? c : x)))} />
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { PackNote } from '../shell/BuySheet'
import { Ban, ChevronDown } from 'lucide-react'
import type { Slot, TokenSet } from '@/core/types'
import { BACKDROP_ANCHORS, CSS_BACKDROP_IDS, SHADER_IDS, backdropDecls, backdropPlace, backdropShaderId, treatmentInfo, type BackdropAnchor, type BackdropId, type TreatmentValue } from '@/core/treatments'
import { shaderFor } from '@/core/media'
import { useShaderThumb } from '@/lib/shaderPosters'
import { useStore } from '@/state/store'
import { useBlockPreview } from '../blocks/preview'
import { DialPanel } from './DialPanel'
import { Slider, StyleRow } from '../panels/StyleRows'
import { Switch } from '../panels/parts'
import { effectVarsStyle } from './EffectsTile'

/** CSS declarations as a React style ("background-image" → backgroundImage; custom properties as they are). */
function toStyle(decl: Record<string, string>): React.CSSProperties {
  return Object.fromEntries(Object.entries(decl).map(([k, v]) => [k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v])) as React.CSSProperties
}

/** A swatch of a backdrop, drawn with the page's tokens and effects (a live one by its shader, over its stand-in). */
export function BackdropSwatch({ value, tokens, className = '' }: { value: TreatmentValue | null; tokens: TokenSet; className?: string }) {
  const effects = useStore((s) => s.guide.effects)
  const live = backdropShaderId(value ?? undefined)
  const spec = useMemo(() => (live ? shaderFor(live, value!.params, value!.seed ?? 1, tokens, '1/1') : null), [live, value, tokens])
  const thumb = useShaderThumb(spec, 96, 96)
  const style = useMemo(
    () => ({ ...effectVarsStyle(tokens, effects), background: tokens['color.bg'], ...toStyle(backdropDecls(value ?? undefined, tokens)), ...(thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: 'cover' } : {}) }),
    [value, tokens, effects, thumb],
  )
  return <span className={`block rounded-lg ring-1 ring-zinc-950/10 ${className}`} style={style} />
}

/**
 * What's behind a section: none (as clipped) or a backdrop, then its dials.
 * Hovering shows it on the section; clicking keeps it.
 */
export function BackdropPicker({ slot, tokens }: { slot: Slot; tokens: TokenSet }) {
  const show = useBlockPreview((s) => s.showBackdrop)
  const st = useStore.getState
  const cur = slot.backdrop
  const [choosing, setChoosing] = useState(false)
  const pick = (v: TreatmentValue | null) => {
    show(null)
    st().setBackdrop(slot.id, v)
  }
  const info = cur ? treatmentInfo('backdrop', cur.id) : undefined
  const swatch = (id: BackdropId) => {
    const t = treatmentInfo('backdrop', id)!
    const v: TreatmentValue = cur?.id === id ? cur : { id, seed: cur?.seed ?? 1, preset: t.presets[0]?.id, params: { ...t.presets[0]?.values, ...backdropPlace(id) } }
    return (
      <button
        key={id}
        type="button"
        title={`${t.label}: ${t.hint}`}
        onMouseEnter={() => show({ slotId: slot.id, value: v })}
        onClick={(e) => {
          e.stopPropagation()
          pick(v)
        }}
        className={`cursor-pointer rounded-lg transition-[scale] duration-150 active:scale-[0.97] ${cur?.id === id ? 'ring-2 ring-zinc-900 ring-offset-1' : ''}`}
      >
        <BackdropSwatch value={v} tokens={tokens} className="aspect-square w-full" />
      </button>
    )
  }
  return (
    <div className="grid gap-2">
      <PackNote what="Backdrops" />
      <StyleRow label="Backdrop">
        <button
          type="button"
          aria-expanded={choosing}
          onClick={(e) => {
            e.stopPropagation()
            setChoosing(!choosing)
            show(null)
          }}
          className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-lift pl-1 pr-2 text-[12px] font-medium text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgb(0_0_0/0.2)]"
        >
          {cur ? <BackdropSwatch value={cur} tokens={tokens} className="size-6 shrink-0" /> : <span className="grid size-6 shrink-0 place-items-center text-zinc-400"><Ban size={13} /></span>}
          <span className="min-w-0 flex-1 truncate text-left">{cur && info ? info.label : 'None'}</span>
          <ChevronDown size={14} className={`shrink-0 text-zinc-400 transition-transform duration-150 ${choosing ? 'rotate-180' : ''}`} />
        </button>
      </StyleRow>
      {choosing && (
        <div className="grid gap-2 rounded-xl bg-white/50 p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
      <div className="grid grid-cols-6 gap-1" onMouseLeave={() => show(null)}>
        <button
          type="button"
          title="None (as clipped)"
          onMouseEnter={() => show({ slotId: slot.id, value: null })}
          onClick={(e) => {
            e.stopPropagation()
            pick(null)
          }}
          className={`grid aspect-square cursor-pointer place-items-center rounded-lg text-zinc-400 transition-[scale] duration-150 active:scale-[0.97] ${!cur ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10 hover:text-zinc-700'}`}
        >
          <Ban size={14} />
        </button>
        {CSS_BACKDROP_IDS.map(swatch)}
      </div>
      <div className="px-0.5 text-[11px] font-semibold text-zinc-400">Moving</div>
      <div className="grid grid-cols-6 gap-1" onMouseLeave={() => show(null)}>
        {SHADER_IDS.map(swatch)}
      </div>
        </div>
      )}
      {cur && info && (
        <>
          <Placement value={cur} onPreview={(v) => show({ slotId: slot.id, value: v })} onCommit={(v) => { show(null); st().setBackdrop(slot.id, v) }} />
          <details className="group rounded-xl bg-white/60 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
            <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 px-2.5 text-[12px] font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
              Fine-tune {info.label.toLowerCase()}
              <ChevronDown size={14} className="text-zinc-400 transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <div className="px-2.5 pb-2.5">
              <DialPanel
                info={{ ...info, params: Object.fromEntries(Object.entries(info.params).filter(([k]) => k !== 'anchor' && k !== 'reach')) }}
                value={cur}
                tokens={tokens}
                onPreview={(v) => show(v ? { slotId: slot.id, value: keepPlace(v, cur) } : null)}
                onCommit={(v) => { show(null); st().setBackdrop(slot.id, keepPlace(v, cur)) }}
              />
            </div>
          </details>
        </>
      )}
    </div>
  )
}

/** Fine-tuning changes how a backdrop looks, never where it sits. */
const keepPlace = (v: TreatmentValue, cur: TreatmentValue): TreatmentValue => ({ ...v, params: { ...v.params, anchor: cur.params?.anchor ?? 'full', ...(cur.params?.reach !== undefined ? { reach: cur.params.reach } : {}) } })

const PAD = BACKDROP_ANCHORS.filter((a): a is Exclude<BackdropAnchor, 'full'> => a !== 'full')

/** Where a backdrop sits and how far it spreads: a pad of nine spots, the whole section, and one slider. */
function Placement({ value, onPreview, onCommit }: { value: TreatmentValue; onPreview: (v: TreatmentValue) => void; onCommit: (v: TreatmentValue) => void }) {
  const anchor = (value.params?.anchor as string | undefined) ?? 'full'
  const saved = (value.params?.reach as number | undefined) ?? 70
  const [reach, setReach] = useState(saved)
  useEffect(() => setReach(saved), [saved])
  const at = (patch: { anchor?: string; reach?: number }) => ({ ...value, params: { ...value.params, anchor, reach, ...patch } })
  const whole = anchor === 'full'
  return (
    <div className="flex items-stretch gap-3">
      <div className={`grid size-[76px] shrink-0 grid-cols-3 gap-0.5 rounded-xl bg-lift p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition-opacity ${whole ? 'opacity-50' : ''}`} role="radiogroup" aria-label="Where the backdrop sits">
        {PAD.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={anchor === a}
            aria-label={a.replace('-', ' ')}
            title={a.replace('-', ' ')}
            onMouseEnter={() => onPreview(at({ anchor: a }))}
            onClick={(e) => {
              e.stopPropagation()
              onCommit(at({ anchor: a }))
            }}
            className="group/spot grid cursor-pointer place-items-center rounded-md transition-[background-color,scale] hover:bg-zinc-950/5 active:scale-[0.97]"
          >
            <span className={`rounded-full transition-[width,height,background-color] duration-150 ${anchor === a ? 'size-3 bg-zinc-900' : 'size-1.5 bg-zinc-400 group-hover/spot:bg-zinc-700'}`} />
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
        <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-zinc-600">
          Whole section
          <Switch on={whole} onChange={() => onCommit(at({ anchor: whole ? (backdropPlace(value.id as BackdropId)?.anchor ?? 'top') : 'full' }))} label="Cover the whole section" />
        </div>
        <label className={`grid grid-cols-[46px_minmax(0,1fr)_34px] items-center gap-1.5 transition-opacity ${whole ? 'pointer-events-none opacity-40' : ''}`}>
          <span className="text-[12px] font-medium text-zinc-600">Reach</span>
          <Slider
            label="How far it spreads before fading out"
            value={reach}
            min={20}
            max={120}
            step={5}
            disabled={whole}
            onChange={(n) => {
              setReach(n)
              onPreview(at({ reach: n }))
            }}
            onCommit={() => onCommit(at({ reach }))}
          />
          <span className="text-right text-[11.5px] tabular-nums text-zinc-500">{reach}%</span>
        </label>
      </div>
    </div>
  )
}

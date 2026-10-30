import { useMemo } from 'react'
import { Ban } from 'lucide-react'
import type { Slot, TokenSet } from '@/core/types'
import { CSS_BACKDROP_IDS, SHADER_IDS, backdropDecls, backdropShaderId, treatmentInfo, type BackdropId, type TreatmentValue } from '@/core/treatments'
import { shaderFor } from '@/core/media'
import { useShaderThumb } from '@/lib/shaderPosters'
import { useStore } from '@/state/store'
import { useBlockPreview } from '../blocks/preview'
import { DialPanel } from './DialPanel'
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
  const pick = (v: TreatmentValue | null) => {
    show(null)
    st().setBackdrop(slot.id, v)
  }
  const info = cur ? treatmentInfo('backdrop', cur.id) : undefined
  const swatch = (id: BackdropId) => {
    const t = treatmentInfo('backdrop', id)!
    const v: TreatmentValue = cur?.id === id ? cur : { id, seed: cur?.seed ?? 1, preset: t.presets[0]?.id, params: t.presets[0]?.values }
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
        className={`cursor-pointer rounded-lg transition-[scale] duration-150 active:scale-[0.96] ${cur?.id === id ? 'ring-2 ring-zinc-900 ring-offset-1' : ''}`}
      >
        <BackdropSwatch value={v} tokens={tokens} className="aspect-square w-full" />
      </button>
    )
  }
  return (
    <div className="grid gap-2.5">
      <div className="grid grid-cols-6 gap-1" onMouseLeave={() => show(null)}>
        <button
          type="button"
          title="None (as clipped)"
          onMouseEnter={() => show({ slotId: slot.id, value: null })}
          onClick={(e) => {
            e.stopPropagation()
            pick(null)
          }}
          className={`grid aspect-square cursor-pointer place-items-center rounded-lg text-zinc-400 transition-[scale] duration-150 active:scale-[0.96] ${!cur ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10 hover:text-zinc-700'}`}
        >
          <Ban size={14} />
        </button>
        {CSS_BACKDROP_IDS.map(swatch)}
      </div>
      <div className="px-0.5 text-[11px] font-semibold text-zinc-400">Live, in WebGL</div>
      <div className="grid grid-cols-6 gap-1" onMouseLeave={() => show(null)}>
        {SHADER_IDS.map(swatch)}
      </div>
      {cur && info && (
        <div className="rounded-xl bg-white/60 p-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-zinc-900">{info.label}</span>
            <span className="truncate text-[11px] text-zinc-500">{info.hint}</span>
          </div>
          <DialPanel info={info} value={cur} tokens={tokens} onPreview={(v) => show(v ? { slotId: slot.id, value: v } : null)} onCommit={(v) => st().setBackdrop(slot.id, v)} />
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CssVars, TokenSet } from '@/core/types'
import { EFFECT_IDS, effectsVars, lookList, treatmentInfo, type EffectId, type EffectsState, type TreatmentValue } from '@/core/treatments'
import { expandTokens } from '@/core/tokens'
import { useStore } from '@/state/store'
import { useEffectPreview } from '@/state/derived'
import { Switch } from '../panels/parts'
import { DialPanel } from './DialPanel'

/** The page's tokens and effects as inline variables, so a preview in the app draws with them. */
export function effectVarsStyle(tokens: TokenSet, effects: EffectsState | undefined): React.CSSProperties {
  const vars: CssVars = { ...expandTokens(tokens), ...effectsVars(effects, tokens) }
  return vars as React.CSSProperties
}

/** A small scene that shows every effect at once: a gradient, a raised card with grain, a glass chip, a glow. */
export function EffectsArt({ tokens, effects, className = '' }: { tokens: TokenSet; effects: EffectsState | undefined; className?: string }) {
  const style = useMemo(() => effectVarsStyle(tokens, effects), [tokens, effects])
  return (
    <span className={`relative block h-[72px] overflow-hidden rounded-[10px] ${className}`} style={{ ...style, background: 'var(--mx-color-surface)', boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.06)' }}>
      <span className="absolute inset-y-0 left-0 w-[46%]" style={{ background: 'var(--mx-gradient, linear-gradient(120deg, var(--mx-color-primary), var(--mx-color-accent)))' }} />
      <span
        className="absolute left-[30%] top-[18px] h-7 w-[26%] rounded-[8px]"
        style={{ background: 'var(--mx-glass-fill, color-mix(in oklab, var(--mx-color-bg) 62%, transparent))', backdropFilter: 'var(--mx-glass-blur, blur(16px) saturate(1.4))', border: '1px solid var(--mx-glass-edge, transparent)' }}
      />
      <span
        className="absolute right-[10%] top-3 h-12 w-[30%] rounded-[10px]"
        style={{ background: 'var(--mx-grain, none) repeat 0 0 / 120px 120px, var(--mx-color-bg)', boxShadow: 'var(--mx-shadow-card)' }}
      />
      <span className="absolute bottom-2.5 left-3 size-3 rounded-full" style={{ background: 'var(--mx-color-accent)', boxShadow: 'var(--mx-glow, none)' }} />
    </span>
  )
}

/**
 * The style guide's effects: a shelf of curated looks, then each effect with its
 * dials. Dragging a dial previews it on every section; letting go keeps it.
 */
export function EffectsPanel({ tokens }: { tokens: TokenSet }) {
  const effects = useStore((s) => s.guide.effects)
  const preview = useEffectPreview((s) => s.set)
  const [open, setOpen] = useState<EffectId | null>(null)
  const st = useStore.getState
  const looks = lookList()
  const show = (id: EffectId, v: TreatmentValue | null) => preview(v ? { ...effects, [id]: v } : null)

  return (
    <div className="grid gap-3">
      {looks.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Looks</div>
          <div className="grid grid-cols-2 gap-1.5" onMouseLeave={() => preview(null)}>
            {looks.map((l) => (
              <button
                key={l.id}
                type="button"
                title={l.hint}
                onMouseEnter={() => preview(l.effects)}
                onClick={(e) => {
                  e.stopPropagation()
                  preview(null)
                  st().setEffects(l.effects, true)
                  st().showFlash(`Effects: ${l.label}`, { undo: true })
                }}
                className="group grid cursor-pointer gap-1 rounded-xl p-1 text-left transition-[background-color,scale] duration-150 hover:bg-zinc-950/[0.04] active:scale-[0.98]"
              >
                <EffectsArt tokens={tokens} effects={l.effects} className="h-12" />
                <span className="px-0.5 text-[11.5px] font-semibold text-zinc-700">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-1">
        {EFFECT_IDS.map((id) => {
          const info = treatmentInfo('effect', id)!
          const v = effects?.[id]
          const expanded = open === id
          return (
            <div key={id} className={`rounded-xl transition-colors ${expanded ? 'bg-white/70 p-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]' : 'px-2.5 py-1.5'}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(expanded ? null : id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left">
                  <ChevronDown size={13} className={`shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                  <span className="text-[12.5px] font-semibold text-zinc-900">{info.label}</span>
                  <span className="truncate text-[11px] text-zinc-500">{v ? (v.preset ? info.presets.find((p) => p.id === v.preset)?.label : 'Custom') : 'From your style guide'}</span>
                </button>
                <Switch
                  on={!!v}
                  label={`${info.label} effect`}
                  onChange={() => {
                    st().setEffect(id, v ? null : { id, preset: info.presets[0]?.id, params: info.presets[0]?.values })
                    if (!v) setOpen(id)
                  }}
                />
              </div>
              {expanded && (
                <div className="mt-2.5">
                  <p className="mb-2 text-[11.5px] leading-snug text-zinc-500">{info.hint}</p>
                  <DialPanel info={info} value={v ?? { id }} tokens={tokens} seeded={false} onPreview={(x) => show(id, x)} onCommit={(x) => st().setEffect(id, x)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

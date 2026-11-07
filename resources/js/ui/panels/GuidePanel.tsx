import { ColorButton } from '@/ui/color/ColorPicker'
import { useState } from 'react'
import { TYPE_RATIOS } from '@/core/dials'
import { Check, ClipboardCopy, Lock, Plus, RotateCcw, X } from 'lucide-react'
import { FREE_TOKENS } from '@/core/plan'
import { useAccount } from '@/lib/account'
import { needsPack } from '@/state/plan'
import type { BlockKind, ComponentDefault, Conflict, TokenGroup, TokenKey } from '@/core/types'
import { BLOCK_LABEL } from '@/core/blocks'
import { findVariant } from '@/core/blocks/variants'
import { IconGlyph, IconSetPicker } from '../blocks/IconMenu'
import { candidateSource, candidateSourceName, groupWinner } from '@/core/guide'
import { CONTRAST_PAIRS, contrastRatio, expandTokens, GROUP_LABEL, keysInGroup, primaryFamily, TOKEN_LABEL, varsToCss } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'
import { Look } from './guide/Look'
import { GuideBoard } from './guide/GuideBoard'
import { FontField } from './FontPicker'
import { PanelSection } from './parts'

/** The style guide panel: a board of tiles, one per group, that open into their choices and knobs. */
/** Look first; the full style guide sits behind it. */
export function GuidePanel() {
  const view = useStore((s) => s.ui.guideView)
  return view === 'guide' ? <GuideBoard /> : <Look />
}

export function sourceOf(candidateId: string) {
  const src = candidateSource(library, candidateId)
  return src ?? { name: candidateSourceName(library, candidateId) }
}

/** Copy the guide's CSS variables plus an instruction, for an agent. */
export function useCopyGuide() {
  const guide = useResolvedGuide()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const css = varsToCss(expandTokens(guide.tokens))
    const text = `Apply this style guide from Blokmix. Use only these CSS variables for color, type, radius, shadow, spacing and motion; replace hard-coded values with them.\n\n${css}\n`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  return { copied, copy }
}

/** Always in reach at the bottom of the panel, however far the guide scrolls. */
export function CopyFooter() {
  const { copied, copy } = useCopyGuide()
  return (
    <div className="sticky bottom-0 z-10 border-t border-zinc-950/6 px-4 py-3 backdrop-blur-md [background:var(--header-bg)]">
      <button type="button" onClick={copy} className="btn-quiet flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[13px] font-medium">
        {copied ? <Check size={14} className="text-green-600" /> : <ClipboardCopy size={14} />}
        {copied ? 'Copied for your agent' : 'Copy for your agent'}
      </button>
    </div>
  )
}

export function BrandColours() {
  const state = useStore((s) => s.guide)
  const st = useStore.getState
  return (
    <PanelSection title="Extra colors" action={<AddSwatch />}>
      {state.swatches?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {state.swatches.map((w) => (
            <span key={w.id} className="flex h-7 items-center gap-1.5 rounded-full border border-zinc-950/10 pl-1 pr-1 text-[12px] text-zinc-700">
              <span className="size-5 rounded-full ring-1 ring-zinc-950/10" style={{ background: w.value }} />
              {w.name}
              <span className="font-mono text-[10.5px] text-zinc-400">{w.value}</span>
              <button type="button" onClick={() => st().removeSwatch(w.id)} className="grid size-5 place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700" aria-label={`Remove ${w.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-zinc-500">Colors beyond your palette. Add one here, or from a block’s Style menu.</p>
      )}
    </PanelSection>
  )
}

export function Components() {
  const state = useStore((s) => s.guide)
  const st = useStore.getState
  return (
    <PanelSection title="Block looks">
      {state.components && Object.keys(state.components).length ? (
        <div className="space-y-1">
          {(Object.entries(state.components) as [BlockKind, ComponentDefault][]).map(([kind, d]) => (
            <div key={kind} className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12.5px]">
              <span className="w-16 font-semibold text-zinc-900">All {BLOCK_LABEL[kind].toLowerCase()}s</span>
              <span className="flex-1 truncate text-zinc-600">{describeLook(kind, d)}</span>
              <button type="button" onClick={() => st().clearComponent(kind)} className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700" title="Stop using this look everywhere">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-zinc-500">Select a block on the page, give it a look, then choose “Use for all” to make it the look for every block of its kind.</p>
      )}
    </PanelSection>
  )
}

/** Each contrast pair, with its ratio and whether it passes AA. */
export function useContrast() {
  const tokens = useResolvedGuide().tokens
  return CONTRAST_PAIRS.map(([fg, bg, label]) => {
    const r = contrastRatio(tokens[fg], tokens[bg])
    return { label, fg: tokens[fg], bg: tokens[bg], ratio: r, ok: r != null && r >= 4.5 }
  })
}

export function Contrast() {
  const pairs = useContrast()
  return (
    <PanelSection title="Contrast">
      <div className="space-y-1.5">
        {pairs.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[12px]">
            <span className="grid h-6 w-9 place-items-center rounded-md border border-zinc-950/10 text-[11px] font-bold" style={{ background: p.bg, color: p.fg }}>
              Aa
            </span>
            <span className="flex-1 text-zinc-600">{p.label}</span>
            <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${p.ok ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-600'}`}>
              {p.ratio ?? '?'}:1 {p.ok ? 'AA' : 'low'}
            </span>
          </div>
        ))}
      </div>
    </PanelSection>
  )
}

export function Candidates() {
  const state = useStore((s) => s.guide)
  const st = useStore.getState
  return (
    <PanelSection title="Options">
      {state.candidates.length ? (
        <div className="flex flex-wrap gap-1.5">
          {state.candidates.map((c) => (
            <span key={c.id} className="flex h-7 items-center gap-1.5 rounded-full border border-zinc-950/10 pl-2.5 pr-1 text-[12px] text-zinc-700">
              {sourceOf(c.id)?.name ?? c.clipId} · {GROUP_LABEL[c.group].toLowerCase()}
              <button type="button" onClick={() => st().removeCandidate(c.id)} className="grid size-5 place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700" aria-label="Remove candidate">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-zinc-500">No options yet. In a clipped section’s Style, pick “Add as an option”.</p>
      )}
    </PanelSection>
  )
}

/** Every token in a group, with its knob, where it came from, and any disagreement to settle. */
export function GroupTokens({ group }: { group: TokenGroup }) {
  const guide = useResolvedGuide()
  const state = useStore((s) => s.guide)
  const conflicts = new Map(guide.conflicts.map((c) => [c.key, c]))
  return (
    <div className="space-y-3">
      {keysInGroup(group).map((k) => (
        <TokenRow key={k} k={k} value={guide.tokens[k]} provenance={guide.provenance[k]} conflict={conflicts.get(k)} chosen={!!state.choices[k]} />
      ))}
    </div>
  )
}

export function describeLook(kind: BlockKind, d: ComponentDefault): string {
  const parts: string[] = []
  const v = findVariant(kind, d.variant)
  if (v) parts.push(v.label)
  if (d.style?.fill) parts.push(`${d.style.fill.replace('x:', '')} fill`)
  if (d.style?.ink) parts.push(`${d.style.ink.replace('x:', '')} text`)
  if (d.style?.radius) parts.push(`${d.style.radius} corners`)
  if (d.style?.shadow) parts.push(`${d.style.shadow} shadow`)
  return parts.join(' · ') || 'Default'
}

export function AddSwatch() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('#7c5cff')
  const [name, setName] = useState('')
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-zinc-600 hover:bg-zinc-950/5">
        <Plus size={12} /> Add
      </button>
    )
  const save = () => {
    if (name.trim()) useStore.getState().addSwatch(name.trim(), value)
    setOpen(false)
    setName('')
  }
  return (
    <span className="flex items-center gap-1.5">
      <ColorButton value={value} onPick={setValue} title="Color" className="size-6 shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setOpen(false)
        }}
        onBlur={save}
        placeholder="Name"
        className="h-6 w-24 rounded-md bg-white px-1.5 text-[12px] outline-none ring-1 ring-zinc-950/10 focus:ring-zinc-400"
      />
    </span>
  )
}

export function GroupDecision({ group, open }: { group: TokenGroup; open: boolean }) {
  const state = useStore((s) => s.guide)
  const cands = state.candidates.filter((c) => c.group === group)
  if (cands.length < 2) return null
  const winner = groupWinner(state, group)
  return (
    <div className={`mb-3 rounded-xl p-2 ${open ? 'bg-attention-soft/60 ring-1 ring-attention/40' : 'bg-well'}`}>
      <div className="mb-1.5 px-0.5 text-[11.5px] font-medium text-zinc-500">{open ? 'Pick one' : 'Picked'}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {cands.map((c) => {
          const clip = library.clips[c.clipId]
          const t = clip.tokens
          const active = winner === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => useStore.getState().chooseGroup(c.id)}
              className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition active:scale-[0.97] ${
                active ? 'border-zinc-900 bg-white shadow-sm' : 'border-zinc-950/10 bg-white/70 hover:border-zinc-950/30'
              }`}
            >
              <span className="grid h-8 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-zinc-950/10" style={{ background: t['color.bg'], borderRadius: group === 'shape' ? Math.min(10, parseFloat(t['radius.base'])) : undefined }}>
                {group === 'color' ? (
                  <span className="flex -space-x-1">
                    {(['color.primary', 'color.accent', 'color.text'] as const).map((k) => (
                      <span key={k} className="size-3 rounded-full border border-zinc-950/10" style={{ background: t[k] }} />
                    ))}
                  </span>
                ) : group === 'type' ? (
                  <span style={{ fontFamily: t['font.display'], color: t['color.text'], fontWeight: Number(t['type.displayWeight']) }} className="text-[15px] leading-none">
                    Aa
                  </span>
                ) : (
                  <span className="font-mono text-[9px]" style={{ color: t['color.text'] }}>
                    {group === 'shape' ? t['radius.base'] : group === 'space' ? t['space.section'] : t['motion.duration']}
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-zinc-800">{library.sources[clip.sourceId]?.name}</span>
                <span className="block truncate text-[10.5px] text-zinc-400">{active ? 'chosen' : TYPE_HINT[group](t)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const TYPE_HINT: Record<TokenGroup, (t: Record<TokenKey, string>) => string> = {
  color: (t) => t['color.primary'],
  type: (t) => primaryFamily(t['font.display']),
  shape: (t) => `radius ${t['radius.base']}, lines ${t['stroke.width'] ?? '1px'}`,
  space: (t) => `section ${t['space.section']}`,
  motion: (t) => t['motion.duration'],
}

export function TokenRow({ k, value, provenance, conflict, chosen }: { k: TokenKey; value: string; provenance: string; conflict?: Conflict; chosen: boolean }) {
  const st = useStore.getState
  const from = provenance === 'base' ? 'default' : provenance === 'custom' ? 'custom' : (sourceOf(provenance)?.name ?? '')
  // On Free, the Feel dials move these; the knob itself is in a mix pack (brand colors and fonts stay yours).
  const locked = !useAccount((s) => s.paid) && !FREE_TOKENS.has(k)
  return (
    <div className={`rounded-xl ${conflict && !conflict.resolved ? 'bg-attention-soft/40 p-2 ring-1 ring-attention/30' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-zinc-700">{TOKEN_LABEL[k]}</span>
        <span className="truncate text-[11px] text-zinc-400">{from}</span>
        {locked && <Lock size={11} className="shrink-0 text-zinc-400" aria-label="In a mix pack" />}
        {chosen && (
          <button type="button" title="Reset to automatic" onClick={() => st().chooseToken(k, null)} className="grid size-5 place-items-center rounded text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700">
            <RotateCcw size={11} />
          </button>
        )}
      </div>
      <div className="relative mt-1.5">
        <div inert={locked} className={locked ? 'opacity-50' : undefined}>
          <Knob k={k} value={value} onChange={(v) => st().chooseToken(k, { kind: 'custom', value: v })} />
        </div>
        {locked && <button type="button" onClick={() => needsPack(TOKEN_LABEL[k])} className="absolute inset-0 cursor-pointer" aria-label={`${TOKEN_LABEL[k]}: in a mix pack`} />}
      </div>
      {conflict && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {conflict.options.map((o) => {
            const active = o.value === conflict.current && conflict.resolved
            const src = sourceOf(o.candidateIds[0])
            return (
              <button
                key={o.value}
                type="button"
                title={`${o.value} from ${o.candidateIds.map((id) => sourceOf(id)?.name).join(', ')}`}
                onClick={() => st().chooseToken(k, { kind: 'candidate', candidateId: o.candidateIds[0] })}
                className={`flex h-7 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-[11.5px] transition active:scale-[0.97] ${
                  active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-950/10 bg-white text-zinc-600 hover:border-zinc-950/30'
                }`}
              >
                <OptionPreview k={k} value={o.value} />
                {src?.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function OptionPreview({ k, value }: { k: TokenKey; value: string }) {
  if (k.startsWith('color.')) return <span className="size-5 rounded-full border border-zinc-950/15" style={{ background: value }} />
  if (k.startsWith('font.'))
    return (
      <span className="grid size-5 place-items-center rounded-full bg-zinc-950/5 text-[11px] font-bold" style={{ fontFamily: value }}>
        Aa
      </span>
    )
  if (k === 'radius.base') return <span className="ml-1 size-4 border-2 border-current" style={{ borderRadius: Math.min(8, parseFloat(value)) }} />
  if (k === 'icon.set') return <span className="ml-1 text-zinc-700"><IconGlyph name="star" set={value} size={14} /></span>
  if (k === 'stroke.width') return <span className="ml-1 h-0 w-5 border-t border-current" style={{ borderTopWidth: parseFloat(value) }} />
  return <span className="ml-1.5 font-mono text-[10.5px]">{value.length > 12 ? value.slice(0, 12) + '…' : value}</span>
}

const RATIOS = TYPE_RATIOS
const EASES: [string, string][] = [
  ['cubic-bezier(0.16, 1, 0.3, 1)', 'Expo out'],
  ['cubic-bezier(0.34, 1.56, 0.64, 1)', 'Springy'],
  ['cubic-bezier(0.2, 0.8, 0.2, 1)', 'Snappy'],
  ['cubic-bezier(0.22, 1, 0.36, 1)', 'Quint out'],
  ['cubic-bezier(0.4, 0, 0.2, 1)', 'Standard'],
  ['cubic-bezier(0, 0, 1, 1)', 'Linear'],
]


function Slider({ value, min, max, step = 1, unit, onChange }: { value: number; min: number; max: number; step?: number; unit: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(`${e.target.value}${unit}`)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
      />
      <span className="w-14 text-right font-mono text-[11.5px] tabular-nums text-zinc-600">
        {value}
        {unit}
      </span>
    </div>
  )
}

const selectCls =
  'h-8 w-full rounded-lg border border-zinc-950/10 bg-white px-2 text-[12.5px] text-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900/15'

function Knob({ k, value, onChange }: { k: TokenKey; value: string; onChange: (v: string) => void }) {
  if (k.startsWith('color.')) {
    return (
      <div className="flex items-center gap-2">
        <ColorButton
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onPick={onChange}
          title="Pick a color"
          className="size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-950/15 shadow-inner"
        >
          <span className="block size-full" style={{ background: value }} />
        </ColorButton>
        <input
          key={value}
          defaultValue={value}
          onBlur={(e) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(e.target.value) && onChange(e.target.value.toLowerCase())}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-8 w-full rounded-lg border border-zinc-950/10 bg-white px-2 font-mono text-[12px] uppercase text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-900/15"
        />
      </div>
    )
  }
  if (k.startsWith('font.')) return <FontField k={k} value={value} onChange={onChange} />
  const n = parseFloat(value)
  switch (k) {
    case 'type.base':
      return <Slider value={n} min={12} max={22} unit="px" onChange={onChange} />
    case 'type.ratio':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          {!RATIOS.includes(value) && <option value={value}>{value}</option>}
          {RATIOS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )
    case 'type.displayWeight':
      return <Slider value={n} min={300} max={900} step={10} unit="" onChange={onChange} />
    case 'radius.base':
      return <Slider value={n} min={0} max={32} unit="px" onChange={onChange} />
    case 'icon.set':
      return <IconSetPicker value={value} onChange={onChange} />
    case 'stroke.width':
      return <Slider value={n} min={1} max={4} step={0.5} unit="px" onChange={onChange} />
    case 'space.base':
      return <Slider value={n} min={2} max={8} unit="px" onChange={onChange} />
    case 'space.section':
      return <Slider value={n} min={40} max={180} step={4} unit="px" onChange={onChange} />
    case 'space.content':
      return <Slider value={n} min={960} max={1600} step={20} unit="px" onChange={onChange} />
    case 'space.text':
      return <Slider value={n} min={560} max={960} step={10} unit="px" onChange={onChange} />
    case 'motion.duration':
      return <Slider value={n} min={60} max={1200} step={20} unit="ms" onChange={onChange} />
    case 'motion.ease':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          {!EASES.some(([v]) => v === value) && <option value={value}>{value}</option>}
          {EASES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      )
    case 'shadow.card': {
      const presets = [...new Set(Object.values(library.sources).map((s) => s.tokens['shadow.card']))]
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          {!presets.includes(value) && <option value={value}>{value}</option>}
          {presets.map((p) => (
            <option key={p} value={p}>
              {Object.values(library.sources).find((s) => s.tokens['shadow.card'] === p)?.name}: {p.slice(0, 22)}
            </option>
          ))}
          <option value="none">None</option>
        </select>
      )
    }
    default:
      return <input defaultValue={value} key={value} onBlur={(e) => onChange(e.target.value)} className={selectCls} />
  }
}

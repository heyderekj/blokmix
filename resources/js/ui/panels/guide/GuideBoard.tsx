import { useState } from 'react'
import type { TokenGroup, TokenKey } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { GROUP_LABEL, primaryFamily } from '@/core/tokens'
import { BrandColours, Candidates, Components, CopyFooter, GroupDecision, GroupTokens, useContrast } from '../GuidePanel'
import { FontLinks, sourceName, useGuideData, withCandidate } from './shared'
import { SavedGuides } from './SavedGuides'
import { isHosted } from '@/lib/host'

/**
 * C · Board. A tile per group that shows the value rather than naming it; the open
 * decisions carry a flag. A tile opens across the board into its choices and knobs.
 */
export function GuideBoard() {
  const { tokens, open, candidates, winner } = useGuideData()
  const [opened, setOpened] = useState<TokenGroup | null>(null)
  return (
    <div>
      <FontLinks tokens={[tokens, ...TOKEN_GROUPS.flatMap((g) => candidates(g).map((c) => withCandidate(tokens, c)))]} />
      <div className="grid grid-cols-2 gap-2 p-3">
        {TOKEN_GROUPS.map((g) =>
          opened === g ? (
            <div key={g} className="col-span-2 animate-rise rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_28px_-14px_rgb(0_0_0/0.3)]">
              <button type="button" onClick={() => setOpened(null)} className="mb-2 flex w-full cursor-pointer items-center justify-between text-left">
                <span className="text-[13.5px] font-semibold text-zinc-900">{GROUP_LABEL[g]}</span>
                <span className="text-[11.5px] font-medium text-zinc-500">Done</span>
              </button>
              <GroupDecision group={g} open={open.includes(g)} />
              <GroupTokens group={g} />
            </div>
          ) : (
            <button
              key={g}
              type="button"
              onClick={() => setOpened(g)}
              className={`group/tile relative flex min-h-[124px] cursor-pointer flex-col justify-between gap-2 rounded-2xl bg-[var(--lift)] p-3 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)] transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_14px_26px_-12px_rgb(0_0_0/0.3)] ${g === 'motion' ? 'col-span-2 min-h-0' : ''}`}
            >
              {open.includes(g) && <span className="absolute right-2.5 top-2.5 rounded-full bg-attention-soft px-2 py-0.5 text-[10.5px] font-bold text-attention-ink">Pick one</span>}
              <span className="text-[12.5px] font-semibold text-zinc-900">{GROUP_LABEL[g]}</span>
              <TileArt group={g} tokens={tokens} />
              <span className="truncate text-[11px] text-zinc-500">{sourceLine(g)}</span>
            </button>
          ),
        )}
        <ContrastTile />
        {isHosted() && <SavedGuides />}
        <div className="col-span-2 overflow-hidden rounded-2xl bg-[var(--lift)] shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <BrandColours />
          <Components />
          <Candidates />
        </div>
      </div>
      <CopyFooter />
    </div>
  )

  function sourceLine(g: TokenGroup) {
    const cands = candidates(g)
    if (open.includes(g)) return `${cands.map(sourceName).join(' or ')}?`
    const from = cands.find((c) => c.id === winner(g)) ?? cands[0]
    return from ? `from ${sourceName(from)}` : 'Default'
  }
}

function TileArt({ group, tokens: t }: { group: TokenGroup; tokens: Record<TokenKey, string> }) {
  if (group === 'color')
    return (
      <span className="flex h-11 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]">
        {(['color.bg', 'color.surface', 'color.muted', 'color.text', 'color.primary', 'color.accent'] as TokenKey[]).map((k) => (
          <i key={k} className="flex-1" style={{ background: t[k] }} title={`${k.split('.')[1]} ${t[k]}`} />
        ))}
      </span>
    )
  if (group === 'type')
    return (
      <span className="grid gap-0.5">
        <span className="text-[34px] leading-none text-zinc-900" style={{ fontFamily: t['font.display'], fontWeight: Number(t['type.displayWeight']) || 700 }}>
          Aa
        </span>
        <span className="truncate text-[11px] text-zinc-600" style={{ fontFamily: t['font.body'] }}>
          {primaryFamily(t['font.display'])} / {primaryFamily(t['font.body'])}
        </span>
      </span>
    )
  if (group === 'shape') {
    const r = parseFloat(t['radius.base']) || 0
    const s = parseFloat(t['stroke.width']) || 1
    return <span className="block h-11 w-16 border-l-zinc-900 border-t-zinc-900" style={{ borderTopWidth: s * 2, borderLeftWidth: s * 2, borderStyle: 'solid', borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: r * 1.6 }} />
  }
  if (group === 'space') {
    const base = parseFloat(t['space.base']) || 4
    return (
      <span className="flex h-11 items-end gap-1">
        {[1, 2, 3, 4, 6, 8, 12].map((n) => (
          <i key={n} className="w-2 rounded-[2px] bg-zinc-800" style={{ height: Math.min(44, n * base * 0.9) }} />
        ))}
      </span>
    )
  }
  // Motion: the easing curve, with a dot that runs it at the real duration on hover.
  const m = t['motion.ease'].match(/cubic-bezier\(([^)]+)\)/)
  const [x1, y1, x2, y2] = m ? m[1].split(',').map(Number) : [0.2, 0.8, 0.2, 1]
  return (
    <span className="flex items-center gap-3">
      <svg viewBox="0 0 100 40" className="h-11 w-36 overflow-visible" preserveAspectRatio="none" aria-hidden>
        <path d={`M0 40 C ${x1 * 100} ${40 - y1 * 40}, ${x2 * 100} ${40 - y2 * 40}, 100 0`} fill="none" stroke="#FF69B4" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="relative h-2 flex-1 rounded-full bg-zinc-950/[0.06]">
        <span
          className="absolute left-0 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-zinc-900 transition-[left] group-hover/tile:left-[calc(100%-14px)] motion-reduce:transition-none"
          style={{ transitionDuration: t['motion.duration'], transitionTimingFunction: t['motion.ease'] }}
        />
      </span>
      <span className="font-mono text-[11px] text-zinc-500">{t['motion.duration']}</span>
    </span>
  )
}

function ContrastTile() {
  const pairs = useContrast()
  return (
    <div className="col-span-2 rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <span className="text-[12.5px] font-semibold text-zinc-900">Contrast</span>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {pairs.map((p) => (
          <span key={p.label} title={p.label} className="grid gap-1 rounded-xl p-2 text-center" style={{ background: p.bg, color: p.fg, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.06)' }}>
            <span className="text-[16px] font-bold leading-none">Aa</span>
            <span className={`mx-auto rounded-full px-1.5 font-mono text-[10.5px] font-semibold ${p.ok ? 'bg-green-500/90 text-white' : 'bg-red-500 text-white'}`}>{p.ratio ?? '?'}:1</span>
          </span>
        ))}
      </div>
    </div>
  )
}

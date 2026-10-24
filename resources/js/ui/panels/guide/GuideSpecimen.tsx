import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import type { Candidate, TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { GROUP_LABEL } from '@/core/tokens'
import { BrandColours, Candidates, Components, CopyFooter, GroupTokens, sourceOf, useContrast } from '../GuidePanel'
import { FontLinks, SourceMark, Specimen, choose, sourceName, summaryOf, useGuideData, withCandidate } from './shared'

/**
 * A · Specimen. Your style guide drawn as a page, pinned on top; every choice below
 * previews in it on hover and lands in it on click. The groups are a compact spec
 * list that opens into the knobs.
 */
export function GuideSpecimen() {
  const { tokens, open, candidates, winner } = useGuideData()
  const [hover, setHover] = useState<Candidate | null>(null)
  const shown = withCandidate(tokens, hover)
  const all = open.flatMap((g) => candidates(g))
  return (
    <div>
      <FontLinks tokens={[tokens, ...all.map((c) => withCandidate(tokens, c))]} />
      <div className="sticky top-0 z-10 border-b border-zinc-950/5 px-4 pb-3 pt-3.5 backdrop-blur-md [background:var(--header-bg)]">
        <Specimen tokens={shown} />
        <div className="mt-2 flex items-center justify-between text-[11.5px] text-zinc-500">
          <span>{hover ? `Previewing ${sourceName(hover)} · ${GROUP_LABEL[hover.group].toLowerCase()}` : 'Your style guide, as a page'}</span>
          {open.length ? <span className="font-semibold text-attention-ink">{open.length} to decide</span> : <span className="flex items-center gap-1 font-semibold text-done-ink"><Check size={12} /> No contradictions</span>}
        </div>
      </div>

      {open.length > 0 && (
        <div className="grid gap-2 px-4 pt-3">
          {open.map((g) => (
            <div key={g} className="rounded-xl bg-attention-soft/60 p-2 ring-1 ring-attention/30">
              <div className="mb-1.5 flex justify-between px-0.5 text-[11.5px] font-semibold text-attention-ink">
                <span>{GROUP_LABEL[g]}: which one?</span>
                <span className="font-medium opacity-70">Hover to preview</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {candidates(g).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setHover(c)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(c)}
                    onBlur={() => setHover(null)}
                    onClick={() => {
                      choose(c)
                      setHover(null)
                    }}
                    className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-white p-1.5 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.07)] transition-[box-shadow,scale] duration-150 active:scale-[0.97] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.18)] ${winner(g) === c.id ? 'ring-2 ring-zinc-900' : ''}`}
                  >
                    <SourceMark group={g} tokens={withCandidate(tokens, c)} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-zinc-800">{sourceName(c)}</span>
                      <span className="block truncate text-[10.5px] text-zinc-400">{summaryOf(g, withCandidate(tokens, c))}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-2 pb-2 pt-3">
        <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Spec</div>
        {TOKEN_GROUPS.map((g) => (
          <SpecRow key={g} group={g} />
        ))}
        <ContrastRow />
      </div>

      <BrandColours />
      <Components />
      <Candidates />
      <CopyFooter />
    </div>
  )
}

function SpecRow({ group }: { group: TokenGroup }) {
  const { tokens, guide, winner, candidates } = useGuideData()
  const [open, setOpen] = useState(false)
  const from = winner(group)
  const prov = guide.provenance[`${group === 'type' ? 'font.display' : group === 'shape' ? 'radius.base' : group === 'space' ? 'space.section' : group === 'motion' ? 'motion.duration' : 'color.primary'}`]
  const source = from ? sourceOf(from)?.name : prov === 'base' ? 'Default' : prov === 'custom' ? 'Custom' : (sourceOf(prov)?.name ?? 'Mixed')
  return (
    <div className="rounded-xl transition-[background-color] duration-150 hover:bg-zinc-950/[0.025]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left">
        <SourceMark group={group} tokens={tokens} size={22} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold text-zinc-900">{GROUP_LABEL[group]}</span>
            <span className="truncate text-[11px] text-zinc-400">{candidates(group).length > 1 || prov !== 'base' ? source : 'Default'}</span>
          </span>
          <span className="block truncate font-mono text-[11px] text-zinc-500">{summaryOf(group, tokens)}</span>
        </span>
        <ChevronRight size={14} className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="animate-rise px-2 pb-3 pt-1">{<GroupTokens group={group} />}</div>}
    </div>
  )
}

function ContrastRow() {
  const pairs = useContrast()
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 pt-2">
      <span className="mr-1 text-[13px] font-semibold text-zinc-900">Contrast</span>
      {pairs.map((p) => (
        <span key={p.label} title={p.label} className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 font-mono text-[11px] font-semibold ${p.ok ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-600'}`}>
          <span className="grid h-4 w-6 place-items-center rounded-full text-[9px] font-bold" style={{ background: p.bg, color: p.fg }}>
            Aa
          </span>
          {p.ratio ?? '?'}
        </span>
      ))}
    </div>
  )
}

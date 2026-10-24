import { useState } from 'react'
import { Check } from 'lucide-react'
import type { TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { GROUP_LABEL } from '@/core/tokens'
import { BrandColours, Candidates, Components, Contrast, CopyFooter, GroupDecision, GroupTokens } from '../GuidePanel'
import { FontLinks, SourceMark, Specimen, choose, sourceName, summaryOf, useGuideData, withCandidate } from './shared'

const QUESTION: Record<TokenGroup, string> = {
  color: 'Which colors?',
  type: 'Which type?',
  shape: 'Which corners and lines?',
  space: 'How roomy?',
  motion: 'How should it move?',
}

/**
 * D · Decisions first. The open choices come first, each as the page drawn both ways;
 * one click settles it. What's settled becomes a quiet "locked in" list you can reopen.
 */
export function GuideDecisions() {
  const { tokens, open, candidates, decided, winner } = useGuideData()
  // Decisions made in this sitting stay on screen with their choice until you move on.
  const [seen] = useState(() => new Set(open))
  const cards = TOKEN_GROUPS.filter((g) => seen.has(g) || open.includes(g))
  const total = cards.length
  const done = cards.filter((g) => !open.includes(g)).length
  return (
    <div>
      <FontLinks tokens={[tokens, ...cards.flatMap((g) => candidates(g).map((c) => withCandidate(tokens, c)))]} />
      <div className="flex items-center gap-3 px-4 pb-1 pt-3.5">
        {total > 0 && (
          <span className="flex gap-1" aria-hidden>
            {cards.map((g) => (
              <i key={g} className={`h-1.5 w-7 rounded-full transition-[background-color] duration-300 ${open.includes(g) ? 'bg-zinc-950/10' : 'bg-key'}`} />
            ))}
          </span>
        )}
        <span className="text-[13.5px] font-semibold text-zinc-900">
          {open.length ? `${open.length} choice${open.length > 1 ? 's' : ''} to make` : total ? 'All set: one style guide' : 'One style guide, no contradictions'}
        </span>
        {total > 0 && <span className="ml-auto font-mono text-[11px] text-zinc-400">{done}/{total}</span>}
      </div>

      {cards.map((g) => (
        <div key={g} className="mx-4 my-2.5 overflow-hidden rounded-2xl bg-[var(--lift)] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_20px_-14px_rgb(0_0_0/0.3)]">
          <div className="flex items-baseline justify-between px-3.5 pb-2 pt-3">
            <span className="text-[14px] font-semibold text-zinc-900">{QUESTION[g]}</span>
            <span className={`text-[11px] font-semibold ${open.includes(g) ? 'text-attention-ink' : 'text-done-ink'}`}>{open.includes(g) ? GROUP_LABEL[g] : `Chose ${sourceName(candidates(g).find((c) => c.id === winner(g)) ?? candidates(g)[0])}`}</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-zinc-950/[0.06]">
            {candidates(g).slice(0, 4).map((c) => {
              const on = winner(g) === c.id && !open.includes(g)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c)}
                  className={`relative grid cursor-pointer gap-2 p-2.5 text-left transition-[background-color] duration-150 ${on ? 'bg-key-soft' : 'bg-[var(--lift)] hover:bg-zinc-950/[0.02]'}`}
                >
                  <Specimen tokens={withCandidate(tokens, c)} size="sm" />
                  <span className="flex items-center justify-between gap-1.5 px-0.5">
                    <span className="truncate text-[12px] font-semibold text-zinc-800">{sourceName(c)}</span>
                    {on ? <Check size={14} className="shrink-0 text-key-ink" /> : <span className="truncate font-mono text-[10px] text-zinc-400">{summaryOf(g, withCandidate(tokens, c)).split(' · ')[0]}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="px-4 pb-2 pt-3">
        <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Locked in</div>
        {TOKEN_GROUPS.filter((g) => !cards.includes(g) || decided.includes(g)).map((g) => (
          <Locked key={g} group={g} />
        ))}
      </div>

      <Contrast />
      <BrandColours />
      <Components />
      <Candidates />
      <CopyFooter />
    </div>
  )
}

function Locked({ group }: { group: TokenGroup }) {
  const { tokens, open } = useGuideData()
  const [editing, setEditing] = useState(false)
  return (
    <div className="border-t border-zinc-950/5 first:border-t-0">
      <div className="flex items-center gap-2.5 py-2">
        <SourceMark group={group} tokens={tokens} size={20} />
        <span className="w-16 text-[12.5px] font-semibold text-zinc-900">{GROUP_LABEL[group]}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500">{summaryOf(group, tokens)}</span>
        <button type="button" onClick={() => setEditing((e) => !e)} className="shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900">
          {editing ? 'Done' : 'Change'}
        </button>
      </div>
      {editing && (
        <div className="animate-rise pb-3">
          <GroupDecision group={group} open={open.includes(group)} />
          <GroupTokens group={group} />
        </div>
      )}
    </div>
  )
}

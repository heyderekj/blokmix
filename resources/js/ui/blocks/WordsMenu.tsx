import { useState } from 'react'
import { Archive, ChevronLeft, ChevronRight, Bookmark, PenLine, Undo2 } from 'lucide-react'
import type { Slot } from '@/core/types'
import { currentWords, wordChoices, type WordChoice } from '@/core/words'
import { slotClip } from '@/data/library'
import { useStore } from '@/state/store'
import { useBlockPreview } from './preview'

const TAG: Record<WordChoice['kind'], string> = { copy: 'Your copy', source: 'Clip’s words', kept: 'Kept' }

/** A field's choices and which one shows now (-1: words you wrote that aren't kept yet). */
export function useWordChoices(slot: Slot, field: string) {
  const content = useStore((s) => s.content)
  const clip = slotClip(slot)
  const choices = wordChoices(clip, slot, content, field)
  const now = currentWords(clip, slot, content, field)
  return { choices, now, at: choices.findIndex((c) => c.text.trim() === now.trim()) }
}

/** ‹ 2/3 ›: step through a field's options right on the page. */
export function WordsCycler({ slot, field, open, onOpen }: { slot: Slot; field: string; open: boolean; onOpen: () => void }) {
  const { choices, at } = useWordChoices(slot, field)
  const n = choices.length + (at < 0 ? 1 : 0)
  if (n < 2) return null
  const step = (d: 1 | -1) => {
    const i = at < 0 ? (d > 0 ? 0 : choices.length - 1) : (at + d + choices.length) % choices.length
    useStore.getState().chooseWords(slot.id, field, choices[i].text)
  }
  return (
    <div className={`flex h-8 shrink-0 items-center rounded-[10px] transition ${open ? 'bg-zinc-900 text-white' : 'text-zinc-700'}`}>
      <button type="button" title="Previous wording ([)" onClick={() => step(-1)} className={`grid h-8 w-6 place-items-center rounded-l-[10px] transition active:scale-[0.94] ${open ? 'hover:bg-white/10' : 'hover:bg-zinc-950/5'}`}>
        <ChevronLeft size={14} />
      </button>
      <button type="button" title="Ways to say it" onClick={onOpen} className={`h-8 px-0.5 text-[12px] font-semibold tabular-nums transition ${open ? '' : 'hover:bg-zinc-950/5'}`}>
        {at < 0 ? 'New' : `${at + 1}/${choices.length}`}
      </button>
      <button type="button" title="Next wording (])" onClick={() => step(1)} className={`grid h-8 w-6 place-items-center rounded-r-[10px] transition active:scale-[0.94] ${open ? 'hover:bg-white/10' : 'hover:bg-zinc-950/5'}`}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

/**
 * Every way a field can read: your copy, the clip's own words, options you or
 * an agent kept. Hover to see one on the page, click to use it. Koati's words:
 * Keep, Retire, Put it back, "Another way to say it".
 */
export function WordsMenu({ slot, field, blockId, onClose }: { slot: Slot; field: string; blockId: string; onClose: () => void }) {
  const { choices, now, at } = useWordChoices(slot, field)
  const retired = (slot.options?.[field] ?? []).filter((o) => o.retiredAt)
  const [showRetired, setShowRetired] = useState(false)
  const st = useStore.getState
  const preview = useBlockPreview.getState()
  const hover = (text: string | null) => preview.showWords(text == null ? null : { slotId: slot.id, field, text })
  const kept = at >= 0 && choices[at].kind === 'kept'

  return (
    <div className="glass-menu w-[340px] animate-pop rounded-2xl p-1.5" onMouseLeave={() => hover(null)}>
      {at < 0 && (
        <Row text={now} tag="Now" on onPick={() => {}} action={{ icon: Bookmark, label: 'Keep', onClick: () => st().keepWords(slot.id, field, now) }} />
      )}
      {choices.map((c, i) => (
        <Row
          key={c.text}
          text={c.text}
          tag={c.option?.by === 'agent' ? 'Agent' : TAG[c.kind]}
          on={i === at}
          onHover={() => hover(c.text)}
          onPick={() => {
            hover(null)
            st().chooseWords(slot.id, field, c.text)
          }}
          action={c.kind === 'kept' ? { icon: Archive, label: 'Retire', onClick: () => st().retireWords(slot.id, field, c.text) } : undefined}
        />
      ))}
      {retired.length > 0 && (
        <div className="px-1 pt-1">
          <button type="button" onClick={() => setShowRetired(!showRetired)} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-700">
            <ChevronRight size={11} className={`transition ${showRetired ? 'rotate-90' : ''}`} /> Retired ({retired.length})
          </button>
          {showRetired &&
            retired.map((o) => (
              <Row key={o.text} text={o.text} tag="Retired" dim onPick={() => {}} action={{ icon: Undo2, label: 'Put it back', onClick: () => st().putBackWords(slot.id, field, o.text) }} />
            ))}
        </div>
      )}
      <div className="mt-1 flex gap-1 border-t border-zinc-950/6 px-1 pt-1.5">
        <button
          type="button"
          disabled={kept || !now.trim()}
          onClick={() => st().keepWords(slot.id, field, now)}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-zinc-700 transition hover:bg-zinc-950/5 disabled:opacity-40"
        >
          <Bookmark size={13} className="text-zinc-400" /> Keep as an option
        </button>
        <button
          type="button"
          onClick={() => {
            // What shows now stays as an option; whatever you write next becomes another.
            if (now.trim()) st().keepWords(slot.id, field, now)
            preview.setKeepNext({ slotId: slot.id, field })
            preview.requestEditText(blockId)
            onClose()
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-zinc-700 transition hover:bg-zinc-950/5"
        >
          <PenLine size={13} className="text-zinc-400" /> Another way to say it
        </button>
      </div>
    </div>
  )
}

function Row({
  text,
  tag,
  on,
  dim,
  onHover,
  onPick,
  action,
}: {
  text: string
  tag: string
  on?: boolean
  dim?: boolean
  onHover?: () => void
  onPick: () => void
  action?: { icon: typeof Bookmark; label: string; onClick: () => void }
}) {
  const Icon = action?.icon
  return (
    <div className={`group flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition ${on ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/[0.04]'}`} onMouseEnter={onHover}>
      <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
        <span className={`mt-[7px] size-1.5 shrink-0 rounded-full ${on ? 'bg-key' : 'bg-transparent'}`} />
        <span className={`line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-snug ${dim ? 'text-zinc-400' : 'text-zinc-800'}`}>{text}</span>
      </button>
      <span className="mt-0.5 shrink-0 text-[10.5px] font-semibold text-zinc-400">{tag}</span>
      {action && Icon && (
        <button
          type="button"
          title={action.label}
          aria-label={action.label}
          onClick={action.onClick}
          className="-my-0.5 grid size-6 shrink-0 place-items-center rounded-md text-zinc-400 opacity-0 transition hover:bg-zinc-950/5 hover:text-zinc-800 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Icon size={13} />
        </button>
      )}
    </div>
  )
}

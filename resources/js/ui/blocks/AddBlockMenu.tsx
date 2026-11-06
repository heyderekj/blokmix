import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Heading, Image as ImageIcon, Link2, MousePointerClick, Smile, Tag, Type } from 'lucide-react'
import type { BlockInfo, InsertKind, Slot } from '@/core/types'
import { addInsert, INSERT_KINDS, INSERT_LABEL } from '@/core/inserts'
import { slotClip } from '@/data/library'
import { useStore } from '@/state/store'
import { useBlockPreview } from './preview'

const ICON: Record<InsertKind, typeof Type> = {
  button: MousePointerClick,
  link: Link2,
  text: Type,
  heading: Heading,
  badge: Tag,
  image: ImageIcon,
  icon: Smile,
}

const HINT: Record<InsertKind, string> = {
  button: 'A quieter action beside the main one',
  link: 'A text link',
  text: 'A line or two of words',
  heading: 'A short heading',
  badge: 'A small label, like “New”',
  image: 'A picture you can fill',
  icon: 'A small icon',
}

/**
 * Add a blok: first, blocks of this section you hid (bring them back as they were), then new ones that go right after
 * the selected block, or after it in every item when it's inside a list's item. Pointing at a kind shows it on the
 * page; ↑ ↓ ↵ pick, Esc closes.
 */
export function AddBlockMenu({ slot, block, onClose }: { slot: Slot; block: BlockInfo; onClose: () => void }) {
  const st = useStore.getState
  const preview = useBlockPreview.getState()
  const clip = slotClip(slot)
  // Inside a list's item, a new blok goes in each item, so the list stays even.
  const item = useMemo(() => {
    for (let b: BlockInfo | undefined = block; b; b = b.parent ? clip.blocks.find((x) => x.id === b!.parent) : undefined) if (b.kind === 'item') return b
    return undefined
  }, [block, clip])
  const itemNoun = item ? (item.label.split(' · ').at(-1) ?? 'item').replace(/\s*\d+$/, '').toLowerCase() : null
  const hidden = useMemo(
    () => Object.entries(slot.edits?.[slot.clipId] ?? {}).flatMap(([id, e]) => (e.hidden ? clip.blocks.filter((b) => b.id === id) : [])),
    [slot, clip],
  )
  const options: ({ kind: 'back'; block: BlockInfo } | { kind: 'add'; add: InsertKind })[] = [...hidden.map((b) => ({ kind: 'back' as const, block: b })), ...INSERT_KINDS.map((k) => ({ kind: 'add' as const, add: k }))]
  const [at, setAt] = useState(hidden.length)
  const list = useRef<HTMLDivElement>(null)

  const show = (k: InsertKind | null) => {
    if (!k) return preview.showInserts(null)
    try {
      preview.showInserts({ slotId: slot.id, value: addInsert(slot, clip, k, block.id).slot.inserts })
    } catch {
      preview.showInserts(null)
    }
  }
  const pick = (o: (typeof options)[number]) => {
    preview.showInserts(null)
    if (o.kind === 'back') {
      st().editBlock(slot.id, o.block.id, { hidden: false })
      st().selectBlock(o.block.id)
      st().showFlash(`${name(o.block)} is back`, { undo: true })
    } else {
      const id = st().addBlock(slot.id, o.add, block.id)
      if (!id) return
      st().selectBlock(id)
      // Words go straight to typing.
      if (o.add !== 'image' && o.add !== 'icon') setTimeout(() => useBlockPreview.getState().requestEditText(id), 120)
      st().showFlash(item ? `Added a ${INSERT_LABEL[o.add].toLowerCase()} to every ${itemNoun}` : `Added a ${INSERT_LABEL[o.add].toLowerCase()}`, { undo: true })
    }
    onClose()
  }

  // ↑ ↓ ↵ while the menu is open.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setAt((i) => {
          const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
          const o = options[n]
          show(o.kind === 'add' ? o.add : null)
          return n
        })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        pick(options[at])
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })
  useEffect(() => () => useBlockPreview.getState().showInserts(null), [])

  return (
    <div ref={list} className="glass-menu w-[300px] animate-pop rounded-2xl p-1.5" role="listbox" aria-label="Add a blok" onMouseLeave={() => show(null)}>
      {hidden.length > 0 && (
        <>
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Bring back</div>
          {hidden.map((b, i) => (
            <Row key={b.id} on={at === i} icon={Eye} label={name(b)} hint="Hidden in this section" onHover={() => (setAt(i), show(null))} onPick={() => pick(options[i])} />
          ))}
          <div className="mx-2 my-1 h-px bg-zinc-950/6" />
        </>
      )}
      <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{item ? `Add to every ${itemNoun}` : 'Add after this'}</div>
      <div className="grid grid-cols-2 gap-0.5">
        {INSERT_KINDS.map((k, j) => {
          const i = hidden.length + j
          return <Row key={k} on={at === i} icon={ICON[k]} label={INSERT_LABEL[k]} hint={HINT[k]} compact onHover={() => (setAt(i), show(k))} onPick={() => pick(options[i])} />
        })}
      </div>
    </div>
  )
}

const name = (b: BlockInfo) => b.label.split(' · ').at(-1) ?? 'Block'

function Row({ on, icon: Icon, label, hint, compact, onHover, onPick }: { on: boolean; icon: typeof Type; label: string; hint: string; compact?: boolean; onHover: () => void; onPick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      title={hint}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onPick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition-[background-color,scale] active:scale-[0.97] ${compact ? 'h-9' : 'py-2'} ${on ? 'bg-zinc-950/[0.06] text-zinc-900' : 'text-zinc-700'}`}
    >
      <Icon size={15} className="shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

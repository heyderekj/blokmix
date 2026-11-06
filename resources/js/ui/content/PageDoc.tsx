import { useMemo, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Minus, Plus, Type, Wand2, X } from 'lucide-react'
import type { Slot } from '@/core/types'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { parseHtml } from '@/core/html/parse'
import { outline, type OutlineList, type OutlineNode } from '@/core/outline'
import { listContext, type SectionClip } from '@/core/lists'
import { currentWords, wordChoices } from '@/core/words'
import { fieldOwner, pageOwnership } from '@/core/ownWords'
import { roleOfField, type Role } from '@/core/jev/pour'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { runCommand } from '@/state/commands'
import { placeFromTray, setTray, trayLines } from '@/state/jevPour'
import { useTrayOpen } from '@/ui/jev/SayBar'
import { Switch } from '@/ui/panels/parts'

const WORD: Record<string, string> = {
  q: 'Question',
  a: 'Answer',
  cta: 'Button',
  ctaPrimary: 'Main button',
  ctaSecondary: 'Second button',
  ctaHeading: 'Button heading',
  ctaButton: 'Button',
  contactCta: 'Contact button',
  desc: 'Description',
  priceYearly: 'Price, yearly',
  subhead: 'Subheading',
  text: 'Text',
}

/** "priceYearly" → "Price yearly"; numbered keys read as words. */
export function wordLabel(key: string): string {
  if (WORD[key]) return WORD[key]
  const t = key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** How a field reads in the document, by the part it plays on the page: the headline big, eyebrows small. */
const LOOK: Partial<Record<Role, string>> = {
  headline: 'text-[30px] font-bold leading-[1.15] tracking-tight [text-wrap:balance]',
  heading: 'text-[22px] font-semibold leading-snug tracking-tight [text-wrap:balance]',
  eyebrow: 'text-[11.5px] font-semibold uppercase tracking-[0.08em]',
  lead: 'text-[17px] leading-relaxed',
  paragraph: 'text-[15px] leading-relaxed [text-wrap:pretty]',
  body: 'text-[14.5px] leading-relaxed [text-wrap:pretty]',
  title: 'text-[16px] font-semibold leading-snug',
  question: 'text-[16px] font-semibold leading-snug',
  answer: 'text-[14.5px] leading-relaxed',
  quote: 'text-[18px] italic leading-relaxed',
  name: 'text-[15px] font-semibold',
  role: 'text-[13px]',
  price: 'text-[20px] font-semibold tabular-nums',
  stat: 'text-[22px] font-bold tabular-nums',
  contact: 'text-[15px]',
}
const PLAIN = 'text-[14px] leading-snug'
const COMPACT: Partial<Record<Role, string>> = { headline: 'text-[22px] font-bold leading-tight tracking-tight', heading: 'text-[17px] font-semibold leading-snug', lead: 'text-[15px] leading-relaxed', quote: 'text-[15px] italic leading-relaxed', stat: 'text-[17px] font-bold', price: 'text-[16px] font-semibold' }

/**
 * Content: the page's words as a document, top to bottom, each at its size on the page. Type right into them. Words
 * that aren't yours yet (a layout's samples, the start's filler) are marked and counted; paste more and Jev places it.
 * The same words the canvas shows and the export writes to src/content/<section>.json.
 */
export function PageDoc({ compact = false, onShowSection }: { compact?: boolean; onShowSection?: (slotId: string) => void }) {
  const slots = useStore(currentSlots)
  if (!slots.length) return <p className="px-4 py-6 text-[13px] text-zinc-500">Add a section to start writing.</p>
  return (
    <div className={compact ? 'px-4 pb-4' : ''}>
      {slots.map((s, i) => (
        <SectionDoc key={s.id} slot={s} index={i} compact={compact} onShow={onShowSection} />
      ))}
      <PasteMore />
    </div>
  )
}

/** "18 of 31 are yours" for the open page. */
export function useOwnership() {
  const slots = useStore(currentSlots)
  const content = useStore((s) => s.content)
  return useMemo(() => pageOwnership(slots, slotClip, content), [slots, content])
}

export function OwnershipCount() {
  const { yours, total } = useOwnership()
  if (!total) return null
  const all = yours === total
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold tabular-nums ${all ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-950/[0.05] text-zinc-700'}`} title="Words on this page that are yours, of all it shows">
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-zinc-950/10" aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${all ? 'bg-emerald-500' : 'bg-zinc-800'}`} style={{ width: `${(yours / total) * 100}%` }} />
      </span>
      {yours} of {total} are yours
    </span>
  )
}

/** The fields a section hides (a hidden block, or one inside a hidden list item or card). */
function hiddenFields(slot: Slot, clip: SectionClip): Set<string> {
  const edits = slot.edits?.[clip.id] ?? {}
  const byId = new Map(clip.blocks.map((b) => [b.id, b]))
  const out = new Set<string>()
  for (const b of clip.blocks) {
    if (!b.field) continue
    for (let at: string | null = b.id; at; at = byId.get(at)?.parent ?? null) if (edits[at]?.hidden) out.add(b.field)
  }
  return out
}

function SectionDoc({ slot, index, compact, onShow }: { slot: Slot; index: number; compact: boolean; onShow?: (slotId: string) => void }) {
  const content = useStore((s) => s.content)
  const clip = slotClip(slot)
  const nodes = useMemo(() => outline(parseHtml(clip.html)), [clip])
  const hidden = useMemo(() => hiddenFields(slot, clip), [slot, clip])
  const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
  const st = useStore.getState
  const ctx: Ctx = { slot, clip, fields, hidden, compact }
  return (
    <section className={compact ? 'pt-5' : 'pt-10'} data-doc-section={slot.id}>
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={() => (onShow ? onShow(slot.id) : st().focusSlot(slot.id))} className="group flex shrink-0 cursor-pointer items-baseline gap-1.5 text-left" title="Show it on the page">
          <span className="text-[11px] font-semibold tabular-nums text-zinc-400">{String(index + 1).padStart(2, '0')}</span>
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500 group-hover:text-zinc-900">{TYPE_LABEL[slot.type]}</span>
        </button>
        <span className="h-px flex-1 bg-zinc-950/10" />
        {clip.origin !== 'layout' && (
          <label className="flex shrink-0 items-center gap-2 text-[11.5px] font-medium text-zinc-500">
            Words it came with
            <Switch on={slot.keep.content} onChange={() => st().toggleKeep(slot.id, 'content')} label="Use the words this section was clipped with" />
          </label>
        )}
      </div>
      {nodes.length ? <Nodes nodes={nodes} ctx={ctx} /> : <p className="text-[13px] text-zinc-400">No words in this section.</p>}
    </section>
  )
}

interface Ctx {
  slot: Slot
  clip: SectionClip
  fields: Record<string, string>
  hidden: Set<string>
  compact: boolean
}

const shows = (n: OutlineNode, ctx: Ctx): boolean => (n.t === 'field' ? !ctx.hidden.has(n.field) : n.items.some((it) => it.nodes.some((x) => shows(x, ctx))))

function Nodes({ nodes, ctx, inItem }: { nodes: OutlineNode[]; ctx: Ctx; inItem?: boolean }) {
  return (
    <div className={inItem ? 'space-y-0.5' : 'space-y-2'}>
      {nodes.filter((n) => shows(n, ctx)).map((n) =>
        n.t === 'field' ? <Field key={n.field} ctx={ctx} field={n.field} role={roleOfField(ctx.slot.type, n.field, inItem ? n.key : undefined)} label={wordLabel(n.key)} /> : <ListDoc key={n.id} list={n} ctx={ctx} />,
      )}
    </div>
  )
}

/** One field, at its size, edited in place. Filler is muted and marked; focusing it selects it so typing replaces it. */
function Field({ ctx, field, role, label }: { ctx: Ctx; field: string; role: Role | null; label: string }) {
  const content = useStore((s) => s.content)
  const { slot, clip, compact } = ctx
  const value = ctx.fields[field] ?? ''
  // While you type, the box shows what you typed (even empty), not the fallback words.
  const [draft, setDraft] = useState<string | null>(null)
  const st = useStore.getState
  const owner = fieldOwner(slot, clip, content, field)
  const mine = owner === 'yours'
  const choices = wordChoices(clip, slot, content, field)
  const now = currentWords(clip, slot, content, field)
  const at = choices.findIndex((c) => c.text.trim() === now.trim())
  const kept = choices.filter((c) => c.kind === 'kept').length
  const cycle = (d: 1 | -1) => {
    const next = choices[(Math.max(0, at) + d + choices.length) % choices.length]
    if (next) st().chooseWords(slot.id, field, next.text)
  }
  const look = (compact && role ? COMPACT[role] : undefined) ?? (role ? LOOK[role] : undefined) ?? PLAIN
  const button = role === 'button'
  return (
    <div className="group/f relative">
      <div className="flex items-start gap-2">
        <textarea
          value={draft ?? value}
          rows={1}
          spellCheck
          aria-label={`${TYPE_LABEL[slot.type]}: ${label}`}
          onFocus={(e) => !mine && e.currentTarget.select()}
          onChange={(e) => {
            setDraft(e.target.value)
            st().chooseWords(slot.id, field, e.target.value)
          }}
          onBlur={() => setDraft(null)}
          title={mine ? label : owner === 'clipped' ? `${label}: the words it was clipped with` : `${label}: sample words, not yours yet. Type over them.`}
          className={`block min-w-0 resize-none rounded-md bg-transparent px-1.5 py-0.5 outline-none transition-[background-color,box-shadow] [@media(hover:hover)]:hover:bg-zinc-950/[0.035] focus:bg-white focus:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_0_0_4px_rgb(0_0_0/0.04)] ${look} ${
            button ? 'w-auto rounded-full border border-zinc-950/15 px-3.5 py-1 text-[13.5px] font-semibold' : 'w-full'
          } ${mine ? 'text-zinc-900' : 'text-zinc-400 underline decoration-zinc-300 decoration-dashed underline-offset-[5px]'}`}
          style={{ fieldSizing: 'content', ...(button ? { maxWidth: '100%' } : {}) } as CSSProperties}
        />
        {choices.length > 1 && kept > 0 && (
          <span className="mt-1 flex shrink-0 items-center rounded-full bg-zinc-950/[0.04] text-[11px] font-semibold tabular-nums text-zinc-500">
            <button type="button" onClick={() => cycle(-1)} aria-label="Previous words" className="grid size-6 cursor-pointer place-items-center rounded-full hover:text-zinc-900">
              <ChevronLeft size={12} />
            </button>
            {Math.max(0, at) + 1}/{choices.length}
            <button type="button" onClick={() => cycle(1)} aria-label="Next words" className="grid size-6 cursor-pointer place-items-center rounded-full hover:text-zinc-900">
              <ChevronRight size={12} />
            </button>
          </span>
        )}
      </div>
      <span className="pointer-events-none absolute -top-2 right-1 flex items-center gap-1 rounded-full bg-white px-1.5 text-[10.5px] font-semibold text-zinc-400 opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] transition-opacity group-focus-within/f:opacity-100 [@media(hover:hover)]:group-hover/f:opacity-100">
        {label}
        {!mine && <span className="text-amber-700">· {owner === 'clipped' ? 'clipped words' : 'not yours yet'}</span>}
      </span>
    </div>
  )
}

function ListDoc({ list, ctx }: { list: OutlineList; ctx: Ctx }) {
  const st = useStore.getState
  const { slot, clip } = ctx
  const lc = listContext(clip, slot, list.id)
  const label = (id: string) => clip.blocks.find((b) => b.id === id)?.label.split(' · ').at(-1) ?? 'Item'
  const edit = (change: Parameters<ReturnType<typeof useStore.getState>['editList']>[1]) => st().editList(slot.id, change)
  return (
    <div className="pt-2">
      <div className="mb-1 flex items-center gap-2 px-1.5">
        <span className="text-[11px] font-semibold text-zinc-400">
          {wordLabel(list.key)} · {list.items.length}
        </span>
        <span className="flex-1" />
        {lc && (
          <button type="button" disabled={lc.count >= lc.max} onClick={() => edit({ op: 'add', listId: list.id })} className="flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[11.5px] font-semibold text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 disabled:opacity-40">
            <Plus size={12} /> {label(list.items[0]?.id ?? '')}
          </button>
        )}
      </div>
      <div className={list.items.every((it) => it.plain) ? 'flex flex-wrap gap-x-1 gap-y-0.5' : 'space-y-1'}>
        {list.items.map((it, i) => {
          const actions = lc && (
            <span className="flex items-center opacity-0 transition focus-within:opacity-100 group-hover/i:opacity-100 [@media(hover:none)]:opacity-100">
              <Mini icon={ArrowUp} label="Move earlier" disabled={i === 0} onClick={() => edit({ op: 'move', itemId: it.id, to: i - 1 })} />
              <Mini icon={ArrowDown} label="Move later" disabled={i === list.items.length - 1} onClick={() => edit({ op: 'move', itemId: it.id, to: i + 1 })} />
              <Mini icon={Copy} label="Duplicate" disabled={lc.count >= lc.max} onClick={() => edit({ op: 'duplicate', itemId: it.id })} />
              <Mini icon={Minus} label="Remove" disabled={lc.count <= 1} onClick={() => edit({ op: 'remove', itemId: it.id })} />
            </span>
          )
          if (!it.nodes.some((x) => shows(x, ctx))) return null
          return (
            <div key={it.id} className={`group/i relative flex items-start gap-1 ${it.plain ? '' : 'rounded-lg py-1 [@media(hover:hover)]:hover:bg-zinc-950/[0.02]'}`}>
              <div className="min-w-0 flex-1">
                <Nodes nodes={it.nodes} ctx={ctx} inItem />
              </div>
              {actions}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Mini({ icon: Icon, label, onClick, disabled }: { icon: typeof Plus; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid size-7 cursor-pointer place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30">
      <Icon size={13} />
    </button>
  )
}

/** Paste more of your words at the bottom of the page: Jev places each line where it belongs, word for word. */
function PasteMore() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const pour = async () => {
    if (!text.trim()) return
    setBusy(true)
    setNote(null)
    try {
      const out = (await runCommand('pour_words', { text }, 'you')) as { message: string }
      useStore.getState().showFlash(out.message, { undo: true })
      setText('')
      if (trayLines(useStore.getState()).length) useTrayOpen.setState({ open: true })
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-zinc-950/15 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={'Paste more of your words: notes, an About page, a menu…\nJev puts each line where it belongs. Nothing is reworded.'}
        className="thin-scroll block w-full resize-y bg-transparent px-1 text-[14px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400"
      />
      {note && <p className="px-1 pt-1 text-[12.5px] text-problem-ink">{note}</p>}
      <div className="flex justify-end pt-1.5">
        <button type="button" disabled={!text.trim() || busy} onClick={pour} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 text-[12.5px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-40">
          <Wand2 size={13} className={busy ? 'animate-pulse' : ''} /> {busy ? 'Placing…' : 'Place them'}
        </button>
      </div>
    </div>
  )
}

/** Words to place, as a column beside the document: each line with its two likeliest homes. */
export function TrayColumn() {
  const lines = useStore(trayLines)
  if (!lines.length) return null
  return (
    <aside className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        <Type size={12} /> To place · {lines.length}
      </p>
      {lines.map((l) => (
        <div key={l.id} className="rounded-xl bg-white p-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <div className="flex items-start gap-1.5">
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-zinc-800">{l.text}</p>
            <button type="button" onClick={() => setTray((all) => all.filter((x) => x.id !== l.id))} aria-label="Drop this line" className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700">
              <X size={12} />
            </button>
          </div>
          {l.homes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {l.homes.map((h) => (
                <button key={`${h.slotId}${h.role}`} type="button" onClick={() => placeFromTray(l, h)} className="cursor-pointer rounded-full bg-zinc-950/[0.04] px-2 py-0.5 text-[11.5px] font-medium text-zinc-700 transition hover:bg-zinc-950/[0.08] active:scale-[0.97]">
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  )
}

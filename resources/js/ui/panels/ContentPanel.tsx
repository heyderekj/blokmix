import { Switch } from './parts'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Bookmark, Copy, ImagePlus, Minus, Plus, Undo2, Archive, X } from 'lucide-react'
import { addFile, useAssets } from '@/lib/assets'
import type { Slot } from '@/core/types'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { parseHtml } from '@/core/html/parse'
import { outline, type OutlineList, type OutlineNode } from '@/core/outline'
import { listContext, type SectionClip } from '@/core/lists'
import { currentWords, wordChoices } from '@/core/words'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { PanelSection } from './parts'
import { CollectionsPanel } from './collections/CollectionsPanel'

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

/**
 * Content: every word on the page, section by section, with each field's
 * options and each list's items. The same words the canvas shows and the
 * export writes to src/content/<section>.json.
 */
export function ContentPanel() {
  const view = useStore((s) => s.ui.contentView)
  return (
    <div>
      <div className="flex px-3 pt-3" role="tablist">
        <div className="flex rounded-full bg-chip p-0.5">
          {(['words', 'collections'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => useStore.getState().setUi({ contentView: v })}
              className={`h-7 cursor-pointer rounded-full px-3 text-[12px] font-semibold transition ${view === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {v === 'words' ? 'This page' : 'Collections'}
            </button>
          ))}
        </div>
      </div>
      {view === 'words' ? <PageWords /> : <CollectionsPanel />}
    </div>
  )
}

/**
 * The name, changed everywhere it's written once you're done typing (Enter or leaving the field), so a half-typed name
 * never lands in your headlines. One undo step.
 */
function SiteName({ brand }: { brand: string }) {
  const [draft, setDraft] = useState(brand)
  useEffect(() => setDraft(brand), [brand])
  const commit = () => {
    const next = draft.trim()
    if (!next || next === brand.trim()) return setDraft(brand)
    const n = useStore.getState().setBrand(next)
    useStore.getState().showFlash(n ? `Renamed to ${next} in ${n} place${n > 1 ? 's' : ''}` : `Renamed to ${next}`, { undo: true })
  }
  return (
    <input
      value={draft}
      aria-label="Your site’s name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(brand)
      }}
      className={`${inputCls} h-8`}
    />
  )
}

/** Your logo once: it fills the nav's and footer's logo wherever they have no picture of their own. */
function SiteLogo() {
  const logo = useStore((s) => s.content.logo)
  const src = useAssets((s) => (logo?.asset ? s.assets[logo.asset]?.dataUrl : undefined))
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const take = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setError(null)
    try {
      const a = await addFile(f)
      useStore.getState().setLogo({ source: 'upload', asset: a.id, fit: 'contain', alt: useStore.getState().content.brand })
      useStore.getState().showFlash('Your logo is on the nav and footer', { undo: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-[12.5px] font-medium text-zinc-700 transition-[background-color,scale] hover:bg-zinc-950/5 active:scale-[0.97]"
      >
        {src ? <img alt="" src={src} className="h-5 max-w-16 object-contain" /> : <ImagePlus size={14} className="text-zinc-400" />}
        {busy ? 'Adding…' : logo ? 'Change logo' : 'Add your logo'}
      </button>
      {logo && (
        <button
          type="button"
          title="Take the logo away (the name shows in words)"
          aria-label="Take the logo away"
          onClick={() => useStore.getState().setLogo(null)}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-zinc-400 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]"
        >
          <X size={13} />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void take(e.target.files?.[0])} />
      {error && <p className="text-[12px] text-problem-ink">{error}</p>}
    </div>
  )
}

function PageWords() {
  const slots = useStore(currentSlots)
  const brand = useStore((s) => s.content.brand)
  if (!slots.length) return <p className="px-4 py-6 text-[12.5px] text-zinc-500">Add a section to start writing.</p>
  return (
    <div>
      <p className="px-4 pt-3.5 text-[12px] leading-relaxed text-zinc-500">Every word on the page, by section. Edit here or right on the page; the export writes these to content files your site reads.</p>
      <PanelSection title="Your site’s name">
        <SiteName brand={brand} />
        <SiteLogo />
      </PanelSection>
      {slots.map((s, i) => (
        <SectionWords key={s.id} slot={s} index={i} />
      ))}
    </div>
  )
}

function SectionWords({ slot, index }: { slot: Slot; index: number }) {
  const content = useStore((s) => s.content)
  const clip = slotClip(slot)
  const nodes = useMemo(() => outline(parseHtml(clip.html)), [clip])
  const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
  const st = useStore.getState
  return (
    <section className="border-b border-zinc-950/5 px-4 py-3.5 last:border-0">
      <button type="button" onClick={() => st().focusSlot(slot.id)} className="mb-2.5 flex items-baseline gap-1.5 text-left" title="Show this section">
        <span className="text-[11px] font-semibold tabular-nums text-zinc-400">{String(index + 1).padStart(2, '0')}</span>
        <h4 className="eyebrow hover:text-zinc-900">{TYPE_LABEL[slot.type]}</h4>
      </button>
      {clip.origin !== 'layout' && (
        <div className="mb-2.5 flex items-center justify-between gap-3 text-[12px] font-medium text-zinc-600">
          Use the words it came with
          <Switch on={slot.keep.content} onChange={() => st().toggleKeep(slot.id, 'content')} label="Use the words this section was clipped with" />
        </div>
      )}
      {nodes.length ? <Nodes nodes={nodes} slot={slot} clip={clip} fields={fields} /> : <p className="text-[12px] text-zinc-400">No words in this section.</p>}
    </section>
  )
}

function Nodes({ nodes, slot, clip, fields }: { nodes: OutlineNode[]; slot: Slot; clip: SectionClip; fields: Record<string, string> }) {
  return (
    <div className="space-y-2.5">
      {nodes.map((n) => (n.t === 'field' ? <FieldRow key={n.field} slot={slot} clip={clip} field={n.field} label={wordLabel(n.key)} value={fields[n.field] ?? ''} /> : <ListBox key={n.id} list={n} slot={slot} clip={clip} fields={fields} />))}
    </div>
  )
}

function FieldRow({ slot, clip, field, label, value, extra, onLabel }: { slot: Slot; clip: SectionClip; field: string; label: string; value: string; extra?: ReactNode; onLabel?: () => void }) {
  const content = useStore((s) => s.content)
  // While you type, the box shows what you typed (even empty), not the fallback words.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const st = useStore.getState
  const choices = wordChoices(clip, slot, content, field)
  const now = currentWords(clip, slot, content, field)
  const others = choices.filter((c) => c.text.trim() !== now.trim())
  const retired = (slot.options?.[field] ?? []).filter((o) => o.retiredAt)
  // Only options you (or an agent) kept are worth a count; your copy and the clip's words are always there.
  const keptOthers = others.filter((c) => c.kind === 'kept').length
  const kept = choices.some((c) => c.kind === 'kept' && c.text.trim() === now.trim())
  return (
    <div className="group">
      <div className="mb-0.5 flex items-center gap-1.5">
        {onLabel ? (
          <button type="button" onClick={onLabel} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900">
            {label}
          </button>
        ) : (
          <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        )}
        <span className="flex-1" />
        {extra}
        {(keptOthers > 0 || retired.length > 0) && (
          <button type="button" onClick={() => setOpen(!open)} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900">
            {keptOthers ? `${keptOthers} more way${keptOthers > 1 ? 's' : ''}` : 'Retired'}
          </button>
        )}
        {!kept && now.trim() && (
          <button type="button" title="Keep as an option" aria-label="Keep as an option" onClick={() => st().keepWords(slot.id, field, now)} className="grid size-5 place-items-center rounded text-zinc-400 opacity-0 transition hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <Bookmark size={12} />
          </button>
        )}
      </div>
      <textarea
        value={draft ?? value}
        rows={1}
        onChange={(e) => {
          setDraft(e.target.value)
          st().chooseWords(slot.id, field, e.target.value)
        }}
        onBlur={() => setDraft(null)}
        className={`${inputCls} py-1.5`}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
      {open && (
        <div className="mt-1 space-y-0.5 rounded-lg bg-zinc-950/[0.03] p-1">
          {others.map((c) => (
            <div key={c.text} className="group/o flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-white">
              <button type="button" onClick={() => st().chooseWords(slot.id, field, c.text)} className="min-w-0 flex-1 text-left text-[12px] leading-snug text-zinc-700" title="Use these words">
                {c.text}
              </button>
              <span className="shrink-0 text-[10.5px] font-semibold text-zinc-400">{c.kind === 'kept' ? (c.option?.by === 'agent' ? 'Agent' : 'Saved') : c.kind === 'copy' ? 'Your words' : clip.origin === 'layout' ? 'Placeholder' : 'Original'}</span>
              {c.kind === 'kept' && (
                <button type="button" title="Retire" aria-label="Retire" onClick={() => st().retireWords(slot.id, field, c.text)} className="text-zinc-400 hover:text-zinc-900">
                  <Archive size={12} />
                </button>
              )}
            </div>
          ))}
          {retired.map((o) => (
            <div key={o.text} className="flex items-start gap-2 rounded-md px-1.5 py-1">
              <span className="min-w-0 flex-1 text-[12px] leading-snug text-zinc-400 line-through decoration-zinc-300">{o.text}</span>
              <button type="button" onClick={() => st().putBackWords(slot.id, field, o.text)} className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900">
                <Undo2 size={11} /> Put it back
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ListBox({ list, slot, clip, fields }: { list: OutlineList; slot: Slot; clip: SectionClip; fields: Record<string, string> }) {
  const st = useStore.getState
  const ctx = listContext(clip, slot, list.id)
  const name = wordLabel(list.key)
  const label = (id: string) => clip.blocks.find((b) => b.id === id)?.label.split(' · ').at(-1) ?? 'Item'
  const show = (id: string) => {
    st().focusSlot(slot.id)
    st().selectBlock(id)
  }
  const edit = (change: Parameters<ReturnType<typeof useStore.getState>['editList']>[1]) => st().editList(slot.id, change)
  return (
    <div className="rounded-xl border border-zinc-950/8 p-2">
      <div className="mb-1.5 flex items-center gap-2 px-0.5">
        <button type="button" onClick={() => show(list.id)} className="text-[12px] font-semibold text-zinc-800 hover:underline">
          {name}
        </button>
        <span className="text-[11px] tabular-nums text-zinc-400">
          {list.items.length}
          {ctx ? ` of up to ${ctx.max}` : ''}
        </span>
        <span className="flex-1" />
        {ctx && (
          <button
            type="button"
            disabled={ctx.count >= ctx.max}
            onClick={() => edit({ op: 'add', listId: list.id })}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-semibold text-zinc-600 transition hover:bg-zinc-950/5 disabled:opacity-40"
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {list.items.map((it, i) => {
          const actions = ctx && (
            <span className="flex items-center opacity-0 transition focus-within:opacity-100 group-hover/i:opacity-100 [@media(hover:none)]:opacity-100">
              <Mini icon={ArrowUp} label="Move earlier" disabled={i === 0} onClick={() => edit({ op: 'move', itemId: it.id, to: i - 1 })} />
              <Mini icon={ArrowDown} label="Move later" disabled={i === list.items.length - 1} onClick={() => edit({ op: 'move', itemId: it.id, to: i + 1 })} />
              <Mini icon={Copy} label="Duplicate" disabled={ctx.count >= ctx.max} onClick={() => edit({ op: 'duplicate', itemId: it.id })} />
              <Mini icon={Minus} label="Remove" disabled={ctx.count <= 1} onClick={() => edit({ op: 'remove', itemId: it.id })} />
            </span>
          )
          const only = it.nodes[0]
          // One field per item (a logo, a link): one row.
          if (it.plain && only.t === 'field')
            return (
              <div key={it.id} className="group/i px-0.5">
                <FieldRow slot={slot} clip={clip} field={only.field} label={label(it.id)} value={fields[only.field] ?? ''} extra={actions} onLabel={() => show(it.id)} />
              </div>
            )
          return (
            <div key={it.id} className="group/i rounded-lg bg-zinc-950/[0.025] p-2">
              <div className="-mt-0.5 mb-1 flex h-6 items-center gap-1">
                <button type="button" onClick={() => show(it.id)} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900">
                  {label(it.id)}
                </button>
                <span className="flex-1" />
                {actions}
              </div>
              <Nodes nodes={it.nodes} slot={slot} clip={clip} fields={fields} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Mini({ icon: Icon, label, onClick, disabled }: { icon: typeof Plus; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid size-6 place-items-center rounded-md text-zinc-500 transition hover:bg-white hover:text-zinc-900 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30">
      <Icon size={12} />
    </button>
  )
}

const inputCls =
  'block w-full resize-none rounded-lg border border-zinc-950/10 bg-white px-2.5 text-[12.5px] leading-snug text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10'

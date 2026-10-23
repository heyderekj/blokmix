import { useState } from 'react'
import { AtSign, Check, ExternalLink, FileText, Hash, Phone, RotateCcw, Unlink } from 'lucide-react'
import type { BlockInfo, LinkTarget, Slot } from '@/core/types'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { describeLink, linkWords, resolveLink, sectionAnchors, suggestLink } from '@/core/links'
import { slotClip } from '@/data/library'
import { useStore } from '@/state/store'
import { Switch } from '../panels/parts'

type Tab = 'section' | 'page' | 'url' | 'email' | 'phone'

const TABS: { id: Tab; label: string; icon: typeof Hash }[] = [
  { id: 'section', label: 'Section', icon: Hash },
  { id: 'page', label: 'Page', icon: FileText },
  { id: 'url', label: 'Web', icon: ExternalLink },
  { id: 'email', label: 'Email', icon: AtSign },
  { id: 'phone', label: 'Phone', icon: Phone },
]

const PAGES = ['/about', '/pricing', '/blog', '/contact', '/careers', '/docs', '/privacy', '/terms']

/** Where a link block leads now: what was set, or what its words suggest. */
export function useLink(slot: Slot, block: BlockInfo) {
  const slots = useStore((s) => s.slots)
  const content = useStore((s) => s.content)
  const clip = slotClip(slot)
  const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
  const words = linkWords(block, clip.blocks, fields)
  const set = slot.edits?.[slot.clipId]?.[block.id]?.link
  const resolved = resolveLink(set, words, slots, slot.id, sectionAnchors(slots))
  return { set, resolved, suggestion: suggestLink(words, slots, slot.id), slots, words }
}

/** The bar's short name for a destination. */
export function LinkLabel({ slot, block }: { slot: Slot; block: BlockInfo }) {
  const { resolved, slots } = useLink(slot, block)
  if (!resolved.target || resolved.target.to === 'none') return <span className="text-zinc-400">Link</span>
  return <span className="max-w-[110px] truncate">{describeLink(resolved.target, slots).replace(/ section$/, '')}</span>
}

/**
 * Where a link or button goes: a section on this page, another page of the
 * site, a web address, an email or a phone number. Words that name a section
 * lead there by themselves ("Pricing" → the pricing section); set one to say
 * otherwise.
 */
export function LinkMenu({ slot, block }: { slot: Slot; block: BlockInfo }) {
  const { set, resolved, suggestion, slots } = useLink(slot, block)
  const current = resolved.target
  const [tab, setTab] = useState<Tab>(current && current.to !== 'none' ? current.to : 'section')
  const st = useStore.getState
  const apply = (link: LinkTarget | undefined) => st().editBlock(slot.id, block.id, { link })

  return (
    <div className="glass-menu w-[320px] animate-pop rounded-2xl p-1.5">
      <div className="flex items-center gap-2 px-2 pb-1.5 pt-1 text-[12px]">
        <span className="text-zinc-500">Goes to</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{describeLink(current, slots)}</span>
        {resolved.auto && <span className="rounded-md bg-zinc-950/[0.05] px-1.5 py-0.5 text-[10.5px] font-semibold text-zinc-500" title="From its words; set one to change it">Auto</span>}
      </div>
      <div className="mb-1.5 flex gap-0.5 rounded-xl bg-zinc-950/[0.04] p-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex h-7 flex-1 items-center justify-center gap-1 rounded-[9px] text-[11.5px] font-medium transition ${tab === t.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'section' && (
        <div className="max-h-56 overflow-y-auto thin-scroll" data-scroll-ok>
          {slots.map((s, i) => {
            const on = current?.to === 'section' && current.slotId === s.id
            const suggested = suggestion?.to === 'section' && suggestion.slotId === s.id
            return (
              <button
                key={s.id}
                type="button"
                disabled={s.id === slot.id}
                onClick={() => apply({ to: 'section', slotId: s.id })}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition disabled:opacity-35 ${on ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/[0.04]'}`}
              >
                <span className="w-5 text-[11px] tabular-nums text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 font-medium text-zinc-800">{TYPE_LABEL[s.type]}</span>
                {suggested && <span className="text-[10.5px] font-semibold text-zinc-400">Its words say so</span>}
                {s.id === slot.id && <span className="text-[10.5px] text-zinc-400">This section</span>}
                {on && <Check size={13} className="text-zinc-900" />}
              </button>
            )
          })}
        </div>
      )}
      {tab === 'page' && (
        <Field
          key="page"
          placeholder="/about"
          initial={current?.to === 'page' ? current.path : ''}
          hint="Another page of the site. The packet asks your agent to make it."
          onSave={(v) => v && apply({ to: 'page', path: v.startsWith('/') ? v : `/${v}` })}
          chips={PAGES}
        />
      )}
      {tab === 'url' && <UrlField initial={current?.to === 'url' ? current : null} onSave={(url, newTab) => url && apply({ to: 'url', url, newTab })} />}
      {tab === 'email' && <Field key="email" placeholder="hello@example.com" initial={current?.to === 'email' ? current.address : ''} hint="Opens their mail app with a new message." onSave={(v) => v && apply({ to: 'email', address: v })} />}
      {tab === 'phone' && <Field key="phone" placeholder="+1 555 010 2026" initial={current?.to === 'phone' ? current.number : ''} hint="Calls on a phone; offers to elsewhere." onSave={(v) => v && apply({ to: 'phone', number: v })} />}

      <div className="mt-1.5 flex gap-1 border-t border-zinc-950/6 px-1 pt-1.5">
        <button type="button" onClick={() => apply({ to: 'none' })} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-zinc-600 transition hover:bg-zinc-950/5">
          <Unlink size={12} className="text-zinc-400" /> No link
        </button>
        {set && (
          <button type="button" onClick={() => apply(undefined)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-zinc-600 transition hover:bg-zinc-950/5">
            <RotateCcw size={12} className="text-zinc-400" /> {suggestion ? `Back to ${describeLink(suggestion, slots)}` : 'Clear'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ placeholder, initial, hint, onSave, chips }: { placeholder: string; initial: string; hint: string; onSave: (v: string) => void; chips?: string[] }) {
  const [v, setV] = useState(initial)
  return (
    <div className="px-1 pb-1">
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave(v.trim())}
        onBlur={() => v.trim() && v.trim() !== initial && onSave(v.trim())}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-zinc-950/10 bg-white px-2.5 text-[12.5px] outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      {chips && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => (setV(c), onSave(c))} className="h-6 rounded-full bg-zinc-950/[0.04] px-2 font-mono text-[11px] text-zinc-600 transition hover:text-zinc-900 active:scale-[0.97]">
              {c}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{hint}</p>
    </div>
  )
}

function UrlField({ initial, onSave }: { initial: { url: string; newTab?: boolean } | null; onSave: (url: string, newTab: boolean) => void }) {
  const [url, setUrl] = useState(initial?.url ?? '')
  const [newTab, setNewTab] = useState(initial?.newTab !== false)
  return (
    <div className="px-1 pb-1">
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave(url.trim(), newTab)}
        onBlur={() => url.trim() && url.trim() !== initial?.url && onSave(url.trim(), newTab)}
        placeholder="https://"
        className="h-8 w-full rounded-lg border border-zinc-950/10 bg-white px-2.5 text-[12.5px] outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      <label className="mt-2 flex items-center justify-between px-0.5 text-[12px] text-zinc-600">
        Open in a new tab
        <Switch
          on={newTab}
          label="Open in a new tab"
          onChange={() => {
            setNewTab(!newTab)
            if (url.trim()) onSave(url.trim(), !newTab)
          }}
        />
      </label>
    </div>
  )
}

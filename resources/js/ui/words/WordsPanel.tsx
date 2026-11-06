import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Pencil, Type, Wand2 } from 'lucide-react'
import type { SectionType, Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { describeSections } from '@/core/jev/pageFromWords'
import { textMode } from '@/core/jev/describe'
import { actionChoices, briefContext, briefOf, FORMAT_LABEL, FORMATS, GOAL_LABEL, GOALS, INDUSTRIES, INDUSTRY_LABEL, type Goal } from '@/core/brief'
import { library, slotClip } from '@/data/library'
import { jevOn } from '@/lib/jev'
import { useStore, currentSlots } from '@/state/store'
import { useLayout } from '@/state/layout'
import { runCommand } from '@/state/commands'
import { planPage, wordsPage, type PagePlan } from '@/state/jevPage'
import { fitsFor, readsAs } from '@/state/wordsFit'
import { retypeSection } from '@/state/retype'
import { canvasApi } from '@/ui/canvas/Canvas'
import { Preview } from '@/ui/shell/Preview'
import { CollectionsPanel } from '@/ui/panels/collections/CollectionsPanel'
import { OwnershipCount, PageDoc, TrayColumn, useOwnership } from '@/ui/content/PageDoc'
import { SiteLogo, SiteName } from '@/ui/content/SiteName'

const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
const SMALL = `flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${PRESS}`
const THUMB_W = 112
const THUMB_H = 72

/**
 * Your words, beside the page: the open page's sections top to bottom, each with its words to type into, the layouts
 * that hold them, and (when suggestions are on) a note when the words read like another kind of section. Write or paste
 * more at the end, or on an empty page start here. The page follows what you're writing, and the panel follows the page.
 */
export function WordsPanel() {
  const view = useStore((s) => s.ui.contentView)
  const slots = useStore(currentSlots)
  const st = useStore.getState
  const scroller = useRef<HTMLDivElement>(null)
  const reads = useReadsAs(slots)
  useScrollSync(scroller)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-950/[0.06] px-3 py-2">
        <div className="flex rounded-full bg-zinc-950/[0.05] p-0.5" role="tablist">
          {(['words', 'collections'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => st().setUi({ contentView: v })} className={`h-7 rounded-full px-3 text-[12.5px] font-semibold ${PRESS} ${view === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}>
              {v === 'words' ? 'This page' : 'Collections'}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {view === 'words' && <NextSample />}
      </header>
      {view === 'collections' ? (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto" data-scroll-ok>
          <CollectionsPanel />
        </div>
      ) : (
        <div ref={scroller} className="thin-scroll relative min-h-0 flex-1 overflow-y-auto pb-24" data-scroll-ok data-words-scroll>
          <div className="space-y-2 px-4 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <SiteName brand={useStore((s) => s.content.brand)} className="min-w-0 rounded-md bg-transparent px-1.5 text-[14px] font-semibold text-zinc-900 outline-none [field-sizing:content] hover:bg-zinc-950/[0.04] focus:bg-zinc-950/[0.04]" />
              <SiteLogo />
            </div>
            <BriefRow />
            <OwnershipCount />
          </div>
          {slots.length ? (
            <PageDoc
              compact
              paste={false}
              onShowSection={(id) => show(id, 'top')}
              onFocusField={(slotId, field) => {
                const slot = slots.find((s) => s.id === slotId)
                const block = slot && slotClip(slot).blocks.find((b) => b.field === field)
                st().focusSlot(slotId)
                if (block) st().selectBlock(block.id)
                show(slotId, 'nearest')
              }}
              extra={(slot, at) => <SectionExtras slot={slot} at={at} reading={reads[slot.id]} />}
            />
          ) : null}
          <div className="px-4 pt-6">
            <WriteOrPaste empty={!slots.some((s) => s.type !== 'nav' && s.type !== 'footer')} />
          </div>
          <div className="px-4 pt-6">
            <TrayColumn />
          </div>
        </div>
      )}
    </div>
  )
}

/** Show a section on the page: scrolled to, in page mode, or framed. */
function show(slotId: string, how: 'top' | 'nearest') {
  suppressPanelSync()
  canvasApi.revealRow(slotId, how)
}

/** "Next" jumps to the first spot that still holds sample words, on the page and here. */
function NextSample() {
  const { yours, total } = useOwnershipLite()
  if (!total || yours === total) return null
  const go = () => {
    const el = document.querySelector<HTMLTextAreaElement>('[data-words-scroll] [data-sample]')
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.focus({ preventScroll: true })
  }
  return (
    <button type="button" onClick={go} title="The next spot that still holds sample words" className={`${SMALL} bg-zinc-900 text-white`}>
      Next <ArrowRight size={12} />
    </button>
  )
}

function useOwnershipLite() {
  const { yours, total } = useOwnership()
  return { yours, total }
}

/** What the site is for, in a line; Change opens the brief to edit (it steers suggestions and goes to your agent). */
function BriefRow() {
  const content = useStore((s) => s.content)
  const [open, setOpen] = useState(false)
  const b = briefOf(content)
  const st = useStore.getState
  const line = briefContext(content).replace(/^[^:]+:\s*/, '')
  return (
    <div className="rounded-xl bg-zinc-950/[0.035] px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-zinc-600">
          <span className="font-semibold text-zinc-800">What it’s for: </span>
          {line && line !== content.brand ? line : 'Not said yet.'}
        </span>
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className={`${SMALL} -mr-1 -mt-0.5 text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900`}>
          <Pencil size={11} /> {open ? 'Done' : 'Change'}
        </button>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 text-[12.5px]">
          <label className="grid gap-1">
            <span className="text-zinc-500">Kind of site</span>
            <select value={b.format ?? ''} onChange={(e) => st().setBrief({ format: (e.target.value || undefined) as never })} className="h-8 rounded-lg bg-white px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]">
              <option value="">Not said</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-zinc-500">Industry</span>
            <select value={b.industry ?? ''} onChange={(e) => st().setBrief({ industry: (e.target.value || undefined) as never })} className="h-8 rounded-lg bg-white px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]">
              <option value="">Not said</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {INDUSTRY_LABEL[i]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1">
            <span className="text-zinc-500">It should</span>
            <div className="flex flex-wrap gap-1">
              {GOALS.map((g) => {
                const on = !!b.goals?.includes(g)
                return (
                  <button key={g} type="button" aria-pressed={on} onClick={() => st().setBrief({ goals: on ? (b.goals ?? []).filter((x) => x !== g) : [...(b.goals ?? []), g as Goal].slice(-4) })} className={`h-7 rounded-full px-2.5 text-[12px] font-medium ${PRESS} ${on ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]'}`}>
                    {GOAL_LABEL[g]}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="grid gap-1">
            <span className="text-zinc-500">Main button</span>
            <input list="main-actions" defaultValue={b.mainAction ?? ''} onBlur={(e) => st().setBrief({ mainAction: e.target.value, mainActionTyped: true })} placeholder={actionChoices(b)[0]} className="h-8 rounded-lg bg-white px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" />
            <datalist id="main-actions">
              {actionChoices(b).map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1">
            <span className="text-zinc-500">Who it’s for</span>
            <input defaultValue={b.who ?? ''} onBlur={(e) => st().setBrief({ who: e.target.value })} placeholder="Neighbors, regulars, people passing by" className="h-8 rounded-lg bg-white px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" />
          </label>
          <p className="text-[11.5px] leading-snug text-zinc-500">Context for suggestions and your agent. It never goes on the page by itself.</p>
        </div>
      )}
    </div>
  )
}

/** Under a section's name: the layouts that hold its words, and a note when its words read like another kind. */
function SectionExtras({ slot, at, reading }: { slot: Slot; at: number; reading?: { type: SectionType; clipId: string | null } }) {
  const slots = useStore(currentSlots)
  const fit = useMemo(() => fitsFor(slots, slot.id)[0], [slots, slot.id])
  const st = useStore.getState
  const [open, setOpen] = useState(false)
  if (slot.type === 'nav' || slot.type === 'footer' || !fit) return null
  const others = fit.fits.filter((f) => !f.current)
  void at
  return (
    <div className="mb-3 space-y-2">
      {reading && <ReadsAsNote slot={slot} type={reading.type} clipId={reading.clipId} />}
      {others.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className={`${SMALL} -ml-2 text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900`}>
            <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            {fit.items.count > 1 ? `Layouts that hold your ${fit.items.count}` : 'Other layouts for these words'} · {others.length}
          </button>
          {open && (
            <div className="thin-scroll -mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-1" data-scroll-ok>
              {fit.fits.map((f) => (
                <button
                  key={f.clipId}
                  type="button"
                  onClick={() => (f.current ? null : (st().setClip(slot.id, f.clipId), show(slot.id, 'nearest')))}
                  title={library.clips[f.clipId]?.title}
                  className={`shrink-0 overflow-hidden rounded-lg ${PRESS} ${f.current ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10 hover:ring-zinc-950/30'}`}
                >
                  <Preview clip={library.clips[f.clipId]} slot={slot} width={THUMB_W} height={THUMB_H} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** "This reads like a FAQ." A click pours the section's words into a FAQ layout, as one undo step. */
function ReadsAsNote({ slot, type, clipId }: { slot: Slot; type: SectionType; clipId: string | null }) {
  const st = useStore.getState
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-900">
      <Wand2 size={13} className="shrink-0" />
      <span className="min-w-0 flex-1">These words read like {article(TYPE_LABEL[type])}.</span>
      <button
        type="button"
        onClick={() => {
          const out = retypeSection(slot.id, type, clipId ?? undefined)
          if (out) st().showFlash(`Made it ${article(TYPE_LABEL[type])}: ${out.placed} lines placed${out.waiting ? `, ${out.waiting} waiting` : ''}.`, { undo: true })
        }}
        className={`${SMALL} shrink-0 bg-amber-900 text-white`}
      >
        Make it {article(TYPE_LABEL[type])}
      </button>
    </div>
  )
}

const article = (label: string) => `${/^[aeiouAEIOU]|^FAQ/.test(label) ? 'an' : 'a'} ${label.replace(/^FAQ$/, 'FAQ')}`

/** Asked once per page a moment after the words settle; cached by the words, so typing elsewhere doesn't ask again. */
function useReadsAs(slots: Slot[]) {
  const [reads, setReads] = useState<Record<string, { type: SectionType; clipId: string | null }>>({})
  const key = useMemo(() => JSON.stringify(slots.map((s) => [s.id, s.type, s.words])), [slots])
  useEffect(() => {
    let live = true
    const t = window.setTimeout(async () => {
      if (!(await jevOn())) return
      const r = await readsAs(slots)
      if (live && r) setReads(r)
    }, 1500)
    return () => {
      live = false
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return reads
}

/**
 * Write or paste: what you bring becomes sections. "Show me sections" reads it (a page from your words) and lists what
 * it would make; then add them as a new page, replace this page, or place the lines into the sections already here.
 */
function WriteOrPaste({ empty }: { empty: boolean }) {
  const [text, setText] = useState('')
  const [plan, setPlan] = useState<PagePlan | null>(null)
  const [arrangement, setArrangement] = useState<1 | 2 | 3>(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const st = useStore.getState
  const preview = useMemo(() => (plan ? wordsPage(plan, arrangement, st().content, (i) => `preview${i}`) : null), [plan, arrangement, st])
  const run = async (what: string, name: string, input: Record<string, unknown>) => {
    setBusy(what)
    setNote(null)
    try {
      const out = (await runCommand(name, input, 'you')) as { message?: string }
      if (out?.message) st().showFlash(out.message, { undo: true })
      setText('')
      setPlan(null)
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const read = async () => {
    setBusy('read')
    setNote(null)
    const p = await planPage(text)
    setBusy(null)
    if (!p) return setNote('No answer this time. Try again, or place the lines into the sections already here.')
    setPlan(p)
  }
  const many = text.trim() && textMode(text) === 'paste'
  return (
    <div className={`rounded-2xl border border-dashed p-3 ${empty ? 'border-zinc-950/25 bg-white' : 'border-zinc-950/15'}`}>
      {empty && <p className="px-1 pb-2 text-[14px] font-semibold text-zinc-900">Start with your words</p>}
      <textarea
        value={text}
        onChange={(e) => (setText(e.target.value), setPlan(null))}
        rows={empty ? 8 : 3}
        placeholder={empty ? 'Paste what you have: an About page, a menu, your old site, notes. Each part becomes a section; nothing is reworded.' : 'Write or paste more: notes, an About page, a menu…'}
        className="thin-scroll block w-full resize-y bg-transparent px-1 text-[14px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400"
      />
      {note && <p className="px-1 pt-1 text-[12.5px] text-problem-ink">{note}</p>}
      {plan && preview && (
        <div className="mt-2 rounded-xl bg-zinc-950/[0.035] p-2.5">
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="min-w-0 flex-1 font-semibold text-zinc-800">{describeSections(preview.types)}</span>
            <span className="flex items-center gap-1 text-zinc-500">
              <button type="button" onClick={() => setArrangement((a) => (((a + 1) % 3) + 1) as 1 | 2 | 3)} className={`${SMALL} hover:bg-zinc-950/5`} aria-label="Another arrangement">
                ‹
              </button>
              {arrangement}/3
              <button type="button" onClick={() => setArrangement((a) => ((a % 3) + 1) as 1 | 2 | 3)} className={`${SMALL} hover:bg-zinc-950/5`} aria-label="Another arrangement">
                ›
              </button>
            </span>
          </div>
          <p className="pt-0.5 text-[11.5px] text-zinc-500">
            {preview.placed} lines placed{preview.tray.length ? `, ${preview.tray.length} waiting for a spot` : ''}.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {!empty && (
              <button type="button" disabled={!!busy} onClick={() => run('page', 'page_from_words', { text, into: 'new_page', arrangement })} className={`${SMALL} bg-zinc-900 text-white`}>
                <Check size={12} /> Add as a new page
              </button>
            )}
            <button type="button" disabled={!!busy} onClick={() => run('replace', 'page_from_words', { text, into: 'this_page', arrangement })} className={`${SMALL} ${empty ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-800 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]'}`}>
              {empty ? 'Make this page' : 'Replace this page'}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-1.5 pt-2">
        {!empty && text.trim() && (
          <button type="button" disabled={!!busy} onClick={() => run('pour', 'pour_words', { text })} className={`${SMALL} bg-white text-zinc-800 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]`}>
            <Type size={12} /> {busy === 'pour' ? 'Placing…' : 'Place into these sections'}
          </button>
        )}
        {(many || empty) && !plan && (
          <button type="button" disabled={!text.trim() || !!busy} onClick={read} className={`${SMALL} bg-zinc-900 text-white disabled:opacity-40`}>
            <Wand2 size={12} className={busy === 'read' ? 'animate-pulse' : ''} /> {busy === 'read' ? 'Reading…' : 'Show me sections'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---- The page and the panel follow each other ----

let quietUntil = 0
/** The panel moved the page: the page shouldn't move the panel back for a moment. */
function suppressPanelSync() {
  quietUntil = Date.now() + 900
}

function useScrollSync(scroller: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let pageQuietUntil = 0
    let t = 0
    // Scrolling the panel (by hand) brings the section at its top into view on the page.
    let byHand = false
    const hand = () => (byHand = true)
    const onScroll = () => {
      if (!byHand || Date.now() < pageQuietUntil) return
      window.clearTimeout(t)
      t = window.setTimeout(() => {
        byHand = false
        const top = el.getBoundingClientRect().top + 24
        const secs = [...el.querySelectorAll<HTMLElement>('[data-doc-section]')]
        const at = secs.find((s) => s.getBoundingClientRect().bottom > top)
        if (at) show(at.dataset.docSection!, 'top')
      }, 160)
    }
    el.addEventListener('wheel', hand, { passive: true })
    el.addEventListener('touchmove', hand, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    // The page came to rest: the panel shows the section at the reading line.
    const off = canvasApi.onSettle(() => {
      if (Date.now() < quietUntil) return
      const v = canvasApi.view()
      const line = canvasApi.screenToWorld(v.left + 1, v.top + (v.h - v.top - v.bottom) * 0.35)
      const rows = useLayout.getState().rows
      const slot = currentSlots(useStore.getState()).find((s) => {
        const r = rows[s.id]
        return r && line.y >= r.top && line.y < r.top + r.height
      })
      const sec = slot && el.querySelector<HTMLElement>(`[data-doc-section="${slot.id}"]`)
      if (!sec) return
      pageQuietUntil = Date.now() + 700
      el.scrollTo({ top: sec.offsetTop - 8, behavior: 'smooth' })
    })
    return () => {
      off()
      window.clearTimeout(t)
      el.removeEventListener('wheel', hand)
      el.removeEventListener('touchmove', hand)
      el.removeEventListener('scroll', onScroll)
    }
  }, [scroller])
}

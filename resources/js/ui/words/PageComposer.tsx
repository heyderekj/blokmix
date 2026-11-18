import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { Lock, LockOpen, Monitor, Smartphone, X } from 'lucide-react'
import { TYPE_LABEL } from '@/core/content'
import { itemCount, pageSections } from '@/core/jev/pageFromWords'
import { pageOf } from '@/core/site'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { keepPagePreview } from '@/state/commands'
import { capacity, matchPageSections, paragraphPlan, planPage, revisePageLines, wordsPage, type PageLayouts, type PagePlan } from '@/state/jevPage'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { Dropdown } from '@/ui/controls/Dropdown'

type Destination = 'new_page' | 'this_page'
interface Session {
  text: string
  into: Destination | 'choose'
  pageId: string
}
const useComposer = create<{ session: Session | null }>(() => ({ session: null }))
const close = () => useComposer.setState({ session: null })

export function openPageComposer(text = '', into: Session['into'] = 'new_page') {
  const st = useStore.getState()
  st.setUi({ sheet: 'none' })
  useComposer.setState({ session: { text, into, pageId: pageOf(st.site, st.ui.pageId).id } })
}

export function PageComposer() {
  const session = useComposer((s) => s.session)
  return session ? <Composer session={session} /> : null
}

const BUTTON = 'cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-zinc-100 disabled:cursor-default disabled:opacity-40'
const PRIMARY = 'cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-default disabled:opacity-40'

function Composer({ session }: { session: Session }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState(session.text)
  const [title, setTitle] = useState('')
  const [reading, setReading] = useState<'suggested' | 'paragraphs'>('suggested')
  const [plan, setPlan] = useState<PagePlan | null>(null)
  const [parsedText, setParsedText] = useState('')
  const [layouts, setLayouts] = useState<PageLayouts>({})
  const [trial, setTrial] = useState<string | null>(null)
  const [pick, setPick] = useState<1 | 2 | 3 | null>(null)
  const [sectionIndex, setSectionIndex] = useState<number | null>(null)
  const [phone, setPhone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [into, setInto] = useState<Destination>(session.into === 'this_page' ? 'this_page' : 'new_page')
  const site = useStore((s) => s.site)
  const content = useStore((s) => s.content)
  const guide = useStore((s) => s.guide)
  const source = site.pages.find((p) => p.id === session.pageId)
  const validText = !!text.trim() && text.length <= 20000

  useEffect(() => {
    const el = dialog.current!
    el.showModal()
    return () => el.close()
  }, [])

  const compare = async () => {
    setBusy(true)
    setError('')
    try {
      const suggested = await planPage(text)
      const next = suggested ?? paragraphPlan(text)
      if (!next.lines.length) throw new Error('Add some words to lay out.')
      setReading(suggested ? 'suggested' : 'paragraphs')
      setPlan(next)
      setParsedText(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t read the content. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const choices = useMemo(() => {
    if (!plan) return []
    return ([1, 2, 3] as const).map((arrangement) => ({
      arrangement, ...wordsPage(plan, arrangement, content, (i) => `preview-${i}`),
    }))
  }, [plan, content])
  const base = choices.find((candidate) => candidate.arrangement === pick) ?? [...choices].sort((a, b) => b.placed - a.placed)[0]
  const uniqueChoices = choices.filter((candidate) => {
    const same = choices.filter((other) => other.slots.every((s, i) => s.clipId === candidate.slots[i]?.clipId))
    return candidate === (same.find((other) => other === base) ?? same[0])
  })
  const focusIndex = sectionIndex ?? Math.max(0, base?.slots.findIndex((s) => s.type !== 'hero' && s.type !== 'header') ?? 0)
  const selectedLayouts = useMemo(() => trial ? { ...layouts, [focusIndex]: { clipId: trial, locked: true } } : layouts, [trial, focusIndex, layouts])
  const choice = useMemo(() => {
    if (!base || !plan || !Object.keys(selectedLayouts).length) return base
    return { arrangement: base.arrangement, ...wordsPage(plan, base.arrangement, content, (i) => `preview-${i}`, selectedLayouts) }
  }, [base, plan, content, selectedLayouts])
  const focused = choice?.slots[focusIndex]
  const pending = !!plan && text !== parsedText
  // Leave the last preview mounted while typing. Only the latest valid edit may replace it.
  useEffect(() => {
    if (!pending || !validText || !plan || !choice) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        let next = revisePageLines(plan, text)
        let nextReading = reading
        if (!next) {
          const suggested = reading === 'suggested' ? await planPage(text, controller.signal) : null
          next = suggested ?? paragraphPlan(text)
          nextReading = suggested ? 'suggested' : 'paragraphs'
        }
        if (controller.signal.aborted) return
        const matches = matchPageSections(plan, next)
        const preserved: Record<number, { clipId: string; locked: boolean }> = {}
        for (const [from, to] of matches) {
          const slot = choice.slots[from]
          preserved[to] = { clipId: slot.clipId, locked: slot.locked }
        }
        setPick(choice.arrangement)
        setLayouts(preserved)
        setSectionIndex(matches.get(focusIndex) ?? null)
        setReading(nextReading)
        setPlan(next)
        setParsedText(text)
      } catch {
        if (!controller.signal.aborted) setError('Couldn’t update the preview. Edit the text to try again.')
      }
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [pending, validText, plan, choice, text, reading, focusIndex])

  const chunk = plan && pageSections(plan.read)[focusIndex]?.chunk
  const { need, lead } = plan ? itemCount(chunk ?? null, plan.read) : { need: 0, lead: null }
  const currentRhythm = focused && library.clips[focused.clipId]?.rhythm
  const best = choices[0]?.slots[focusIndex]
  const bestRhythm = best && library.clips[best.clipId]?.rhythm
  const canFitMore = !!focused && !!best && !!lead && capacity(focused.clipId, lead) < need && capacity(best.clipId, lead) >= need
  const suggestLayout = best && best.clipId !== focused?.clipId && (canFitMore ||
    (focused?.type === 'features' && need > 1 && bestRhythm !== currentRhythm && (bestRhythm === 'stack' || bestRhythm === 'grid')))
  const suggestion = canFitMore ? `This layout has room for all ${need} items.` : bestRhythm === 'stack'
    ? 'Rows give longer service descriptions more room.' : `A grid lets readers scan your ${need} items side by side.`
  const tryLabel = bestRhythm === 'stack' ? 'Try rows' : bestRhythm === 'grid' ? 'Try grid' : 'Try layout'
  const preview = useMemo(() => {
    if (!choice) return null
    const page = { id: 'preview', title: title || 'From your words', path: '/preview', slots: choice.slots, show: { nav: true, footer: true } }
    return { shared: site.shared, pages: [into === 'this_page' && source ? { ...source, slots: choice.slots } : page] }
  }, [choice, site.shared, source, into, title])

  const keep = () => {
    if (!choice || !plan || pending || !validText) return
    setBusy(true)
    setError('')
    try {
      const result = keepPagePreview({ text, into, reading, page: session.pageId, arrangement: choice.arrangement, title: title.trim() || undefined }, plan, selectedLayouts)
      useStore.getState().setUi({ leftPanel: 'words', contentView: 'words' })
      useStore.getState().showFlash(result.message, { undo: true })
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save the page.')
      setBusy(false)
    }
  }

  const toggleKeep = () => {
    if (!focused) return
    setLayouts({ ...layouts, [focusIndex]: { clipId: focused.clipId, locked: !focused.locked } })
  }

  return (
    <dialog ref={dialog} aria-labelledby="composer-title" onCancel={(e) => { e.preventDefault(); if (!busy) close() }}
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[min(1060px,95vw)] max-w-none overflow-auto rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/35">
      <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
        <h2 id="composer-title" className="text-lg font-semibold">Make a page from your content</h2>
        <button type="button" aria-label="Close" disabled={busy} onClick={close} className={BUTTON}><X size={18} /></button>
      </header>
      <div className="grid md:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-3 p-5">
          {session.into === 'choose' && <div className="grid gap-1 text-sm font-semibold">
            Destination
            <Dropdown<Destination> label="Destination" value={into} disabled={busy} onChange={setInto}
              options={[{ v: 'new_page', label: 'Add a new page' }, { v: 'this_page', label: `Replace ${source?.title ?? 'this page'}` }]} />
          </div>}
          {into === 'new_page' && <label className="grid gap-1 text-sm font-semibold">Page name
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} disabled={busy} placeholder="e.g. Services" className="rounded-lg border border-zinc-200 px-3 py-2 font-normal" />
          </label>}
          <label className="grid gap-1 text-sm font-semibold">Your content
            <textarea autoFocus value={text} disabled={busy} onChange={(e) => { setText(e.target.value); setTrial(null); setError('') }}
              placeholder="Paste service descriptions, prices, or a page from your old site." rows={9}
              className="max-h-[40dvh] min-h-24 resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-relaxed font-normal" />
          </label>
          {text.length > 20000 && <p role="alert" className="text-sm text-problem-ink">Use up to 20,000 characters per page. Your full paste is still in the box.</p>}
          {!choice && <button type="button" disabled={busy || !validText} onClick={compare} className={PRIMARY}>{busy ? 'Finding layouts…' : 'Compare layouts'}</button>}
          {choice && <>
            <p aria-live="polite" className="text-sm text-zinc-600">{pending ? validText ? 'Updating preview…' : 'Edit your content to update the preview.' : `${choice.placed} of ${plan!.lines.length} lines placed.`}</p>
            {choice.tray.length > 0 && <details className="text-sm text-zinc-600">
              <summary className="cursor-pointer font-medium">{choice.tray.length} saved for later placement</summary>
              <ul className="mt-2 max-h-36 list-disc overflow-auto pl-5">{choice.tray.map((line) => <li key={line.id}>{line.text}</li>)}</ul>
            </details>}
            <button type="button" disabled={busy || pending || !validText || (into === 'this_page' && !source)} onClick={keep} className={PRIMARY}>
              {busy ? 'Saving…' : into === 'this_page' ? 'Replace this page' : 'Add this page'}
            </button>
          </>}
          {error && <p role="alert" className="text-sm text-problem-ink">{error}</p>}
        </div>
        <section aria-label="Page layouts" className="min-w-0 bg-zinc-100 p-4 md:p-5">
          {preview && choice && focused ? <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div aria-label="Arrangements" role="group" className="flex max-w-full flex-wrap gap-1 rounded-2xl bg-white p-1">{uniqueChoices.map((c) =>
                <button key={c.arrangement} type="button" disabled={busy || pending} aria-pressed={c === base} onClick={() => {
                  if (c === base) return
                  setPick(c.arrangement)
                  setTrial(null)
                  setLayouts(Object.fromEntries(Object.entries(layouts).filter(([, layout]) => layout?.locked)))
                }} className={BUTTON + ' aria-pressed:bg-zinc-900 aria-pressed:text-white'}>Layout {c.arrangement}</button>
              )}</div>
              <div role="group" aria-label="Preview width" className="flex rounded-full bg-white p-1">
                <button aria-label="Desktop" aria-pressed={!phone} onClick={() => setPhone(false)} className={BUTTON + ' aria-pressed:bg-zinc-200'}><Monitor size={16} /></button>
                <button aria-label="Phone" aria-pressed={phone} onClick={() => setPhone(true)} className={BUTTON + ' aria-pressed:bg-zinc-200'}><Smartphone size={16} /></button>
              </div>
            </div>
            <div className={`mx-auto overflow-hidden rounded-lg bg-white shadow-sm ${phone ? 'max-w-[390px]' : ''}`}>
              <SkinPreview focusSlot={focused.id} site={preview} guide={guide} content={content} title={`Layout ${choice.arrangement} preview`} scrollable viewportWidth={phone ? 390 : 1280} height={390} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600">
              Preview section
              <Dropdown label="Preview section" value={String(focusIndex)} className="max-w-full"
                disabled={pending} onChange={(value) => { setTrial(null); setSectionIndex(Number(value)) }}
                options={choice.slots.map((s, i) => ({
                  v: String(i), label: `${TYPE_LABEL[s.type]} · ${library.clips[s.clipId]?.title}${s.locked ? ' · Kept' : ''}`,
                }))} />
              <button type="button" aria-label="Keep this section" disabled={pending || !!trial} aria-pressed={focused.locked} onClick={toggleKeep}
                title={focused.locked ? 'Release this section' : 'Keep this section when trying other layouts'}
                className={BUTTON + ' inline-flex items-center gap-1.5 bg-white aria-pressed:bg-key-soft aria-pressed:text-key-ink'}>
                {focused.locked ? <Lock size={14} aria-hidden /> : <LockOpen size={14} aria-hidden />}
                {focused.locked ? 'Section kept' : 'Keep this section'}
              </button>
            </div>
            {(trial || suggestLayout) && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {trial ? <>
                <span>Previewing {library.clips[trial].title}</span>
                <button type="button" className={PRIMARY} onClick={() => { setLayouts(selectedLayouts); setTrial(null) }}>Keep layout</button>
                <button type="button" className={BUTTON} onClick={() => setTrial(null)}>Go back</button>
              </> : <>
                <span>{suggestion}</span>
                <button type="button" disabled={pending} className={BUTTON + ' bg-white'} onClick={() => setTrial(best!.clipId)}>{tryLabel}</button>
              </>}
            </div>}
            {!trial && !suggestLayout && focused.type === 'features' && need > 1 && (currentRhythm === 'stack' || currentRhythm === 'grid') && (
              <p className="mt-2 text-sm">{currentRhythm === 'stack' ? `Shows your ${need} items in rows, with room for longer descriptions.` : `Groups your ${need} items in a grid for side-by-side browsing.`}</p>
            )}
            {reading === 'paragraphs' && <p className="mt-1 text-xs text-zinc-600">Arranged using your paragraph breaks.</p>}
          </> : <div className="grid h-full min-h-24 place-items-center text-center text-sm text-zinc-500">Your layouts will appear here.</div>}
        </section>
      </div>
    </dialog>
  )
}

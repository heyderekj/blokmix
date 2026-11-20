import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { CornerDownLeft, FilePlus2, Type, Wand2, X } from 'lucide-react'
import type { SayAction } from '@/core/jev/say'
import { readLocalSay } from '@/core/jev/sayLocal'
import { checkJevServer, useJevServer } from '@/lib/jev'
import { doSay, doSayParts, hear, hearParts, previewSay, sayContext, useJevTools, type Heard } from '@/state/jevSay'
import { barSentence, fillBar, type Picks } from '@/core/jev/sentence'
import { Sentence } from './Sentence'
import { trayLines } from '@/state/jevPour'
import { useStore } from '@/state/store'

/** Whether the Say it bar has your attention (⌘K focuses it). The bar itself is always there. */
export const useSay = create<{ open: boolean }>()(() => ({ open: false }))
export const toggleSay = () => useSay.setState((s) => ({ open: !s.open }))
/** Whether Words to place is unfolded above the bar. */
export const useTrayOpen = create<{ open: boolean }>()(() => ({ open: false }))

/** At least this many lines pasted into the bar are your words to place, not something to do. */
const WORDS_LINES = 2

/**
 * Say it: always there above the Dock. Type what you want and see what it'll do before it does it (Jev picks one of
 * Blokmix's own commands and fills it from this page; Enter runs it as one undo step), or paste your words and pour them
 * into this page or make a new one. When Jev isn't sure, it offers what you might have meant.
 */
export function SayBar() {
  const open = useSay((s) => s.open)
  const sheet = useJevTools((s) => s.open === 'pour' || s.open === 'page')
  // Content lists the lines waiting for a home itself.
  const waiting = useStore((s) => (s.ui.leftPanel === 'words' ? 0 : trayLines(s).length))
  const [text, setText] = useState('')
  const [pasted, setPasted] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const applying = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const pasteSubmit = useRef<HTMLButtonElement>(null)
  const server = useJevServer((s) => s.ready)
  useEffect(checkJevServer, [])
  const box = useRef<HTMLDivElement>(null)
  const [picks, setPicks] = useState<Picks>({})
  const pageState = useStore(useShallow((s) => [s.site, s.guide, s.content, s.ui.pageId, s.ui.mode, s.contract] as const))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => sayContext(), [pageState])
  const allowed = useStore((s) => s.ui.jev !== false)
  const suggestions = allowed && server === true
  const segments = useMemo(() => barSentence(picks, ctx, suggestions), [picks, ctx, suggestions])
  const built = useMemo(() => {
    const fill = fillBar(picks, ctx, suggestions)
    return { ...previewSay(fill), text: fill.text }
  }, [picks, ctx, suggestions])
  const changePicks = (next: Picks) => {
    setError(null)
    const id = (p: Picks, key: string) => p[key]?.[0]?.id
    if (id(next, 'verb') !== id(picks, 'verb')) return setPicks({ verb: next.verb })
    if ((id(next, 'section') === 'page') !== (id(picks, 'section') === 'page')) next = { ...next, how: [] }
    if (id(next, 'section') === id(next, 'other') || ['top', 'bottom'].includes(id(next, 'where') ?? '')) next = { ...next, other: [] }
    setPicks(next)
  }

  const query = text.trim()
  const local = useMemo(() => {
    const parsed = query.length > 1 ? readLocalSay(query, ctx) : null
    return parsed ? previewSay(parsed) : null
  }, [query, ctx])
  // Two or more edits in one go ("make the hero darker and move testimonials to the top"), each read here.
  const parts = useMemo(() => (!local && query.length > 3 ? hearParts(query, ctx) : null), [local, query, ctx])
  const request = useMemo(() => open && !sheet && !pasted && suggestions && query.length > 1 && !local && !parts ? { query, ctx } : null, [open, sheet, pasted, suggestions, query, ctx, local, parts])
  const [reply, setReply] = useState<{ request: NonNullable<typeof request>; heard: Heard } | null>(null)
  const heard = local ?? (reply?.request === request ? reply.heard : null)
  const busy = !!request && reply?.request !== request

  useEffect(() => {
    if (!request) return
    const ctrl = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const heard = await hear(request.query, request.ctx, ctrl.signal)
        if (!ctrl.signal.aborted) setReply({ request, heard })
      } catch {
        if (!ctrl.signal.aborted) setReply({ request, heard: { action: null, options: [], message: 'Couldn’t read that request. Try “roomier” or “add a FAQ”.' } })
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [request])

  // The bar stays open while you work in it; a click anywhere else lets it go (unless something's typed).
  useEffect(() => {
    if (!open || query || pasted || running) return
    const down = (e: MouseEvent) => {
      if (box.current?.contains(e.target as Node)) return
      // The dock's button toggles it itself.
      if ((e.target as Element).closest?.('[data-say-toggle]')) return
      useSay.setState({ open: false })
    }
    window.addEventListener('mousedown', down)
    return () => window.removeEventListener('mousedown', down)
  }, [open, query, pasted, running])

  useEffect(() => {
    if (!open || sheet) return
    if (pasted) pasteSubmit.current?.focus()
    else input.current?.focus()
  }, [open, sheet, pasted])

  // The words sheet takes the bar's place while it's up.
  if (sheet) return null
  // Out of the way until asked for (⌘K, or its button in the dock): only lines still waiting for a home show.
  if (!open) return waiting > 0 ? <div className="pointer-events-auto flex justify-center"><TrayChip count={waiting} /></div> : null
  const clear = () => {
    setText('')
    setPasted(null)
    setError(null)
    setPicks({})
  }
  const close = () => {
    useSay.setState({ open: false })
    clear()
    input.current?.blur()
  }
  const run = async (a: SayAction, words: string) => {
    if (applying.current) return
    applying.current = true
    setRunning(true)
    setError(null)
    try {
      await doSay(a, words)
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t apply this change. Try again.')
    } finally {
      applying.current = false
      setRunning(false)
    }
  }
  const words = (mode: 'pour' | 'page') => {
    const t = pasted
    close()
    if (t) useJevTools.setState({ open: mode, text: t, auto: mode, slotId: undefined, into: undefined })
  }
  const action = heard?.action
  const options = heard?.options ?? []
  const showing = !pasted && query.length > 1
  const building = !pasted && !query
  const runBuilt = () => { if (built.action) void run(built.action, built.text) }
  const runParts = async () => {
    if (!parts || applying.current) return
    applying.current = true
    setRunning(true)
    setError(null)
    try {
      await doSayParts(parts)
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t do all of that. Try them one at a time.')
    } finally {
      applying.current = false
      setRunning(false)
    }
  }

  return (
    <div ref={box} onKeyDown={(e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      close()
    }} className="pointer-events-auto flex w-[min(560px,calc(100vw-24px))] flex-col items-stretch" data-say>
      {building && (
        <div className="glass-menu mb-1.5 animate-pop rounded-2xl p-3">
          <Sentence segments={segments} picks={picks} onPicks={changePicks} size="sm" autoOpen={false} />
          {built.action && (
            <button type="button" onClick={runBuilt} disabled={running} className="mt-2.5 flex w-full cursor-pointer items-center gap-2 rounded-xl bg-zinc-950/[0.05] px-2.5 py-2 text-left text-[12.5px] transition hover:bg-zinc-950/[0.08] active:scale-[0.99] disabled:opacity-50">
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{built.action.words}</span>
              <span className="kbd flex items-center gap-1">
                <CornerDownLeft size={11} />
              </span>
            </button>
          )}
          {built.message && <p role="status" className="mt-2 text-[12px] text-zinc-600">{built.message}</p>}
          {!picks.verb?.length && <p className="mt-2 text-[11.5px] text-zinc-600">Build an edit or type “make the page light” below.</p>}
        </div>
      )}
      {showing && parts && (
        <div className="glass-menu mb-1.5 animate-pop rounded-2xl p-1.5 text-[12.5px]">
          <ol className="grid gap-0.5 px-1 pb-1 pt-0.5">
            {parts.map((p, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-950/[0.06] text-[11px] font-semibold tabular-nums text-zinc-600">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{p.action.words}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => void runParts()} disabled={running} className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-zinc-950/[0.05] px-2.5 py-2 text-left transition hover:bg-zinc-950/[0.08] active:scale-[0.99] disabled:opacity-50">
            <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{parts.length === 2 ? 'Do both' : `Do all ${parts.length}`}, in this order</span>
            <span className="kbd flex items-center gap-1">
              <CornerDownLeft size={11} />
            </span>
          </button>
        </div>
      )}
      {showing && !parts && (
        <div className="glass-menu mb-1.5 animate-pop rounded-2xl p-1.5 text-[12.5px]">
          {action && (
            <button type="button" onClick={() => void run(action, query)} disabled={running} className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-zinc-950/[0.05] px-2.5 py-2 text-left transition hover:bg-zinc-950/[0.08] active:scale-[0.99] disabled:opacity-50">
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{action.words}</span>
              <span className="kbd flex items-center gap-1">
                <CornerDownLeft size={11} />
              </span>
            </button>
          )}
          {options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 px-1.5 pb-0.5 pt-1.5">
              <span className="text-[11.5px] text-zinc-500">{action ? 'Or' : 'Did you mean'}</span>
              {options.map((o) => (
                <button key={`${o.intent}${o.words}`} type="button" onClick={() => void run(o, query)} disabled={running} className="cursor-pointer rounded-full bg-zinc-950/[0.05] px-2.5 py-1 font-medium text-zinc-700 transition hover:bg-zinc-950/[0.09] active:scale-[0.97] disabled:opacity-50">
                  {o.words}
                </button>
              ))}
            </div>
          )}
          {!action && !options.length && <p role="status" className="px-2 py-1.5 text-zinc-600">{busy ? 'Finding an edit…' : heard?.message ?? 'Try “roomier”, “make the page dark” or “add a FAQ”.'}</p>}
        </div>
      )}
      {error && <p role="alert" className="glass-menu mb-1.5 rounded-2xl px-3 py-2 text-[12.5px] text-red-800">{error}</p>}
      <div className="flex items-center gap-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (pasted) words('pour')
            else if (parts) void runParts()
            else if (action) void run(action, query)
            else if (!query) runBuilt()
          }}
          className={`glass-menu flex min-w-0 flex-1 items-center gap-2 pr-1.5 pl-3.5 ring-2 ring-zinc-900/10 ${pasted ? 'min-h-11 flex-wrap rounded-2xl py-1.5' : 'h-11 rounded-full'}`}
        >
          <Wand2 size={15} className={`shrink-0 ${busy || running ? 'animate-pulse text-zinc-700' : 'text-zinc-400'}`} />
          {pasted ? (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700">
                <span className="font-semibold text-zinc-900">Your words</span>, {pasted.split('\n').filter((l) => l.trim()).length} lines
              </span>
              <button ref={pasteSubmit} type="submit" className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-3 text-[12.5px] font-semibold text-white transition active:scale-[0.97]">
                <Type size={13} /> Add to this page
              </button>
              <button type="button" onClick={() => words('page')} className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-950/[0.06] px-3 text-[12.5px] font-semibold text-zinc-800 transition hover:bg-zinc-950/[0.1] active:scale-[0.97]">
                <FilePlus2 size={13} /> Make a new page
              </button>
            </>
          ) : (
            <input
              ref={input}
              value={text}
              onChange={(e) => { setError(null); setText(e.target.value) }}
              onFocus={() => useSay.setState({ open: true })}
              readOnly={running}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text/plain')
                if (t.split('\n').filter((l) => l.trim()).length < WORDS_LINES) return
                e.preventDefault()
                if (!running) setPasted(t)
              }}
              placeholder="What do you want to change?"
              aria-label="What do you want to change? Or paste your text"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-500"
            />
          )}
          {!text && !pasted && <span className="kbd shrink-0 max-sm:hidden">⌘K</span>}
          {(text || pasted) && (
            <button type="button" onClick={close} aria-label="Clear" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 active:scale-[0.97]">
              <X size={14} />
            </button>
          )}
        </form>
        {waiting > 0 && <TrayChip count={waiting} />}
      </div>
    </div>
  )
}

/** Lines waiting for a home, beside the bar: a click unfolds them above it. */
function TrayChip({ count }: { count: number }) {
  const open = useTrayOpen((s) => s.open)
  return (
    <button
      type="button"
      onClick={() => useTrayOpen.setState({ open: !open })}
      aria-expanded={open}
      title="Lines of your words waiting for a home"
      className={`glass-menu flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition active:scale-[0.97] ${open ? 'text-zinc-900' : 'text-zinc-700'}`}
    >
      <Type size={13} className="text-zinc-500" />
      <span className="tabular-nums">{count}</span> not placed
    </button>
  )
}

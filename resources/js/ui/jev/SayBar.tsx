import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { CornerDownLeft, FilePlus2, Type, Wand2, X } from 'lucide-react'
import type { SayAction } from '@/core/jev/say'
import { checkJevServer, jevOn, useJevServer } from '@/lib/jev'
import { doSay, hear, useJevTools, type Heard } from '@/state/jevSay'
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
  const waiting = useStore((s) => (s.ui.sheet === 'guide' && s.ui.guideTab === 'content' ? 0 : trayLines(s).length))
  const [text, setText] = useState('')
  const [pasted, setPasted] = useState<string | null>(null)
  const [heard, setHeard] = useState<Heard | null>(null)
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // No key on this server: the bar isn't drawn at all (only lines waiting for a home, if any).
  const server = useJevServer((s) => s.ready)
  useEffect(checkJevServer, [])

  // Checked again whenever "Let Jev help" changes in the menu.
  const allowed = useStore((s) => s.ui.jev)
  useEffect(() => {
    let live = true
    jevOn().then((v) => live && setOff(!v))
    return () => {
      live = false
    }
  }, [allowed])

  // ⌘K: focus the bar (and check again whether Jev is on: the menu can turn it on or off).
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    let live = true
    jevOn().then((v) => live && setOff(!v))
    return () => {
      live = false
    }
  }, [open])

  // Ask as you type: a quarter second after the last key, and only the latest words are answered.
  useEffect(() => {
    if (off || pasted) return
    const t = text.trim()
    if (t.length < 2) {
      setHeard(null)
      setBusy(false)
      return
    }
    setBusy(true)
    const timer = window.setTimeout(() => {
      hear(t).then((h) => {
        if (h === null) return
        setHeard(h)
        setBusy(false)
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [text, off, pasted])

  // The words sheet takes the bar's place while it's up.
  if (sheet) return null
  const clear = () => {
    setText('')
    setPasted(null)
    setHeard(null)
  }
  const close = () => {
    useSay.setState({ open: false })
    clear()
    input.current?.blur()
  }
  const run = async (a: SayAction) => {
    const words = text
    close()
    await doSay(a, words)
  }
  const words = (mode: 'pour' | 'page') => {
    const t = pasted
    close()
    if (t) useJevTools.setState({ open: mode, text: t, auto: mode })
  }
  const action = heard?.action
  const options = heard?.options ?? []
  if (server === false) return waiting > 0 ? <div className="pointer-events-auto flex justify-center" data-say><TrayChip count={waiting} /></div> : null
  const showing = !off && !pasted && (action || options.length > 0 || (heard && !busy && text.trim().length > 1))

  return (
    <div className={`pointer-events-auto flex flex-col items-stretch ${off ? 'w-max max-w-[calc(100vw-24px)] self-center' : 'w-[min(560px,calc(100vw-24px))]'}`} data-say>
      {showing && (
        <div className="glass-menu mb-1.5 animate-pop rounded-2xl p-1.5 text-[12.5px]">
          {action && (
            <button type="button" onClick={() => run(action)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-zinc-950/[0.05] px-2.5 py-2 text-left transition hover:bg-zinc-950/[0.08] active:scale-[0.99]">
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{action.words}</span>
              {heard?.kept && <span className="shrink-0 text-[11px] text-zinc-500" title={heard.kept}>Your rules keep this as it is</span>}
              <span className="kbd flex items-center gap-1">
                <CornerDownLeft size={11} />
              </span>
            </button>
          )}
          {options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 px-1.5 pb-0.5 pt-1.5">
              <span className="text-[11.5px] text-zinc-500">{action ? 'Or' : 'Did you mean'}</span>
              {options.map((o) => (
                <button key={`${o.intent}${o.words}`} type="button" onClick={() => run(o)} className="cursor-pointer rounded-full bg-zinc-950/[0.05] px-2.5 py-1 font-medium text-zinc-700 transition hover:bg-zinc-950/[0.09] active:scale-[0.97]">
                  {o.words}
                </button>
              ))}
            </div>
          )}
          {!action && !options.length && <p className="px-2 py-1.5 text-zinc-500">Not sure what to do with that. Try “roomier”, “make pricing dark”, “warmer colors” or “add a FAQ”.</p>}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (pasted) words('pour')
            else if (action) void run(action)
          }}
          className={`glass-menu flex min-w-0 flex-1 items-center gap-2 rounded-full pl-3.5 transition-shadow ${off ? 'h-9 pr-4' : 'h-11 pr-1.5'} ${open || text || pasted ? 'ring-2 ring-zinc-900/10' : ''}`}
        >
          <Wand2 size={15} className={`shrink-0 ${busy ? 'animate-pulse text-zinc-700' : 'text-zinc-400'}`} />
          {off ? (
            <span className="min-w-0 truncate text-[12.5px] text-zinc-500">Suggestions are off. Turn them on in the menu.</span>
          ) : pasted ? (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700">
                <span className="font-semibold text-zinc-900">Your words</span>, {pasted.split('\n').filter((l) => l.trim()).length} lines
              </span>
              <button type="submit" className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-3 text-[12.5px] font-semibold text-white transition active:scale-[0.97]">
                <Type size={13} /> Pour into this page
              </button>
              <button type="button" onClick={() => words('page')} className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-950/[0.06] px-3 text-[12.5px] font-semibold text-zinc-800 transition hover:bg-zinc-950/[0.1] active:scale-[0.97] max-sm:hidden">
                <FilePlus2 size={13} /> Make a new page
              </button>
            </>
          ) : (
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => useSay.setState({ open: true })}
              onBlur={() => !text && useSay.setState({ open: false })}
              onKeyDown={(e) => e.key === 'Escape' && close()}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text/plain')
                if (t.split('\n').filter((l) => l.trim()).length < WORDS_LINES) return
                e.preventDefault()
                setPasted(t)
              }}
              placeholder="Ask for a change (“roomier”, “add a FAQ”) or paste your words"
              aria-label="Say what to change, or paste your words"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-500"
            />
          )}
          {!off && !text && !pasted && <span className="kbd shrink-0 max-sm:hidden">⌘K</span>}
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
      <span className="tabular-nums">{count}</span> to place
    </button>
  )
}

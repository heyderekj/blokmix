import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { CornerDownLeft, Wand2, X } from 'lucide-react'
import type { SayAction } from '@/core/jev/say'
import { jevOn } from '@/lib/jev'
import { doSay, hear, type Heard } from '@/state/jevSay'

/** Whether the Say it bar is open (⌘K). */
export const useSay = create<{ open: boolean }>()(() => ({ open: false }))
export const toggleSay = () => useSay.setState((s) => ({ open: !s.open }))

/**
 * Say it: type what you want and see what it'll do before it does it. Jev picks one of Blokmix's own commands and
 * fills it from this page; Enter runs it as one undo step. When Jev isn't sure, it offers what you might have meant.
 */
export function SayBar() {
  const open = useSay((s) => s.open)
  const [text, setText] = useState('')
  const [heard, setHeard] = useState<Heard | null>(null)
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  const input = useRef<HTMLInputElement>(null)

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
    if (!open || off) return
    const t = text.trim()
    if (t.length < 2) {
      setHeard(null)
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
  }, [text, open, off])

  if (!open) return null
  const close = () => {
    useSay.setState({ open: false })
    setText('')
    setHeard(null)
  }
  const run = async (a: SayAction) => {
    const words = text
    close()
    await doSay(a, words)
  }
  const action = heard?.action
  const options = heard?.options ?? []

  return (
    <div className="pointer-events-auto w-[min(560px,calc(100vw-24px))] animate-pop" data-say>
      {(action || options.length > 0 || (heard && !busy && text.trim().length > 1) || off) && (
        <div className="glass-menu mb-1.5 rounded-2xl p-1.5 text-[12.5px]">
          {off ? (
            <p className="px-2 py-1.5 text-zinc-500">Say it needs Jev: turn on “Let Jev help” in Blokmix’s menu (the server needs a TypeSafe key).</p>
          ) : action ? (
            <button type="button" onClick={() => run(action)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-zinc-950/[0.05] px-2.5 py-2 text-left transition hover:bg-zinc-950/[0.08] active:scale-[0.99]">
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{action.words}</span>
              {heard?.kept && <span className="shrink-0 text-[11px] text-zinc-500" title={heard.kept}>Your contract keeps this</span>}
              <span className="kbd flex items-center gap-1">
                <CornerDownLeft size={11} />
              </span>
            </button>
          ) : null}
          {!off && options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 px-1.5 pb-0.5 pt-1.5">
              <span className="text-[11.5px] text-zinc-500">{action ? 'Or' : 'Did you mean'}</span>
              {options.map((o) => (
                <button key={`${o.intent}${o.words}`} type="button" onClick={() => run(o)} className="cursor-pointer rounded-full bg-zinc-950/[0.05] px-2.5 py-1 font-medium text-zinc-700 transition hover:bg-zinc-950/[0.09] active:scale-[0.97]">
                  {o.words}
                </button>
              ))}
            </div>
          )}
          {!off && !action && !options.length && heard && !busy && <p className="px-2 py-1.5 text-zinc-500">Not sure what to do with that. Try “roomier”, “make pricing dark” or “add a FAQ”.</p>}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (action) void run(action)
        }}
        className="glass-menu flex h-11 items-center gap-2 rounded-full pl-3.5 pr-1.5"
      >
        <Wand2 size={15} className={`shrink-0 ${busy ? 'animate-pulse text-zinc-700' : 'text-zinc-400'}`} />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          placeholder="Say what to change: “roomier”, “FAQ above pricing”"
          aria-label="Say what to change"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        <button type="button" onClick={close} aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 active:scale-[0.97]">
          <X size={14} />
        </button>
      </form>
    </div>
  )
}

/** The Dock's button for Say it. */
export function SayButton() {
  const open = useSay((s) => s.open)
  return (
    <button
      type="button"
      onClick={toggleSay}
      title="Say what to change (⌘K)"
      aria-label="Say what to change"
      aria-expanded={open}
      className={`grid size-8 place-items-center rounded-full transition active:scale-[0.97] ${open ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
    >
      <Wand2 size={16} />
    </button>
  )
}

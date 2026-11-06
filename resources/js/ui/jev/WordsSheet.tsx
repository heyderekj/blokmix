import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FilePlus2, Type, Wand2, X } from 'lucide-react'
import { runCommand } from '@/state/commands'
import { useJevTools } from '@/state/jevSay'
import { useWordsTray, placeFromTray } from '@/state/jevPour'
import { useStore } from '@/state/store'

/**
 * Your words, two ways: pour them into this page (each line lands where it belongs), or make a new page from them
 * (sections chosen from what the text is). Jev reads; nothing is reworded.
 */
export function WordsSheet() {
  const open = useJevTools((s) => s.open)
  const preset = useJevTools((s) => s.text)
  const firstInto = useJevTools((s) => s.into) ?? 'new_page'
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'pour' | 'page' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [made, setMade] = useState<{ text: string; arrangement: 1 | 2 | 3 } | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const showing = open === 'pour' || open === 'page'

  useEffect(() => {
    if (!showing) return
    // Words Say it was given ("make a page from this: …") or pasted on the board come along.
    setText(preset && preset.split('\n').length > 1 ? preset : '')
    setNote(null)
    setMade(null)
    requestAnimationFrame(() => area.current?.focus())
  }, [showing, preset])

  if (!showing) return null
  const close = () => useJevTools.setState({ open: null, text: undefined, into: undefined })
  const go = async (mode: 'pour' | 'page', arrangement: 1 | 2 | 3 = 1, into: 'new_page' | 'this_page' = 'new_page') => {
    const words = mode === 'page' && made ? made.text : text
    if (!words.trim()) return
    setBusy(mode)
    setNote(null)
    try {
      const out = (await runCommand(mode === 'pour' ? 'pour_words' : 'page_from_words', mode === 'pour' ? { text: words } : { text: words, into, arrangement }, 'you')) as { message: string }
      setNote(out.message)
      useStore.getState().showFlash(out.message, { undo: true })
      if (mode === 'page') setMade({ text: words, arrangement })
      else close()
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pointer-events-auto w-[min(560px,calc(100vw-24px))] animate-pop" data-words-sheet>
      <div className="glass-menu rounded-2xl p-2">
        <div className="flex items-center gap-2 px-1.5 pb-1.5 pt-0.5">
          <Wand2 size={14} className="text-zinc-500" />
          <span className="text-[13px] font-semibold text-zinc-900">Your words</span>
          <span className="text-[11.5px] text-zinc-500">Jev (TypeSafe) reads them to decide where they go. Nothing is reworded.</span>
          <button type="button" onClick={close} aria-label="Close" className="ml-auto grid size-7 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 active:scale-[0.97]">
            <X size={14} />
          </button>
        </div>
        {made ? (
          <div className="rounded-xl bg-zinc-950/[0.04] px-3 py-2.5">
            <p className="text-[12.5px] leading-snug text-zinc-700">{note}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-600">
              Arrangement {made.arrangement} of 3
              <button type="button" disabled={!!busy || made.arrangement === 1} onClick={() => go('page', (made.arrangement - 1) as 1 | 2, 'this_page')} aria-label="Previous arrangement" className="grid size-7 cursor-pointer place-items-center rounded-full transition hover:bg-zinc-950/5 active:scale-[0.97] disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button type="button" disabled={!!busy || made.arrangement === 3} onClick={() => go('page', (made.arrangement + 1) as 2 | 3, 'this_page')} aria-label="Next arrangement" className="grid size-7 cursor-pointer place-items-center rounded-full transition hover:bg-zinc-950/5 active:scale-[0.97] disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
              <button type="button" onClick={close} className="ml-auto cursor-pointer rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-semibold text-white active:scale-[0.97]">
                Keep this one
              </button>
            </div>
          </div>
        ) : (
          <>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && close()}
              placeholder={'Paste notes, an About page, a menu, your old site’s copy…\n\nBread worth getting up for.\nOrder by 8, pick up by 10.'}
              rows={7}
              className="thin-scroll w-full resize-y rounded-xl bg-white px-3 py-2.5 text-[13px] leading-relaxed text-zinc-900 outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
            />
            {note && <p className="px-1.5 pt-1.5 text-[12px] text-problem-ink">{note}</p>}
            <div className="flex items-center gap-1.5 pt-2">
              <button
                type="button"
                disabled={!text.trim() || !!busy}
                onClick={() => go('pour')}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition active:scale-[0.97] disabled:opacity-40 ${open === 'pour' ? 'bg-zinc-900 text-white' : 'bg-zinc-950/[0.06] text-zinc-800 hover:bg-zinc-950/[0.1]'}`}
              >
                <Type size={13} className={busy === 'pour' ? 'animate-pulse' : ''} /> {busy === 'pour' ? 'Placing…' : 'Pour into this page'}
              </button>
              <button
                type="button"
                disabled={!text.trim() || !!busy}
                onClick={() => go('page', 1, firstInto)}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition active:scale-[0.97] disabled:opacity-40 ${open === 'page' ? 'bg-zinc-900 text-white' : 'bg-zinc-950/[0.06] text-zinc-800 hover:bg-zinc-950/[0.1]'}`}
              >
                <FilePlus2 size={13} className={busy === 'page' ? 'animate-pulse' : ''} /> {busy === 'page' ? 'Making the page…' : firstInto === 'this_page' ? 'Make the page' : 'Make a new page'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Lines a pour wasn't sure of, each with its two best homes. */
export function WordsTray() {
  const lines = useWordsTray((s) => s.lines)
  const [open, setOpen] = useState(true)
  if (!lines.length) return null
  const drop = (id: string) => useWordsTray.setState((s) => ({ lines: s.lines.filter((x) => x.id !== id) }))
  return (
    <div className="pointer-events-auto w-[min(440px,calc(100vw-24px))] animate-pop" data-words-tray>
      <div className="glass-menu rounded-2xl p-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-left">
          <Type size={13} className="text-zinc-500" />
          <span className="text-[12.5px] font-semibold text-zinc-900">Words to place</span>
          <span className="rounded-full bg-zinc-950/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-zinc-600">{lines.length}</span>
          <span className="ml-auto text-[11px] text-zinc-500">{open ? 'Hide' : 'Show'}</span>
        </button>
        {open && (
          <ul className="thin-scroll max-h-56 space-y-1 overflow-y-auto px-0.5 pb-0.5" data-scroll-ok>
            {lines.map((l) => (
              <li key={l.id} className="rounded-xl bg-zinc-950/[0.035] px-2.5 py-2">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-zinc-800">{l.text}</p>
                  <button type="button" onClick={() => drop(l.id)} aria-label="Drop this line" className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700">
                    <X size={12} />
                  </button>
                </div>
                {l.homes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {l.homes.map((h) => (
                      <button
                        key={`${h.slotId}${h.role}`}
                        type="button"
                        onClick={() => placeFromTray(l, h)}
                        className="cursor-pointer rounded-full bg-white px-2 py-0.5 text-[11.5px] font-medium text-zinc-700 ring-1 ring-zinc-950/10 transition hover:ring-zinc-400 active:scale-[0.97]"
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

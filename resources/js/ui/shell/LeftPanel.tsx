import { useEffect, type ReactNode } from 'react'
import { MessageSquare, SwatchBook, Type, X } from 'lucide-react'
import { openGroups } from '@/core/guide'
import { outstanding } from '@/core/notes'
import { useStore } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'
import { setInset } from '@/ui/canvas/insets'
import { GuidePanel } from '@/ui/panels/GuidePanel'
import { NotesPanel } from '@/ui/panels/NotesPanel'
import { WordsPanel } from '@/ui/words/WordsPanel'
import { useWideBar } from './TopBar'

type Which = 'words' | 'look' | 'notes'
const RAIL_X = 12
const RAIL_W = 60
const PANEL_W = 400
const GAP = 8

/** Open or close a left panel (the same one again closes it). */
export function toggleLeft(which: Which) {
  const st = useStore.getState()
  st.setUi({ leftPanel: st.ui.leftPanel === which ? 'none' : which, ...(which === 'look' ? { guideView: st.ui.guideView ?? 'look' } : {}) })
}

/**
 * The left side of the board: a slim rail (Words, Look, Notes), and the one you open beside it, docked, so the page
 * stays in view and you can keep selecting things on it. On a narrow window the panel is a sheet from the bottom.
 */
export function LeftPanel() {
  const which = useStore((s) => s.ui.leftPanel)
  const wide = useWideBar()
  const decisions = openGroups(useResolvedGuide()).length
  const todo = useStore((s) => s.notes.filter(outstanding).length)
  const open = which !== 'none'

  // The canvas fits the page into what's left beside the rail and the panel.
  useEffect(() => {
    setInset('left', wide ? RAIL_X + RAIL_W + (open ? GAP + PANEL_W : 0) + 12 : 0)
    return () => setInset('left', 0)
  }, [wide, open])

  const body = which === 'words' ? <WordsPanel /> : which === 'look' ? <Scroll><GuidePanel /></Scroll> : which === 'notes' ? <Scroll><NotesPanel /></Scroll> : null
  const close = () => useStore.getState().setUi({ leftPanel: 'none' })

  return (
    <>
      {wide && (
        <nav className="glass-menu pointer-events-auto absolute z-40 flex flex-col gap-1 rounded-2xl p-1.5" style={{ left: RAIL_X, top: 72, width: RAIL_W }} aria-label="Panels">
          <RailButton on={which === 'words'} icon={Type} label="Words" title="Your words, and the layouts that fit them (W)" onClick={() => toggleLeft('words')} />
          <RailButton on={which === 'look'} icon={SwatchBook} label="Look" title={decisions ? `Look: ${decisions} to decide (G)` : 'Look: themes, feel and the style guide (G)'} onClick={() => toggleLeft('look')} dot={decisions > 0} />
          <RailButton on={which === 'notes'} icon={MessageSquare} label="Notes" title={todo ? `${todo} note${todo > 1 ? 's' : ''} to do` : 'Notes'} onClick={() => toggleLeft('notes')} count={todo} />
        </nav>
      )}
      {open &&
        (wide ? (
          <aside
            className="glass-menu pointer-events-auto absolute z-30 flex animate-pop flex-col overflow-hidden rounded-2xl"
            style={{ left: RAIL_X + RAIL_W + GAP, top: 72, bottom: 12, width: PANEL_W }}
            aria-label={LABEL[which]}
            data-left-panel
          >
            <PanelHead title={LABEL[which]} onClose={close} />
            <div className="min-h-0 flex-1">{body}</div>
          </aside>
        ) : (
          <aside className="glass-menu pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex h-[62vh] animate-pop flex-col overflow-hidden rounded-t-2xl" aria-label={LABEL[which]} data-left-panel>
            <PanelHead title={LABEL[which]} onClose={close} />
            <div className="min-h-0 flex-1">{body}</div>
          </aside>
        ))}
    </>
  )
}

const LABEL: Record<Which, string> = { words: 'Words', look: 'Look', notes: 'Notes' }

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-1 pt-3">
      <h2 className="flex-1 text-[14px] font-semibold text-zinc-900">{title}</h2>
      <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]">
        <X size={16} />
      </button>
    </div>
  )
}

function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="thin-scroll h-full overflow-y-auto" data-scroll-ok>
      {children}
    </div>
  )
}

function RailButton({ on, icon: Icon, label, title, onClick, dot, count }: { on: boolean; icon: typeof Type; label: string; title: string; onClick: () => void; dot?: boolean; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`relative flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${on ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
    >
      <Icon size={18} />
      {label}
      {dot && !count && <span className="absolute right-2 top-2 size-2 rounded-full bg-attention" aria-hidden />}
      {!!count && <span className={`absolute right-1 top-1 min-w-4 rounded-full px-1 text-[10px] font-bold tabular-nums ${on ? 'bg-white/20 text-white' : 'bg-problem text-white'}`}>{count}</span>}
    </button>
  )
}

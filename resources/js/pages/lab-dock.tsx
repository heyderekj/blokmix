import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Dices, Hand, Library, Maximize, Minus, Monitor, MousePointer2, Plus, Smartphone, StickyNote } from 'lucide-react'
import { useStore } from '@/state/store'
import { Avatar } from '@/ui/shell/Avatar'
import { useMe } from '@/lib/people'

/**
 * Design exploration: the dock. Today one bar holds canvas tools, mixing
 * actions, and view settings (device, zoom, fit, presence). Open with ?lab=dock.
 */
export default function LabDock() {
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const variants: { letter: string; name: string; notes: string; V: () => ReactNode }[] = [
    { letter: 'A', name: 'Figma corners', notes: 'Split by job, like Figma: tools bottom-left, the two mixing actions centred, zoom and device bottom-right as a small “60%” menu. Presence moves up next to Export.', V: VariantA },
    { letter: 'B', name: 'One quiet bar', notes: 'Still one bar, but icon-only with tooltips, and all view settings folded into the zoom readout. About half the width.', V: VariantB },
    { letter: 'C', name: 'Tool switcher', notes: 'The three tools collapse into one button showing the current tool, with a menu. Shuffle and Clips keep labels; view settings sit behind “View”.', V: VariantC },
    { letter: 'D', name: 'Tape deck', notes: 'Mixtape’s own: a transport for mixing. Previous / Shuffle / Next for the focused track, with Clips beside it. Tools and view sit quietly in the corners.', V: VariantD },
  ]
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <div className="mx-auto max-w-[1240px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">The dock: four directions</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">Same controls, less noise. Each is shown at the bottom of a canvas; the menus open on click.</p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          {variants.map(({ letter, name, notes, V }) => (
            <section key={letter} className="rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{letter}</span>
                <h2 className="text-[15px] font-semibold text-zinc-900">{name}</h2>
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-zinc-500">{notes}</p>
              <Stage>
                <V />
              </Stage>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[230px] overflow-hidden rounded-xl" style={{ background: 'var(--canvas-bg)' }}>
      <div className="absolute inset-x-16 top-4 bottom-0 rounded-t-[10px] bg-[#f3eadb] shadow-[0_20px_50px_-20px_rgb(0_0_0/0.3)]">
        <div className="grid grid-cols-3 gap-2 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-[#e8dcc6]" />
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

/* ---------- shared bits ---------- */

const bar = 'glass-panel pointer-events-auto flex h-11 items-center gap-0.5 rounded-2xl px-1'

function Tool({ icon: Icon, active, label, onClick }: { icon: typeof Hand; active?: boolean; label: string; onClick?: () => void }) {
  return (
    <button type="button" title={label} onClick={onClick} className={`grid size-8 place-items-center rounded-full transition ${active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}>
      <Icon size={16} />
    </button>
  )
}

function TextBtn({ icon: Icon, children, onClick }: { icon?: typeof Hand; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-950/5">
      {Icon && <Icon size={15} />}
      {children}
    </button>
  )
}

function Popover({ children, align = 'right' }: { children: ReactNode; align?: 'left' | 'right' | 'center' }) {
  const pos = align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'
  return <div className={`glass-menu absolute bottom-full z-10 mb-2 w-52 rounded-2xl p-1.5 ${pos}`}>{children}</div>
}

function MenuRow({ icon: Icon, label, kbd }: { icon: typeof Hand; label: string; kbd?: string }) {
  return (
    <div className="flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] text-zinc-700 hover:bg-zinc-950/5">
      <Icon size={15} className="text-zinc-500" />
      <span className="flex-1">{label}</span>
      {kbd && <span className="kbd">{kbd}</span>}
    </div>
  )
}

function ViewMenu() {
  const [device, setDevice] = useState<'d' | 'm'>('d')
  return (
    <>
      <div className="mb-1 flex gap-1 rounded-lg bg-well p-0.5">
        {(['d', 'm'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setDevice(k)} className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium ${device === k ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
            {k === 'd' ? <Monitor size={13} /> : <Smartphone size={13} />}
            {k === 'd' ? 'Desktop' : 'Mobile'}
          </button>
        ))}
      </div>
      <MenuRow icon={Plus} label="Zoom in" kbd="+" />
      <MenuRow icon={Minus} label="Zoom out" kbd="−" />
      <MenuRow icon={Maximize} label="Fit everything" kbd="⇧1" />
    </>
  )
}

/* ---------- A. Figma corners ---------- */

function VariantA() {
  const [tool, setTool] = useState(0)
  const [zoom, setZoom] = useState(false)
  const me = useMe()
  return (
    <>
      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          <Avatar who={me} size={26} />
        </div>
        <span className="glass-panel pointer-events-auto flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-medium text-zinc-700">Export</span>
      </div>
      <div className="absolute bottom-3 left-3">
        <div className={bar}>
          {[MousePointer2, Hand, StickyNote].map((I, i) => (
            <Tool key={i} icon={I} active={tool === i} label="Tool" onClick={() => setTool(i)} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className={bar}>
          <TextBtn icon={Dices}>Shuffle</TextBtn>
          <TextBtn icon={Library}>Clips</TextBtn>
        </div>
      </div>
      <div className="absolute bottom-3 right-3">
        <div className="relative">
          {zoom && (
            <Popover>
              <ViewMenu />
            </Popover>
          )}
          <button type="button" onClick={() => setZoom((z) => !z)} className={`${bar} px-3 text-[13px] font-medium tabular-nums text-zinc-700`}>
            60% <ChevronDown size={14} className="text-zinc-400" />
          </button>
        </div>
      </div>
    </>
  )
}

/* ---------- B. One quiet bar ---------- */

function VariantB() {
  const [tool, setTool] = useState(0)
  const [zoom, setZoom] = useState(false)
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
      <div className="relative">
        {zoom && (
          <Popover>
            <ViewMenu />
          </Popover>
        )}
        <div className={bar}>
          {[MousePointer2, Hand, StickyNote].map((I, i) => (
            <Tool key={i} icon={I} active={tool === i} label="Tool" onClick={() => setTool(i)} />
          ))}
          <span className="mx-1 h-5 w-px bg-zinc-950/10" />
          <Tool icon={Dices} label="Shuffle (Space)" />
          <Tool icon={Library} label="Clips (C)" />
          <span className="mx-1 h-5 w-px bg-zinc-950/10" />
          <button type="button" onClick={() => setZoom((z) => !z)} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium tabular-nums text-zinc-600 hover:bg-zinc-950/5">
            60% <ChevronDown size={13} className="text-zinc-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- C. Tool switcher ---------- */

function VariantC() {
  const tools = [
    { icon: MousePointer2, label: 'Select', k: 'V' },
    { icon: Hand, label: 'Hand', k: 'H' },
    { icon: StickyNote, label: 'Sticky note', k: 'S' },
  ]
  const [tool, setTool] = useState(0)
  const [menu, setMenu] = useState<'tool' | 'view' | null>(null)
  const T = tools[tool].icon
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
      <div className="relative">
        {menu === 'tool' && (
          <Popover align="left">
            {tools.map((t, i) => (
              <button key={t.label} type="button" onClick={() => (setTool(i), setMenu(null))} className="w-full text-left">
                <MenuRow icon={t.icon} label={t.label} kbd={t.k} />
              </button>
            ))}
          </Popover>
        )}
        {menu === 'view' && (
          <Popover>
            <ViewMenu />
          </Popover>
        )}
        <div className={bar}>
          <button type="button" onClick={() => setMenu(menu === 'tool' ? null : 'tool')} className="flex h-8 items-center gap-0.5 rounded-full bg-zinc-900 pl-2 pr-1.5 text-white">
            <T size={15} />
            <ChevronDown size={12} className="opacity-70" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-950/10" />
          <TextBtn icon={Dices}>Shuffle</TextBtn>
          <TextBtn icon={Library}>Clips</TextBtn>
          <span className="mx-1 h-5 w-px bg-zinc-950/10" />
          <button type="button" onClick={() => setMenu(menu === 'view' ? null : 'view')} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-950/5">
            View <span className="tabular-nums text-zinc-400">60%</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- D. Tape deck ---------- */

function VariantD() {
  const [tool, setTool] = useState(0)
  const [zoom, setZoom] = useState(false)
  return (
    <>
      <div className="absolute bottom-3 left-3">
        <div className={bar}>
          {[MousePointer2, Hand, StickyNote].map((I, i) => (
            <Tool key={i} icon={I} active={tool === i} label="Tool" onClick={() => setTool(i)} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className="glass-panel pointer-events-auto flex h-12 items-center gap-1 rounded-full px-1.5">
          <button type="button" title="Previous clip (←)" className="grid size-9 place-items-center rounded-full text-zinc-600 hover:bg-zinc-950/5">
            <ChevronLeft size={18} />
          </button>
          <button type="button" title="Shuffle (Space)" className="btn-lit flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
            <Dices size={16} /> Shuffle
          </button>
          <button type="button" title="Next clip (→)" className="grid size-9 place-items-center rounded-full text-zinc-600 hover:bg-zinc-950/5">
            <ChevronRight size={18} />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-950/10" />
          <TextBtn icon={Library}>Clips</TextBtn>
        </div>
      </div>
      <div className="absolute bottom-3 right-3">
        <div className="relative">
          {zoom && (
            <Popover>
              <ViewMenu />
            </Popover>
          )}
          <button type="button" onClick={() => setZoom((z) => !z)} className={`${bar} px-3 text-[13px] font-medium tabular-nums text-zinc-700`}>
            60% <ChevronDown size={14} className="text-zinc-400" />
          </button>
        </div>
      </div>
    </>
  )
}

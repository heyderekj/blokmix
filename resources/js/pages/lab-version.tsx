import type { ReactNode } from 'react'
import { Bot, MoreHorizontal } from 'lucide-react'
import type { Status, VersionNode } from '@/core/types'
import { STATUSES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { STATUS_META } from '@/ui/frames/status'

/**
 * Design exploration: the version header. Status has to read at a glance; the
 * tracks should say what's in the mix, not just how many. Open with ?lab=version.
 */
export default function LabVersion() {
  const v = useStore((s) => Object.values(s.versions).sort((a, b) => a.createdAt - b.createdAt)[0])
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  if (!v) return null
  const variants: { letter: string; name: string; notes: string; Header: (p: { v: VersionNode; status: Status }) => ReactNode }[] = [
    {
      letter: 'A',
      name: 'Neutral bar, status tag, track strip',
      notes: 'The header stays white whatever the status. Status is a soft tag with a dot. The tracks become a strip of six tiles, each in its source’s colour.',
      Header: HeaderA,
    },
    {
      letter: 'B',
      name: 'Status spine',
      notes: 'A coloured spine down the left edge carries status, so it reads from far away without washing the whole bar. The tracks are a stack of source avatars.',
      Header: HeaderB,
    },
    {
      letter: 'C',
      name: 'Status ring on the letter',
      notes: 'The letter tile wears the status as a ring: dashed while in progress, solid once ready, with a small badge for changes or approval. A mini page shows the track order.',
      Header: HeaderC,
    },
    {
      letter: 'D',
      name: 'Stamp',
      notes: 'Like a label on a tape: status is a stamped word at the right, beside the action. The mix is spelled out as sources with dots, so you can read it.',
      Header: HeaderD,
    },
  ]
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Version header: four directions</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Each direction is shown in all five statuses, so you can judge how quickly status reads. Uses version {v.letter}’s real tracks.
        </p>
        <div className="mt-8 space-y-6">
          {variants.map(({ letter, name, notes, Header }) => (
            <section key={letter} className="rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{letter}</span>
                <h2 className="text-[15px] font-semibold text-zinc-900">{name}</h2>
              </div>
              <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-zinc-500">{notes}</p>
              <div className="space-y-2.5">
                {STATUSES.map((st) => (
                  <Header key={st} v={v} status={st} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- shared ---------- */

function tracksOf(v: VersionNode) {
  return v.snapshot.slots
    .map((s) => {
      const clip = library.clips[s.clipId]
      if (!clip) return null
      const source = library.sources[clip.sourceId]
      return { type: s.type, source: source.name.split(' ')[0], color: clip.tokens['color.primary'], bg: clip.tokens['color.bg'], ink: clip.tokens['color.onPrimary'] }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
}

function sourcesOf(v: VersionNode) {
  const seen = new Map<string, { name: string; color: string; bg: string; ink: string; count: number }>()
  for (const t of tracksOf(v)) {
    const s = seen.get(t.source)
    if (s) s.count++
    else seen.set(t.source, { name: t.source, color: t.color, bg: t.bg, ink: t.ink, count: 1 })
  }
  return [...seen.values()]
}

function Build() {
  return (
    <button type="button" className="btn-quiet flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold">
      <Bot size={14} /> Build
    </button>
  )
}

function More() {
  return (
    <button type="button" className="grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-950/5" aria-label="More">
      <MoreHorizontal size={16} />
    </button>
  )
}

const SOFT: Record<Status, { bg: string; ink: string }> = {
  'in-progress': { bg: 'var(--well)', ink: 'var(--n-700)' },
  ready: { bg: 'var(--attention-soft)', ink: 'var(--attention-ink)' },
  changes: { bg: 'var(--problem-soft)', ink: 'var(--problem-ink)' },
  approved: { bg: 'var(--done-soft)', ink: 'var(--done-ink)' },
  archived: { bg: 'var(--well)', ink: 'var(--n-500)' },
}

/* ---------- A. Neutral bar, status tag, track strip ---------- */

function HeaderA({ v, status }: { v: VersionNode; status: Status }) {
  const m = STATUS_META[status]
  const tracks = tracksOf(v)
  return (
    <div className="glass-panel flex min-h-14 items-center gap-3 rounded-2xl py-2 pl-2 pr-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-[14px] font-bold text-white">{v.letter}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-zinc-900">{v.title}</span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: SOFT[status].bg, color: SOFT[status].ink }}>
            <m.icon size={12} strokeWidth={2.4} />
            {m.label}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-0.5">
          {tracks.map((t, i) => (
            <span key={i} title={`${TYPE_LABEL[t.type]} · ${t.source}`} className="h-2 w-6 rounded-full ring-1 ring-zinc-950/10" style={{ background: t.color }} />
          ))}
          <span className="ml-1.5 text-[11.5px] text-zinc-500">{tracks.length} tracks</span>
        </div>
      </div>
      <Build />
      <More />
    </div>
  )
}

/* ---------- B. Status spine ---------- */

function HeaderB({ v, status }: { v: VersionNode; status: Status }) {
  const m = STATUS_META[status]
  const sources = sourcesOf(v)
  return (
    <div className="glass-panel relative flex min-h-14 items-center gap-3 overflow-hidden rounded-2xl py-2 pl-4 pr-2">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: m.color }} />
      <span className="text-[22px] font-bold leading-none tabular-nums text-zinc-900">{v.letter}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-zinc-900">{v.title}</div>
        <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: SOFT[status].ink }}>
          <m.icon size={12} strokeWidth={2.4} style={{ color: m.color }} />
          {m.label}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {sources.map((s) => (
            <span
              key={s.name}
              title={`${s.name}: ${s.count} track${s.count > 1 ? 's' : ''}`}
              className="grid size-7 place-items-center rounded-full text-[10.5px] font-bold ring-2 ring-[var(--lift)]"
              style={{ background: s.color, color: s.ink }}
            >
              {s.name[0]}
            </span>
          ))}
        </div>
        <span className="text-[12px] tabular-nums text-zinc-500">{v.snapshot.slots.length}</span>
      </div>
      <Build />
      <More />
    </div>
  )
}

/* ---------- C. Status ring on the letter ---------- */

function HeaderC({ v, status }: { v: VersionNode; status: Status }) {
  const m = STATUS_META[status]
  const tracks = tracksOf(v)
  const dashed = status === 'in-progress'
  const faded = status === 'archived'
  return (
    <div className={`glass-panel flex min-h-14 items-center gap-3 rounded-2xl py-2 pl-2 pr-2 ${faded ? 'opacity-70' : ''}`}>
      <span className="relative grid size-10 shrink-0 place-items-center">
        <svg viewBox="0 0 40 40" className={`absolute inset-0 ${dashed ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
          <circle cx="20" cy="20" r="18" fill="none" stroke={m.color} strokeWidth="2.5" strokeDasharray={dashed ? '5 4' : undefined} />
        </svg>
        <span className="text-[15px] font-bold text-zinc-900">{v.letter}</span>
        {(status === 'changes' || status === 'approved' || status === 'ready') && (
          <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-white ring-2 ring-[var(--lift)]" style={{ background: m.color }}>
            <m.icon size={10} strokeWidth={3} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-zinc-900">{v.title}</div>
        <div className="text-[12px] font-medium" style={{ color: SOFT[status].ink }}>
          {m.label}
        </div>
      </div>
      {/* a tiny page: the track order, top to bottom */}
      <div className="flex w-9 shrink-0 flex-col gap-[2px] rounded-md bg-well p-1 ring-1 ring-zinc-950/5" title={tracks.map((t) => `${TYPE_LABEL[t.type]} · ${t.source}`).join('\n')}>
        {tracks.map((t, i) => (
          <span key={i} className="block rounded-[2px]" style={{ background: t.color, height: t.type === 'hero' ? 9 : t.type === 'nav' || t.type === 'footer' ? 3 : 5 }} />
        ))}
      </div>
      <Build />
      <More />
    </div>
  )
}

/* ---------- D. Stamp ---------- */

function HeaderD({ v, status }: { v: VersionNode; status: Status }) {
  const m = STATUS_META[status]
  const sources = sourcesOf(v)
  return (
    <div className="glass-panel flex min-h-14 items-center gap-3 rounded-2xl py-2 pl-2 pr-2">
      <span className="grid h-10 w-9 shrink-0 place-items-center rounded-lg bg-zinc-900 text-[15px] font-bold text-white">{v.letter}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-zinc-900">{v.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px] text-zinc-500">
          {sources.map((s) => (
            <span key={s.name} className="flex items-center gap-1">
              <span className="size-2 rounded-full ring-1 ring-zinc-950/10" style={{ background: s.color }} />
              {s.name}
              {s.count > 1 && <span className="text-zinc-400">×{s.count}</span>}
            </span>
          ))}
        </div>
      </div>
      <span
        className="shrink-0 -rotate-3 rounded-md border-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ borderColor: m.color, color: SOFT[status].ink, background: SOFT[status].bg }}
      >
        {m.label}
      </span>
      <Build />
      <More />
    </div>
  )
}

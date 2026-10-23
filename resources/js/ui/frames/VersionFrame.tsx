import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Bot, Eye, Link2, Package, Shuffle, Trash2 } from 'lucide-react'
import type { BuildTarget, VersionNode } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { composePage } from '@/core/compose'
import { referenceHtml } from '@/core/export/reference-html'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { VIEWPORT_VH } from '@/state/derived'
import { PageFrame } from '@/frame/PageFrame'
import { runReferenceBuild } from '@/lib/agent-sim'
import { FlashTitle, FrameHeader, HeaderButton, StatusMenu } from './FrameHeader'
import { STATUS_META } from './status'
import type { FramePlacement } from '../canvas/geometry'

export const VersionFrame = memo(function VersionFrame({ p }: { p: FramePlacement }) {
  const v = p.node
  const viewport = useStore((s) => s.ui.viewport)
  const selected = useStore((s) => s.ui.selectedFrameId === v.id)
  const previewing = useStore((s) => s.ui.previewFrameId === v.id)
  const agentBusy = useStore((s) => !!s.agent.versionId)
  const isBranchBase = useStore((s) => s.branchFrom === v.id)
  const setFrameHeight = useLayout((s) => s.setFrameHeight)
  const setSections = useLayout((s) => s.setSections)
  const st = useStore.getState

  const srcdoc = useMemo(() => {
    const page = composePage({
      slots: v.snapshot.slots.filter((s) => library.clips[s.clipId]),
      guide: resolveGuide(v.snapshot.guide),
      content: v.snapshot.content,
      library,
      slotNotes: v.snapshot.slotNotes,
    })
    return referenceHtml(page, { vh: VIEWPORT_VH[viewport], tagSlots: true })
  }, [v.snapshot, viewport])

  const building = v.kind === 'build' && !v.build?.done
  const meta = STATUS_META[v.status]

  return (
    <div
      className="absolute"
      style={{ left: p.x, top: p.y, width: p.w }}
      onPointerDown={() => st().setUi({ selectedFrameId: v.id })}
      data-frame={v.id}
    >
      <FrameHeader width={p.w} tint={meta.color} selected={selected}>
        <StatusMenu status={v.status} onChange={(s) => st().setStatus(v.id, s)} />
        <span
          className="grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-[12px] font-bold text-background"
          style={{ background: meta.color }}
        >
          {v.letter}
        </span>
        <FlashTitle status={v.status}>
          <Title v={v} />
        </FlashTitle>
        {v.kind === 'build' && <AgentBadge v={v} />}
        {isBranchBase && <span className="rounded-md bg-key-soft px-2 py-0.5 text-[11px] font-semibold text-key-ink">in the mix</span>}
        <HeaderButton icon={Eye} label={previewing ? 'Stop interacting' : 'Interact with the page'} active={previewing} onClick={() => st().setUi({ previewFrameId: previewing ? null : v.id })} />
        <HeaderButton icon={Shuffle} label="Remix: load into the working mix and branch" onClick={() => remix(v)} />
        {v.kind === 'snapshot' && <SendToAgent disabled={agentBusy} onSend={(t) => runReferenceBuild(v.id, t)} />}
        {v.kind === 'build' && <AttachUrl v={v} />}
        <HeaderButton
          icon={Package}
          label="Open the packet for this version"
          onClick={() => st().setUi({ packetSource: v.id, sheet: 'packet' })}
        />
        <HeaderButton
          icon={Trash2}
          label="Delete (undo with ⌘Z)"
          onClick={() => {
            st().deleteVersion(v.id)
            st().showFlash(`Deleted ${v.letter}`, { undo: true })
          }}
        />
      </FrameHeader>

      <div
        className="relative overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.06)]"
        style={{ minHeight: 600, outline: selected ? `calc(3px / var(--z)) solid ${meta.color}` : undefined }}
      >
        {building ? (
          <BuildProgress v={v} />
        ) : (
          <PageFrame
            srcdoc={v.build?.previewUrl ? undefined : srcdoc}
            src={v.build?.previewUrl}
            width={p.w}
            title={`${v.letter}: ${v.title}`}
            interactive={previewing}
            onHeight={(h) => setFrameHeight(v.id, h)}
            onSections={(s) => setSections(v.id, s)}
          />
        )}
        {v.kind === 'build' && v.build?.done && !v.build.previewUrl && (
          <div className="pointer-events-none absolute right-0 top-0 origin-top-right" style={{ transform: 'scale(calc(1 / var(--z)))' }}>
            <span className="m-2 inline-block rounded-md bg-zinc-900/85 px-2 py-1 text-[11px] font-medium text-white">
              Reference build · what the {v.build.target === 'astro' ? 'Astro' : 'Next.js'} export renders
            </span>
          </div>
        )}
      </div>
    </div>
  )
})

function remix(v: VersionNode) {
  const st = useStore.getState()
  st.remix(v.id)
  st.showFlash(`Loaded ${v.letter} into the mix: your next version branches from it`)
}

function Title({ v }: { v: VersionNode }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(v.title)
  useEffect(() => setVal(v.title), [v.title])
  if (editing)
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (val.trim()) useStore.getState().renameVersion(v.id, val.trim())
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setVal(v.title)
            setEditing(false)
          }
        }}
        className="w-full rounded-md bg-white px-1.5 py-0.5 font-medium text-zinc-900 outline-none ring-2 ring-zinc-900/20"
      />
    )
  return (
    <div className="truncate font-medium text-zinc-900" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
      {v.title}
    </div>
  )
}

function AgentBadge({ v }: { v: VersionNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-agent-soft py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-agent-ink">
      <span className="grid size-4 place-items-center rounded-full bg-agent text-[9px] font-bold text-white">C</span>
      {v.build?.agentName} · {v.build?.target === 'astro' ? 'Astro' : 'Next'}
    </span>
  )
}

function SendToAgent({ disabled, onSend }: { disabled: boolean; onSend: (t: BuildTarget) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <HeaderButton icon={Bot} label={disabled ? 'The agent is busy' : 'Send to agent'} disabled={disabled} active={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 animate-pop rounded-2xl border border-zinc-950/10 bg-white p-2 shadow-xl">
          <p className="px-2 pb-2 pt-1 text-[12px] leading-snug text-zinc-500">
            Hand this version’s packet to the agent. Until MCP is connected, it renders the exporter’s reference build.
          </p>
          {(['astro', 'next'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setOpen(false)
                onSend(t)
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium text-zinc-800 transition hover:bg-zinc-100 active:scale-[0.98]"
            >
              Build with {t === 'astro' ? 'Astro' : 'Next.js'}
              <span className="text-zinc-400">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AttachUrl({ v }: { v: VersionNode }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(v.build?.previewUrl ?? '')
  return (
    <div className="relative">
      <HeaderButton icon={Link2} label="Attach the agent’s preview URL" active={open || !!v.build?.previewUrl} onClick={() => setOpen((o) => !o)} />
      {open && (
        <form
          className="absolute right-0 top-full z-50 mt-2 flex w-80 animate-pop gap-1.5 rounded-2xl border border-zinc-950/10 bg-white p-2 shadow-xl"
          onSubmit={(e) => {
            e.preventDefault()
            const clean = url.trim()
            if (clean && !/^https?:\/\//.test(clean)) return
            useStore.getState().updateBuild(v.id, { previewUrl: clean || undefined, by: clean ? 'agent' : 'reference' })
            setOpen(false)
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:4321"
            className="min-w-0 flex-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[13px] outline-none"
          />
          <button className="btn-lit btn-ink rounded-full px-3.5 text-[13px] font-medium">Attach</button>
        </form>
      )}
    </div>
  )
}

function BuildProgress({ v }: { v: VersionNode }) {
  const steps = v.build?.steps ?? []
  return (
    <div className="relative h-[1400px] overflow-hidden bg-zinc-50">
      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_30%,rgb(0_0_0/0.04)_50%,transparent_70%)]" />
      <div className="absolute left-1/2 top-24 origin-top" style={{ transform: 'translateX(-50%) scale(calc(1 / var(--z)))' }}>
        <div className="w-80 rounded-2xl border border-zinc-950/10 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <span className="grid size-6 place-items-center rounded-full bg-agent text-[11px] font-bold text-white">C</span>
            {v.build?.agentName} is building {v.letter}
          </div>
          <ul className="space-y-1.5 text-[12.5px]">
            {steps.map((s, i) => (
              <motion.li key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-zinc-600">
                <span className={i === steps.length - 1 ? 'text-blue-500' : 'text-green-600'}>{i === steps.length - 1 ? '◌' : '✓'}</span>
                {s}
              </motion.li>
            ))}
            {!steps.length && <li className="text-zinc-400">Picking up the packet…</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

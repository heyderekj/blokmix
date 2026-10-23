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
import { FlashTitle, FrameHeader, OverflowMenu, StatusMenu, StatusRing } from './FrameHeader'
import { Avatar, AvatarStack } from '../shell/Avatar'
import { agent, useMe } from '@/lib/people'
import { STATUS_INK, STATUS_META } from './status'
import type { FramePlacement } from '../canvas/geometry'
import { AstroIcon, NextIcon } from '../shell/FrameworkIcons'

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
  const me = useMe()

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
  const [attaching, setAttaching] = useState(false)
  const parent = useStore((s) => (v.parentId ? s.versions[v.parentId] : null))
  const sources = useMemo(() => {
    return [...new Set(v.snapshot.slots.map((sl) => library.clips[sl.clipId]?.sourceId).filter(Boolean))]
  }, [v.snapshot])
  const metaLine = [
    `${v.snapshot.slots.length} tracks · ${sources.length} sites`,
    v.kind === 'build' ? `${v.build?.agentName} · ${v.build?.target === 'astro' ? 'Astro' : 'Next.js'}${v.build?.previewUrl ? ' · live preview' : ''}` : parent ? `from ${parent.letter}` : null,
    isBranchBase ? 'in the mix' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="absolute"
      style={{ left: p.x, top: p.y, width: p.w }}
      onPointerDown={() => st().setUi({ selectedFrameId: v.id })}
      data-frame={v.id}
    >
      <FrameHeader width={p.w} selected={selected} dim={v.status === 'archived'}>
        <StatusMenu status={v.status} onChange={(s) => st().setStatus(v.id, s)} trigger={<StatusRing letter={v.letter} status={v.status} />} />
        <div className="min-w-0 flex-1 @max-[180px]:hidden">
          <FlashTitle status={v.status}>
            <Title v={v} />
          </FlashTitle>
          <div className="truncate text-[12px] leading-snug">
            <span className="font-medium" style={{ color: STATUS_INK[v.status] }}>
              {meta.label}
            </span>
            {metaLine && <span className="text-zinc-500"> · {metaLine}</span>}
          </div>
        </div>
        <span className="@max-[420px]:hidden">
          <AvatarStack people={v.kind === 'build' ? [agent(v.build?.agentName ?? 'Agent')] : [me]} />
        </span>
        {v.kind === 'snapshot' ? (
          <SendToAgent disabled={agentBusy} onSend={(t) => runReferenceBuild(v.id, t)} />
        ) : (
          <button type="button" onClick={() => remix(v)} title="Remix" className="btn-quiet flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold @max-[340px]:px-2 @max-[220px]:hidden">
            <Shuffle size={13} /> <span className="@max-[340px]:hidden">Remix</span>
          </button>
        )}
        <OverflowMenu
          items={[
            { icon: Eye, label: previewing ? 'Stop interacting' : 'Interact with the page', onClick: () => st().setUi({ previewFrameId: previewing ? null : v.id }) },
            ...(v.kind === 'snapshot' ? [{ icon: Shuffle, label: 'Remix into the working mix', onClick: () => remix(v) }] : []),
            { icon: Package, label: 'Export this version', onClick: () => st().setUi({ packetSource: v.id, sheet: 'packet' }) },
            ...(v.kind === 'build' ? [{ icon: Link2, label: v.build?.previewUrl ? 'Change preview URL' : 'Attach the agent’s preview URL', onClick: () => setAttaching(true) }] : []),
            {
              icon: Trash2,
              label: 'Delete',
              danger: true,
              onClick: () => {
                st().deleteVersion(v.id)
                st().showFlash(`Deleted ${v.letter}`, { undo: true })
              },
            },
          ]}
        />
        {attaching && <AttachUrl v={v} onClose={() => setAttaching(false)} />}
      </FrameHeader>

      <div
        className="frame-r relative overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.06)]"
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
    <div className="truncate text-[15px] font-semibold leading-tight text-zinc-900" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
      {v.title}
    </div>
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
    <div ref={ref} className="relative @max-[220px]:hidden">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? 'The agent is busy' : 'Send this version to your agent'}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="btn-quiet flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold @max-[340px]:px-2"
      >
        <Bot size={14} /> <span className="@max-[340px]:hidden">Build</span>
      </button>
      {open && (
        <div className="glass-menu absolute right-0 top-full z-50 mt-2 w-64 animate-pop rounded-2xl p-2">
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
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-800 transition hover:bg-zinc-950/5"
            >
              <span className="flex items-center gap-2">
                {t === 'astro' ? <AstroIcon size={15} /> : <NextIcon size={15} />}
                Build with {t === 'astro' ? 'Astro' : 'Next.js'}
              </span>
              <span className="text-zinc-400">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AttachUrl({ v, onClose }: { v: VersionNode; onClose: () => void }) {
  const [url, setUrl] = useState(v.build?.previewUrl ?? '')
  return (
    <div className="absolute right-1.5 top-full">
      <form
          className="glass-menu absolute right-0 top-0 z-50 mt-2 flex w-80 animate-pop gap-1.5 rounded-2xl p-2"
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') onClose()
          }}
          onSubmit={(e) => {
            e.preventDefault()
            const clean = url.trim()
            if (clean && !/^https?:\/\//.test(clean)) return
            useStore.getState().updateBuild(v.id, { previewUrl: clean || undefined, by: clean ? 'agent' : 'reference' })
            onClose()
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:4321"
            className="min-w-0 flex-1 rounded-lg bg-well px-2.5 py-1.5 text-[13px] outline-none"
          />
          <button className="btn-lit btn-ink rounded-full px-3.5 text-[13px] font-medium">Attach</button>
        </form>
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
            <Avatar who={agent(v.build?.agentName ?? 'Agent')} size={24} ring={false} />
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

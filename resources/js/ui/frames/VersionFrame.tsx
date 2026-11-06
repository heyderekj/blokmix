import { uploadData } from '@/lib/assets'
import { bindContextFor, useCollections } from '@/state/collections'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Bot, Copy, Eye, Link2, Package, Shuffle, Trash2 } from 'lucide-react'
import type { BuildTarget, VersionNode } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { composeSite } from '@/core/compose'
import { allSlots, mapSlots } from '@/core/site'
import { referenceHtml } from '@/core/export/reference-html'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { VIEWPORT_VH } from '@/state/derived'
import { PageFrame } from '@/frame/PageFrame'
import { runReferenceBuild } from '@/lib/agent-sim'
import { useAgentLink } from '@/lib/agentLink'
import { REVIEW_WIDTHS } from '@/core/export/packet'
import { PreviewMarksBar, PreviewPins } from '../notes/PreviewMarks'
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

  // A version of a site shows one page at a time.
  const pages = v.snapshot.site.pages
  const [pageId, setPageId] = useState(pages[0]?.id)
  const shown = pages.find((x) => x.id === pageId) ?? pages[0]
  const collections = useCollections((s) => s.bySlug)
  const srcdoc = useMemo(() => {
    const page = composeSite({
      site: mapSlots(v.snapshot.site, (s) => (library.clips[s.clipId] ? s : null)),
      guide: resolveGuide(v.snapshot.guide),
      content: v.snapshot.content,
      library,
      slotNotes: v.snapshot.slotNotes,
      page: v.snapshot.guide,
      uploads: uploadData,
      bind: bindContextFor(v.snapshot.site, collections),
    })
    return referenceHtml(page, { vh: VIEWPORT_VH[viewport], tagSlots: true, pageId: shown?.id })
  }, [v.snapshot, viewport, shown?.id, collections])

  // An agent's build shows its preview as soon as it reports one, even while it keeps working.
  const live = v.build?.previewUrl
  const building = v.kind === 'build' && !v.build?.done && !live
  // A live preview renders at the width it's reviewed at (1440, 390) and is drawn to fit the frame, so review pins line up.
  const pageW = live ? (viewport === 'desktop' ? REVIEW_WIDTHS[0] : REVIEW_WIDTHS[1]) : p.w
  const scale = p.w / pageW
  const reported = live ? (v.build?.previewHeight?.[`/@${pageW}`] ?? v.build?.previewHeight?.['/']) : undefined
  const frameH = useLayout((s) => s.frameHeights[v.id] ?? 0)
  const meta = STATUS_META[v.status]
  const [attaching, setAttaching] = useState(false)
  const parent = useStore((s) => (v.parentId ? s.versions[v.parentId] : null))
  const sources = useMemo(() => {
    return [...new Set(allSlots(v.snapshot.site).map((sl) => library.clips[sl.clipId]?.sourceId).filter(Boolean))]
  }, [v.snapshot])
  const metaLine = [
    `${pages.length > 1 ? `${pages.length} pages · ` : ''}${allSlots(v.snapshot.site).length} sections · ${sources.length} sites`,
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
        {pages.length > 1 && !live && !building && <PageTabs pages={pages} current={shown.id} onPick={setPageId} />}
        <PreviewMarksBar v={v} width={pageW} />
        <span className="@max-[420px]:hidden">
          <AvatarStack people={v.kind === 'build' ? [agent(v.build?.agentName ?? 'Agent')] : [me]} />
        </span>
        {/* Make your mix match this version (your unsaved edits are saved first) */}
        <button type="button" onClick={() => remix(v)} title="Make your mix match this version" className="btn-quiet flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold active:scale-[0.97] @max-[420px]:hidden">
          <Shuffle size={13} /> Start from this
        </button>
        {v.kind === 'snapshot' && <SendToAgent v={v} disabled={agentBusy} onReference={(t) => runReferenceBuild(v.id, t)} />}
        <OverflowMenu
          items={[
            { icon: Eye, label: previewing ? 'Stop interacting' : 'Interact with the page', onClick: () => st().setUi({ previewFrameId: previewing ? null : v.id }) },
            { icon: Shuffle, label: 'Work from this version', onClick: () => remix(v) },
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
        style={{ minHeight: 600, outline: selected ? `calc(3px / var(--zl)) solid ${meta.color}` : undefined }}
      >
        {building ? (
          <BuildProgress v={v} />
        ) : live ? (
          <div style={{ width: p.w, height: frameH || undefined, overflow: 'hidden' }}>
            <div style={{ width: pageW, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
              <PageFrame src={live} srcHeight={reported} width={pageW} title={`${v.letter}: ${v.title}`} interactive={previewing} onHeight={(h) => setFrameHeight(v.id, Math.round(h * scale))} />
            </div>
          </div>
        ) : (
          <PageFrame
            srcdoc={srcdoc}
            width={p.w}
            title={`${v.letter}: ${v.title}`}
            interactive={previewing}
            onHeight={(h) => setFrameHeight(v.id, h)}
            onSections={(s) => setSections(v.id, s)}
          />
        )}
        {!building && <PreviewPins v={v} width={pageW} frameW={p.w} frameH={frameH} />}
        {live && !v.build?.done && (
          <div className="pointer-events-none absolute right-0 top-0 origin-top-right" style={{ transform: 'scale(calc(1 / var(--zl)))' }}>
            <span className="m-2 inline-block rounded-md bg-zinc-900/85 px-2 py-1 text-[11px] font-medium text-white">
              {v.build?.agentName} is still working{v.build?.steps.length ? `: ${v.build.steps[v.build.steps.length - 1]}` : ''}
            </span>
          </div>
        )}
        {v.kind === 'build' && v.build?.done && !v.build.previewUrl && v.build.by === 'reference' && (
          <div className="pointer-events-none absolute right-0 top-0 origin-top-right" style={{ transform: 'scale(calc(1 / var(--zl)))' }}>
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
  const saved = st.remix(v.id)
  // Your working mix becomes a copy of this version; the next one you save builds on it. Undo brings back what you had.
  st.showFlash(saved ? `You’re working from ${v.letter} now. Your edits are kept as ${saved}.` : `You’re working from ${v.letter} now. What you save next builds on it.`, { undo: true })
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

function SendToAgent({ v, disabled, onReference }: { v: VersionNode; disabled: boolean; onReference: (t: BuildTarget) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const link = useAgentLink((s) => s.status)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])
  const name = (t: BuildTarget) => (t === 'astro' ? 'Astro' : 'Next.js')
  const ask = (t: BuildTarget) => {
    setOpen(false)
    const st0 = useStore.getState()
    // No agent connected to Blokmix: the files and a prompt to paste are the way (Export, opened on this version).
    if (link !== 'connected') return st0.setUi({ packetSource: v.id, packetTargets: [t], sheet: 'packet' })
    const prompt = `Use blokmix to build version ${v.letter} in ${name(t)}`
    const st = useStore.getState()
    void navigator.clipboard?.writeText(prompt).catch(() => {})
    st.showFlash(`Copied “${prompt}”: paste it to your agent`)
  }
  const Row = ({ t, onClick, icon }: { t: BuildTarget; onClick: () => void; icon?: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-800 transition hover:bg-zinc-950/5"
    >
      <span className="flex items-center gap-2">
        {t === 'astro' ? <AstroIcon size={15} /> : <NextIcon size={15} />}
        {name(t)}
      </span>
      <span className="text-zinc-400">{icon ?? '→'}</span>
    </button>
  )
  return (
    <div ref={ref} className="relative @max-[220px]:hidden">
      <button
        type="button"
        // While the agent builds another one this waits, and its tooltip says so.
        aria-disabled={disabled || undefined}
        title={disabled ? 'Your agent is busy with another build' : 'Build this version'}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setOpen((o) => !o)
        }}
        className={`btn-quiet flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold @max-[340px]:px-2 ${disabled ? 'cursor-default opacity-50' : 'active:scale-[0.97]'}`}
      >
        <Bot size={14} /> <span className="@max-[340px]:hidden">Build</span>
      </button>
      {open && (
        <div className="glass-menu absolute right-0 top-full z-50 mt-2 w-72 animate-pop rounded-2xl p-2">
          <div className="px-2 pb-1 pt-1 text-[12.5px] font-semibold text-zinc-900">Build with your agent</div>
          <p className="px-2 pb-1.5 text-[12px] leading-snug text-zinc-500">
            {link === 'connected'
              ? 'Copies a prompt for your agent. It builds this version and shows it here.'
              : 'Get the files and a prompt to paste into your AI tool.'}
          </p>
          {(['astro', 'next'] as const).map((t) => (
            <Row key={t} t={t} onClick={() => ask(t)} icon={link === 'connected' ? <Copy size={13} /> : undefined} />
          ))}
          <div className="mx-2 my-1.5 border-t border-zinc-950/5" />
          <div className="px-2 pb-1 pt-0.5 text-[12.5px] font-semibold text-zinc-900">Preview the code</div>
          <p className="px-2 pb-1.5 text-[12px] leading-snug text-zinc-500">See the exported site right here, no agent needed.</p>
          {(['astro', 'next'] as const).map((t) => (
            <Row
              key={t}
              t={t}
              onClick={() => {
                setOpen(false)
                onReference(t)
              }}
            />
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
          <button className="btn-lit btn-ink cursor-pointer rounded-full px-3.5 text-[13px] font-medium">Attach</button>
        </form>
    </div>
  )
}

function BuildProgress({ v }: { v: VersionNode }) {
  const steps = v.build?.steps ?? []
  // An agent can go quiet: after a minute without word, offer a way out.
  const [quiet, setQuiet] = useState(false)
  useEffect(() => {
    setQuiet(false)
    const t = window.setTimeout(() => setQuiet(true), 60_000)
    return () => window.clearTimeout(t)
  }, [steps.length])
  return (
    <div className="relative h-[1400px] overflow-hidden bg-zinc-50">
      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_30%,rgb(0_0_0/0.04)_50%,transparent_70%)]" />
      <div className="absolute left-1/2 top-24 origin-top" style={{ transform: 'translateX(-50%) scale(calc(1 / var(--zl)))' }}>
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
            {!steps.length && <li className="text-zinc-400">Getting started…</li>}
          </ul>
          {quiet && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-950/6 pt-3 text-[12px] text-zinc-500">
              No word for a minute.
              <button
                type="button"
                onClick={() => {
                  useStore.getState().updateBuild(v.id, { done: true }, 'changes')
                  useStore.getState().showFlash(`Stopped waiting for ${v.build?.agentName ?? 'the agent'}`, { undo: true })
                }}
                className="btn-quiet flex h-7 cursor-pointer items-center rounded-full px-2.5 text-[12px] font-semibold active:scale-[0.97]"
              >
                Stop waiting
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Which page of a version's site the frame shows. */
function PageTabs({ pages, current, onPick }: { pages: { id: string; title: string; path: string }[]; current: string; onPick: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Pages" className="flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 p-0.5 @max-[560px]:hidden">
      {pages.map((pg) => (
        <button
          key={pg.id}
          type="button"
          role="tab"
          aria-selected={pg.id === current}
          title={pg.path}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onPick(pg.id)}
          className={`h-7 max-w-[120px] truncate rounded-full px-2.5 text-[12px] font-semibold transition-[background-color,color] duration-150 active:scale-[0.97] ${pg.id === current ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
        >
          {pg.title}
        </button>
      ))}
    </div>
  )
}

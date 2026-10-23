import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ClipboardCopy, Download, FileCode2, FileJson, FileText, Files, Folder, Layers, StickyNote, SwatchBook } from 'lucide-react'
import type { BuildTarget } from '@/core/types'
import { openGroups, resolveGuide } from '@/core/guide'
import { composePage } from '@/core/compose'
import { agentPrompt, packetFiles, type PacketInput } from '@/core/export/packet'
import { zipFiles } from '@/core/export/zip'
import { assetUrl, useAssets } from '@/lib/assets'
import { slug } from '@/core/export/astro'
import { dfsOrder, generalNotesFor, marksFor, slotNotesFor } from '@/core/versions'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { Segmented } from '../shell/TopBar'
import { AstroIcon, NextIcon } from '../shell/FrameworkIcons'

export function PacketPanel() {
  const source = useStore((s) => s.ui.packetSource)
  const target: BuildTarget = useStore((s) => s.ui.packetTargets[0] ?? 'astro')
  const targets = useMemo<BuildTarget[]>(() => [target], [target])
  const versions = useStore((s) => s.versions)
  const tapeName = useStore((s) => s.tapeName)
  const slots = useStore((s) => s.slots)
  const guideState = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const notes = useStore((s) => s.notes)
  const sections = useLayout((s) => s.sections)
  const [open, setOpen] = useState<string>('MIXTAPE.md')
  const [copied, setCopied] = useState<string | null>(null)
  const [tab, setTab] = useState<'files' | 'prompt'>('files')
  const st = useStore.getState

  const version = source !== 'mix' ? versions[source] : null

  const assets = useAssets((s) => s.assets)
  const input: PacketInput = useMemo(() => {
    const snap = version?.snapshot ?? { slots, guide: guideState, content, slotNotes: slotNotesFor(slots, notes), marks: marksFor(slots, notes), generalNotes: generalNotesFor(notes) }
    const guide = resolveGuide(snap.guide)
    // Notes pinned on a version frame land in the packet, tagged with the section they sit on.
    const frameNotes = version
      ? notes
          .filter((n) => n.anchor.kind === 'frame' && n.anchor.frameId === version.id && n.text.trim())
          .map((n) => {
            const dy = n.anchor.kind === 'frame' ? n.anchor.dy : 0
            const sec = (sections[version.id] ?? []).find((s) => dy >= s.top && dy < s.top + s.height)
            const slot = sec && snap.slots.find((s) => s.id === sec.slot)
            return slot ? `[${slot.type}] ${n.text.trim()}` : n.text.trim()
          })
      : []
    const parent = version?.parentId ? versions[version.parentId] : null
    return {
      page: composePage({ slots: snap.slots.filter((s) => library.clips[s.clipId]), guide, content: snap.content, library, slotNotes: snap.slotNotes, title: snap.content.brand, page: snap.guide, uploads: assetUrl }),
      guide,
      guideState: snap.guide,
      library,
      tapeName,
      version: version ? { id: version.id, letter: version.letter, title: version.title, status: version.status, parentLetter: parent?.letter } : null,
      targets,
      notes: [...(snap.generalNotes ?? []), ...frameNotes],
      // A version's marks live on with the tape, so read them live rather than from the snapshot.
      marks: version ? marksFor(snap.slots, notes) : snap.marks,
    }
  }, [version, versions, slots, guideState, content, notes, sections, tapeName, targets, assets])

  const files = useMemo(() => packetFiles(input), [input])
  const paths = Object.keys(files)
  const current = files[open] !== undefined ? open : 'MIXTAPE.md'

  const flash = (k: string) => {
    setCopied(k)
    setTimeout(() => setCopied(null), 1400)
  }

  const download = () => {
    const name = `${slug(tapeName)}-${version ? version.letter.toLowerCase().replace(/\./g, '-') : 'mix'}`
    const blob = new Blob([zipFiles(files, name) as BlobPart], { type: 'application/zip' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    st().showFlash(`Packet downloaded: ${paths.length} files`)
  }

  const copyPrompt = async (t: BuildTarget) => {
    await navigator.clipboard.writeText(agentPrompt(input, t))
    flash(`prompt-${t}`)
  }



  const openConflicts = openGroups(input.guide).length
  const noteCount = input.page.sections.reduce((n, s) => n + s.notes.length, 0) + (input.notes?.length ?? 0)

  const facts: { icon: typeof Layers; text: string; dot?: boolean }[] = [
    { icon: Layers, text: `${input.page.sections.length} sections` },
    { icon: Files, text: `${paths.length} files` },
    openConflicts
      ? { icon: SwatchBook, text: `${openConflicts} style choice${openConflicts > 1 ? 's' : ''} open`, dot: true }
      : { icon: SwatchBook, text: 'Guide settled' },
    ...(noteCount ? [{ icon: StickyNote, text: `${noteCount} notes` }] : []),
  ]

  return (
    <div>
      {/* tier 1: what's being handed off, and the one action */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="relative -ml-1.5 w-fit max-w-full">
            <select
              value={source in versions || source === 'mix' ? source : 'mix'}
              onChange={(e) => st().setUi({ packetSource: e.target.value })}
              className="w-full max-w-full cursor-pointer appearance-none truncate rounded-md bg-transparent py-0.5 pl-1.5 pr-6 text-[15px] font-semibold text-zinc-900 outline-none transition hover:bg-zinc-950/5"
              aria-label="Which version to export"
            >
              <option value="mix">Working mix</option>
              {dfsOrder(versions).map(({ node }) => (
                <option key={node.id} value={node.id}>
                  {node.letter} · {node.title}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
            {facts.map((f) => (
              <span key={f.text} className="flex items-center gap-1">
                <span className="relative grid">
                  <f.icon size={13} className="text-zinc-400" />
                  {f.dot && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-attention ring-1 ring-[var(--lift)]" />}
                </span>
                {f.text}
              </span>
            ))}
          </div>
        </div>
        <button type="button" onClick={download} className="btn-lit btn-ink flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold">
          <Download size={14} /> Download
        </button>
      </div>

      {/* tier 2: tabs left, targets right */}
      <div className="flex items-end gap-0.5 border-t border-zinc-950/6 px-2 pt-1.5">
        {(['files', 'prompt'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-8 rounded-t-lg px-3 text-[12.5px] font-medium transition ${tab === k ? 'bg-well text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            {k === 'files' ? 'Files' : 'Agent prompt'}
          </button>
        ))}
        <div className="ml-auto pb-1 pr-0.5">
          <Segmented
            value={target}
            options={[
              { value: 'astro', label: <><AstroIcon size={13} />Astro</>, title: 'Export an Astro project' },
              { value: 'next', label: <><NextIcon size={13} />Next.js</>, title: 'Export a Next.js project' },
            ]}
            onChange={(t) => st().setUi({ packetTargets: [t] })}
          />
        </div>
      </div>

      <div className="bg-well p-3">
        {tab === 'files' ? (
          <>
            <FileTree paths={paths} open={current} onOpen={setOpen} />
            <div className="mb-1.5 mt-3 flex items-center justify-between">
              <span className="truncate font-mono text-[11.5px] text-zinc-500">{current}</span>
              <CopyBtn copied={copied === 'file'} onClick={async () => {
                const f = files[current]
                if (typeof f === 'string') await navigator.clipboard.writeText(f)
                flash('file')
              }} />
            </div>
            <pre className="thin-scroll max-h-[340px] min-h-40 overflow-auto rounded-xl bg-lift p-3 font-mono text-[11px] leading-relaxed text-zinc-700 ring-1 ring-zinc-950/5">
              {typeof files[current] === 'string' ? files[current] : `Image · ${Math.round((files[current] as Uint8Array).length / 1024)} KB`}
            </pre>
          </>
        ) : (
          <div className="space-y-3">
            {targets.map((t) => (
              <div key={t}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-zinc-900">{t === 'astro' ? 'Astro' : 'Next.js'}</span>
                  <CopyBtn copied={copied === `prompt-${t}`} onClick={() => copyPrompt(t)} />
                </div>
                <pre className="thin-scroll max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-lift p-3 text-[12px] leading-relaxed text-zinc-700 ring-1 ring-zinc-950/5">{agentPrompt(input, t)}</pre>
              </div>
            ))}
            <p className="text-[11.5px] leading-relaxed text-zinc-500">
              Unzip the packet next to your agent and paste the prompt. Once Mixtape’s MCP server exists, agents will pull the packet themselves and post their build back to the canvas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function CopyBtn({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900"
    >
      {copied ? <Check size={12} className="text-done" /> : <ClipboardCopy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function iconFor(p: string) {
  if (p.endsWith('.json')) return FileJson
  if (p.endsWith('.md')) return FileText
  return FileCode2
}

function FileTree({ paths, open, onOpen }: { paths: string[]; open: string; onOpen: (p: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const root = paths.filter((p) => !p.includes('/'))
  const dirs = [...new Set(paths.filter((p) => p.includes('/')).map((p) => p.split('/')[0]))]
  const row = (p: string, label: string, depth: number) => {
    const Icon = iconFor(p)
    return (
      <button
        key={p}
        type="button"
        onClick={() => onOpen(p)}
        className={`flex h-7 w-full items-center gap-1.5 rounded-lg pr-2 text-left text-[12px] transition ${open === p ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <Icon size={13} className="shrink-0 opacity-60" />
        <span className="truncate font-mono">{label}</span>
      </button>
    )
  }
  return (
    <div className="space-y-px">
      {root.map((p) => row(p, p, 0))}
      {dirs.map((d) => (
        <div key={d}>
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, [d]: !e[d] }))}
            className="flex h-7 w-full items-center gap-1.5 rounded-lg px-2 text-left text-[12px] font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            <ChevronRight size={13} className={`transition-transform ${expanded[d] ? 'rotate-90' : ''}`} />
            <Folder size={13} className="opacity-60" />
            <span className="font-mono">{d}/</span>
            <span className="ml-auto text-[10.5px] text-zinc-400">{paths.filter((p) => p.startsWith(d + '/')).length}</span>
          </button>
          {expanded[d] && paths.filter((p) => p.startsWith(d + '/')).map((p) => row(p, p.slice(d.length + 1), 1))}
        </div>
      ))}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Check, ChevronRight, ClipboardCopy, Download, FileCode2, FileJson, FileText, Folder, Sparkles } from 'lucide-react'
import type { BuildTarget } from '@/core/types'
import { openGroups, resolveGuide } from '@/core/guide'
import { composePage } from '@/core/compose'
import { agentPrompt, packetFiles, type PacketInput } from '@/core/export/packet'
import { zipFiles } from '@/core/export/zip'
import { slug } from '@/core/export/astro'
import { slotNotesFor, dfsOrder } from '@/core/versions'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { PanelSection } from './parts'

export function PacketPanel() {
  const source = useStore((s) => s.ui.packetSource)
  const targets = useStore((s) => s.ui.packetTargets)
  const versions = useStore((s) => s.versions)
  const tapeName = useStore((s) => s.tapeName)
  const slots = useStore((s) => s.slots)
  const guideState = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const notes = useStore((s) => s.notes)
  const sections = useLayout((s) => s.sections)
  const [open, setOpen] = useState<string>('MIXTAPE.md')
  const [copied, setCopied] = useState<string | null>(null)
  const st = useStore.getState

  const version = source !== 'mix' ? versions[source] : null

  const input: PacketInput = useMemo(() => {
    const snap = version?.snapshot ?? { slots, guide: guideState, content, slotNotes: slotNotesFor(slots, notes) }
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
      page: composePage({ slots: snap.slots.filter((s) => library.clips[s.clipId]), guide, content: snap.content, library, slotNotes: snap.slotNotes, title: snap.content.brand }),
      guide,
      guideState: snap.guide,
      library,
      tapeName,
      version: version ? { id: version.id, letter: version.letter, title: version.title, status: version.status, parentLetter: parent?.letter } : null,
      targets,
      notes: frameNotes,
    }
  }, [version, versions, slots, guideState, content, notes, sections, tapeName, targets])

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

  const toggleTarget = (t: BuildTarget) => {
    const next = targets.includes(t) ? targets.filter((x) => x !== t) : [...targets, t]
    if (next.length) st().setUi({ packetTargets: next })
  }

  const openConflicts = openGroups(input.guide).length
  const noteCount = input.page.sections.reduce((n, s) => n + s.notes.length, 0) + (input.notes?.length ?? 0)

  return (
    <div className="flex h-full flex-col">
      <PanelSection title="Hand off">
        <label className="mb-2 block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">From</span>
          <select
            value={source in versions || source === 'mix' ? source : 'mix'}
            onChange={(e) => st().setUi({ packetSource: e.target.value })}
            className="h-9 w-full rounded-xl border border-zinc-950/10 bg-white px-2.5 text-[13px] font-medium text-zinc-800 outline-none"
          >
            <option value="mix">Working mix</option>
            {dfsOrder(versions).map(({ node }) => (
              <option key={node.id} value={node.id}>
                {node.letter} · {node.title}
              </option>
            ))}
          </select>
        </label>
        <div className="mb-3 flex gap-1.5">
          {(['astro', 'next'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTarget(t)}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[12.5px] font-semibold transition active:scale-95 ${
                targets.includes(t) ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-950/10 text-zinc-500'
              }`}
            >
              {targets.includes(t) && <Check size={13} />}
              {t === 'astro' ? 'Astro' : 'Next.js'}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11.5px]">
          <Chip>{input.page.sections.length} tracks</Chip>
          <Chip>{paths.length} files</Chip>
          <Chip tone={openConflicts ? 'warn' : 'ok'}>{openConflicts ? `${openConflicts} style decision${openConflicts > 1 ? 's' : ''} open` : 'guide resolved'}</Chip>
          {noteCount > 0 && <Chip>{noteCount} notes</Chip>}
        </div>
        <button
          type="button"
          onClick={download}
          className="btn-lit btn-ink mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold"
        >
          <Download size={15} /> Download packet (.zip)
        </button>
        <div className="flex gap-1.5">
          {targets.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => copyPrompt(t)}
              className="btn-quiet flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-medium"
            >
              {copied === `prompt-${t}` ? <Check size={13} className="text-green-600" /> : <Sparkles size={13} />}
              {t === 'astro' ? 'Astro' : 'Next'} prompt
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">
          Unzip next to your agent and paste the prompt. When Mixtape’s MCP server lands, agents will pull this packet directly and post their build back to the canvas.
        </p>
      </PanelSection>

      <PanelSection title="Files">
        <FileTree paths={paths} open={current} onOpen={setOpen} />
      </PanelSection>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="truncate font-mono text-[11.5px] text-zinc-500">{current}</span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(files[current])
              flash('file')
            }}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-800"
          >
            {copied === 'file' ? <Check size={12} className="text-green-600" /> : <ClipboardCopy size={12} />}
            Copy
          </button>
        </div>
        <pre className="thin-scroll max-h-[420px] min-h-40 overflow-auto rounded-xl bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
          {files[current]}
        </pre>
      </div>
    </div>
  )
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'warn' | 'ok' }) {
  const cls = tone === 'warn' ? 'bg-attention-soft text-attention-ink' : tone === 'ok' ? 'bg-done-soft text-done-ink' : 'bg-chip text-zinc-700'
  return <span className={`rounded-md px-2 py-0.5 font-medium ${cls}`}>{children}</span>
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

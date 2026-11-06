import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, ClipboardCopy, Download, FileCode2, FileJson, FileText, Files, Folder, Layers, StickyNote, SwatchBook } from 'lucide-react'
import type { BuildTarget } from '@/core/types'
import { openGroups } from '@/core/guide'
import { agentPrompt, packetFiles, type PacketInput } from '@/core/export/packet'
import { zipFiles } from '@/core/export/zip'
import { useAssets } from '@/lib/assets'
import { useAgentLink } from '@/lib/agentLink'
import { packetInputFor } from '@/lib/packet'
import { withBakedPosters } from '@/lib/shaderPosters'
import { slug } from '@/core/export/astro'
import { dfsOrder } from '@/core/versions'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { Segmented } from '../shell/TopBar'
import { AstroIcon, NextIcon } from '../shell/FrameworkIcons'
import { FiveSecondCard } from '../jev/FiveSecondCard'

export function PacketPanel() {
  const source = useStore((s) => s.ui.packetSource)
  const target: BuildTarget = useStore((s) => s.ui.packetTargets[0] ?? 'astro')
  const targets = useMemo<BuildTarget[]>(() => [target], [target])
  const versions = useStore((s) => s.versions)
  const mixName = useStore((s) => s.mixName)
  const site = useStore((s) => s.site)
  const guideState = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const notes = useStore((s) => s.notes)
  const sections = useLayout((s) => s.sections)
  const [open, setOpen] = useState<string>('BLOKMIX.md')
  const [copied, setCopied] = useState<string | null>(null)
  // Open on what to do with it; the files are a tab away for anyone who wants to look inside.
  const [tab, setTab] = useState<'files' | 'prompt'>('prompt')
  // Without an agent connected to Blokmix, the prompt leaves out the steps that report back to it.
  const mcp = useAgentLink((s) => s.status === 'connected')
  const st = useStore.getState

  const version = source !== 'mix' ? versions[source] : null

  const assets = useAssets((s) => s.assets)
  const input: PacketInput = useMemo(
    () => packetInputFor({ mixName, site, guide: guideState, content, notes, versions }, { version, targets, sections }),
    // Uploads load from the browser's store after start-up; rebuild when they arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, versions, site, guideState, content, notes, sections, mixName, targets, assets],
  )

  const files = useMemo(() => packetFiles(input), [input])
  const paths = Object.keys(files)
  const current = files[open] !== undefined ? open : 'BLOKMIX.md'

  const flash = (k: string) => {
    setCopied(k)
    setTimeout(() => setCopied(null), 1400)
  }

  const download = async () => {
    const name = `${slug(mixName)}-${version ? version.letter.toLowerCase().replace(/\./g, '-') : 'mix'}`
    // Live shaders get posters drawn from the real shader (the preview shows stand-ins).
    const ready = input.page.shaders.length ? packetFiles({ ...input, page: await withBakedPosters(input.page) }) : files
    const blob = new Blob([zipFiles(ready, name) as BlobPart], { type: 'application/zip' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    st().showFlash(`Downloaded ${paths.length} files`)
  }

  const copyPrompt = async (t: BuildTarget) => {
    await navigator.clipboard.writeText(agentPrompt(input, t, undefined, { mcp }))
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
              <option value="mix">Your mix, as it is now</option>
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
        {/* How to build it has its own Download, as step 1 */}
        {tab === 'files' && (
          <button type="button" onClick={download} className="btn-lit btn-ink cursor-pointer flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold active:scale-[0.97]">
            <Download size={14} /> Download
          </button>
        )}
      </div>

      <FiveSecondCard />

      {/* tier 2: tabs left, targets right */}
      <div className="flex items-end gap-0.5 border-t border-zinc-950/6 px-2 pt-1.5">
        {(['prompt', 'files'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-8 rounded-t-lg px-3 text-[12.5px] font-medium transition ${tab === k ? 'bg-well text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            {k === 'files' ? 'Files' : 'How to build it'}
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
            {mcp && (
              <p className="rounded-xl bg-done/10 px-3 py-2 text-[12px] leading-relaxed text-zinc-700">
                Your agent is connected. Ask it to build this mix and it shows its progress here.
              </p>
            )}
            <ol className="grid gap-2.5">
              <Step n={1} title="Download the files" body="Double-click the zip to open it.">
                <button type="button" onClick={download} className="btn-quiet flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold active:scale-[0.97]">
                  <Download size={13} /> Download
                </button>
              </Step>
              <Step n={2} title="Open the folder in your AI tool" body="Cursor, Claude Code, or whichever you build with." />
              {targets.map((t) => (
                <Step key={t} n={3} title="Paste this prompt" body={`It builds the page in ${t === 'astro' ? 'Astro' : 'Next.js'}. Not sure which to pick? Astro.`}>
                  <button type="button" onClick={() => copyPrompt(t)} className="btn-lit btn-ink flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold active:scale-[0.97]">
                    {copied === `prompt-${t}` ? <Check size={13} /> : <ClipboardCopy size={13} />} {copied === `prompt-${t}` ? 'Copied' : 'Copy prompt'}
                  </button>
                </Step>
              ))}
            </ol>
            {targets.map((t) => (
              <details key={t} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[11.5px] font-medium text-zinc-500 hover:text-zinc-800">
                  <ChevronRight size={12} className="transition-transform group-open:rotate-90" /> See the prompt
                </summary>
                <pre className="thin-scroll mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-lift p-3 text-[12px] leading-relaxed text-zinc-700 ring-1 ring-zinc-950/5">{agentPrompt(input, t, undefined, { mcp })}</pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[11px] font-semibold tabular-nums text-white">{n}</span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[12.5px] font-semibold text-zinc-900">{title}</span>
        <span className="text-[12px] leading-snug text-zinc-500">{body}</span>
      </span>
      {children}
    </li>
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

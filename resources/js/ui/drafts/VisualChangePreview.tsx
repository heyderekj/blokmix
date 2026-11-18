import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { referenceHtml } from '@/core/export/reference-html'
import { resolveGuide } from '@/core/guide'
import { allSlots } from '@/core/site'
import type { Change } from '@/core/iterations'
import type { VersionNode } from '@/core/types'
import { packetInputFor } from '@/lib/packet'
import { useStore } from '@/state/store'

function PreviewTile({ version, change, label }: { version: VersionNode; change: Change; label: string }) {
  const sample = useMemo(() => {
    if (change.kind === 'color') {
      const color = resolveGuide(version.snapshot.guide).tokens[change.token]
      return { color, value: color }
    }
    const page = packetInputFor(useStore.getState(), { version, targets: [] }).page
    const section = page.sections.find((s) => s.slotId === change.section)
    if (!section) return {}
    const edge = change.kind === 'spacing' ? change.edge : undefined
    const slot = allSlots(version.snapshot.site).find((s) => s.id === change.section)
    const value = edge ? (slot?.spacing?.[edge] ?? 'default') : undefined
    // Inherit the rendered padding so the overlay follows the clip, tokens and responsive overrides.
    const highlight = edge
      ? `
      main > :first-child { position: relative !important; }
      main > :first-child::after { content: ''; position: absolute; pointer-events: none; inset-inline: 0;
        ${edge}: 0; height: 0; box-sizing: content-box; padding-${edge}: inherit;
        background: repeating-linear-gradient(135deg, #42caff77 0 4px, #42caff22 4px 12px);
        box-shadow: inset 0 ${edge === 'bottom' ? '2px' : '-2px'} #70d5ff; }`
      : ''
    const style = `<style>
      html, body { margin: 0 !important; height: 100%; overflow: hidden; background: transparent !important; }
      body { display: flex; flex-direction: column; justify-content: ${edge === 'bottom' ? 'flex-end' : 'flex-start'}; }
      main { flex: none; }
      *, *::before, *::after { animation: none !important; transition: none !important; }
      ${highlight}
    </style>`
    const html = referenceHtml({ ...page, site: undefined, sections: [section] }).replace('</head>', style + '</head>')
    return { html, value }
  }, [version, change])

  return (
    <figure className="version-preview-tile">
      <figcaption>
        <strong>{label}</strong>
        {sample.value && <span>{sample.value}</span>}
      </figcaption>
      <div className="version-preview-window">
        {sample.color ? (
          <div className="h-full" style={{ backgroundColor: sample.color }} />
        ) : sample.html ? (
          <iframe title={label + ' section preview'} sandbox="" tabIndex={-1} srcDoc={sample.html} />
        ) : (
          <span className="text-xs text-muted-foreground">Section absent</span>
        )}
      </div>
    </figure>
  )
}

export function VisualChangePreview({
  change,
  before,
  after,
  mode,
  initiallyOpen,
}: {
  change: Change
  before: VersionNode
  after: VersionNode
  mode: 'saved' | 'proposal'
  initiallyOpen: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div className="version-visual">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {change.kind === 'spacing' ? 'Spacing preview' : 'Visual preview'} <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="version-preview-pair">
          <PreviewTile version={before} change={change} label={mode === 'saved' ? 'Before' : 'Sent'} />
          <PreviewTile version={after} change={change} label={mode === 'saved' ? 'Saved' : 'Proposed'} />
        </div>
      )}
    </div>
  )
}

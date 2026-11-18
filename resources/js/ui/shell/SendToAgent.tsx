import { Bot } from 'lucide-react'
import type { BuildTarget, VersionNode } from '@/core/types'
import { versionBuildPrompt } from '@/core/export/packet'
import { useAgentLink } from '@/lib/agentLink'
import { canShip, useShippingPrice } from '@/state/shipping'
import { useStore } from '@/state/store'
import { Dropdown, type DropdownOption } from '../controls/Dropdown'

type Action = BuildTarget | 'preview-astro' | 'preview-next'

export function SendToAgent({ version, onReference, className }: {
  version: VersionNode
  onReference?: (target: BuildTarget) => void
  className?: string
}) {
  const connected = useAgentLink((s) => s.status === 'connected')
  const busy = useStore((s) => !!s.agent.versionId)
  const shippingPrice = useShippingPrice()
  const group = shippingPrice === null ? undefined : `$${shippingPrice} once per site`
  const options: DropdownOption<Action>[] = [
    { v: 'astro', label: connected ? 'Copy Astro prompt' : 'Astro files and prompt', group },
    { v: 'next', label: connected ? 'Copy Next.js prompt' : 'Next.js files and prompt', group },
  ]
  if (onReference) {
    options.push(
      { v: 'preview-astro', label: 'Preview Astro', group: 'Preview the code' },
      { v: 'preview-next', label: 'Preview Next.js', group: 'Preview the code' },
    )
  }

  const choose = async (action: Action) => {
    if (action === 'preview-astro' || action === 'preview-next') {
      onReference?.(action === 'preview-astro' ? 'astro' : 'next')
      return
    }
    const st = useStore.getState()
    if (connected) {
      if (!canShip('Handing it to your agent')) return
      try {
        await navigator.clipboard.writeText(versionBuildPrompt(version, action))
        st.showFlash(`Copied the prompt for version ${version.letter}. Paste it into your agent.`)
        return
      } catch {
        st.showFlash('Clipboard unavailable. You can get the prompt and files from Export.')
      }
    }
    st.setUi({ packetSource: version.id, packetTargets: [action], sheet: 'packet' })
  }

  return <Dropdown label="Send to agent" options={options} onChange={choose} disabled={busy}
    lead={<Bot size={13} aria-hidden className="shrink-0" />} className={className} />
}

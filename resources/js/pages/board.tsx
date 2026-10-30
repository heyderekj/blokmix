import { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/state/store'
import { Canvas } from '@/ui/canvas/Canvas'
import { World } from '@/ui/canvas/World'
import { TopBar } from '@/ui/shell/TopBar'
import { Lightbox } from '@/ui/shell/Lightbox'
import { Dock } from '@/ui/shell/Dock'
import { SiteLibrary } from '@/ui/library/SiteLibrary'
import { Flash, HelpOverlay } from '@/ui/shell/Overlays'
import { useShortcuts } from '@/hooks/useShortcuts'

/**
 * The one screen: a canvas with three islands on top and a dock below. Nothing
 * is docked open; each island grows into the panel it controls, one at a time.
 * (An Inertia page once this moves into Laravel.)
 */
export default function Board() {
  const theme = useStore((s) => s.ui.theme)
  const [help, setHelp] = useState(false)
  const toggleHelp = useCallback(() => setHelp((h) => !h), [])
  useShortcuts(toggleHelp)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="relative h-full w-full overflow-hidden" data-board>
      <Canvas>
        <World />
      </Canvas>
      <TopBar onHelp={toggleHelp} />
      <Dock />
      <Lightbox />
      <SiteLibrary />
      <Flash />
      <HelpOverlay open={help} onClose={() => setHelp(false)} />
    </div>
  )
}

import { useEffect } from 'react'
import { useStore } from '@/state/store'
import { Canvas } from '@/ui/canvas/Canvas'
import { World } from '@/ui/canvas/World'
import { TopBar } from '@/ui/shell/TopBar'
import { Lightbox } from '@/ui/shell/Lightbox'
import { Dock } from '@/ui/shell/Dock'
import { SelectionStyle } from '@/ui/panels/SelectionStyle'
import { SiteLibrary } from '@/ui/library/SiteLibrary'
import { Flash, HelpOverlay, toggleHelp } from '@/ui/shell/Overlays'
import { useShortcuts } from '@/hooks/useShortcuts'
import { StartOverlay } from '@/ui/start/StartOverlay'
import { BuySheet } from '@/ui/shell/BuySheet'

/**
 * The one screen: a canvas with three islands on top and a dock below. Nothing
 * is docked open; each island grows into the panel it controls, one at a time.
 * (An Inertia page once this moves into Laravel.)
 */
export default function Board() {
  const theme = useStore((s) => s.ui.theme)
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
      <SelectionStyle />
      <Lightbox />
      <SiteLibrary />
      <Flash />
      <HelpOverlay />
      <StartOverlay />
      <BuySheet />
    </div>
  )
}

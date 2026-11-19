import { useStore } from '@/state/store'
import { canvasApi } from '@/ui/canvas/Canvas'
import { blankMix } from '@/state/seed'
import { mixFromStart, startedWords } from '@/lib/start'
import { buildStarter } from '@/core/starters'
import { library } from '@/data/library'
import { importLocalMix } from '@/ui/shell/TopBar'
import { StartGuide, useStartFlow } from './StartGuide'
import { landOnPage } from '@/ui/shell/landOnPage'

/** The guided start over the browser-only mix: a start (or a blank page, a starter, a file) replaces it, a fresh undo history and all. */
export function StartOverlay() {
  const open = useStartFlow((s) => s.open)
  if (!open) return null
  // The new mix is framed once it has drawn.
  const close = () => {
    useStartFlow.setState({ open: false })
    setTimeout(() => canvasApi.fitMix(), 120)
  }
  return (
    <StartGuide
      onClose={close}
      onBlank={(name) => {
        useStore.getState().openMixData(blankMix(name === 'Your site' ? undefined : name))
        close()
      }}
      onStarter={(starter, name) => {
        const { site, guide } = buildStarter(library, starter)
        useStore.getState().openMixData({ ...blankMix(name === 'Your site' ? starter.name : name), site, guide })
        close()
      }}
      onImport={() => (close(), importLocalMix())}
      onDone={(input, starts, chosen) => {
        const mix = mixFromStart(input, starts, chosen)
        useStore.getState().openMixData(mix)
        close()
        // You land on the page itself, with a few quiet hints above the dock for where to look next.
        landOnPage()
        useStore.getState().showFlash(startedWords(input.name, mix))
      }}
    />
  )
}

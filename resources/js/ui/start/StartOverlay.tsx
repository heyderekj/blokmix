import { useStore } from '@/state/store'
import { canvasApi } from '@/ui/canvas/Canvas'
import { blankMix } from '@/state/seed'
import { mixFromStart, startedWords } from '@/lib/start'
import { buildStarter } from '@/core/starters'
import { starterOpen } from '@/core/library'
import { library } from '@/data/library'
import { importLocalMix } from '@/ui/shell/TopBar'
import { StartGuide, useStartFlow } from './StartGuide'

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
        if (!starterOpen(library, starter)) return useStore.getState().showFlash(`“${starter.name}” uses layouts in a mix pack.`)
        const { site, guide } = buildStarter(library, starter)
        useStore.getState().openMixData({ ...blankMix(name === 'Your site' ? starter.name : name), site, guide })
        close()
      }}
      onImport={() => (close(), importLocalMix())}
      onDone={(input, starts, chosen) => {
        const mix = mixFromStart(input, starts, chosen)
        useStore.getState().openMixData(mix)
        close()
        // Your words are what's left to do: the Words panel opens beside the page, its Next on the first sample.
        useStore.getState().setUi({ leftPanel: 'words' })
        useStore.getState().showFlash(startedWords(input.name, mix))
      }}
    />
  )
}

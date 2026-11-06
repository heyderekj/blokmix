import { useStore } from '@/state/store'
import { canvasApi } from '@/ui/canvas/Canvas'
import { blankMix } from '@/state/seed'
import { mixFromStart } from '@/lib/start'
import { StartFlow, useStartFlow } from './StartFlow'
import { useJevTools } from '@/state/jevSay'

/** The guided start over the browser-only mix: a start (or a blank page) replaces it, a fresh undo history and all. */
export function StartOverlay() {
  const open = useStartFlow((s) => s.open)
  if (!open) return null
  // The new mix is framed once it has drawn.
  const close = () => {
    useStartFlow.setState({ open: false })
    setTimeout(() => canvasApi.fitMix(), 120)
  }
  return (
    <StartFlow
      onClose={close}
      onBlank={() => {
        useStore.getState().openMixData(blankMix())
        close()
      }}
      onWords={(name) => {
        // A blank mix, then the page is made from your words where you can see it.
        useStore.getState().openMixData(blankMix())
        if (name) useStore.getState().setBrand(name)
        close()
        useJevTools.setState({ open: 'page', text: undefined, into: 'this_page' })
      }}
      onDone={(input, starts, chosen) => {
        useStore.getState().openMixData(mixFromStart(input, starts, chosen))
        close()
        useStore.getState().showFlash(`Started ${input.name.trim() || 'your mix'}. The other starts are kept as versions.`)
      }}
    />
  )
}

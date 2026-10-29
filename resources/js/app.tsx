import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import '../css/app.css'
import Board from '@/pages/board'
import { FIRST_VISIT, useStore } from '@/state/store'
import { useStartFlow } from '@/ui/start/StartFlow'
import { library } from '@/data/library'
import { canvasApi } from '@/ui/canvas/Canvas'
import { runCommand, tools } from '@/state/commands'
import { startAgentLink } from '@/lib/agentLink'
import { loadAssets } from '@/lib/assets'
import { isHosted } from '@/lib/host'
import { loadUserClips } from '@/lib/userClips'

if (import.meta.env.DEV) Object.assign(window, { __mx: { store: useStore, library, canvas: canvasApi, startFlow: useStartFlow } })
// The same commands the app uses, for scripts and agents: blokmix.tools(), blokmix.run(name, input).
const agentApi = { tools, run: (name: string, input?: unknown) => runCommand(name, input, 'agent') }
// window.mixtape is the name from before the rename, kept so older agent prompts still work.
Object.assign(window, { blokmix: agentApi, mixtape: agentApi })

startAgentLink()
void loadAssets()

if (isHosted()) {
  // Served by Laravel: an Inertia app, one page component per route (resources/js/pages).
  // Your account's captured clips join the library first, so mixes that use them open whole.
  await loadUserClips()
  const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx', { eager: true })
  void createInertiaApp({
    resolve: (name) => {
      const page = pages[`./pages/${name}.tsx`]
      if (!page) throw new Error(`No page component for "${name}"`)
      return page
    },
    setup({ el, App, props }) {
      createRoot(el!).render(
        <StrictMode>
          <App {...props} />
        </StrictMode>,
      )
    },
  })
} else {
  // On its own (npm run dev): just the board, opening on the guided start the first time.
  if (FIRST_VISIT) useStartFlow.setState({ open: true })
  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <Board />
    </StrictMode>,
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/app.css'
import Board from '@/pages/board'
import { useStore } from '@/state/store'
import { library } from '@/data/library'
import { canvasApi } from '@/ui/canvas/Canvas'
import { runCommand, tools } from '@/state/commands'
import { startAgentLink } from '@/lib/agentLink'
import { loadAssets } from '@/lib/assets'

if (import.meta.env.DEV) Object.assign(window, { __mx: { store: useStore, library, canvas: canvasApi } })
// The same commands the app uses, for scripts and agents: blokmix.tools(), blokmix.run(name, input).
const agentApi = { tools, run: (name: string, input?: unknown) => runCommand(name, input, 'agent') }
// window.mixtape is the name from before the rename, kept so older agent prompts still work.
Object.assign(window, { blokmix: agentApi, mixtape: agentApi })

startAgentLink()
void loadAssets()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Board />
  </StrictMode>,
)

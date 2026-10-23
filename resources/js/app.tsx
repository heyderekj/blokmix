import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/app.css'
import Board from '@/pages/board'
import LabMotion from '@/pages/lab-motion'
import { useStore } from '@/state/store'
import { library } from '@/data/library'
import { canvasApi } from '@/ui/canvas/Canvas'
import { runCommand, tools } from '@/state/commands'
import { startAgentLink } from '@/lib/agentLink'

if (import.meta.env.DEV) Object.assign(window, { __mx: { store: useStore, library, canvas: canvasApi } })
// The same commands the app uses, for scripts and agents: mixtape.tools(), mixtape.run(name, input).
Object.assign(window, { mixtape: { tools, run: (name: string, input?: unknown) => runCommand(name, input, 'agent') } })

startAgentLink()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get('lab') === 'motion' ? <LabMotion /> : <Board />}
  </StrictMode>,
)

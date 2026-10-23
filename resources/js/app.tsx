import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/app.css'
import Board from '@/pages/board'
import LabTrack from '@/pages/lab-track'
import LabVersion from '@/pages/lab-version'
import { useStore } from '@/state/store'
import { library } from '@/data/library'
import { canvasApi } from '@/ui/canvas/Canvas'

if (import.meta.env.DEV) Object.assign(window, { __mx: { store: useStore, library, canvas: canvasApi } })

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    {{ track: <LabTrack />, version: <LabVersion /> }[new URLSearchParams(location.search).get('lab') ?? ''] ?? <Board />}
  </StrictMode>,
)

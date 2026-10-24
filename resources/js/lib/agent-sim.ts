import type { BuildTarget } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { useStore, pauseHistory, resumeHistory } from '@/state/store'
import { useLayout } from '@/state/layout'
import { canvasApi } from '@/ui/canvas/Canvas'
import { placeVersions } from '@/ui/canvas/geometry'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The Build menu's "Reference build": no agent, just the deterministic reference
 * build from the exporters (exactly what the packet contains), and the frame says
 * so. A real agent goes through prepare_build / report_build over MCP and shows
 * the same presence, steps and status flow.
 */
export async function runReferenceBuild(versionId: string, target: BuildTarget) {
  const st = useStore.getState()
  const parent = st.versions[versionId]
  if (!parent || st.agent.versionId) return
  const buildId = st.startBuild(versionId, target)

  // Follow the agent to its new frame.
  setTimeout(() => {
    const s = useStore.getState()
    const p = placeVersions(s.versions, s.ui.viewport, s.framePos).find((x) => x.id === buildId)
    const h = useLayout.getState().frameHeights[versionId] ?? 3000
    if (p) canvasApi.focusRect({ x: p.x - p.w * 1.2, y: p.y - 200, w: p.w * 2.4, h: Math.min(h, 2400) + 200 }, 0.35)
  }, 120)

  const guide = resolveGuide(parent.snapshot.guide)
  const conflicts = guide.conflicts.length
  const steps = [
    'Reading BLOKMIX.md and blokmix.json',
    conflicts ? `Applying ${conflicts} resolved token decisions` : 'Applying the style guide',
    `Writing ${parent.snapshot.slots.length} section components`,
    `Wiring tokens.css into ${target === 'astro' ? 'src/layouts/Base.astro' : 'app/layout.tsx'}`,
    'Rendering the preview',
  ]
  for (let i = 0; i < steps.length; i++) {
    await sleep(i === 0 ? 900 : 700 + Math.random() * 400)
    if (!useStore.getState().versions[buildId]) break
    pauseHistory()
    useStore.getState().updateBuild(buildId, { steps: steps.slice(0, i + 1) })
    useStore.getState().setAgent({ step: i + 1 })
    resumeHistory()
  }
  await sleep(500)
  pauseHistory()
  useStore.getState().updateBuild(buildId, { done: true }, 'ready')
  useStore.getState().setAgent({ versionId: null, step: 0 })
  resumeHistory()
  useStore.getState().showFlash(`${useStore.getState().versions[buildId]?.letter ?? 'Build'} is ready for review`)
}

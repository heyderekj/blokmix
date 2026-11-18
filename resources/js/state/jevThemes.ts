import { jevOn, askJev } from '@/lib/jev'
import { listParts } from '@/core/themeParts'
import { briefContext } from '@/core/brief'
import { rankThemes, visualKey, themeReason } from '@/core/themeRanking'
import { skinList, swapThemeParts, type ThemeParts } from '@/core/skins'
import { STYLE_AREAS, isKept } from '@/core/contract'
import { themeRequest, themeScores, restyleRequest, restyleAnswers, type RestyleChoices } from '@/core/jev/themes'
import type { GuideState } from '@/core/types'
import { useStore } from './store'

export async function scoreLooks(guides: GuideState[], brief: string, title: string, body?: string, signal?: AbortSignal) {
  if (!guides.length || !(await jevOn()) || signal?.aborted) return null
  const { themeShot } = await import('@/lib/themeShot')
  const assets = await Promise.all(guides.map((g) => themeShot(g, title, body)))
  if (signal?.aborted || !assets.every((a) => a !== null)) return null
  return themeScores(await askJev(themeRequest(brief, assets), { signal }), guides.length)
}

function context() {
  const st = useStore.getState()
  const valid = () => {
    const now = useStore.getState()
    return st.guide === now.guide && st.content === now.content && st.contract === now.contract && st.draftId === now.draftId && st.ui.jev === now.ui.jev
  }
  const brief = st.content.brief
  const words = [briefContext(st.content), brief?.feel?.join(', ')].filter(Boolean).join('. ')
  return { st, valid, brief, words }
}

export async function rankByEye(count = 3, flavors = true) {
  const { st, brief, valid, words } = context()
  const ranked = rankThemes({ guide: st.guide, contract: st.contract, brief, count: 10, pool: flavors ? undefined : skinList() })
  const scores = await scoreLooks(
    ranked.map((r) => r.guide),
    words,
    st.content.brand,
    st.content.fields.hero?.headline,
  )
  if (!valid()) return { by: 'stale', themes: [] }
  const themes = ranked.map((r, i) => ({ id: r.skin.id, name: r.skin.name, reason: r.reason, score: scores?.[i] }))
  if (scores) themes.sort((a, b) => b.score! - a.score!)
  return { by: scores ? 'preview' : 'words', themes: themes.slice(0, count) }
}

export async function checkLook() {
  const { st, brief, words, valid } = context()
  const ranked = rankThemes({ brief, guide: st.guide, contract: st.contract, pool: skinList(), count: 5 })
  const trials: { parts: ThemeParts; guide: GuideState }[] = [{ parts: {}, guide: st.guide }]
  const seen = new Set([visualKey(st.guide)])
  for (const area of STYLE_AREAS) {
    if (area === 'motion' || (area === 'color' && st.guide.brand) || isKept(st.contract, area)) continue
    for (const { skin } of ranked) {
      const parts = { [area]: skin.id }
      const guide = swapThemeParts(st.guide, parts, st.contract)
      const key = visualKey(guide)
      if (seen.has(key)) continue
      trials.push({ parts, guide })
      seen.add(key)
      break
    }
  }
  const scores = await scoreLooks(
    trials.map((x) => x.guide),
    words,
    st.content.brand,
    st.content.fields.hero?.headline,
  )
  if (!valid()) return { verdict: 'The look has changed.' }
  if (!scores) return { verdict: 'Visual suggestions are unavailable.' }
  const index = scores.indexOf(Math.max(...scores))
  if (Math.round(scores[index]) <= Math.round(scores[0]))
    return { verdict: scores[0] >= 2 ? 'This already fits.' : 'No clear improvement among these choices.' }
  return { verdict: 'Try this change.', parts: trials[index].parts }
}

export async function restyle(text: string) {
  const { st, valid } = context()
  const choices: RestyleChoices = {}
  for (const row of listParts(st.guide, st.contract)) {
    if (row.kept) continue
    choices[row.area] = Object.fromEntries(
      row.options
        .filter((p) => p.id !== row.current && !(row.area === 'color' && st.guide.brand && !p.id.startsWith('brand/')))
        .map((p) => {
          return [p.id, p.name]
        }),
    )
  }
  if (!Object.keys(choices).length) return { options: [] }
  const picked = restyleAnswers(await askJev(restyleRequest(text, choices)), choices)
  return { options: valid() ? picked.map((parts) => ({ parts, reason: themeReason(swapThemeParts(st.guide, parts, st.contract)) })) : [] }
}

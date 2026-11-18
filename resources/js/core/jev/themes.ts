import { at, choice, score } from './ask'
import { imageRef } from './state'
import { scoreOf } from './read'
import { shuffled, merged } from './shuffle'
import type { JevAsset, JevRequest, JevResponse } from './types'
import type { StyleArea } from '../contract'
import type { ThemeParts } from '../skins'

export function themeRequest(brief: string, pictures: JevAsset[]): JevRequest {
  return {
    model: 'jev-preview',
    state: { brief },
    assets: Object.fromEntries(pictures.map((p, i) => [imageRef(`look${i}`), p])),
    questions: Object.fromEntries(
      pictures.map((_, i) => [
        `fit_${i}`,
        score({ question: `How well does the typography, color and styling suit ${at('brief')}?`, picture: imageRef(`look${i}`) }, [
          'Conflicts',
          'Weak fit',
          'Fits',
          'Fits well',
          'Excellent fit',
        ]),
      ]),
    ),
  }
}
export function themeScores(answer: JevResponse | null, n: number): number[] | null {
  const scores = Array.from({ length: n }, (_, i) => scoreOf(answer, `fit_${i}`)?.score)
  return scores.every((s): s is number => typeof s === 'number' && Number.isFinite(s)) ? scores : null
}
export function suggestedIndex(scores: number[] | null) {
  if (!scores?.length) return -1
  const best = Math.max(...scores)
  const level = Math.round(best)
  return level >= 2 && scores.filter((s) => Math.round(s) === level).length === 1 ? scores.indexOf(best) : -1
}
export type RestyleChoices = Partial<Record<StyleArea, Record<string, string>>>
export function restyleRequest(text: string, options: RestyleChoices): JevRequest {
  return {
    model: 'jev-latest',
    state: { text },
    questions: Object.assign(
      {},
      ...Object.entries(options).map(([area, choices]) =>
        shuffled(
          area,
          choice(`Which ${area} choice best carries out ${at('text')}? Keep it if the request does not ask for this area.`, {
            keep: 'Leave this part as it is',
            ...choices,
          }),
        ),
      ),
    ),
  }
}

export function restyleAnswers(answer: JevResponse | null, options: RestyleChoices): ThemeParts[] {
  const parts: ThemeParts = {}
  for (const area of Object.keys(options) as StyleArea[]) {
    const pick = merged(answer, area)
    if (pick?.agree && pick.choice !== 'keep' && options[area]?.[pick.choice]) parts[area] = pick.choice
  }
  const keys = Object.keys(parts) as StyleArea[]
  return keys.length <= 1 ? (keys.length ? [parts] : []) : [parts, ...keys.slice(0, 2).map((area) => ({ [area]: parts[area] }))]
}

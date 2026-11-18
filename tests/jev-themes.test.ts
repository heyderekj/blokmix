import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import '@/data/skins'
import { fakeJev, realJev } from './helpers/fakeJev'
import { useStore } from '@/state/store'
import { emptyContract } from '@/core/contract'
import { guideFor } from '@/core/start'
import { checkLook, rankByEye, restyle } from '@/state/jevThemes'
import { suggestedIndex } from '@/core/jev/themes'
import { themeShot } from '@/lib/themeShot'
vi.mock('@/lib/themeShot', () => ({ themeShot: vi.fn(async () => ({ type: 'image', format: 'jpg', data_base64: 'sample' })) }))
beforeEach(() => {
  vi.clearAllMocks()
  useStore.setState({ guide: guideFor({ skin: 'studio' }), contract: emptyContract() })
})
afterEach(() => realJev())
it('returns local order without drawing when suggestions are off', async () => {
  fakeJev(undefined, { off: true })
  expect(await rankByEye()).toMatchObject({ by: 'words', themes: expect.any(Array) })
  expect(themeShot).not.toHaveBeenCalled()
})
it('uses the same closed options and bounds visual checks to the request limits', async () => {
  const fake = fakeJev((q) => (q === 'fit_0' ? 4 : 1))
  expect((await rankByEye()).by).toBe('preview')
  expect(await checkLook()).toEqual({ verdict: 'This already fits.' })
  for (const req of fake.requests) {
    expect(Object.keys(req.assets ?? {}).length).toBeLessThanOrEqual(20)
    expect(Object.keys(req.questions).length).toBeLessThanOrEqual(200)
  }
  expect(suggestedIndex([2.1, 2.2])).toBe(-1)
})
it('returns restyle previews without editing and skips kept areas', async () => {
  useStore.setState({ contract: { ...emptyContract(), areas: { shape: 'keep' } } })
  const before = useStore.getState().guide
  const fake = fakeJev((name) => (name.startsWith('type') ? 'vinyl' : 'keep'))
  expect((await restyle('use editorial type')).options.map((o) => o.parts)).toEqual([{ type: 'vinyl' }])
  expect(fake.requests[0].questions.type__r).toBeDefined()
  expect(fake.requests[0].questions.shape).toBeUndefined()
  expect(useStore.getState().guide).toBe(before)
})
it('discards an answer after a draft or brief changes', async () => {
  fakeJev(() => 3, { delayMs: 15 })
  const pending = rankByEye()
  useStore.getState().setBrief({ industry: 'education' })
  expect(await pending).toEqual({ by: 'stale', themes: [] })
})

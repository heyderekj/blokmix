import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { slotClip } from '@/data/library'
import { focusFrom, jevThumbUrl, rankedOrder, rankRequest, FIT_LEVELS } from '@/core/jev/photos'
import { objectPosition, renderMedia } from '@/core/media'
import { boxOnPicture } from '@/lib/jevImage'
import type { JevResponse } from '@/core/jev'
import type { MediaFill, StockPhoto } from '@/core/types'
import { answerFor, fakeJev, realJev } from './helpers/fakeJev'

// No canvas in Node: any picture "converts" to a small JPEG, letterboxed top and bottom by 10%.
vi.mock('@/lib/jevImage', async (orig) => {
  const real = await orig<typeof import('@/lib/jevImage')>()
  return { ...real, toJevJpeg: vi.fn(async () => ({ asset: { type: 'image', format: 'jpg', data_base64: '/9j/' }, inner: { left: 0, top: 0.1, width: 1, height: 0.8 } })) }
})

const photo: StockPhoto = { provider: 'unsplash', id: 'abc', url: 'https://images.unsplash.com/photo-1?ixid=x&auto=format', thumb: '', width: 4000, height: 3000, author: 'Ana', authorUrl: 'https://unsplash.com/@ana', link: 'https://unsplash.com/photos/abc' }

const subjectSaid = (box: { top: number; bottom: number; left: number; right: number }, kind = 'product', clear = 0.9): JevResponse => ({
  model: 'fake',
  usage: { input_tokens: 0, output_tokens: 0 },
  answers: { subject: { type: 'box', box, confidence: null }, has_subject: { type: 'noul', noul: clear }, kind: { type: 'choice', choice: kind, confidence: 0.9, probabilities: { [kind]: 0.9 } } },
})

beforeEach(() => useStore.getState().resetDemo())
afterEach(() => realJev())

describe('keeping the subject in frame', () => {
  it('centers on a thing, and sits near the face for a person', () => {
    expect(focusFrom(subjectSaid({ top: 0.2, bottom: 0.6, left: 0.5, right: 0.9 }))).toEqual({ x: 0.7, y: 0.4, kind: 'product' })
    expect(focusFrom(subjectSaid({ top: 0.1, bottom: 0.9, left: 0.2, right: 0.6 }, 'person'))).toEqual({ x: 0.4, y: 0.32, kind: 'person' })
  })

  it('trusts no box when there is no clear subject, or the box is a speck or the whole picture', () => {
    expect(focusFrom(subjectSaid({ top: 0.2, bottom: 0.6, left: 0.5, right: 0.9 }, 'place', 0.3))).toBeNull()
    expect(focusFrom(subjectSaid({ top: 0.5, bottom: 0.52, left: 0.5, right: 0.52 }))).toBeNull()
    expect(focusFrom(subjectSaid({ top: 0, bottom: 1, left: 0, right: 0.99 }))).toBeNull()
  })

  it('maps a box from the letterboxed canvas Jev saw onto the picture', () => {
    expect(boxOnPicture({ top: 0.1, bottom: 0.5, left: 0, right: 1 }, { left: 0, top: 0.1, width: 1, height: 0.8 })).toEqual({ top: 0, bottom: 0.5, left: 0, right: 1 })
  })

  it('writes the focus as object-position in exports and frames', () => {
    expect(objectPosition({ x: 0.7, y: 0.32 })).toBe('70% 32%')
    const fill: MediaFill = { source: 'stock', stock: photo, focus: { x: 0.7, y: 0.32 } }
    expect(renderMedia(fill, useStore.getState().guide.base as never, '4/3', () => undefined)?.focus).toEqual({ x: 0.7, y: 0.32 })
    // Show it all: nothing is cropped, so no focus.
    expect(renderMedia({ ...fill, fit: 'contain' }, useStore.getState().guide.base as never, '4/3', () => undefined)?.focus).toBeUndefined()
  })

  it('find_subject sets the focus as one undo step', async () => {
    const slot = currentSlots(useStore.getState()).find((s) => slotClip(s).blocks.some((b) => b.kind === 'image'))!
    const img = slotClip(slot).blocks.find((b) => b.kind === 'image')!
    useStore.getState().editBlock(slot.id, img.id, { media: { source: 'stock', stock: photo } })
    useStore.temporal.getState().clear()
    fakeJev((name, q) => (name === 'subject' ? { box: { top: 0.18, bottom: 0.5, left: 0.6, right: 0.9 } } : name === 'kind' ? 'person' : q.type === 'noul' ? 0.9 : undefined))
    const out = (await runCommand('find_subject', { section: slot.id, block: img.id })) as { focus: { x: number; y: number }; subject: string }
    // The box sits in the letterboxed canvas: 0.18–0.5 there is 0.1–0.5 of the picture; a person's focus is near the top.
    expect(out).toMatchObject({ subject: 'person', focus: { x: 0.75, y: 0.21 } })
    const s = currentSlots(useStore.getState()).find((x) => x.id === slot.id)!
    expect(s.edits?.[s.clipId]?.[img.id]?.media?.focus).toEqual({ x: 0.75, y: 0.21 })
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })
})

describe('best fit first', () => {
  it('asks Unsplash for JPEGs Jev can read', () => {
    const u = new URL(jevThumbUrl(photo))
    expect(u.searchParams.get('fm')).toBe('jpg')
    expect(u.searchParams.get('auto')).toBeNull()
    expect(Number(u.searchParams.get('h'))).toBeGreaterThanOrEqual(280)
  })

  it('rates each photo on its own and keeps the original order for ties', () => {
    const req = rankRequest({ words: 'Fresh bread every morning' }, ['<img:p0>', '<img:p1>', '<img:p2>'], {})
    expect(Object.keys(req.questions)).toEqual(['fit_0', 'fit_1', 'fit_2'])
    const answers = Object.fromEntries(Object.entries(req.questions).map(([n, q]) => [n, answerFor(q, { level: n === 'fit_2' ? 4 : n === 'fit_0' ? 1 : 1 })]))
    const { order } = rankedOrder({ model: 'x', answers, usage: { input_tokens: 0, output_tokens: 0 } }, 3)
    expect(order).toEqual([2, 0, 1])
    expect(FIT_LEVELS).toHaveLength(5)
  })
})

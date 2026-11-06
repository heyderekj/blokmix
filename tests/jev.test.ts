import { afterEach, describe, expect, it } from 'vitest'
import { cacheKey, choice, clip, merged, noul, route, shuffled, topTwo, type JevRequest } from '@/core/jev'
import { imageSize, requestProblem } from '@/core/jev/limits'
import { askJev, askLatest, jevOn, setJevAllowed } from '@/lib/jev'
import { jevSize } from '@/lib/jevImage'
import { fakeJev, realJev } from './helpers/fakeJev'

afterEach(() => {
  realJev()
  setJevAllowed(() => true)
})

const req = (words = 'See plans'): JevRequest => ({
  state: { link: { words } },
  questions: { to: choice('Where does `link.words` lead?', { pricing: 'The pricing section', faq: 'The questions', stay: null }) },
})

describe('reading answers', () => {
  it('routes by the probability of the option acted on', () => {
    const t = { act: 0.8, offer: 0.4 }
    expect(route(0.85, t)).toBe('act')
    expect(route(0.5, t)).toBe('offer')
    expect(route(0.2, t)).toBe('none')
    expect(topTwo({ probabilities: { a: 0.2, b: 0.7, c: 0.1 } }).map((x) => x.option)).toEqual(['b', 'a'])
  })

  it('asks a choice in both orders and merges them, agreeing only when both pick the same', () => {
    const q = shuffled('to', choice('Where?', { a: 'A', b: 'B', c: 'C' }))
    expect(Object.keys(q)).toEqual(['to', 'to__r'])
    expect(Object.keys(q.to__r.criteria)).toEqual(['c', 'b', 'a'])
    const answers = {
      to: { type: 'choice' as const, choice: 'a', confidence: 0.6, probabilities: { a: 0.7, b: 0.2, c: 0.1 } },
      to__r: { type: 'choice' as const, choice: 'b', confidence: 0.4, probabilities: { a: 0.4, b: 0.5, c: 0.1 } },
    }
    const m = merged({ model: 'x', answers, usage: { input_tokens: 0, output_tokens: 0 } }, 'to')!
    expect(m.agree).toBe(false)
    expect(m.choice).toBe('a')
    expect(m.probabilities.a).toBeCloseTo(0.55)
  })

  it('trims long words at a word and keys requests stably', () => {
    expect(clip('one two three four five', 12)).toBe('one two…')
    expect(clip('  short  ')).toBe('short')
    const a = cacheKey(req())
    expect(cacheKey(req())).toBe(a)
    expect(cacheKey(req('Pricing'))).not.toBe(a)
  })
})

describe('what leaves our server', () => {
  // A 1×1 PNG header with the given size, and a minimal JPEG with an SOF0 frame.
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33)
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
    new DataView(b.buffer).setUint32(16, w)
    new DataView(b.buffer).setUint32(20, h)
    return b
  }
  const jpeg = (w: number, h: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0])
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')

  it('reads the size of a JPEG or PNG', () => {
    expect(imageSize(png(640, 480))).toEqual({ w: 640, h: 480, type: 'png' })
    expect(imageSize(jpeg(800, 600))).toEqual({ w: 800, h: 600, type: 'jpg' })
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('lets through what Blokmix sends and nothing else', () => {
    const ok = { ...req(), model: 'jev-latest' }
    expect(requestProblem(ok, 300)).toBeNull()
    expect(requestProblem({ ...ok, model: 'gpt' }, 300)).toMatch(/jev-latest/)
    expect(requestProblem({ ...ok, questions: [{ type: 'noul' }] }, 300)).toMatch(/by name/)
    expect(requestProblem({ ...ok, questions: { x: { type: 'essay' } } }, 300)).toMatch(/choice, score/)
    const photo = (b: Uint8Array) => ({ ...ok, model: 'jev-preview', assets: { '<img:p>': { type: 'image', format: 'png', data_base64: b64(b) } } })
    expect(requestProblem(photo(png(640, 480)), 300)).toBeNull()
    expect(requestProblem(photo(png(200, 480)), 300)).toMatch(/280 to 1568/)
    expect(requestProblem(photo(png(2000, 480)), 300)).toMatch(/280 to 1568/)
  })

  it('sizes pictures inside Jev’s limits, padding thin ones', () => {
    expect(jevSize(1600, 900)).toMatchObject({ w: 1568, h: 882 })
    expect(jevSize(400, 225)).toMatchObject({ w: 498, h: 280 })
    // A long thin banner can't grow to 280 without passing 1568, so it's letterboxed.
    const thin = jevSize(3000, 100)
    expect(thin.w).toBe(1568)
    expect(thin.h).toBe(280)
    expect(thin.dh).toBeLessThan(280)
  })
})

describe('asking Jev from the board', () => {
  it('returns answers, and caches the same question', async () => {
    const fake = fakeJev((name) => (name === 'to' ? 'pricing' : undefined))
    const a = await askJev(req())
    expect(a?.answers.to).toMatchObject({ type: 'choice', choice: 'pricing' })
    await askJev(req())
    expect(fake.requests).toHaveLength(1)
  })

  it('falls back (null) when the server has no key or this device turned Jev off', async () => {
    fakeJev(() => 'pricing', { off: true })
    expect(await jevOn()).toBe(false)
    expect(await askJev(req())).toBeNull()
    fakeJev(() => 'pricing')
    setJevAllowed(() => false)
    expect(await askJev(req())).toBeNull()
  })

  it('gives up after its timeout', async () => {
    fakeJev(() => 'pricing', { delayMs: 200 })
    expect(await askJev(req(), { timeoutMs: 20 })).toBeNull()
  })

  it('answers only the latest words when asked as you type', async () => {
    fakeJev(() => 'pricing', { delayMs: 30 })
    const first = askLatest('say', { state: 'room', questions: { x: noul('Roomier?') } })
    const second = askLatest('say', { state: 'roomier', questions: { x: noul('Roomier?') } })
    expect(await first).toBeNull()
    expect(await second).not.toBeNull()
  })
})

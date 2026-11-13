import { describe, expect, it } from 'vitest'
import {
  centerX,
  fitWidth,
  leavesPage,
  normalizeWheel,
  pageBounds,
  PINCH_MAX,
  PINCH_MIN,
  round,
  rubber,
  stepZoom,
  unrubber,
  WHEEL_GAP,
  wheelHand,
  ZOOM_STOPS,
  zoomFactor,
  zoomKey,
  type View,
} from '@/ui/canvas/camera'

const view = (over: Partial<View> = {}): View => ({ w: 1440, h: 900, top: 72, bottom: 88, left: 24, right: 24, ...over })

describe('normalizeWheel', () => {
  it('turns lines and pages into pixels', () => {
    expect(normalizeWheel({ deltaX: 0, deltaY: 3, deltaMode: 1 }).dy).toBe(48)
    expect(normalizeWheel({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 700).dy).toBe(700)
    expect(normalizeWheel({ deltaX: 2.5, deltaY: -4, deltaMode: 0 })).toMatchObject({ dx: 2.5, dy: -4, notch: false, zoom: false })
  })
  it('tells a pinch from a mouse wheel click', () => {
    const pinch = normalizeWheel({ deltaX: 0, deltaY: -3.2, deltaMode: 0, ctrlKey: true })
    expect(pinch).toMatchObject({ zoom: true, notch: false })
    const notch = normalizeWheel({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: true })
    expect(notch).toMatchObject({ zoom: true, notch: true })
    expect(normalizeWheel({ deltaX: 0, deltaY: 3, deltaMode: 1, metaKey: true }).notch).toBe(true)
  })
  it('scrolls sideways with shift on a mouse', () => {
    expect(normalizeWheel({ deltaX: 0, deltaY: 40, deltaMode: 0, shiftKey: true })).toMatchObject({ dx: 40, dy: 0 })
  })
})

describe('wheelHand', () => {
  const run = (deltas: number[], gap = 16) => {
    let hand = null as ReturnType<typeof wheelHand> | null
    return deltas.map((d, i) => (hand = wheelHand(hand, normalizeWheel({ deltaX: 0, deltaY: d, deltaMode: 0 }).notch, i * gap)).kind)
  }
  it('keeps a fast trackpad flick a trackpad, whole-pixel deltas and all', () => {
    expect(run([2, 6, 14, 30, 52, 80, 110, 120, 104, 86, 70, 55, 42])).toEqual(Array(13).fill('pad'))
  })
  it('reads a mouse wheel spun fast as clicks', () => {
    expect(run([100, 100, 100, 100])).toEqual(Array(4).fill('mouse'))
  })
  it('turns trackpad as soon as a gesture shows it, and starts fresh after a pause', () => {
    expect(run([100, 100, 4, 100])).toEqual(['mouse', 'mouse', 'pad', 'pad'])
    expect(run([4, 100], WHEEL_GAP)).toEqual(['pad', 'mouse'])
  })
})

describe('zoomFactor', () => {
  it('clamps a pinch per event', () => {
    expect(zoomFactor({ dy: -500, notch: false }, 1)).toBe(PINCH_MAX)
    expect(zoomFactor({ dy: 500, notch: false }, 1)).toBe(PINCH_MIN)
    expect(zoomFactor({ dy: -2, notch: false }, 1)).toBeCloseTo(Math.exp(0.02))
    expect(zoomFactor({ dy: 0, notch: false }, 1)).toBe(1)
  })
  it('steps one stop per mouse wheel click', () => {
    expect(1 * zoomFactor({ dy: -100, notch: true }, 1)).toBeCloseTo(1.25)
    expect(1 * zoomFactor({ dy: 100, notch: true }, 1)).toBeCloseTo(0.9)
  })
})

describe('stepZoom', () => {
  it('walks the stops both ways', () => {
    expect(stepZoom(1, 1)).toBe(1.25)
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(0.8, 1)).toBe(0.9)
    expect(stepZoom(0.8, -1)).toBe(0.75)
    expect(stepZoom(2, 1)).toBe(2)
    expect(stepZoom(ZOOM_STOPS[0], -1)).toBe(ZOOM_STOPS[0])
  })
  it('is the same step everywhere: out then in comes back', () => {
    for (const s of ZOOM_STOPS.slice(1, -1)) expect(stepZoom(stepZoom(s, -1), 1)).toBe(s)
  })
})

describe('fitWidth', () => {
  it('shows a desktop page at 100% on a 1440 window', () => {
    const f = fitWidth(1280, view())
    expect(f.z).toBe(1)
    expect(f.x).toBe(24 + (1392 - 1280) / 2)
  })
  it('never zooms past maxZ', () => {
    expect(fitWidth(390, view()).z).toBe(1)
    expect(fitWidth(390, view(), 56, 2).z).toBe(2)
  })
  it('fits between docked panels', () => {
    const v = view({ right: 24 + 364, left: 24 + 200 })
    const f = fitWidth(1280, v, 40)
    expect(f.z).toBeCloseTo((1440 - 224 - 388 - 80) / 1280)
    // Centred in the free space, not the window.
    const free = 1440 - 224 - 388
    expect(f.x + (1280 * f.z) / 2).toBeCloseTo(224 + free / 2)
    expect(centerX(1280, f.z, v)).toBe(f.x)
  })
  it('fits a phone', () => {
    const f = fitWidth(1280, view({ w: 390, h: 800 }))
    expect(f.z).toBeGreaterThan(0.2)
    expect(f.x).toBeGreaterThan(24)
  })
})

describe('pageBounds and rubber', () => {
  it('scrolls from the top to the end', () => {
    const b = pageBounds(4000, 1, view())
    expect(b.max).toBe(72 + 64)
    expect(b.min).toBe(900 - 88 - 120 - 4000)
  })
  it('a short page does not scroll', () => {
    const b = pageBounds(300, 1, view())
    expect(b.min).toBe(b.max)
  })
  it('gives less and less past the ends, never more than dim', () => {
    expect(rubber(-100, -500, 0, 200)).toBe(-100)
    const a = rubber(50, -500, 0, 200)
    const b = rubber(200, -500, 0, 200)
    const c = rubber(5000, -500, 0, 200)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(50)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeLessThan(200)
    expect(rubber(-600, -500, 0, 200)).toBeGreaterThan(-600)
    expect(rubber(-600, -500, 0, 200)).toBeLessThan(-500)
  })
  it('picks a stretched page up where it is', () => {
    for (const y of [-900, -620, -100, 30, 400]) expect(rubber(unrubber(rubber(y, -500, 0, 200), -500, 0, 200), -500, 0, 200)).toBeCloseTo(rubber(y, -500, 0, 200))
  })
})

describe('leavesPage', () => {
  it('lets go of the page only well below fitting it', () => {
    expect(leavesPage(1, 1)).toBe(false)
    expect(leavesPage(0.7, 1)).toBe(false)
    expect(leavesPage(0.6, 1)).toBe(false)
    expect(leavesPage(0.59, 1)).toBe(true)
    expect(leavesPage(0.2, 0.4)).toBe(true)
    expect(leavesPage(0.3, 0.4)).toBe(false)
  })
})

describe('round', () => {
  it('snaps to device pixels', () => {
    expect(round(10.4)).toBe(10)
    expect(round(10.3, 2)).toBe(10.5)
    expect(round(-3.26, 2)).toBe(-3.5)
  })
})

describe('zoomKey', () => {
  const k = (key: string, code: string, mods: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}) => zoomKey({ key, code, ...mods })
  it('reads ⌘ zoom keys', () => {
    expect(k('=', 'Equal', { metaKey: true })).toBe('in')
    expect(k('+', 'Equal', { metaKey: true, shiftKey: true })).toBe('in')
    expect(k('-', 'Minus', { ctrlKey: true })).toBe('out')
    expect(k('0', 'Digit0', { metaKey: true })).toBe('fitWidth')
    expect(k('1', 'Digit1', { metaKey: true })).toBe('actual')
    expect(k('2', 'Digit2', { metaKey: true })).toBe(null)
    expect(k('z', 'KeyZ', { metaKey: true })).toBe(null)
  })
  it('reads ⇧ digits by their key, not the symbol', () => {
    expect(k('!', 'Digit1', { shiftKey: true })).toBe('fitAll')
    expect(k('@', 'Digit2', { shiftKey: true })).toBe('selection')
    expect(k(')', 'Digit0', { shiftKey: true })).toBe('actual')
  })
  it('steps with + and −, and leaves plain digits and ⌥ alone', () => {
    expect(k('+', 'Equal', { shiftKey: true })).toBe('in')
    expect(k('=', 'Equal')).toBe('in')
    expect(k('-', 'Minus')).toBe('out')
    expect(k('1', 'Digit1')).toBe(null)
    expect(k('=', 'Equal', { altKey: true })).toBe(null)
  })
})

// How a page holds up, in plain words. A page is a function of a few inputs (its
// sections, its style guide, the screen it's on), so you can ask what fills the
// first screen and whether it holds at every width (after Shu Ding's "The
// Calculus of Interfaces"). We don't compile pages into math: the browser lays the
// real page out at each width (`lib/measure.ts`) and this reads the result.

/** What one width's layout showed. Positions are page pixels from the top. */
export interface PageMeasure {
  /** The screen: width and the height of what shows before scrolling. */
  width: number
  height: number
  /** The page's widest point: more than `width` means something spills sideways. */
  scrollWidth: number
  docHeight: number
  /** Where the nav ends (0 without one). */
  navBottom: number
  /** The opening section's main heading, and how many lines it wraps to. */
  headline?: { top: number; bottom: number; lines: number }
  /** The opening section's first button. */
  button?: { top: number; bottom: number }
  /** Every block that starts above the fold, top to bottom: what a visitor sees before scrolling. */
  shown?: { slot: string; block: string }[]
}

export interface ScoreCheck {
  id: string
  ok: boolean
  /** What it means for the page, in a sentence. */
  words: string
  /** How much it counts. Informational checks weigh 0. */
  weight: number
}

export interface PageScore {
  /** 0–100. */
  score: number
  checks: ScoreCheck[]
  /** The page's length on a phone, in screens. */
  phoneScreens: number | null
}

/** The screens a start is measured on: a laptop and a phone for the first screen, and the widths between for spills. */
export const SCREENS = {
  laptop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
} as const
export const SWEEP = [360, 768, 1024, 1440] as const

const above = (b: { bottom: number } | undefined, fold: number) => !!b && b.bottom <= fold

/**
 * Read the measurements at each width into checks and a score. `byWidth` is keyed by width; `extra` adds checks
 * read some other way (the five-second test: what a visitor would make of the first screen's words).
 */
export function scorePage(byWidth: Record<number, PageMeasure>, extra: ScoreCheck[] = []): PageScore {
  const checks: ScoreCheck[] = []
  const laptop = byWidth[SCREENS.laptop.width]
  const phone = byWidth[SCREENS.phone.width]

  const firstScreen = (m: PageMeasure | undefined, where: string) => {
    if (!m) return
    const head = above(m.headline, m.height)
    const btn = above(m.button, m.height)
    if (m.headline || m.button) {
      checks.push({
        id: `first-${where}`,
        ok: head && (btn || !m.button),
        weight: 3,
        words:
          head && btn
            ? `Headline and button show on a ${where} without scrolling`
            : head
              ? m.button
                ? `On a ${where}, the button sits below the first screen`
                : `Headline shows on a ${where} without scrolling`
              : `On a ${where}, the headline starts below the first screen`,
      })
    }
    const share = m.navBottom / m.height
    checks.push({
      id: `nav-${where}`,
      ok: share < 0.2,
      weight: 1,
      words: share < 0.2 ? `The nav stays out of the way on a ${where}` : `The nav takes ${Math.round(share * 100)}% of a ${where}’s first screen`,
    })
  }
  firstScreen(laptop, 'laptop')
  firstScreen(phone, 'phone')

  if (phone?.headline) {
    const lines = phone.headline.lines
    checks.push({
      id: 'headline-lines',
      ok: lines <= 4,
      weight: 1,
      words: lines <= 4 ? `The headline fits in ${lines} line${lines === 1 ? '' : 's'} on a phone` : `The headline runs to ${lines} lines on a phone; fewer words would read faster`,
    })
  }

  const spills = Object.values(byWidth)
    .filter((m) => m.scrollWidth > m.width + 1)
    .map((m) => m.width)
    .sort((a, b) => a - b)
  if (Object.keys(byWidth).length) {
    checks.push({
      id: 'no-spill',
      ok: !spills.length,
      weight: 2,
      words: spills.length ? `Something spills off the side at ${spills.map((w) => `${w}px`).join(', ')}` : 'Nothing spills off the side, from phones to wide screens',
    })
  }

  checks.push(...extra)
  const total = checks.reduce((n, c) => n + c.weight, 0)
  const got = checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0)
  return {
    score: total ? Math.round((got / total) * 100) : 0,
    checks,
    phoneScreens: phone ? Math.round((phone.docHeight / phone.height) * 10) / 10 : null,
  }
}

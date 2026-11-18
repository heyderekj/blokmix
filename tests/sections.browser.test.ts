import { afterAll, describe, expect, it } from 'vitest'
import { launchBrowser } from '../extension/scripts/fixtures'
import { library } from '@/data/library'
import { composeSite } from '@/core/compose'
import { resolveGuide } from '@/core/guide'
import { guideFor, startCandidates } from '@/core/start'
import { referenceHtml } from '@/core/export/reference-html'
import { SLIDER_JS } from '@/core/export/slider-runtime'

const browser = await launchBrowser()
afterAll(() => browser?.close())

describe.skipIf(!browser)('navigation and slider controls in Chrome', () => {
  it('offers the final stop even when only a small part of the last card is out of view', async () => {
    const page = await browser!.newPage({ reducedMotion: 'reduce' })
    try {
      await page.setContent(`<style>
        [data-slider-track] { width: 400px; display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; }
        [data-slider-track] > div { flex: 0 0 200px; scroll-snap-align: start; }
      </style>
      <div data-slider>
        <div data-slider-track><div>One</div><div>Two</div></div>
        <button type="button" data-slider-next>Next</button>
      </div>
      <script>${SLIDER_JS}</script>`)
      await page.locator('[data-slider-ready]').waitFor()
      const next = page.getByRole('button', { name: 'Next' })
      expect(await next.isEnabled()).toBe(true)
      await next.click()
      await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('[data-slider-next]')?.disabled)
      expect(await page.locator('[data-slider-track]').evaluate((el) => el.scrollLeft)).toBe(20)
    } finally {
      await page.close()
    }
  })

  it('shows real links in the compact menu and closes it with Escape', async () => {
    const start = startCandidates({ kind: 'local', name: 'Flour House' }, library)[0]
    const guide = guideFor({ skin: 'counter-service' })
    const composed = composeSite({ site: start.site, content: start.content, library, guide: resolveGuide(guide), page: guide })
    const page = await browser!.newPage({ viewport: { width: 390, height: 844 } })
    try {
      await page.setContent(referenceHtml(composed).replace(/<link[^>]*>/g, ''))
      const nav = page.getByRole('navigation', { name: 'Primary navigation' })
      const toggle = nav.getByRole('button', { name: 'Menu' })
      await toggle.press('Enter')
      const links = nav.getByRole('list').getByRole('link')
      await links.first().waitFor()
      const hasRoom = await links.evaluateAll((els) => els.every((el, i) => i === 0 || els[i - 1].getBoundingClientRect().bottom <= el.getBoundingClientRect().top + 1))
      expect(hasRoom).toBe(true)
      const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')))
      expect(hrefs.every((href) => href && href !== '#')).toBe(true)
      await links.first().press('Escape')
      expect(await toggle.getAttribute('aria-expanded')).toBe('false')
      expect(await toggle.evaluate((el) => document.activeElement === el)).toBe(true)
    } finally {
      await page.close()
    }
  })
})

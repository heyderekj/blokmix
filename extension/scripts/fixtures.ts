// Capture saved HTML fixtures in a real Chrome (Playwright drives the browser
// already on this machine), the same way the extension does on a live page.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright-core'
import type { SectionType } from '@/core/types'
import { snapshotSection } from '../src/snapshot'
import type { Snapshot } from '../src/capture/types'

export const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url))

export interface FixtureSection {
  selector: string
  type: SectionType
}

export interface Fixture {
  file: string
  host: string
  sections: FixtureSection[]
}

/** The fixture pages and the sections tests capture from them. */
export const FIXTURE_PAGES: Fixture[] = [
  {
    file: 'lumen.html',
    host: 'lumen.example',
    sections: [
      { selector: '.site-header', type: 'nav' },
      { selector: '#hero', type: 'hero' },
      { selector: '#features', type: 'features' },
      { selector: '#pricing', type: 'pricing' },
      { selector: '#faq', type: 'faq' },
      { selector: '.site-footer', type: 'footer' },
    ],
  },
  {
    file: 'orbit.html',
    host: 'orbit.example',
    sections: [
      { selector: '#logos', type: 'logos' },
      { selector: '#quotes', type: 'testimonials' },
      { selector: '#numbers', type: 'stats' },
      { selector: '#cta', type: 'cta' },
    ],
  },
  {
    file: 'folio.html',
    host: 'folio.example',
    sections: [
      { selector: '#story', type: 'content' },
      { selector: '#team', type: 'team' },
      { selector: '#journal', type: 'blog' },
      { selector: '#contact', type: 'contact' },
    ],
  },
]

/** Launch Chrome: Playwright's own build if installed, else the system Chrome. Null when neither is there. */
export async function launchBrowser(): Promise<Browser | null> {
  for (const opts of [{}, { channel: 'chrome' }, { channel: 'chromium' }]) {
    try {
      return await chromium.launch(opts)
    } catch {
      /* try the next */
    }
  }
  return null
}

/** Load a fixture as https://<host>/ and snapshot each section. */
export async function snapshotFixture(browser: Browser, fx: Fixture, viewport = { width: 1440, height: 900 }, shots?: string): Promise<Map<string, Snapshot>> {
  const html = readFileSync(FIXTURES + fx.file, 'utf8')
  const page = await browser.newPage({ viewport })
  // Offline: the page itself, and a 404 for everything else (images, fonts).
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.host === fx.host && url.pathname === '/' ? route.fulfill({ contentType: 'text/html', body: html }) : route.fulfill({ status: 404, body: '' })
  })
  await page.goto(`https://${fx.host}/`)
  const out = new Map<string, Snapshot>()
  if (shots) for (const s of fx.sections) await page.locator(s.selector).first().screenshot({ path: `${shots}/${s.type}.${fx.host.split('.')[0]}.original.png`, animations: 'disabled' })
  for (const s of fx.sections) {
    const snap = await page.evaluate(
      ([src, sel]) => {
        const fn = (0, eval)(`(${src})`) as typeof snapshotSection
        const el = document.querySelector(sel)
        if (!el) throw new Error(`No element for ${sel}`)
        return fn(el, {})
      },
      [snapshotSection.toString(), s.selector] as const,
    )
    out.set(s.selector, snap)
  }
  await page.close()
  return out
}

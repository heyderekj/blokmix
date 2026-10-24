// End-to-end check of the built extension in Chrome for Testing (branded Chrome
// no longer loads unpacked extensions from the command line):
//   npm run extension:build && npx vite-node extension/scripts/e2e.ts [executablePath]
// Picks the features section of the lumen fixture with the mouse, accepts the
// guessed type with Enter, and screenshots the panel to .out/e2e-panel.png.

import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { FIXTURES } from './fixtures'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const cache = join(homedir(), 'Library/Caches/ms-playwright')
const cft =
  process.argv[2] ??
  (existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().map((d) => join(cache, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')).find(existsSync) : undefined)
if (!cft) throw new Error('Chrome for Testing not found: npx playwright-core install chromium, or pass its path')

const ctx = await chromium.launchPersistentContext('', {
  executablePath: cft,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
})
const html = readFileSync(FIXTURES + 'lumen.html', 'utf8')
await ctx.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.protocol === 'chrome-extension:') return route.continue()
  return url.host === 'lumen.example' && url.pathname === '/' ? route.fulfill({ contentType: 'text/html', body: html }) : route.fulfill({ status: 404, body: '' })
})
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
const extId = new URL(sw.url()).host

const page = await ctx.newPage()
await page.goto('https://lumen.example/')
await sw.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ url: 'https://lumen.example/*' })
  await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] })
  await chrome.tabs.sendMessage(tab.id!, { type: 'blokmix:pick' })
})
const card = page.locator('#features .card h3').first()
await card.scrollIntoViewIfNeeded()
const box = (await card.boundingBox())!
await page.mouse.move(box.x + 10, box.y + 5)
await page.mouse.move(box.x + 20, box.y + 8)
mkdirSync('.out', { recursive: true })
await page.screenshot({ path: '.out/e2e-hover.png' })
await page.mouse.click(box.x + 20, box.y + 8)
await page.waitForTimeout(300)
await page.screenshot({ path: '.out/e2e-chooser.png' })
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)

const stored = (await sw.evaluate(() => chrome.storage.local.get('captures'))) as { captures?: { type: string; snapshot: { selector: string } }[] }
console.log('captures:', stored.captures?.map((c) => `${c.type} ← ${c.snapshot.selector}`))

const panel = await ctx.newPage()
await panel.setViewportSize({ width: 420, height: 1100 })
await panel.goto(`chrome-extension://${extId}/panel.html`)
await panel.waitForTimeout(1500)
await panel.screenshot({ path: '.out/e2e-panel.png', fullPage: true })
console.log((await panel.locator('.lint').first().textContent())?.trim())
await ctx.close()

// Page-side helpers for reading a whole page at once: dismissing a consent banner, splitting the page into
// sections, typing each one, and the page-wide style facts the site's tokens are merged from.
//
// Like snapshot.ts, every export is ONE self-contained function (no imports, every helper inside), so the
// library CLI can run it in a headless page through toString(). The picker imports guessSectionType directly.

import type { SectionType } from '@/core/types'

export interface FoundSection {
  n: number
  box: { x: number; y: number; w: number; h: number }
  tag: string
  /** A fixed or sticky bar at the top of the page (drawn over what's below it). */
  fixed: boolean
  /** The section starts under a fixed nav that overlaps it (a hero behind a transparent bar). */
  underNav: boolean
  selector: string
}

export interface TypeGuess {
  type: SectionType
  confidence: number
  reason: string
}

export interface TypeContext {
  /** Place among the page's sections and how many there are. */
  index: number
  count: number
  /** The site's home page (a page-title block at the top of any other page is a `header`). */
  home: boolean
  /** Index of the first section that isn't the nav. */
  firstContent: number
}

export interface PageFacts {
  bodyBg: string
  bodyColor: string
  htmlBg: string
  /** :root / html custom properties, resolved. */
  vars: Record<string, string>
  /** Families the page loads with @font-face (document.fonts), loaded ones first. */
  fontFaces: string[]
  typekit: boolean
  fontLinks: string[]
  /** Solid button-like controls, grouped by fill and text color. */
  buttons: { bg: string; color: string; count: number }[]
  /** Flex/grid gaps in px, one entry per container. */
  gaps: number[]
  /** Paragraph font sizes (px) → characters set in them: the reading size. */
  bodySizes: Record<string, number>
}

/** Click away a cookie/consent banner, preferring reject / essential-only. Returns what it clicked, or null. */
export function dismissConsent(): string | null {
  const ids = [
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    '.cky-btn-reject',
    '#didomi-notice-disagree-button',
    '[data-testid="uc-deny-all-button"]',
    '.osano-cm-denyAll',
    '#truste-consent-required',
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '.cky-btn-accept',
    '#didomi-notice-agree-button',
    '[data-testid="uc-accept-all-button"]',
    '#truste-consent-button',
  ]
  const shown = (e: Element) => {
    const r = e.getBoundingClientRect()
    const s = getComputedStyle(e)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0
  }
  for (const sel of ids) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el && shown(el)) {
      el.click()
      return sel
    }
  }
  const REJECT = /^(reject( all| non-essential| optional| additional)?( cookies)?|decline( all| optional)?( cookies)?|deny( all)?|only (essential|necessary)( cookies)?|(use )?(essential|necessary|required) (cookies )?only|continue without accepting|refuse( all)?)$/i
  const ACCEPT = /^(accept( all)?( cookies)?|agree( and close)?|i agree|allow( all)?( cookies)?|got it|ok(ay)?|i understand|understood|continue)$/i
  const bannerish = (e: Element) => {
    for (let p: Element | null = e; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p)
      const hint = `${p.id} ${typeof p.className === 'string' ? p.className : ''} ${p.getAttribute('aria-label') ?? ''} ${p.getAttribute('role') ?? ''}`
      if (/cookie|consent|gdpr|privacy|cmp|onetrust|didomi|banner|dialog/i.test(hint) || s.position === 'fixed' || s.position === 'sticky') return true
    }
    return false
  }
  // Never a link that leads somewhere else: clicking it would leave the page.
  const leaves = (e: Element) => e.tagName === 'A' && !/^(#|javascript:|$)/i.test((e.getAttribute('href') ?? '').trim())
  const controls = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]')).filter(
    (e) => shown(e) && bannerish(e) && !leaves(e) && !e.closest('a[href]:not([href^="#"]):not([href^="javascript:"])'),
  )
  const label = (e: Element) => ((e as HTMLInputElement).value || e.textContent || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()
  const pick = controls.find((e) => REJECT.test(label(e))) ?? controls.find((e) => ACCEPT.test(label(e)))
  if (pick) {
    ;(pick as HTMLElement).click()
    return label(pick)
  }
  return null
}

/**
 * Close what floats over the page once consent is handled: modal dialogs (role=dialog, aria-modal, <dialog open>),
 * fixed overlays covering a large part of the viewport (a newsletter pop-up, a region picker) and bars fixed to the
 * bottom edge (a cookie or app-download bar). With `hide` false it clicks each one's close control (aria-label, title
 * or text: close, dismiss, no thanks, ×…); with `hide` true whatever is still there is set to display: none. The top
 * nav, small floating buttons and fixed backgrounds holding the page's own content are left alone. Returns what it did.
 */
export function dismissPopups(hide = false): string[] {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const done: string[] = []
  const shown = (e: Element) => {
    const s = getComputedStyle(e)
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const fixedish = (e: Element) => getComputedStyle(e).position === 'fixed'
  const pageText = Math.max(1, (document.body.innerText ?? '').length)
  const textOf = (e: Element) => ((e as HTMLElement).innerText ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()
  const nameOf = (e: Element) => {
    const id = e.id ? `#${e.id}` : ''
    const cls = typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/)[0]}` : ''
    return `${e.tagName.toLowerCase()}${id}${cls}`
  }
  // The page's own content (a smooth-scroll container fixed in place, a fixed background) is never an overlay.
  const holdsPage = (e: Element) => textOf(e).length > pageText * 0.35 || (!!e.querySelector('main, h1') && !e.closest('[role="dialog"], [aria-modal="true"], dialog'))
  const isTopBar = (r: DOMRect) => r.top <= 12 && r.height <= 240 && r.width >= vw * 0.6
  const area = (r: DOMRect) => Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
  const COOKIE = /cookie|consent|privacy|tracking|gdpr|personal data|your data|preferences/i

  const found = new Set<Element>()
  // Dialogs the page marks as such.
  for (const e of Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]'))) {
    if (!shown(e)) continue
    const r = e.getBoundingClientRect()
    if (r.width < 160 || r.height < 60 || area(r) < vw * vh * 0.02) continue
    // A menu panel that happens to be a dialog but sits offscreen or is the nav itself.
    if (isTopBar(r) && !COOKIE.test(textOf(e))) continue
    found.add(e)
  }
  // Fixed layers: large ones over the middle of the screen, and bars along the bottom edge.
  for (const e of Array.from(document.body.querySelectorAll('*'))) {
    if (!fixedish(e) || !shown(e)) continue
    const r = e.getBoundingClientRect()
    if (isTopBar(r)) continue
    const big = area(r) >= vw * vh * 0.25
    const bottomBar = r.bottom >= vh - 8 && r.top > vh * 0.45 && r.width >= vw * 0.4 && r.height >= 40
    // A card pinned to a bottom corner: a cookie notice, or a promo panel with things to press.
    const anchored = r.bottom >= vh - 48 && r.top > vh * 0.35
    const cornerCard = r.width >= 260 && r.height >= 120 && area(r) >= vw * vh * 0.05 && (COOKIE.test(textOf(e)) || (anchored && e.querySelectorAll('a, button').length >= 1))
    if (!big && !bottomBar && !cornerCard) continue
    if (holdsPage(e)) continue
    const t = textOf(e)
    const controls = e.querySelectorAll('button, a, input, [role="button"]').length
    // A big fixed layer with nothing to read or press is a backdrop or a background, not a pop-up.
    if (!t && !controls) {
      // A scrim: only when something marked as a dialog (or a fixed card) sits on it.
      if (!big || parseFloat(getComputedStyle(e).zIndex || '0') <= 0) continue
    }
    if (bottomBar && !big && !COOKIE.test(t) && !/app|download|sign up|subscribe|newsletter|offer|discount|%/i.test(t)) continue
    found.add(e)
  }
  // What sits on top at the center of the screen, when it's a fixed layer that isn't the page.
  for (const [x, y] of [[vw / 2, vh / 2], [vw / 2, vh * 0.35]]) {
    let layer: Element | null = null
    for (let p = document.elementFromPoint(x, y); p && p !== document.body; p = p.parentElement) if (fixedish(p)) layer = p
    if (layer && !isTopBar(layer.getBoundingClientRect()) && !holdsPage(layer) && (textOf(layer) || layer.querySelector('button, input, a'))) found.add(layer)
  }
  // Outermost only.
  const layers = Array.from(found).filter((e) => !Array.from(found).some((o) => o !== e && o.contains(e)))

  const CLOSE = /^(close|close (dialog|modal|popup|pop-up|banner|this|window|overlay|message|form|newsletter( signup)?)|dismiss|no,? thanks?|no thank you|not now|maybe later|skip|later|×|✕|✖|x|continue to (site|website|shop)|stay on .*|reject( all)?|decline( all)?)$/i
  const CLOSE_HINT = /close|dismiss|modal__x|popup-x|btn-x/i
  const labelOf = (e: Element) => (e.getAttribute('aria-label') || e.getAttribute('title') || textOf(e) || (e as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim()
  for (const layer of layers) {
    if (!hide) {
      // The close control may sit beside the dialog in the same overlay (or the overlay is the dialog's parent).
      const scope = layer.closest('[role="dialog"], [aria-modal="true"], dialog') ?? layer
      // Never a link that leads somewhere else: clicking it would leave the page.
      const leaves = (c: Element) => !!c.closest('a[href]') && !/^(#|javascript:|$)/i.test((c.closest('a[href]')!.getAttribute('href') ?? '').trim())
      const controls = Array.from(scope.querySelectorAll('button, a, [role="button"], input[type="button"], [aria-label], [title]')).filter((c) => shown(c) && !leaves(c))
      const pick =
        controls.find((c) => CLOSE.test(labelOf(c))) ??
        controls.find((c) => /^(button|a)$/i.test(c.tagName) && CLOSE_HINT.test(`${c.getAttribute('aria-label') ?? ''} ${c.getAttribute('title') ?? ''} ${typeof c.className === 'string' ? c.className : ''} ${c.id}`)) ??
        controls.find((c) => /^(button|a)$/i.test(c.tagName) && !textOf(c) && c.querySelector('svg') && c.getBoundingClientRect().width <= 64 && c.getBoundingClientRect().height <= 64)
      if (pick) {
        ;(pick as HTMLElement).click()
        done.push(`closed ${nameOf(layer)} (“${labelOf(pick).slice(0, 30) || 'icon'}”)`)
      }
    } else {
      ;(layer as HTMLElement).style.setProperty('display', 'none', 'important')
      done.push(`hid ${nameOf(layer)}`)
    }
  }
  // A modal usually locks scrolling; give it back once something was taken away.
  if (hide && done.length) {
    for (const e of [document.documentElement, document.body]) {
      const s = getComputedStyle(e)
      if (s.overflowY === 'hidden') (e as HTMLElement).style.setProperty('overflow', 'visible', 'important')
      if (s.position === 'fixed') {
        ;(e as HTMLElement).style.setProperty('position', 'static', 'important')
        ;(e as HTMLElement).style.setProperty('top', 'auto', 'important')
      }
    }
  }
  return done
}

/**
 * Split the page into sections: descend through wrappers (single-child boxes, <main>, app roots, runs of stacked
 * <section>s, very tall boxes made of stacked full-width blocks), take a fixed/sticky top bar as the nav and a
 * trailing <footer> as the footer, skip tiny, empty or floating blocks. Marks each with data-mx-lib="<n>".
 * Call it scrolled to the top.
 */
export function findSections(): FoundSection[] {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const body = document.body
  const SKIP = /^(script|style|link|meta|noscript|template|svg|iframe|dialog|br|hr)$/i
  const SECTIONY = /^(section|header|footer|nav|aside|article)$/i
  const WRAPPER_ID = /^(root|app|__next|__nuxt|main|page|wrapper|content|site|smooth-wrapper|smooth-content|main-content|maincontent|page-wrapper|site-content)$/i
  const box = (e: Element) => {
    const r = e.getBoundingClientRect()
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }
  }
  const visible = (e: Element) => {
    const s = getComputedStyle(e)
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const pos = (e: Element) => getComputedStyle(e).position
  const sizable = (e: Element, minW = vw * 0.5) => !SKIP.test(e.tagName) && visible(e) && box(e).w >= minW && box(e).h >= 24
  const floating = (e: Element) => pos(e) === 'fixed' || pos(e) === 'sticky'
  // Boxes that draw nothing themselves (display: contents, or a zero-size wrapper whose children overflow it) are
  // looked through: their children count as the parent's.
  const hollow = (e: Element) => {
    if (SKIP.test(e.tagName)) return false
    const s = getComputedStyle(e)
    if (s.display === 'none') return false
    if (s.display === 'contents') return true
    const r = e.getBoundingClientRect()
    return (r.width < 2 || r.height < 2) && e.children.length > 0 && s.overflow !== 'hidden' && s.visibility !== 'hidden'
  }
  const childrenOf = (e: Element, depth = 0): Element[] =>
    Array.from(e.children).flatMap((c) => (depth < 6 && hollow(c) ? childrenOf(c, depth + 1) : [c]))
  const kidsOf = (e: Element, minW = vw * 0.5) => childrenOf(e).filter((k) => sizable(k, minW))
  const REPLACED = /^(img|video|canvas|picture|iframe|object|embed)$/i
  const hasContent = (e: Element) => (e.textContent ?? '').trim().length > 0 || !!e.querySelector('img, svg, video, canvas, picture, input, iframe') || getComputedStyle(e).backgroundImage !== 'none'
  // A section is rarely taller than this; anything taller with stacked blocks inside is split further.
  const HUGE = Math.max(vh, 800) * 2.5

  const descend = (el: Element, depth: number, minW = vw * 0.5): Element[] => {
    if (depth > 30) return [el]
    // In-flow children only: absolutely placed layers (a hero's background, a decoration) belong to their parent.
    const all = kidsOf(el, minW).filter((k) => !(floating(k) && box(k).h < 220))
    const inflow = all.filter((k) => pos(k) !== 'absolute')
    const kids = inflow.length ? inflow : all
    // Page chrome is one section, whatever it's built from.
    if (/^(footer|nav)$/i.test(el.tagName) || el.getAttribute('role') === 'contentinfo') return [el]
    const b = box(el)
    // A huge box whose content is a narrow column (a reading-width page): measure widths against that column.
    if (b.h > HUGE && !kids.length) {
      const widest = Math.max(0, ...childrenOf(el).filter((c) => !SKIP.test(c.tagName) && visible(c) && pos(c) !== 'absolute' && pos(c) !== 'fixed').map((c) => box(c).w))
      if (widest >= 280 && widest * 0.8 < minW) return descend(el, depth + 1, widest * 0.8)
    }
    // A huge box made of side-by-side columns (a sticky intro beside a long scrolling column): each column splits on
    // its own, with widths measured against the column.
    if (b.h > HUGE) {
      const cols = childrenOf(el)
        .filter((c) => !SKIP.test(c.tagName) && visible(c) && pos(c) !== 'absolute' && pos(c) !== 'fixed' && box(c).w >= vw * 0.2 && box(c).h >= 200 && hasContent(c))
        .sort((a, c) => box(a).x - box(c).x)
      const besideEachOther = cols.length >= 2 && cols.length <= 3 && cols.every((c, i) => i === 0 || box(c).x >= box(cols[i - 1]).x + box(cols[i - 1]).w - 8)
      if (besideEachOther && cols.some((c) => box(c).h > HUGE)) return cols.flatMap((c) => (box(c).h > HUGE ? descend(c, depth + 1, box(c).w * 0.8) : [c]))
    }
    if (!kids.length) return [el]
    if (kids.length === 1) {
      // Copy laid over a picture (an absolutely placed layer with words) makes the box the section, not the picture.
      const k0 = box(kids[0])
      const over = (c: Element) => {
        const r = box(c)
        const ix = Math.min(r.x + r.w, k0.x + k0.w) - Math.max(r.x, k0.x)
        const iy = Math.min(r.y + r.h, k0.y + k0.h) - Math.max(r.y, k0.y)
        return r.w >= 100 && r.h >= 40 && ix > 0 && iy > 0 && ix * iy >= k0.w * k0.h * 0.05
      }
      const overlay = b.h <= HUGE && childrenOf(el).some((c) => c !== kids[0] && pos(c) === 'absolute' && visible(c) && (c.textContent ?? '').trim().length > 0 && over(c))
      if (el !== body && (overlay || REPLACED.test(kids[0].tagName))) return [el]
      // A wrapper only when the one child is the whole thing: not when a narrow column beside it (copy next to a
      // picture) was too narrow to count.
      const k = box(kids[0])
      const beside = childrenOf(el).some((c) => c !== kids[0] && !SKIP.test(c.tagName) && visible(c) && pos(c) !== 'absolute' && box(c).w >= 120 && box(c).h >= 60 && hasContent(c) && !floating(c))
      const whole = k.h >= b.h * 0.7 && k.w >= b.w * 0.85 && !beside
      // A huge box around one big child is a wrapper too, as long as that child is most of it.
      return el === body || whole || (b.h > HUGE && k.h >= b.h * 0.6 && !beside) ? descend(kids[0], depth + 1, minW) : [el]
    }
    const sorted = kids.sort((a, c) => box(a).y - box(c).y)
    const stacked = sorted.every((k, i) => {
      if (i === 0) return true
      const p = box(sorted[i - 1])
      return box(k).y >= p.y + p.h * 0.5
    })
    if (!stacked) return [el]
    const wrapper = el === body || el.tagName === 'MAIN' || WRAPPER_ID.test(el.id) || el.getAttribute('role') === 'main'
    const sectiony = sorted.filter((k) => SECTIONY.test(k.tagName)).length >= 2
    // Full-width blocks: as wide as the box, or as wide as a page's content column (a 1200px column in 1440).
    const blocksIn = sorted.filter((k) => (box(k).w >= b.w * 0.9 || box(k).w >= Math.min(vw * 0.75, 1000)) && box(k).h >= 120).length
    const tall = b.h > vh * 1.8 && el.tagName !== 'SECTION' && blocksIn >= 2
    // One child covering most of a box taller than a section, among several stacked blocks: the page's main wrapper
    // (a hero's picture over its copy is one section, however much of it the picture takes).
    const holdsMost = b.h > vh * 1.5 && sorted.some((k) => box(k).h >= b.h * 0.6) && blocksIn >= 2
    const huge = b.h > HUGE && blocksIn >= 2
    if (wrapper || sectiony || tall || holdsMost || huge) return sorted.flatMap((k) => descend(k, depth + 1, minW))
    return [el]
  }

  let blocks = descend(body, 0)
  // Floating things that aren't a top bar (chat bubbles, cookie bars, back-to-top), tiny and empty blocks.
  // Short ones: a row of marks or links (a logo strip) stays; a lone line of text (a caption, a kicker) joins the
  // nearest section's box below.
  const orphans: Element[] = []
  // Orphans that belong to the block below (a section's heading split off) or above (its trailing button row).
  const leans = new Map<Element, 'next' | 'prev'>()
  blocks = blocks.filter((e) => {
    const b = box(e)
    if (floating(e) && b.y > 10) return false
    if (!hasContent(e)) return false
    if (b.h < 60 && !(b.y < 10 && b.h >= 30)) {
      const marks = e.querySelectorAll('img, svg, picture').length
      if (b.h >= 28 && (marks >= 3 || e.querySelectorAll('a, button').length >= 3)) return true
      orphans.push(e)
      return false
    }
    return true
  })

  // A section intro split off from its body: a short heading block with no actions right before a sibling.
  const merged: Element[] = []
  for (let i = 0; i < blocks.length; i++) {
    const e = blocks[i]
    const next = blocks[i + 1]
    const b = box(e)
    if (
      next &&
      e.parentElement === next.parentElement &&
      b.h < 320 &&
      b.y > 200 &&
      e.querySelector('h1, h2, h3') &&
      e.querySelectorAll('a, button').length <= 1 &&
      !e.querySelector('img, video, picture') &&
      getComputedStyle(e).backgroundColor === getComputedStyle(next).backgroundColor &&
      !SECTIONY.test(e.tagName)
    ) {
      // Mark both; the pair is captured through their parent only when nothing else lives there.
      const parent = e.parentElement!
      if (kidsOf(parent).length === 2) {
        merged.push(parent)
        i++
        continue
      }
    }
    merged.push(e)
  }
  blocks = merged

  // Strips splitting left beside their section: a heading with nothing else (joins the block below), a row of one
  // or two buttons with little text (joins the block above). They widen that block's box.
  blocks = blocks.filter((e, i) => {
    const b = box(e)
    if (SECTIONY.test(e.tagName) && e.tagName !== 'SECTION') return true
    if (b.y < 200 || e.querySelector('img, video, picture, canvas, form, input')) return true
    const text = (e.textContent ?? '').replace(/\s+/g, ' ').trim()
    const acts = e.querySelectorAll('a, button').length
    const next = blocks[i + 1]
    const prev = blocks[i - 1]
    const near = (o: Element | undefined, below: boolean) => {
      if (!o) return false
      const ob = box(o)
      return below ? ob.y - (b.y + b.h) < 60 && ob.y >= b.y + b.h - 4 : b.y - (ob.y + ob.h) < 60 && b.y >= ob.y + ob.h - 4
    }
    if (b.h < 200 && e.querySelector('h1, h2, h3') && acts <= 1 && text.length < 160 && near(next, true) && box(next!).h > b.h) {
      orphans.push(e)
      leans.set(e, 'next')
      return false
    }
    if (b.h < 120 && acts >= 1 && acts <= 2 && text.length < 60 && !e.querySelector('h1, h2, h3') && near(prev, false)) {
      orphans.push(e)
      leans.set(e, 'prev')
      return false
    }
    return true
  })

  // The nav: a fixed or sticky bar at the top, or a header/nav at the top that splitting didn't reach.
  const topBars = Array.from(body.querySelectorAll('*')).filter((e) => {
    if (SKIP.test(e.tagName) || !visible(e)) return false
    const b = box(e)
    return b.y <= 140 && b.h >= 30 && b.h <= 240 && (b.w >= vw * 0.9 || (floating(e) && b.w >= vw * 0.6)) && (floating(e) || /^(header|nav)$/i.test(e.tagName) || e.getAttribute('role') === 'banner' || !!e.closest('header, nav, [role="banner"]'))
  })
  const outermost = topBars.filter((e) => !topBars.some((o) => o !== e && o.contains(e)))
  // The bar with the most links wins (an announcement strip above the real nav has one or two).
  const actionsIn = (e: Element) => Array.from(e.querySelectorAll('a, button')).filter((a) => a.getBoundingClientRect().width > 0).length
  const nav = outermost.filter((e) => actionsIn(e) >= 3).sort((a, c) => actionsIn(c) - actionsIn(a))[0] ?? outermost.find((e) => actionsIn(e) >= 2)
  const under = new Set<Element>()
  if (nav && !blocks.some((b) => b === nav || nav.contains(b))) {
    // A strip above the nav (an announcement) that splitting took for the nav stays its own block.
    for (const b of blocks) if (b.contains(nav) || box(b).y < box(nav).y + box(nav).h - 4) under.add(b)
    blocks = [nav, ...blocks.filter((b) => b !== nav)]
  }

  // The footer: a trailing <footer> / contentinfo that splitting left inside something else.
  // It sits in the bottom part of the page and doesn't start at the top (a <footer> wrapping the whole page isn't one).
  const docH = document.documentElement.scrollHeight
  const footish = (e: Element) => box(e).y > 0 && box(e).y >= docH * 0.4 && box(e).h <= Math.max(docH * 0.5, vh)
  const foot = Array.from(body.querySelectorAll('footer, [role="contentinfo"]'))
    .filter((e) => visible(e) && box(e).w >= vw * 0.8 && box(e).h >= 60 && footish(e))
    .filter((e, _i, all) => !all.some((o) => o !== e && o.contains(e)))
    .pop()
  if (foot && !blocks.some((b) => b === foot || foot.contains(b))) {
    const host = blocks.find((b) => b.contains(foot))
    if (host) {
      // Only split it off when the host is mostly something else.
      if (box(foot).h < box(host).h * 0.8) blocks.push(foot)
      else blocks[blocks.indexOf(host)] = foot
    } else blocks.push(foot)
  }

  // No block inside another; page order.
  blocks = blocks.filter((e, _i, all) => !all.some((o) => o !== e && o.contains(e) && !(e === foot || e === nav)))
  blocks.sort((a, c) => (a === nav ? -1 : c === nav ? 1 : box(a).y - box(c).y))

  const cssPath = (el: Element): string => {
    if (el.id && /^[a-z][\w-]*$/i.test(el.id) && document.querySelectorAll(`#${el.id}`).length === 1) return `#${el.id}`
    const parent = el.parentElement
    if (!parent || el === body) return 'body'
    const i = Array.from(parent.children).indexOf(el) + 1
    return `${cssPath(parent)} > ${el.tagName.toLowerCase()}:nth-child(${i})`
  }
  const boxes = new Map(blocks.map((e) => [e, box(e)]))
  // The nav's box takes in what it draws outside itself (a bar positioned below an announcement strip).
  if (nav && boxes.has(nav)) {
    const b = { ...boxes.get(nav)! }
    let bottom = b.y + b.h
    for (const d of Array.from(nav.querySelectorAll('*'))) {
      if (!visible(d) || d.closest('svg') !== null && d.tagName.toLowerCase() !== 'svg') continue
      const r = box(d)
      if (r.w > 0 && r.h > 0 && r.y < 260 && r.y + r.h <= 260 && r.h < 200) bottom = Math.max(bottom, r.y + r.h)
    }
    boxes.set(nav, { ...b, h: bottom - b.y })
    for (const e of blocks) if (e !== nav && box(e).y < bottom - 4 && box(e).y + box(e).h > bottom) under.add(e)
  }
  for (const o of orphans) {
    const ob = box(o)
    let best: Element | null = null
    let gap = 120
    for (const e of blocks) {
      if (e === nav) continue
      const b = boxes.get(e)!
      const lean = leans.get(o)
      if (lean === 'next' && b.y < ob.y + ob.h - 4) continue
      if (lean === 'prev' && b.y + b.h > ob.y + 4) continue
      const d = ob.y >= b.y + b.h ? ob.y - (b.y + b.h) : b.y >= ob.y + ob.h ? b.y - (ob.y + ob.h) : 0
      if (d < gap) (gap = d), (best = e)
    }
    if (!best) continue
    const b = boxes.get(best)!
    const x = Math.min(b.x, ob.x)
    const y = Math.min(b.y, ob.y)
    boxes.set(best, { x, y, w: Math.max(b.x + b.w, ob.x + ob.w) - x, h: Math.max(b.y + b.h, ob.y + ob.h) - y })
  }

  for (const old of Array.from(document.querySelectorAll('[data-mx-lib]'))) old.removeAttribute('data-mx-lib')
  return blocks.map((el, n) => {
    el.setAttribute('data-mx-lib', String(n))
    const b = boxes.get(el)!
    return {
      n,
      box: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) },
      tag: el.tagName.toLowerCase(),
      fixed: el === nav && floating(el),
      underNav: under.has(el) && el !== nav,
      selector: cssPath(el),
    }
  })
}

/** A guess at a section's type from what's inside, with how sure it is (0–1). */
export function guessSectionType(el: Element, ctx: Partial<TypeContext> = {}): TypeGuess {
  const tag = el.tagName.toLowerCase()
  const r = el.getBoundingClientRect()
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const q = (s: string) => el.querySelectorAll(s).length
  const top = r.top + window.scrollY
  const vh = window.innerHeight
  const docH = document.documentElement.scrollHeight
  const pos = getComputedStyle(el).position
  // Without a page context (the picker), the rules that depend on place are off.
  const index = ctx.index ?? -1
  const count = ctx.count ?? -1
  const firstContent = ctx.firstContent ?? 0
  const home = ctx.home ?? true
  const links = q('a')
  const g = (type: SectionType, confidence: number, reason: string): TypeGuess => ({ type, confidence, reason })

  // Pictures: real images, videos, canvases and boxes painted with a background image, by area.
  const area = Math.max(1, r.width * r.height)
  let picArea = 0
  let pics = 0
  // (A <picture> is measured by its <img>: the <picture> itself is often an inline box with no size.)
  for (const m of Array.from(el.querySelectorAll('img, video, canvas, [style*="background-image"]'))) {
    const b = m.getBoundingClientRect()
    if (b.width < 60 || b.height < 60) continue
    pics++
    picArea += Math.min(b.width, r.width) * Math.min(b.height, r.height)
  }
  const picShare = Math.min(1, picArea / area)

  if (tag === 'nav' && r.height < 220 && top < 220) return g('nav', 0.95, 'nav element at the top')
  if ((pos === 'fixed' || pos === 'sticky') && top < 20 && r.height < 220) return g('nav', 0.92, 'fixed bar at the top')
  if ((tag === 'header' || el.getAttribute('role') === 'banner' || q('nav')) && r.height < 220 && top < 220 && links >= 3) return g('nav', 0.9, 'header bar with links at the top')
  if (index === 0 && r.height < 200 && links >= 3) return g('nav', 0.7, 'first short block of links')

  // A footer sits in the bottom part of the page: never a box starting at the top or spanning most of it.
  const lowDown = top > 0 && top >= docH * 0.4 && r.height <= Math.max(docH * 0.5, vh)
  if ((tag === 'footer' || el.getAttribute('role') === 'contentinfo') && lowDown) return g('footer', 0.95, 'footer element')
  if (index >= 0 && index === count - 1 && links >= 6 && lowDown) return g('footer', 0.8, 'last block, many links')
  // A link index near the end (a footer without the element, a slim legal strip after it).
  if (index >= 0 && index >= count - 2 && links >= 15 && lowDown && text.length / links < 40) return g('footer', 0.7, 'link index at the end')
  if (top + r.height >= docH - 40 && links >= 3 && lowDown && r.height < vh * 1.5) return g('footer', 0.7, 'reaches the bottom of the page')

  if (q('form') && (q('textarea') || q('input[type="email"]')) && q('input, textarea') >= 3) return g('contact', 0.85, 'form with several fields')
  if (q('input[type="email"]') === 1 && q('input:not([type="hidden"]), textarea') <= 2) return g('cta', 0.7, 'single email signup')
  if (q('details') >= 2) return g('faq', 0.9, 'accordion of details')
  // Questions as headings or toggles: several short lines ending in a question mark under a questions heading.
  const asked = Array.from(el.querySelectorAll('h2, h3, h4, h5, button, summary, dt, [aria-expanded], p, span')).filter((n) => /\?\s*$/.test((n.textContent ?? '').trim()) && (n.textContent ?? '').trim().length < 160).length
  if (asked >= 3 && /\b(faq|frequently asked|questions)\b/i.test(text.slice(0, 300))) return g('faq', 0.8, 'questions under a questions heading')
  if (/\b(faq|frequently asked|questions)\b/i.test(text.slice(0, 200)) && q('[aria-expanded], details, dt, h3, h4') >= 3) return g('faq', 0.8, 'questions heading with a list')
  const prices = (text.match(/[$€£]\s?\d+/g) ?? []).length
  if (prices >= 2) return /\/\s?(mo|month|yr|year|user|seat)|per (month|year|user|seat)|monthly|annually/i.test(text) ? g('pricing', 0.9, 'plan prices') : g('pricing', 0.5, 'prices (products rather than plans?)')

  const h1 = q('h1')
  const isFirst = index >= 0 && (index === firstContent || (index <= firstContent + 1 && top < vh * 0.6))
  if (!home && isFirst && h1 && r.height < 720 && picShare < 0.5 && text.length < 700) return g('header', 0.75, 'page title at the top of an inner page')
  if (h1 && top < vh * 1.2) return g('hero', home ? 0.85 : 0.6, 'main heading near the top')
  if (isFirst && home && (picShare > 0.4 || r.height > vh * 0.6)) return g('hero', 0.55, 'first big block')

  if (q('blockquote') >= 1) return g('testimonials', 0.75, 'blockquote')
  // Quoted passages of real sentences (not quoted strings in a code sample).
  const prose = Array.from(el.querySelectorAll('p, span, div, figcaption, q'))
    .filter((n) => !n.closest('pre, code') && n.children.length === 0)
    .map((n) => (n.textContent ?? '').trim())
  const quotes = prose.filter((t) => /^[“"‘«]/.test(t) && t.split(/\s+/).length >= 6).length
  if (quotes >= 1 && (text.match(/[“"][^”"]{30,}[”"]/g) ?? []).length >= 1) return g('testimonials', quotes >= 2 ? 0.7 : 0.55, 'quoted passages')
  const leaves = Array.from(el.querySelectorAll('*')).filter((n) => !n.children.length)
  const sizeOf = (n: Element) => parseFloat(getComputedStyle(n).fontSize) || 0
  const NUM = /^[\d.,]+\s?[%+kKmMx×s]*$|^[$€£]?\d[\d.,]*[%+kKmMBx×]+$/
  const bigNumbers = leaves.filter((n) => NUM.test((n.textContent ?? '').trim()) && sizeOf(n) >= 28)
  if (bigNumbers.length >= 3 && text.length < 900) return g('stats', 0.75, 'several big numbers')
  if (bigNumbers.length >= 2 && text.length < 500) return g('stats', 0.55, 'big numbers')
  const markEls = Array.from(el.querySelectorAll('img, svg')).filter((m) => !m.parentElement?.closest('svg') && m.getBoundingClientRect().width > 0)
  const markH = markEls.map((m) => m.getBoundingClientRect().height).sort((a, b) => a - b)[Math.floor(markEls.length / 2)] ?? 0
  if (markEls.length >= 5 && text.length < 400 && picShare < 0.35 && markH < 90) return g('logos', 0.75, 'row of small marks')
  if (q('time') >= 2) return g('blog', 0.8, 'dated entries')
  if (q('article') >= 2 && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\bmin read\b/i.test(text)) return g('blog', 0.7, 'articles with dates')

  // The largest run of alike siblings (same tag, about the same width, each holding text): a list of features, posts…
  let run = 0
  let runWithPics = 0
  for (const p of [el, ...Array.from(el.querySelectorAll('*'))].slice(0, 3000)) {
    const kids = Array.from(p.children).filter((k) => (k.textContent ?? '').trim().length > 8 && k.getBoundingClientRect().width > 120)
    if (kids.length < 3) continue
    const w0 = kids[0].getBoundingClientRect().width
    const alike = kids.filter((k) => k.tagName === kids[0].tagName && Math.abs(k.getBoundingClientRect().width - w0) < w0 * 0.15)
    if (alike.length >= 3 && alike.length > run) {
      run = alike.length
      runWithPics = alike.filter((k) => k.querySelector('img, picture, video, svg, canvas')).length
    }
  }
  const head = el.querySelector('h1, h2, h3, h4')
  const headText = ((head?.textContent ?? '') + ' ' + text.slice(0, 120)).toLowerCase()
  if (run >= 3 && /\b(changelog|blog|news|articles|stories|journal|insights|updates|latest)\b/.test(headText)) return g('blog', 0.6, 'list under a posts heading')
  if (pics >= 4 && picShare >= 0.45 && text.length < 500) return g('gallery', 0.75, 'mostly pictures, little text')
  if (pics >= 3 && /\b(team|our people|leadership|founders|meet the)\b/.test(headText)) return g('team', 0.6, 'people heading with pictures')
  if (pics >= 4 && picShare >= 0.15 && text.length < 220) return g('gallery', 0.6, 'tiles of pictures with short labels')
  if (pics >= 2 && picShare >= 0.6 && text.length < 300) return g('gallery', 0.55, 'large pictures, little text')
  if (q('h3, h4') >= 3) return g('features', 0.6, 'several sub-headings')
  if (run >= 3 && run <= 12) return g('features', runWithPics >= 3 ? 0.55 : 0.5, 'a run of alike items')
  if (pics >= 1 && picShare > 0.3 && text.length < 700) return g('content', 0.5, 'copy beside a picture')
  const biggest = leaves.reduce((m, n) => ((n.textContent ?? '').trim() ? Math.max(m, sizeOf(n)) : m), 0)
  const actions = Array.from(el.querySelectorAll('a, button')).filter((a) => a.getBoundingClientRect().width > 0 && (a.textContent ?? '').trim()).length
  if (actions >= 1 && actions <= 3 && r.height < 560 && (q('h2, h3') || biggest >= 32) && text.length < 400) return g('cta', 0.6, 'short heading with an action')
  if (pics >= 1 && picShare > 0.3) return g('content', 0.45, 'copy with a picture')
  return g('content', 0.35, 'nothing more specific')
}

/** Page-wide style facts: body colors, :root variables, loaded font families, buttons and gaps. */
export function pageFacts(): PageFacts {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  // Any CSS color (oklch, color(), named) → rgba(), by painting it.
  const norm = (v: string) => {
    if (!v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)') return 'rgba(0, 0, 0, 0)'
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = v
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data)
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
  }
  const root = document.documentElement
  const rcs = getComputedStyle(root)
  const bcs = getComputedStyle(document.body)

  const vars: Record<string, string> = {}
  const names = new Set<string>()
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        if (/^(:root|html)\b/.test(r.selectorText.trim())) for (const p of Array.from(r.style)) if (p.startsWith('--')) names.add(p)
      } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules)
    }
  }
  for (const s of Array.from(document.styleSheets)) {
    try {
      walk(s.cssRules)
    } catch {
      /* cross-origin */
    }
  }
  for (const n of Array.from(names).slice(0, 400)) {
    const v = rcs.getPropertyValue(n).trim()
    if (v && v.length < 120) vars[n] = v
  }

  const faces: { family: string; loaded: boolean }[] = []
  document.fonts.forEach((f) => {
    const family = f.family.replace(/^['"]|['"]$/g, '')
    if (!faces.some((x) => x.family === family)) faces.push({ family, loaded: f.status === 'loaded' })
    else if (f.status === 'loaded') faces.find((x) => x.family === family)!.loaded = true
  })
  faces.sort((a, b) => Number(b.loaded) - Number(a.loaded))
  const links = Array.from(document.querySelectorAll('link[href], script[src]')).map((l) => (l as HTMLLinkElement).href || (l as HTMLScriptElement).src)

  const buttons = new Map<string, { bg: string; color: string; count: number }>()
  for (const e of Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'))) {
    const r = e.getBoundingClientRect()
    if (r.width < 40 || r.height < 24 || r.height > 80 || r.width > 420) continue
    const s = getComputedStyle(e)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    const bg = norm(s.backgroundColor)
    if (/, 0\)$/.test(bg)) continue
    const label = (e.textContent ?? '').trim()
    if (!label || label.length > 40) continue
    const color = norm(s.color)
    const k = `${bg}|${color}`
    const cur = buttons.get(k) ?? { bg, color, count: 0 }
    cur.count++
    buttons.set(k, cur)
  }

  const gaps: number[] = []
  for (const e of Array.from(document.body.querySelectorAll('*')).slice(0, 6000)) {
    const s = getComputedStyle(e)
    if (!/flex|grid/.test(s.display)) continue
    for (const g of [s.rowGap, s.columnGap]) {
      const v = parseFloat(g)
      if (v > 0 && v <= 160) gaps.push(Math.round(v))
    }
  }

  const bodySizes: Record<string, number> = {}
  for (const e of Array.from(document.querySelectorAll('p, li, dd, blockquote')).slice(0, 4000)) {
    const t = (e.textContent ?? '').trim().length
    if (t < 40 || e.closest('nav, footer, pre, code')) continue
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const k = String(Math.round(parseFloat(getComputedStyle(e).fontSize)))
    bodySizes[k] = (bodySizes[k] ?? 0) + t
  }

  return {
    bodySizes,
    bodyBg: norm(bcs.backgroundColor),
    bodyColor: norm(bcs.color),
    htmlBg: norm(rcs.backgroundColor),
    vars,
    fontFaces: faces.map((f) => f.family),
    typekit: links.some((h) => /typekit\.(net|com)/.test(h)),
    fontLinks: links.filter((h) => /fonts\.googleapis\.com|fontshare\.com|fontsource|typekit\.net/.test(h)),
    buttons: Array.from(buttons.values()).sort((a, b) => b.count - a.count).slice(0, 12),
    gaps,
  }
}

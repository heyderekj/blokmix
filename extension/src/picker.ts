// The in-page picker: hover outlines sections with Blokmix's pink pick outline
// (PickOutline in ui/frames/SlotRow.tsx), ↑/↓ widen or narrow the pick, a click
// freezes it and asks for the section type, then the section is snapshotted.

import { SECTION_TYPES, type SectionType } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { blockedSheetHrefs, snapshotSection } from './snapshot'
import { guessSectionType } from './sections'
import type { Snapshot } from './capture/types'

const KEY = '#ff6aa8'
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

const CSS = `
:host { all: initial; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font: 500 12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif; }
.outline { position: fixed; left: 0; top: 0; border-radius: 6px; opacity: 0;
  background: color-mix(in oklab, ${KEY} 10%, transparent);
  box-shadow: 0 0 0 2px ${KEY}, 0 0 0 5.5px color-mix(in oklab, ${KEY} 18%, transparent);
  transition: opacity 140ms ${EASE}, transform 90ms ${EASE}, width 90ms ${EASE}, height 90ms ${EASE}; }
.outline.on { opacity: 1; }
.outline.picked { background: color-mix(in oklab, ${KEY} 7%, transparent); box-shadow: 0 0 0 2.5px ${KEY}, 0 0 0 6px color-mix(in oklab, ${KEY} 18%, transparent); }
.label { position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; white-space: nowrap; border-radius: 6px; background: ${KEY}; color: #fff; padding: 2px 8px; font-weight: 600; box-shadow: 0 4px 12px -4px rgb(0 0 0 / 0.35); }
.label kbd { font: inherit; opacity: 0.75; margin-left: 6px; }
.chooser { position: fixed; pointer-events: auto; width: 300px; padding: 12px; border-radius: 12px; background: #fff; color: #18181b;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08), 0 16px 40px -8px rgb(0 0 0 / 0.3); opacity: 0; transform: translateY(4px) scale(0.98);
  transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 160ms cubic-bezier(0.23, 1, 0.32, 1); }
.chooser.on { opacity: 1; transform: none; }
.chooser h2 { all: unset; display: block; font-size: 13px; font-weight: 650; margin: 0 2px 8px; }
.chooser p { margin: 0 2px 10px; color: #71717a; }
.types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.types button, .row button { all: unset; cursor: pointer; text-align: center; padding: 7px 4px; border-radius: 7px; background: #f4f4f5; font-weight: 550; transition: background-color 120ms ease-out, scale 120ms ease-out; }
.types button:hover { background: #e4e4e7; }
.types button:active, .row button:active { scale: 0.97; }
.types button.guess { background: color-mix(in oklab, ${KEY} 18%, #fff); box-shadow: inset 0 0 0 1.5px ${KEY}; }
.row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; color: #71717a; }
.row button { padding: 6px 10px; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); pointer-events: none; background: #18181b; color: #fff; padding: 10px 14px; border-radius: 10px; font-weight: 550; box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.4); }
.hint { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); background: #18181b; color: #fff; padding: 8px 12px; border-radius: 999px; font-weight: 550; }
.hint kbd { font: inherit; background: rgb(255 255 255 / 0.16); padding: 1px 6px; border-radius: 5px; margin: 0 2px; }
`

export interface PickerHandlers {
  /** Fetch cross-origin stylesheet text (the extension can; the page can't). */
  fetchCss: (urls: string[]) => Promise<string[]>
  onCapture: (snap: Snapshot, type: SectionType) => Promise<void> | void
}

export function startPicker(h: PickerHandlers): () => void {
  const host = document.createElement('blokmix-clipper')
  const shadow = host.attachShadow({ mode: 'closed' })
  shadow.innerHTML = `<style>${CSS}</style><div class="layer"><div class="hint">Hover a section · <kbd>↑</kbd><kbd>↓</kbd> wider or narrower · click to clip · <kbd>Esc</kbd> to stop</div><div class="outline"><span class="label"></span></div></div>`
  document.documentElement.appendChild(host)
  const layer = shadow.querySelector('.layer') as HTMLElement
  const outline = shadow.querySelector('.outline') as HTMLElement
  const label = shadow.querySelector('.label') as HTMLElement

  let hovered: Element | null = null
  let current: Element | null = null
  let narrower: Element[] = []
  let picked = false
  /** While the type chooser is open: capture with the guessed type (Enter). */
  let accept: (() => void) | null = null

  const draw = (el: Element | null) => {
    current = el
    if (!el) return outline.classList.remove('on')
    const r = el.getBoundingClientRect()
    outline.style.transform = `translate(${r.left}px, ${Math.max(r.top, 0)}px)`
    outline.style.width = `${r.width}px`
    outline.style.height = `${Math.min(r.height, window.innerHeight - Math.max(r.top, 0))}px`
    outline.classList.add('on')
    label.innerHTML = `${describe(el)} <kbd>${Math.round(r.width)}×${Math.round(r.height)}</kbd>`
  }

  const onMove = (e: MouseEvent) => {
    if (picked) return
    const t = e.target as Element
    if (!t || t === host || hovered === t) return
    hovered = t
    narrower = []
    draw(sectionFor(t))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      stop()
    } else if (picked && accept && e.key === 'Enter') {
      e.preventDefault()
      accept()
    } else if (!picked && current && e.key === 'ArrowUp') {
      e.preventDefault()
      const up = current.parentElement
      if (up && up !== document.documentElement) {
        narrower.push(current)
        draw(up)
      }
    } else if (!picked && current && e.key === 'ArrowDown') {
      e.preventDefault()
      const down = narrower.pop() ?? Array.from(current.children).sort((a, b) => area(b) - area(a))[0]
      if (down) draw(down)
    } else if (!picked && current && e.key === 'Enter') {
      e.preventDefault()
      choose(current)
    }
  }
  const onClick = (e: MouseEvent) => {
    if (e.composedPath().includes(host)) return
    e.preventDefault()
    e.stopPropagation()
    if (!picked && current) choose(current)
  }
  const swallow = (e: Event) => {
    if (!e.composedPath().includes(host)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  const onScroll = () => current && draw(current)

  const choose = (el: Element) => {
    picked = true
    outline.classList.add('picked')
    const guess = guessType(el)
    const box = document.createElement('div')
    box.className = 'chooser'
    box.innerHTML = `<h2>What kind of section is this?</h2><p>Copy and blocks are named after the type.</p><div class="types">${SECTION_TYPES.map((t) => `<button data-t="${t}" class="${t === guess ? 'guess' : ''}">${TYPE_LABEL[t]}</button>`).join('')}</div><div class="row"><span>Guessed: ${TYPE_LABEL[guess]} · <b>Enter</b></span><button data-back>Pick again</button></div>`
    const r = el.getBoundingClientRect()
    const top = Math.min(Math.max(r.top + 12, 12), window.innerHeight - 260)
    box.style.left = `${Math.min(Math.max(r.left + 12, 12), window.innerWidth - 312)}px`
    box.style.top = `${top}px`
    layer.appendChild(box)
    requestAnimationFrame(() => box.classList.add('on'))
    accept = () => {
      accept = null
      box.remove()
      void capture(el, guess)
    }
    box.addEventListener('click', async (e) => {
      const b = (e.target as HTMLElement).closest('button')
      if (!b) return
      accept = null
      if (b.hasAttribute('data-back')) {
        box.remove()
        picked = false
        outline.classList.remove('picked')
        return
      }
      box.remove()
      await capture(el, b.dataset.t as SectionType)
    })
  }

  const capture = async (el: Element, type: SectionType) => {
    outline.classList.remove('on')
    shadow.querySelector('.hint')?.remove()
    toast('Clipping…')
    // Cover the page so :hover leaves the section (the pointer is still over it from the click);
    // the snapshot then finishes the hover-out transitions and reads the at-rest look.
    layer.style.pointerEvents = 'auto'
    layer.style.cursor = 'progress'
    try {
      // Let reveal-on-scroll content arrive before reading it.
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: r.height > window.innerHeight ? 'start' : 'center' })
      await new Promise((res) => setTimeout(res, 450))
      const blocked = blockedSheetHrefs(document)
      const sheetTexts = blocked.length ? await h.fetchCss(blocked).catch(() => []) : []
      const snap = snapshotSection(el, { sheetTexts })
      await h.onCapture(snap, type)
      toast(`Clipped a ${TYPE_LABEL[type].toLowerCase()} section · it’s in the Blokmix panel`)
    } catch (err) {
      toast(`Couldn’t clip this section: ${(err as Error).message}`)
    }
    setTimeout(stop, 1800)
  }

  const toast = (text: string) => {
    shadow.querySelector('.toast')?.remove()
    const t = document.createElement('div')
    t.className = 'toast'
    t.textContent = text
    layer.appendChild(t)
  }

  const stop = () => {
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('click', onClick, true)
    for (const ev of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) document.removeEventListener(ev, swallow, true)
    window.removeEventListener('scroll', onScroll, true)
    host.remove()
  }

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('click', onClick, true)
  for (const ev of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) document.addEventListener(ev, swallow, true)
  window.addEventListener('scroll', onScroll, true)
  return stop
}

const area = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width * r.height
}

const SECTIONY = new Set(['section', 'header', 'footer', 'nav', 'article', 'aside'])

/** The section a hovered element belongs to: the nearest wide, section-like ancestor. */
export function sectionFor(el: Element): Element {
  const vw = window.innerWidth
  let wide: Element | null = null
  for (let p: Element | null = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const r = p.getBoundingClientRect()
    if (r.width < vw * 0.6 || r.height < 40) continue
    wide ??= p
    const parent = p.parentElement
    if (SECTIONY.has(p.tagName.toLowerCase()) || parent === document.body || parent?.tagName === 'MAIN' || (p.id && !/^(root|app|__next|main)$/i.test(p.id))) return p
  }
  return wide ?? el
}

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = !id && typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 1).map((c) => `.${c}`).join('') : ''
  return `${tag}${id}${cls}`
}

/** A first guess at the section type, from what's inside (shared with the site library's typer). */
export function guessType(el: Element): SectionType {
  return guessSectionType(el).type
}

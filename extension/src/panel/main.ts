// The side panel: every capture as a card with its type, source and variant,
// a live preview at 1440 or 390, lint results by rule, what capture changed,
// the files, and export (into the Blokmix folder, or a zip).

import { SECTION_TYPES, type SectionType } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { captureClip, sourceIdFor, type CaptureResult } from '../capture'
import { previewDoc } from '../capture/preview'
import { looksLikeRepo, writeToRepo, zipFiles, type DirLike } from '../capture/export'
import type { StoredCapture } from '../background'

// ---- storage (chrome.storage in the extension; localStorage when the panel is opened as a plain page) ----

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local
const store = {
  async list(): Promise<StoredCapture[]> {
    if (hasChrome) return ((await chrome.storage.local.get('captures')).captures as StoredCapture[]) ?? []
    try {
      return JSON.parse(localStorage.getItem('blokmix:captures') ?? '[]')
    } catch {
      return []
    }
  },
  async save(list: StoredCapture[]) {
    if (hasChrome) await chrome.storage.local.set({ captures: list })
    else localStorage.setItem('blokmix:captures', JSON.stringify(list))
    render()
  },
}
if (hasChrome) chrome.storage.onChanged.addListener((c) => c.captures && render())

// ---- the Blokmix folder (File System Access), remembered in IndexedDB ----

type Dir = DirLike & FileSystemDirectoryHandle
const idb = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open('blokmix-clipper', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
async function kv<T>(key: string, value?: T): Promise<T | undefined> {
  const db = await idb()
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', value === undefined ? 'readonly' : 'readwrite')
    const os = tx.objectStore('kv')
    const r = value === undefined ? os.get(key) : os.put(value, key)
    r.onsuccess = () => res(value === undefined ? (r.result as T) : value)
    r.onerror = () => rej(r.error)
  })
}
let folder: Dir | undefined
kv<Dir>('folder')
  .then((d) => {
    folder = d
    renderFolder()
  })
  .catch(() => renderFolder())

async function chooseFolder(): Promise<Dir | undefined> {
  const pick = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<Dir> }).showDirectoryPicker
  if (!pick) return undefined
  const dir = await pick({ id: 'blokmix', mode: 'readwrite' })
  if (!(await looksLikeRepo(dir))) {
    alert('That folder doesn’t look like Blokmix: pick the repo folder (the one with samples/clips) or its samples folder.')
    return undefined
  }
  folder = dir
  await kv('folder', dir)
  renderFolder()
  return dir
}

async function writable(dir: Dir): Promise<boolean> {
  const d = dir as unknown as { queryPermission(o: object): Promise<string>; requestPermission(o: object): Promise<string> }
  if ((await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  return (await d.requestPermission({ mode: 'readwrite' })) === 'granted'
}

function renderFolder() {
  const el = document.getElementById('folder')!
  el.innerHTML = folder ? `<span>Saves into <b>${esc(folder.name)}</b></span><button class="ghost" data-act="folder">Change</button>` : `<span>Choose your Blokmix folder to save clips straight into <b>samples/</b>.</span><button class="ghost" data-act="folder">Choose</button>`
  el.querySelector('button')!.onclick = () => void chooseFolder()
}

// ---- cards ----

const results = new Map<string, CaptureResult>()
const viewport = new Map<string, 390 | 1440>()
const fileTab = new Map<string, string>()
const statusOf = new Map<string, { text: string; kind: '' | 'ok' | 'err' }>()

function run(c: StoredCapture): CaptureResult {
  const key = `${c.id}|${c.type}|${c.sourceId ?? ''}|${c.variant ?? ''}`
  const hit = results.get(key)
  if (hit) return hit
  const res = captureClip(c.snapshot, { type: c.type, sourceId: c.sourceId, variant: c.variant })
  results.set(key, res)
  return res
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function render() {
  const list = await store.list()
  const main = document.getElementById('list')!
  if (!list.length) {
    main.innerHTML = `<div class="empty"><strong>No clips yet</strong>Press <b>Pick a section</b>, hover the page, and click the section you want. Then choose what kind of section it is.</div>`
    return
  }
  main.innerHTML = ''
  for (const c of list) main.appendChild(card(c, list))
}

function card(c: StoredCapture, list: StoredCapture[]): HTMLElement {
  const res = run(c)
  const host = (() => {
    try {
      return new URL(c.snapshot.url).hostname.replace(/^www\./, '')
    } catch {
      return 'page'
    }
  })()
  const vp = viewport.get(c.id) ?? 1440
  const errors = res.issues.filter((i) => i.level === 'error')
  const warns = res.issues.filter((i) => i.level === 'warn')
  const tab = fileTab.get(c.id)
  const files = Object.keys(res.files)
  const st = statusOf.get(c.id)
  const el = document.createElement('article')
  el.className = 'card'
  el.innerHTML = `
    <div class="card-head">
      <div><h3>${esc(TYPE_LABEL[c.type])} from ${esc(host)}</h3><p>${esc(c.snapshot.selector)}</p></div>
      <button class="ghost" data-act="remove" aria-label="Remove this clip">Remove</button>
    </div>
    <div class="controls">
      <label>Type<select data-f="type">${SECTION_TYPES.map((t) => `<option value="${t}" ${t === c.type ? 'selected' : ''}>${TYPE_LABEL[t]}</option>`).join('')}</select></label>
      <label>Source<input data-f="sourceId" value="${esc(c.sourceId ?? res.sourceId)}" placeholder="${esc(sourceIdFor(c.snapshot.url))}" spellcheck="false"></label>
      <label>Variant<input data-f="variant" value="${esc(c.variant ?? res.folder.slice(res.sourceId.length + 1))}" spellcheck="false"></label>
    </div>
    <div class="folder-name">samples/clips/${res.type}/${res.folder}/</div>
    <div class="viewports"><button data-vp="1440" aria-pressed="${vp === 1440}">1440</button><button data-vp="390" aria-pressed="${vp === 390}">390</button></div>
    <div class="stage"><iframe sandbox="allow-same-origin" title="Preview" loading="lazy"></iframe></div>
    ${
      errors.length || warns.length
        ? `<div class="lint ${errors.length ? 'bad' : 'ok'}">${errors.length ? `${errors.length} lint error${errors.length > 1 ? 's' : ''}: the clip won’t load cleanly until these are fixed` : 'Passes lint, with notes'}<ul>${[...errors, ...warns].map((i) => `<li class="${i.level === 'error' ? 'e' : 'w'}"><span class="rule">${i.rule ? `Rule ${i.rule}` : 'Lint'}</span> · ${esc(i.message)}</li>`).join('')}</ul></div>`
        : `<div class="lint ok">Passes every clip rule (core/lint.ts)</div>`
    }
    ${res.notes.length ? `<details><summary>What capture changed (${res.notes.length})</summary><ul>${res.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
    <details ${tab ? 'open' : ''}><summary>Files (${files.length})</summary>
      <div class="files">${files.map((f) => `<button data-file="${esc(f)}" aria-pressed="${f === tab}">${esc(f.split('/').slice(-2).join('/'))}</button>`).join('')}</div>
      ${tab && res.files[tab] !== undefined ? `<pre>${esc(res.files[tab])}</pre>` : ''}
    </details>
    <div class="actions"><button class="primary" data-act="save">${folder ? 'Save to Blokmix' : 'Save to Blokmix…'}</button><button class="ghost" data-act="zip">Download .zip</button></div>
    ${st ? `<div class="status ${st.kind}">${esc(st.text)}</div>` : ''}
  `

  // Preview, scaled to the card.
  const iframe = el.querySelector('iframe')!
  const stage = el.querySelector('.stage') as HTMLElement
  iframe.srcdoc = previewDoc(res)
  iframe.style.width = `${vp}px`
  const fit = () => {
    const scale = stage.clientWidth / vp
    const h = iframe.contentDocument?.body?.scrollHeight ?? 400
    iframe.style.height = `${h}px`
    iframe.style.transform = `scale(${scale})`
    stage.style.height = `${Math.min(h * scale, 640)}px`
  }
  iframe.onload = () => {
    fit()
    setTimeout(fit, 400) // web fonts
  }
  new ResizeObserver(fit).observe(stage)

  const update = async (patch: Partial<StoredCapture>) => {
    const next = list.map((x) => (x.id === c.id ? { ...x, ...patch } : x))
    await store.save(next)
  }
  el.querySelector<HTMLSelectElement>('[data-f="type"]')!.onchange = (e) => update({ type: (e.target as HTMLSelectElement).value as SectionType })
  for (const f of ['sourceId', 'variant'] as const)
    el.querySelector<HTMLInputElement>(`[data-f="${f}"]`)!.onchange = (e) => update({ [f]: (e.target as HTMLInputElement).value.trim() || undefined })
  el.querySelectorAll<HTMLButtonElement>('[data-vp]').forEach((b) => (b.onclick = () => (viewport.set(c.id, Number(b.dataset.vp) as 390 | 1440), render())))
  el.querySelectorAll<HTMLButtonElement>('[data-file]').forEach((b) => (b.onclick = () => (fileTab.set(c.id, fileTab.get(c.id) === b.dataset.file ? '' : b.dataset.file!), render())))
  el.querySelector<HTMLButtonElement>('[data-act="remove"]')!.onclick = () => store.save(list.filter((x) => x.id !== c.id))
  el.querySelector<HTMLButtonElement>('[data-act="zip"]')!.onclick = () => {
    const blob = new Blob([zipFiles(res.files) as BlobPart], { type: 'application/zip' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${res.type}.${res.folder}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    statusOf.set(c.id, { text: `Unzip at the Blokmix repo root (or run npm run clip:add -- ${a.download}).`, kind: '' })
    render()
  }
  el.querySelector<HTMLButtonElement>('[data-act="save"]')!.onclick = async () => {
    try {
      const dir = folder ?? (await chooseFolder())
      if (!dir || !(await writable(dir))) return
      if (errors.length && !confirm('This clip has lint errors, so Blokmix will flag it. Save anyway?')) return
      const report = await writeToRepo(dir, res.files)
      const kept = report.kept.length ? ` Kept the existing ${report.kept.map((k) => k.split('/').pop()).join(', ')}.` : ''
      statusOf.set(c.id, { text: `Saved ${report.written.length} files to samples/clips/${res.type}/${res.folder}/. Blokmix picks it up on reload.${kept}`, kind: 'ok' })
    } catch (err) {
      statusOf.set(c.id, { text: `Couldn’t save: ${(err as Error).message}`, kind: 'err' })
    }
    render()
  }
  return el
}

document.getElementById('pick')!.onclick = async () => {
  if (!hasChrome) return alert('Open this panel from the Blokmix Clipper extension to pick sections.')
  const r = (await chrome.runtime.sendMessage({ type: 'blokmix:start-pick' })) as { ok: boolean; error?: string }
  if (!r?.ok) alert(r?.error ?? 'Couldn’t start the picker on this tab.')
}

/** For the plain-page preview: add a snapshot by hand (`blokmixPanel.add(snapshot, 'hero')`). */
;(window as unknown as { blokmixPanel: object }).blokmixPanel = {
  add: async (snapshot: StoredCapture['snapshot'], type: SectionType) => store.save([{ id: crypto.randomUUID(), snapshot, type }, ...(await store.list())]),
}

renderFolder()
render()

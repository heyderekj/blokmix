import { isMockId, parseLook, registerLooks, registerMocks, type Look, type MockSource } from '@/core/treatments'

const files = import.meta.glob('/samples/mocks/*/*.{html,css,json}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

/** The UI mockups in samples/mocks/<id>/ (mock.html, mock.css, mock.json). */
export function mocksFromFiles(raw: Record<string, string>): MockSource[] {
  const byId = new Map<string, Record<string, string>>()
  for (const [path, text] of Object.entries(raw)) {
    const m = /\/mocks\/([\w-]+)\/mock\.(html|css|json)$/.exec(path)
    if (!m) continue
    byId.set(m[1], { ...byId.get(m[1]), [m[2]]: text })
  }
  return [...byId].flatMap(([id, f]) => {
    // (Vitest hands CSS over as an empty string; the app and the exports get it in full.)
    if (!isMockId(id) || !f.html || f.css === undefined) return []
    const meta = f.json ? (JSON.parse(f.json) as Partial<MockSource>) : {}
    return [{ id, label: meta.label ?? id, hint: meta.hint ?? '', ratio: meta.ratio, chrome: meta.chrome, html: f.html, css: f.css }]
  })
}

export const mocks = mocksFromFiles(files)
registerMocks(mocks)

const lookFiles = import.meta.glob('/samples/treatments/*.json', { eager: true, import: 'default' }) as Record<string, unknown>

/** The curated looks in samples/treatments (the Effects shelf). */
export const looks = Object.entries(lookFiles).flatMap(([path, json]) => {
  const look = parseLook(path.replace(/^.*\/|\.json$/g, ''), json)
  return look ? [look] : []
}) as Look[]
registerLooks(looks)

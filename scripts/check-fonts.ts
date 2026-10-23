// Checks that every font in the library loads from its provider: npx vite-node scripts/check-fonts.ts
import { FONT_LIBRARY, fontSource } from '../resources/js/core/fonts'
import { fontHrefs } from '../resources/js/core/tokens'
const bad: string[] = []
await Promise.all(FONT_LIBRARY.map(async (f) => {
  const s = fontSource(f)
  if (s.provider === 'fontsource') {
    for (const url of fontHrefs([s])) {
      const r = await fetch(url)
      const t = await r.text()
      if (!r.ok || !t.includes(`'${f.family}'`)) bad.push(`${f.family} ${r.status} ${url}`)
    }
    return
  }
  const url = s.provider === 'fontshare' ? `https://api.fontshare.com/v2/css?f[]=${s.fontshare}&display=swap` : `https://fonts.googleapis.com/css2?family=${s.css2}&display=swap`
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36' } })
  const t = await r.text()
  if (!r.ok || !t.includes('@font-face')) bad.push(`${f.family} ${r.status} ${url}`)
  else if (s.provider === 'fontshare') { const ws = [...t.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]); for (const w of f.weights) if (!ws.includes(String(w))) bad.push(`${f.family} missing ${w} (has ${[...new Set(ws)].join(',')})`) }
}))
console.log(FONT_LIBRARY.length, 'fonts;', bad.length ? 'problems:\n' + bad.join('\n') : 'all load')

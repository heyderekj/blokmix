// The reader never writes: every free string it returns must be a span of what you typed. A span is found ignoring
// case, curly versus straight quotes, dash kinds, runs of spaces and the punctuation at its ends; what lands is the
// slice of your own text, exactly as you wrote it. app/Services/ReaderSpans.php does the same in PHP (both run
// tests/fixtures/reader-spans.json). One string that isn't a span drops the whole read.

/** A span is at most this long (a page's purpose, a who-it's-for). */
export const MAX_SPAN = 300

const QUOTES: Record<string, string> = { '‘': "'", '’': "'", '‛': "'", '`': "'", '´': "'", '“': '"', '”': '"', '„': '"', '‟': '"', '–': '-', '—': '-', '‐': '-', '‑': '-', '−': '-' }
/** Punctuation a span may start or end with that isn't part of it (stripped before matching). */
const EDGE = /^[\s.,;:!?'"‘’“”«»()[\]…–—-]+|[\s.,;:!?'"‘’“”«»()[\]…–—-]+$/gu

/** The text folded for matching, with each folded character's index in the original. */
function fold(text: string): { s: string; at: number[] } {
  let s = ''
  const at: number[] = []
  let i = 0
  for (const ch of text) {
    if (/\s/u.test(ch)) {
      if (s && !s.endsWith(' ')) {
        s += ' '
        at.push(i)
      }
    } else {
      const f = (QUOTES[ch] ?? ch).normalize('NFKC').toLowerCase()
      s += f
      // One entry per UTF-16 unit, so indexes into `s` line up (an emoji is two).
      for (let u = 0; u < f.length; u++) at.push(i)
    }
    i += ch.length
  }
  return { s, at }
}

/** The part of `text` that `span` quotes, exactly as written, or null when it isn't there. */
export function findSpan(text: string, span: string): string | null {
  if (typeof span !== 'string') return null
  const needle = fold(span.replace(EDGE, '')).s.trim()
  if (!needle || needle.length > MAX_SPAN) return null
  const hay = fold(text)
  const k = hay.s.indexOf(needle)
  if (k < 0) return null
  const start = hay.at[k]
  const lastFolded = k + needle.length - 1
  // The original character the last folded one came from, taken whole (a surrogate pair stays a pair).
  const lastStart = hay.at[lastFolded]
  const end = lastStart + (text.codePointAt(lastStart)! > 0xffff ? 2 : 1)
  return text.slice(start, end)
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

/** Every place a path names: "name", "feel.words[]", "pages[].purpose". */
function places(root: Json, path: string): { get: () => Json; set: (v: Json) => void }[] {
  const parts = path.split('.')
  let at: { get: () => Json; set: (v: Json) => void }[] = [{ get: () => root, set: () => {} }]
  for (const part of parts) {
    const many = part.endsWith('[]')
    const key = many ? part.slice(0, -2) : part
    const next: typeof at = []
    for (const p of at) {
      const o = p.get()
      if (!o || typeof o !== 'object' || Array.isArray(o) || !(key in o)) continue
      const obj = o as Record<string, Json>
      if (!many) next.push({ get: () => obj[key], set: (v) => (obj[key] = v) })
      else if (Array.isArray(obj[key])) {
        const arr = obj[key] as Json[]
        arr.forEach((_, i) => next.push({ get: () => arr[i], set: (v) => (arr[i] = v) }))
      }
    }
    at = next
  }
  return at
}

/**
 * The read with each span replaced by your own words exactly as written, or null when any string at a span path isn't
 * a span of `text` (or is empty). Nulls are fine: the reader says null for what you didn't say.
 */
export function verbatim<T>(read: T, text: string, paths: readonly string[]): T | null {
  const copy = JSON.parse(JSON.stringify(read)) as Json
  for (const path of paths) {
    for (const p of places(copy, path)) {
      const v = p.get()
      if (v === null) continue
      if (typeof v !== 'string') return null
      const exact = findSpan(text, v)
      if (exact === null) return null
      p.set(exact)
    }
  }
  return copy as T
}

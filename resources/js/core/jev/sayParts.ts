// Say it, two (or more) things at once: "make the hero darker and move testimonials to the top". The request is cut where
// people join requests ("and", "then", a comma or a semicolon), but only where every part reads as an edit on its own,
// so "black and white" or "terms and conditions" stay whole. Pure: the reader of each part is passed in.

/** Where people join two requests, longest first so "and then" wins over "and". */
const JOIN = /(\s*;\s*|,?\s+and then\s+|,?\s+and also\s+|,?\s+then\s+|,\s+and\s+|\s+and\s+|,\s+)/i

/**
 * The request as its parts, in the order said, when it holds two or more that each read (`reads` says whether some
 * words are an edit on their own); null when it's one request, or a part wouldn't read. Each part is the smallest run
 * of words, from where the last one ended, that reads, so a join inside a part ("black and white") stays in it.
 */
export function splitSay(text: string, reads: (part: string) => boolean): string[] | null {
  const pieces = text.trim().split(JOIN)
  // Words and joins alternate: words at even places.
  const words = pieces.filter((_, i) => i % 2 === 0)
  const joins = pieces.filter((_, i) => i % 2 === 1)
  if (words.length < 2) return null
  const parts: string[] = []
  let start = 0
  while (start < words.length) {
    let end = start
    let part = words[start]
    while (!reads(part.trim()) && end + 1 < words.length) {
      part += joins[end] + words[end + 1]
      end++
    }
    if (!reads(part.trim())) return null
    parts.push(part.trim())
    start = end + 1
  }
  return parts.length > 1 ? parts : null
}

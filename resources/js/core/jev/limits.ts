// The shape and size of request Blokmix sends Jev, checked before anything leaves our
// server. app/Http/Controllers/Api/JevController.php holds the same numbers in PHP.

export const JEV_LIMITS = {
  maxBody: 6 * 1024 * 1024,
  maxJsonWithoutImages: 200 * 1024,
  maxQuestions: 200,
  maxImages: 20,
  maxImageBytes: 1024 * 1024,
  minSide: 280,
  maxSide: 1568,
} as const

const MODELS = ['jev-latest', 'jev-preview']
const TYPES = ['choice', 'score', 'noul', 'box']

/** Width and height of a JPEG or PNG from its bytes, or null for anything else. */
export function imageSize(b: Uint8Array): { w: number; h: number; type: 'png' | 'jpg' } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
    return { w: v.getUint32(16), h: v.getUint32(20), type: 'png' }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      const len = (b[i + 2] << 8) | b[i + 3]
      // Start-of-frame markers (baseline, progressive…), not DHT/JPG/DAC.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], type: 'jpg' }
      }
      i += 2 + len
    }
  }
  return null
}

const fromBase64 = (s: string): Uint8Array | null => {
  try {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'))
    const bin = atob(s)
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** What's wrong with a request, in a sentence, or null when it's one Blokmix would send. */
export function requestProblem(body: unknown, rawBytes: number): string | null {
  if (rawBytes > JEV_LIMITS.maxBody) return 'That is more than Jev is asked about at once.'
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Send the request as JSON.'
  const b = body as Record<string, unknown>
  if (!MODELS.includes(b.model as string)) return 'Ask jev-latest or jev-preview.'
  if (!('state' in b)) return 'Send a state.'
  const q = b.questions
  if (!q || typeof q !== 'object' || Array.isArray(q) || !Object.keys(q).length) return 'Send the questions by name.'
  const qs = Object.values(q as Record<string, unknown>)
  if (qs.length > JEV_LIMITS.maxQuestions) return `At most ${JEV_LIMITS.maxQuestions} questions at once.`
  if (qs.some((x) => !x || typeof x !== 'object' || !TYPES.includes((x as { type?: string }).type ?? ''))) return 'Every question is a choice, score, noul or box.'
  const assets = (b.assets ?? {}) as Record<string, { type?: string; format?: string; data_base64?: string }>
  if (typeof assets !== 'object' || Array.isArray(assets)) return 'Assets go by reference.'
  const list = Object.values(assets)
  if (!list.length && rawBytes > JEV_LIMITS.maxJsonWithoutImages) return 'That is more words than Jev is asked about at once.'
  if (list.length > JEV_LIMITS.maxImages) return `At most ${JEV_LIMITS.maxImages} pictures at once.`
  for (const a of list) {
    const bytes = a?.type === 'image' && ['jpg', 'jpeg', 'png'].includes(a.format ?? '') && a.data_base64 ? fromBase64(a.data_base64) : null
    if (!bytes || !bytes.length || bytes.length > JEV_LIMITS.maxImageBytes) return 'Pictures are JPEG or PNG, under 1 MB each.'
    const size = imageSize(bytes)
    if (!size) return 'Pictures are JPEG or PNG, under 1 MB each.'
    if (Math.min(size.w, size.h) < JEV_LIMITS.minSide || Math.max(size.w, size.h) > JEV_LIMITS.maxSide) return 'Pictures are 280 to 1568 pixels a side.'
  }
  return null
}

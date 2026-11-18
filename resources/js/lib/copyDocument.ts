// Import only the document's text. Pictures and formatting stay in the original file.
export const COPY_LIMIT = 100_000
const MAX_BYTES = 8 * 1024 * 1024

export async function readCopyDocument(file: File): Promise<string> {
  if (!/\.(txt|md|markdown|docx)$/i.test(file.name)) throw new Error('Choose a Markdown (.md), text (.txt), or Word (.docx) file.')
  if (file.size > MAX_BYTES) throw new Error('Choose a file under 8 MB, or paste the text below.')

  let text: string
  if (/\.docx$/i.test(file.name)) {
    const { unzipSync, strFromU8 } = await import('fflate')
    try {
      const part = 'word/document.xml'
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => f.name === part && f.originalSize <= MAX_BYTES,
      })
      if (!files[part]) throw new Error()
      const xml = strFromU8(files[part])
      if (/<!DOCTYPE/i.test(xml)) throw new Error()
      const doc = new DOMParser().parseFromString(xml, 'application/xml')
      if (doc.getElementsByTagName('parsererror').length) throw new Error()
      const ns = doc.documentElement.namespaceURI
      const paragraphs = Array.from(doc.getElementsByTagNameNS(ns, 'p'))
      text = paragraphs.map((p) => {
        const style = p.getElementsByTagNameNS(ns, 'pStyle')[0]?.getAttributeNS(ns, 'val') ?? ''
        const heading = /^heading([1-6])$/i.exec(style)
        const runs = Array.from(p.getElementsByTagNameNS(ns, '*')).filter((el) => el.closest('*|p') === p)
        const line = runs.map((el) => {
          if (el.localName === 't') return el.textContent
          if (el.localName === 'tab') return '\t'
          if (el.localName === 'br' || el.localName === 'cr') return '\n'
          return ''
        }).join('').trim()
        return heading && line ? '#'.repeat(Number(heading[1])) + ' ' + line : line
      }).filter(Boolean).join('\n\n')
    } catch {
      throw new Error('Couldn’t read this Word document. Save it as a new .docx or paste its text below.')
    }
  } else {
    text = await file.text()
    if (text.includes('\u0000')) throw new Error('Save this file as UTF-8 text, or paste its text below.')
  }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!text) throw new Error('This file has no readable text. Try another file or paste your copy.')
  return text
}

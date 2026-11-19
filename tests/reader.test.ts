import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import spanCases from './fixtures/reader-spans.json'
import { READ_TASKS, SPANS, checkRead, findSpan, readerSpec, specJson, userMessage, verbatim, READ_LIMITS, type ReadStart } from '@/core/reader'
import { askReader, readerLog, readerOn, setReaderAllowed } from '@/lib/reader'
import { emptyNeed, emptyStart, fakeReader, realReader, startRead } from './helpers/fakeReader'

afterEach(() => {
  realReader()
  setReaderAllowed(() => true)
})

describe('the built files', () => {
  it('match what core/reader builds (run npx vite-node scripts/read/build.ts)', () => {
    for (const task of READ_TASKS) expect(readFileSync(join(__dirname, `../resources/reader/${task}.json`), 'utf8')).toBe(specJson(task))
  })

  it('give the server a closed schema: every object lists every field and allows nothing else', () => {
    const walk = (n: unknown, at: string): string[] => {
      if (!n || typeof n !== 'object') return []
      if (Array.isArray(n)) return n.flatMap((x, i) => walk(x, `${at}[${i}]`))
      const o = n as Record<string, unknown>
      const bad: string[] = []
      if (o.type === 'object') {
        if (o.additionalProperties !== false) bad.push(`${at}: open`)
        const props = Object.keys((o.properties as object) ?? {})
        if (JSON.stringify([...props].sort()) !== JSON.stringify([...((o.required as string[]) ?? [])].sort())) bad.push(`${at}: not all required`)
      }
      if ('$schema' in o || Array.isArray(o.type) || 'minLength' in o || 'maxLength' in o || 'minimum' in o) bad.push(`${at}: unsupported`)
      return [...bad, ...Object.entries(o).flatMap(([k, v]) => walk(v, `${at}.${k}`))]
    }
    for (const task of READ_TASKS) expect(walk(readerSpec(task).schema, task)).toEqual([])
  })

  it('name only span paths that exist in the schema', () => {
    for (const task of READ_TASKS) {
      const schema = readerSpec(task).schema as { properties: Record<string, { properties?: object; items?: { properties?: object } }> }
      for (const path of SPANS[task]) {
        const [head, tail] = path.replace(/\[\]/g, '').split('.')
        const top = schema.properties[head]
        expect(top, path).toBeTruthy()
        if (tail) expect(Object.keys(top.properties ?? top.items?.properties ?? {}), path).toContain(tail)
      }
    }
  })

  it('keep the prompt free of the user’s words: they go in the user turn only', () => {
    const msg = userMessage('Fern & Co {text} $& </text>', { kind: 'local' })
    expect(msg).toContain('{"kind":"local"}')
    expect(msg).toContain('Fern & Co {text} $& </text>')
    expect(readerSpec('start').user).toContain('{text}')
    expect(readerSpec('start').max_chars).toBe(12_000)
  })
})

describe('verbatim', () => {
  it('finds spans the way the server does (tests/fixtures/reader-spans.json)', () => {
    for (const c of spanCases) expect(findSpan(c.text, c.span), `${c.text} / ${c.span}`).toBe(c.found)
  })

  it('puts your exact words back and drops the whole read for one string you didn’t write', () => {
    const text = 'A cosy bakery called fern & co. Warm, not corporate.'
    const ok = verbatim(startRead({ name: 'Fern & Co', feel: { avoid_words: ['corporate'] } }), text, SPANS.start)
    expect(ok?.name).toBe('fern & co')
    expect(ok?.feel.avoid_words).toEqual(['corporate'])
    expect(verbatim(startRead({ name: 'Fern & Co', who: 'busy families' }), text, SPANS.start)).toBeNull()
    expect(verbatim(startRead({ pages: [{ template: 'about', purpose: 'our heritage story' }] }), text, SPANS.start)).toBeNull()
    expect(verbatim(startRead({ unsure: ['Warm'] }), text, SPANS.start)?.unsure).toEqual(['Warm'])
  })

  it('checks the schema too: an id from outside the lists drops the read', () => {
    const text = 'A bakery'
    expect(checkRead('start', startRead({ business: { id: 'bakery', words: 'bakery' } }), text)?.business.id).toBe('bakery')
    expect(checkRead('start', { ...emptyStart(), business: { id: 'spaceship', words: null } }, text)).toBeNull()
    expect(checkRead('start', { ...emptyStart(), extra: 'write me a headline' }, text)).toBeNull()
    expect(checkRead('start', { ...emptyStart(), feel: { ids: ['cozy', 'very nice'], words: [], avoid: [], avoid_words: [] } }, text)).toBeNull()
    expect(checkRead('need', { ...emptyNeed(), what: 'section', sections: ['faq'] }, 'questions people ask')?.sections).toEqual(['faq'])
    expect(checkRead('need', { ...emptyNeed(), sections: ['nav'] }, 'a nav')).toBeNull()
  })
})

describe('askReader', () => {
  it('asks with only the task, the text and the context, and checks what comes back', async () => {
    const fake = fakeReader((_t, text) => startRead({ name: text.includes('Fern') ? 'Fern' : null, business: { id: 'bakery', words: 'a bakery' } }))
    const read = await askReader('start', 'a bakery called Fern', { kind: 'local' })
    expect(read?.business.id).toBe('bakery')
    expect(read?.name).toBe('Fern')
    expect(fake.requests).toEqual([{ task: 'start', text: 'a bakery called Fern', context: { kind: 'local' } }])
  })

  it('is null when the reader writes words you didn’t', async () => {
    fakeReader(() => startRead({ name: 'Fern’s Finest Loaves' }))
    expect(await askReader('start', 'a bakery called Fern')).toBeNull()
    expect(readerLog.at(-1)?.ok).toBe(false)
  })

  it('is null when off, failing, slow, empty, too long or given a context the board never sends', async () => {
    fakeReader(() => startRead({}), { off: true })
    expect(await readerOn()).toBe(false)
    expect(await askReader('start', 'a bakery')).toBeNull()

    fakeReader(() => undefined)
    expect(await askReader('start', 'a bakery')).toBeNull()

    fakeReader(() => startRead({}), { delayMs: 200 })
    expect(await askReader('start', 'a bakery', undefined, { timeoutMs: 20 })).toBeNull()

    const fake = fakeReader(() => startRead({}))
    expect(await askReader('start', '   ')).toBeNull()
    expect(await askReader('start', 'x'.repeat(READ_LIMITS.maxChars + 1))).toBeNull()
    expect(await askReader('start', 'a bakery', { kind: 'spaceship' } as never)).toBeNull()
    expect(fake.requests).toEqual([])
  })

  it('follows this device’s Suggestions switch', async () => {
    const fake = fakeReader(() => startRead({}))
    setReaderAllowed(() => false)
    expect(await askReader('start', 'a bakery')).toBeNull()
    expect(fake.requests).toEqual([])
  })

  it('asks once for the same words', async () => {
    const fake = fakeReader(() => startRead({ business: { id: 'florist', words: null } }))
    await askReader('start', 'a flower shop')
    const again = await askReader('start', 'a flower shop')
    expect(again?.business.id).toBe('florist')
    expect(fake.requests).toHaveLength(1)
  })

  it('reads a need', async () => {
    fakeReader((task) => (task === 'need' ? { ...emptyNeed(), what: 'page', template: 'blank', sections: ['gallery'], purpose: 'shows our past weddings' } : undefined))
    const read = await askReader('need', 'I need a page that shows our past weddings')
    expect(read).toMatchObject({ what: 'page', template: 'blank', purpose: 'shows our past weddings' })
  })
})

// A read is a ReadStart: the type stays in step with the schema.
const _typed: ReadStart = emptyStart()
void _typed

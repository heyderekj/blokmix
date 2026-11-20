import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { applyRead, setPicks, type StartState, type StartView } from '@/core/startFlow'
import { keywordRead, type ReadStart } from '@/core/reader'
import { matchRequest, openBlanks, rankRequest, readMatch, readRank, sentenceText, startSentence, type Blank, type Picks } from '@/core/jev/sentence'
import { askJev, askLatest } from '@/lib/jev'
import { askReader, readerOn } from '@/lib/reader'
import { noteWants } from '@/lib/jevWants'
import type { Heard } from '@/lib/startFromText'
import { Sentence, isParagraph } from '@/ui/jev/Sentence'
import { ChipRows } from './ChipRows'
import { CopyDrawer } from './CopyDrawer'

const SEGMENTS = startSentence()

/**
 * Describe the site, on one screen: the sentence with blanks, then a row for each thing it understood, all filled in
 * and changeable in place. Your own words in a blank, or a paragraph pasted into any of them, are read: by the reader
 * when it's on, else by keywords, so they never dead-end. A read fills every blank it can, never one you set.
 */
export function Describe({ s, v, setS, jev, onReading }: { s: StartState; v: StartView; setS: Dispatch<SetStateAction<StartState>>; jev: boolean; onReading: (on: boolean) => void }) {
  const [order, setOrder] = useState<Record<string, string[]>>({})
  const latest = useRef(s)
  latest.current = s
  const fill = v.fill

  // The open blanks' options, in the order that fits what's filled so far.
  useEffect(() => {
    if (!jev || !fill.text) return
    const open = openBlanks(SEGMENTS, s.picks)
    if (!open.some((b) => !b.ownOnly)) return
    let live = true
    const timer = window.setTimeout(() => {
      askLatest('start-sentence', rankRequest(sentenceText(SEGMENTS, s.picks), open)).then((res) => live && res && setOrder((o) => ({ ...o, ...readRank(res, open) })))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill.text, jev])

  // Things asked for that Blokmix has no section for yet are counted (by name only) for what to make next.
  const noted = useRef(new Set<string>())
  useEffect(() => {
    const fresh = fill.wants.filter((w) => !noted.current.has(w))
    if (!jev || !fresh.length) return
    fresh.forEach((w) => noted.current.add(w))
    void noteWants(fresh, 'start', undefined, fill.kind ?? undefined)
  }, [fill.wants, fill.kind, jev])

  const match = async (b: Blank, words: string) => readMatch(await askJev(matchRequest(b, words, fill.text)))

  /** Read your words and fold the read in. The reader goes over the whole sentence; keywords read just your words. */
  const read = async (text: string, own?: { blank: string; words: string; paragraph?: boolean }, now?: Picks) => {
    const asked = now ?? latest.current.picks
    onReading(true)
    try {
      let r: ReadStart | null = null
      if (await readerOn()) {
        const context = fill.kind ? { kind: fill.kind } : undefined
        r = await askReader('start', text, context)
      }
      setS((cur) => applyRead(cur, r ?? keywordRead(own?.words ?? text), asked, own))
    } finally {
      onReading(false)
    }
  }

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">What are you making?</h2>
        <p className="mt-1.5 text-[15px] text-[#6B5F68] [text-wrap:pretty]">Fill in the blanks in your own words, or paste a paragraph into any of them. The page beside follows along.</p>
      </div>
      <Sentence
        segments={SEGMENTS}
        picks={s.picks}
        onPicks={(picks) => setS((cur) => setPicks(cur, picks))}
        order={order}
        kind={fill.kind}
        match={jev ? match : undefined}
        from={s.from}
        onOwnWords={(b, words, now, list) => {
          // Your words for the name are just the name; everything else may say more than its blank.
          if (b.ownOnly) return
          const sentence = sentenceText(SEGMENTS, now)
          // A list already holds its items in the blank, so the read only fills the other blanks. A paragraph says more
          // than its blank: the blank takes what's read from it (applyRead's `paragraph`). `now` is the sentence as it
          // is with your words in it, so the read never mistakes them for a change made while it read.
          if (list) void read(sentence, undefined, now)
          else void read(sentence, { blank: b.id, words, paragraph: isParagraph(words) }, now)
        }}
        onPasteText={(text) => void read(text)}
      />
      <ChipRows s={s} v={v} onChange={setS} paste={s.copy?.mode === 'paste'} />
      <CopyDrawer kind={v.kind} using={s.copy?.mode === 'paste' ? (s.copy as Heard) : null} onUse={(heard) => setS((cur) => ({ ...cur, copy: heard, sections: null }))} />
    </section>
  )
}

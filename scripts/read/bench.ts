// Putting the reader through its paces.
//
//   npx vite-node scripts/read/bench.ts [start|need] [--runs 3]
//
// Reads each labelled text (scripts/read/cases.ts) the way the server does (scripts/read/call.ts: the committed spec,
// structured output, then the schema and the spans) and prints accuracy per field against today's start (Jev's
// describe request plus keywords; Jev only with TYPESAFE_API_KEY, else keywords alone), how many reads were dropped
// for a string that wasn't the text's (and that none was let through), latency and cost. Writes
// .out/read/bench-<date>.json. Needs ANTHROPIC_API_KEY (shell, .env.local or .env).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clientFor, dollars, readOnce, type Reply } from './call'
import { NEED_CASES, START_CASES, type StartCase, type StartTruth } from './cases'
import { SPANS, type ReadNeed, type ReadStart } from '../../resources/js/core/reader/schema'
import { ask, jevKey, pool } from '../jev/client'
import { describeRequest, readDescribe, sureGoals } from '../../resources/js/core/jev/describe'
import { guessBrief, kindOf } from '../../resources/js/core/brief'

function keyFromFiles(name: string): string {
  for (const f of ['.env.local', '.env']) {
    const p = join(process.cwd(), f)
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(new RegExp(`^${name}[ \\t]*=[ \\t]*"?([^"\\n]+?)"?[ \\t]*$`, 'm'))
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return ''
}

const args = process.argv.slice(2)
const runsAt = args.indexOf('--runs')
const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 1
const suites = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--runs')
const chosen = suites.length ? suites : ['start']
const key = process.env.ANTHROPIC_API_KEY?.trim() || keyFromFiles('ANTHROPIC_API_KEY')
const model = process.env.BLOKMIX_READ_MODEL?.trim() || keyFromFiles('BLOKMIX_READ_MODEL') || 'claude-haiku-5-5'

if (!key) {
  console.error('No ANTHROPIC_API_KEY: put it in .env.local (or export it) and run again.')
  process.exit(1)
}
const client = clientFor(key, 20_000)

// ---- Judging ----

type Field = keyof StartTruth
type Verdicts = Partial<Record<Field, boolean>>

const has = (xs: string[] | undefined, x: string) => !!xs?.includes(x)

/** Each field the truth names, right or wrong, for the reader's read. */
function judgeStart(t: StartTruth, r: ReadStart): Verdicts {
  const v: Verdicts = {}
  if ('business' in t) v.business = r.business.id === t.business
  if (t.kind) v.kind = r.kind === t.kind
  if (t.format) v.format = r.format === t.format
  if (t.industry) v.industry = r.industry === t.industry
  if ('name' in t) v.name = (r.name ?? null)?.toLowerCase() === (t.name ?? null)?.toLowerCase()
  if (t.feel) v.feel = t.feel.some((f) => has(r.feel.ids, f))
  if (t.notFeel) v.notFeel = !t.notFeel.some((f) => has(r.feel.ids, f))
  if (t.avoid !== undefined) v.avoid = (r.feel.avoid.length + r.feel.avoid_words.length > 0) === t.avoid
  if (t.goals) v.goals = t.goals.every((g) => has(r.goals, g))
  if (t.notGoals) v.notGoals = !t.notGoals.some((g) => has(r.goals, g))
  if (t.action) v.action = r.action.id === t.action
  if (t.show) v.show = t.show.every((s) => has(r.show, s))
  if (t.notShow) v.notShow = !t.notShow.some((s) => has(r.show, s))
  if (t.pages) v.pages = JSON.stringify([...new Set(r.pages.map((p) => p.template))].sort()) === JSON.stringify([...t.pages].sort())
  if ('tone' in t) v.tone = r.tone === t.tone
  return v
}

/** What today's start reads from the same text: Jev's describe request (when there's a key) else keywords. */
async function today(text: string): Promise<{ kind: string | null; format: string | null; industry: string | null; goals: string[]; jev: boolean }> {
  const guess = guessBrief(text)
  const byKeywords = { kind: guess.format || guess.industry ? kindOf(guess) : null, format: guess.format ?? null, industry: guess.industry ?? null, goals: guess.goals ?? [], jev: false }
  if (!jevKey()) return byKeywords
  const { res } = await ask(describeRequest(text, []))
  const d = readDescribe(res)
  if (!d) return byKeywords
  return { kind: d.kind, format: d.format ?? byKeywords.format, industry: d.industry ?? byKeywords.industry, goals: sureGoals(d).length ? sureGoals(d) : byKeywords.goals, jev: true }
}

function judgeToday(t: StartTruth, d: Awaited<ReturnType<typeof today>>): Verdicts {
  const v: Verdicts = {}
  if (t.kind) v.kind = d.kind === t.kind
  if (t.format) v.format = d.format === t.format
  if (t.industry) v.industry = d.industry === t.industry
  if (t.goals) v.goals = t.goals.every((g) => d.goals.includes(g))
  if (t.notGoals) v.notGoals = !t.notGoals.some((g) => d.goals.includes(g))
  return v
}

/** Strings in an accepted read that aren't, character for character, in the text (must stay 0). */
function strayStrings(read: unknown, text: string, paths: readonly string[]): string[] {
  const out: string[] = []
  const at = (o: unknown, parts: string[]): unknown[] => {
    if (!parts.length) return [o]
    const [p, ...rest] = parts
    const many = p.endsWith('[]')
    const v = (o as Record<string, unknown> | null)?.[many ? p.slice(0, -2) : p]
    return many ? (Array.isArray(v) ? v.flatMap((x) => at(x, rest)) : []) : at(v, rest)
  }
  for (const path of paths) for (const s of at(read, path.split('.'))) if (typeof s === 'string' && !text.includes(s)) out.push(s)
  return out
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const quantile = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] : 0)

function summary(name: string, replies: Reply[]) {
  const ok = replies.filter((r) => r.read)
  const why: Record<string, number> = {}
  for (const r of replies) if (!r.read) why[r.why ?? 'error'] = (why[r.why ?? 'error'] ?? 0) + 1
  const cost = replies.reduce((s, r) => s + dollars(r), 0)
  const ms = replies.map((r) => r.ms)
  console.log(`\n${name}: ${ok.length}/${replies.length} reads accepted${Object.keys(why).length ? ` (dropped: ${Object.entries(why).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`)
  console.log(`  latency p50 ${quantile(ms, 0.5)}ms, p90 ${quantile(ms, 0.9)}ms`)
  console.log(`  tokens per read: ${Math.round(replies.reduce((s, r) => s + r.input_tokens, 0) / replies.length)} in (${Math.round(replies.reduce((s, r) => s + r.cache_read, 0) / replies.length)} from cache), ${Math.round(replies.reduce((s, r) => s + r.output_tokens, 0) / replies.length)} out`)
  console.log(`  cost: $${(cost / replies.length).toFixed(5)} a read, $${cost.toFixed(4)} in all`)
  return { accepted: ok.length, total: replies.length, dropped: why, p50: quantile(ms, 0.5), p90: quantile(ms, 0.9), dollarsPerRead: cost / replies.length }
}

// ---- Suites ----

const out: Record<string, unknown> = { model, runs, date: new Date().toISOString() }

if (chosen.includes('start')) {
  const replies: Reply[] = []
  const reader: Record<string, [number, number]> = {}
  const base: Record<string, [number, number]> = {}
  const byTag: Record<string, [number, number]> = {}
  const stray: string[] = []
  const misses: unknown[] = []
  const repeats: Record<number, string[]> = {}
  let jevUsed = false
  const tally = (into: Record<string, [number, number]>, v: Verdicts) => {
    for (const [f, ok] of Object.entries(v)) {
      into[f] ??= [0, 0]
      into[f][0] += ok ? 1 : 0
      into[f][1] += 1
    }
  }
  for (let run = 0; run < runs; run++) {
    await pool(START_CASES, 4, async (c: StartCase, i) => {
      const r = await readOnce(client, model, 'start', c.text)
      replies.push(r)
      ;(repeats[i] ??= []).push(JSON.stringify(r.read))
      if (r.read) stray.push(...strayStrings(r.read, c.text, SPANS.start))
      const v = r.read ? judgeStart(c.truth, r.read as ReadStart) : Object.fromEntries(Object.keys(c.truth).map((f) => [f, false]))
      tally(reader, v)
      byTag[c.tag] ??= [0, 0]
      byTag[c.tag][0] += Object.values(v).filter(Boolean).length
      byTag[c.tag][1] += Object.values(v).length
      if (run === 0) {
        const d = await today(c.text)
        jevUsed ||= d.jev
        tally(base, judgeToday(c.truth, d))
        const wrong = Object.entries(v).filter(([, ok]) => !ok).map(([f]) => f)
        if (wrong.length) misses.push({ tag: c.tag, text: c.text.slice(0, 80), wrong, read: r.read, why: r.why })
      }
    })
  }
  const s = summary('start', replies)
  console.log(`  strings let through that weren’t the text’s: ${stray.length} (must be 0)`)
  console.log(`\n  field        reader   today (${jevUsed ? 'Jev + keywords' : 'keywords only: no TYPESAFE_API_KEY'})`)
  for (const [f, [n, d]] of Object.entries(reader)) console.log(`  ${f.padEnd(12)} ${pct(n, d).padStart(6)}   ${base[f] ? pct(base[f][0], base[f][1]).padStart(6) : '     — (not read today)'}`)
  console.log('\n  by kind of text:')
  for (const [t, [n, d]] of Object.entries(byTag)) console.log(`  ${t.padEnd(12)} ${pct(n, d).padStart(6)}`)
  const unstable = runs > 1 ? Object.values(repeats).filter((xs) => new Set(xs).size > 1).length / START_CASES.length : null
  if (unstable !== null) console.log(`  reads that changed between ${runs} runs: ${Math.round(unstable * 100)}%`)
  out.start = { ...s, reader, today: base, todayUsedJev: jevUsed, byTag, stray, unstable, misses }
}

if (chosen.includes('need')) {
  const replies: Reply[] = []
  let right = 0
  let judged = 0
  const stray: string[] = []
  for (let run = 0; run < runs; run++) {
    await pool(NEED_CASES, 4, async (c) => {
      const r = await readOnce(client, model, 'need', c.text)
      replies.push(r)
      const read = r.read as ReadNeed | null
      if (read) stray.push(...strayStrings(read, c.text, SPANS.need))
      const checks = [read?.what === c.truth.what, ...(c.truth.template ? [read?.template === c.truth.template] : []), ...(c.truth.sections ? [c.truth.sections.some((t) => read?.sections.slice(0, 2).includes(t as never))] : [])]
      right += checks.filter(Boolean).length
      judged += checks.length
    })
  }
  const s = summary('need', replies)
  console.log(`  strings let through that weren’t the text’s: ${stray.length} (must be 0)`)
  console.log(`  right: ${pct(right, judged)} of ${judged} checks`)
  out.need = { ...s, right, judged, stray }
}

mkdirSync('.out/read', { recursive: true })
const file = `.out/read/bench-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`\nWrote ${file}`)

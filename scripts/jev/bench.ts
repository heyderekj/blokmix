// Putting Jev through its paces on Blokmix's own data.
//
//   npx vite-node scripts/jev/bench.ts [suite…] [--runs 3]
//
// Each suite (scripts/jev/suites/) turns labelled cases into Jev requests and judges the
// answers against the truth and against what Blokmix did before Jev. It prints accuracy,
// how often acting at each threshold would be right, calibration, how often the option
// order changes the answer, latency and cost, and writes .out/jev/bench-<date>.json.
// Thresholds in core/jev/<feature>.ts change only when this says so. Needs TYPESAFE_API_KEY.

import { mkdirSync, writeFileSync } from 'node:fs'
import { ask, jevKey, pool } from './client'
import { describeMetrics, metrics, type Judged } from './metrics'
import { SUITES } from './suites'

const args = process.argv.slice(2)
const runsAt = args.indexOf('--runs')
const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 1
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--runs')
const chosen = names.length ? SUITES.filter((s) => names.includes(s.name)) : SUITES

if (!jevKey()) {
  console.error('No TYPESAFE_API_KEY: put it in .env.local (or export it) and run again.')
  process.exit(1)
}
if (!chosen.length) {
  console.error(`No such suite. Suites: ${SUITES.map((s) => s.name).join(', ')}`)
  process.exit(1)
}

const out: Record<string, unknown> = {}
for (const suite of chosen) {
  const cases = await suite.load()
  const judged: Judged[] = []
  const ms: number[] = []
  let tokens = 0
  const repeats: Record<string, string[]> = {}
  for (let r = 0; r < runs; r++) {
    await pool(cases, 6, async (c, i) => {
      const req = await suite.request(c)
      const { res, ms: t, error } = await ask(req)
      if (error) console.warn(`  ${suite.name} #${i}: ${error}`)
      ms.push(t)
      tokens += res?.usage.input_tokens ?? 0
      const js = suite.judge(c, res)
      if (r === 0) judged.push(...js)
      js.forEach((j, k) => (repeats[`${i}.${k}`] ??= []).push(j.jev))
    })
  }
  const m = metrics(judged)
  const unstable = runs > 1 ? Object.values(repeats).filter((xs) => new Set(xs).size > 1).length / Math.max(1, Object.keys(repeats).length) : null
  console.log(describeMetrics(suite.name, m, ms, tokens) + (unstable !== null ? `\n  changed between ${runs} runs: ${Math.round(unstable * 100)}%` : ''))
  out[suite.name] = { metrics: m, ms, tokens, unstable, misses: judged.filter((j) => j.jev !== j.truth).slice(0, 30) }
}

mkdirSync('.out/jev', { recursive: true })
const file = `.out/jev/bench-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`\nWrote ${file}`)

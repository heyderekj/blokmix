// How well Jev did on a bench suite: right answers, against today's heuristic, how its
// probabilities line up with how often it's right, and whether the option order sways it.

/** One judged question: what was true, what Jev said and how sure, and what Blokmix said before Jev. */
export interface Judged {
  truth: string
  jev: string
  p: number
  /** Both option orders picked the same (when the question was asked shuffled). */
  agree?: boolean
  baseline?: string | null
}

export interface Metrics {
  n: number
  accuracy: number
  baseline: number | null
  /** At each threshold: how many Jev would act on, and how often those are right. */
  thresholds: { t: number; coverage: number; precision: number }[]
  /** Expected calibration error over 10 buckets (0 = probabilities match hit rates). */
  ece: number
  buckets: { from: number; n: number; p: number; hit: number }[]
  /** Share asked in both orders that changed their answer. */
  flip: number | null
}

export function metrics(js: Judged[], ts = [0.5, 0.6, 0.7, 0.8, 0.9]): Metrics {
  const n = js.length
  const hit = (j: Judged) => j.jev === j.truth
  const withBase = js.filter((j) => j.baseline !== undefined)
  const buckets = Array.from({ length: 10 }, (_, i) => {
    const inB = js.filter((j) => Math.min(9, Math.floor(j.p * 10)) === i)
    return { from: i / 10, n: inB.length, p: inB.length ? inB.reduce((s, j) => s + j.p, 0) / inB.length : 0, hit: inB.length ? inB.filter(hit).length / inB.length : 0 }
  })
  const asked = js.filter((j) => j.agree !== undefined)
  return {
    n,
    accuracy: n ? js.filter(hit).length / n : 0,
    baseline: withBase.length ? withBase.filter((j) => j.baseline === j.truth).length / withBase.length : null,
    thresholds: ts.map((t) => {
      const act = js.filter((j) => j.p >= t)
      return { t, coverage: n ? act.length / n : 0, precision: act.length ? act.filter(hit).length / act.length : 0 }
    }),
    ece: n ? buckets.reduce((s, b) => s + (b.n / n) * Math.abs(b.p - b.hit), 0) : 0,
    buckets,
    flip: asked.length ? asked.filter((j) => !j.agree).length / asked.length : null,
  }
}

export function percentile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] : 0
}

const pc = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

export function describeMetrics(name: string, m: Metrics, ms: number[], tokens: number): string {
  const lines = [
    `${name}: ${m.n} answers · Jev ${pc(m.accuracy)}${m.baseline !== null ? ` · today’s rule ${pc(m.baseline)}` : ''} · calibration error ${m.ece.toFixed(3)}${m.flip !== null ? ` · flips with option order ${pc(m.flip)}` : ''}`,
    `  acting at ${m.thresholds.map((t) => `${t.t}: ${pc(t.coverage)} of answers, ${pc(t.precision)} right`).join(' · ')}`,
    `  latency p50 ${Math.round(percentile(ms, 0.5))} ms, p95 ${Math.round(percentile(ms, 0.95))} ms · ${tokens.toLocaleString()} input tokens ≈ $${((tokens / 1e6) * 0.042).toFixed(4)}`,
  ]
  return lines.join('\n')
}

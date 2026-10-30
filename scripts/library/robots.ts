// A small robots.txt reader: the groups for our agent (or `*`), Allow/Disallow with `*` and `$`, longest match wins.

export interface Robots {
  allowed(path: string): boolean
}

export function parseRobots(text: string, agent = 'blokmix'): Robots {
  type Group = { agents: string[]; rules: { allow: boolean; re: RegExp; len: number }[] }
  const groups: Group[] = []
  let cur: Group | null = null
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }))
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur || (key !== 'allow' && key !== 'disallow')) continue
    if (key === 'disallow' && !val) continue
    const re = new RegExp('^' + val.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$'))
    cur.rules.push({ allow: key === 'allow', re, len: val.length })
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)))
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
  return {
    allowed(path: string) {
      const hits = rules.filter((r) => r.re.test(path)).sort((a, b) => b.len - a.len || Number(b.allow) - Number(a.allow))
      return hits.length ? hits[0].allow : true
    },
  }
}

export async function fetchRobots(origin: string, agent?: string): Promise<{ robots: Robots; found: boolean }> {
  try {
    const res = await fetch(new URL('/robots.txt', origin), { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return { robots: parseRobots('', agent), found: false }
    return { robots: parseRobots(await res.text(), agent), found: true }
  } catch {
    return { robots: parseRobots('', agent), found: false }
  }
}

import { hash } from '@/core/hash'

/**
 * People and agents, told apart by kind rather than colour: a person is a
 * monogram, an agent is a woven pattern. Both stay neutral so status and the
 * key colour are the only hues in a header.
 */
export type Participant = { kind: 'person'; name: string } | { kind: 'agent'; name: string }

export function Avatar({ who, size = 28, ring = true }: { who: Participant; size?: number; ring?: boolean }) {
  const cls = `grid shrink-0 place-items-center overflow-hidden rounded-full ${ring ? 'ring-2 ring-[var(--lift)]' : ''}`
  if (who.kind === 'person') {
    const initials = monogram(who.name)
    return (
      <span className={`${cls} bg-chip font-semibold text-zinc-700`} style={{ width: size, height: size, fontSize: size * (initials.length > 1 ? 0.36 : 0.42) }} title={who.name}>
        {initials}
      </span>
    )
  }
  return (
    <span className={`${cls} bg-zinc-900`} style={{ width: size, height: size }} title={`${who.name} (agent)`}>
      <AgentPattern seed={who.name} size={size} />
    </span>
  )
}

export function AvatarStack({ people, extra }: { people: Participant[]; extra?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {people.map((p) => (
          <Avatar key={`${p.kind}:${p.name}`} who={p} />
        ))}
      </div>
      {extra}
    </div>
  )
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** A small woven pattern, seeded by the agent's name so each agent keeps its own. */
function AgentPattern({ seed, size }: { seed: string; size: number }) {
  const n = parseInt(hash(seed), 36)
  const kind = n % 3
  const angle = [0, 45, -45, 90][(n >> 2) % 4]
  const id = `ap-${hash(seed)}`
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        {kind === 0 && (
          <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
            <rect width="2" height="4" fill="var(--n-400)" />
          </pattern>
        )}
        {kind === 1 && (
          <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
            <circle cx="2" cy="2" r="1.1" fill="var(--n-300)" />
          </pattern>
        )}
        {kind === 2 && (
          <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
            <rect width="3" height="3" fill="var(--n-400)" />
            <rect x="3" y="3" width="3" height="3" fill="var(--n-400)" />
          </pattern>
        )}
      </defs>
      <rect width="24" height="24" fill="var(--n-700)" />
      <rect width="24" height="24" fill={`url(#${id})`} opacity="0.55" />
      <circle cx="12" cy="12" r="4.2" fill="var(--n-50)" opacity="0.9" />
    </svg>
  )
}

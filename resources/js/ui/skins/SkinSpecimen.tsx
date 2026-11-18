import { useMemo } from 'react'
import { themeScene, type ThemeScene } from '@/core/themeScene'
import type { GuideState } from '@/core/types'

export function SceneDrawing({scene: s, lettering = true}: {scene: ThemeScene; lettering?: boolean}) {
  const { hero, band, radius, inset } = s
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300" aria-hidden="true" className="block h-auto w-full rounded-xl">
    <rect width="600" height="300" fill={hero['color.bg']} />
    <rect y="230" width="600" height="70" fill={band['color.bg']} />
    <rect x={inset} y="161" width="132" height="44" rx={s.pill ? 22 : radius} fill={hero['color.primary']} />
    {s.outline && <rect x={inset + 140} y="161" width="133" height="44" rx={radius} stroke={hero['color.text']} fill="none" />}
    {s.card === 'offset' && <rect x="386" y="51" width="188" height="156" rx={radius} fill={hero['color.text']}/>}
    <rect x="380" y="45" width="188" height="156" rx={radius} fill={hero['color.surface']} stroke={s.card === 'bordered' || s.card === 'offset' ? hero['color.text'] : 'none'} />
    {s.art && <image href={s.art} x="390" y="55" width="168" height="102" preserveAspectRatio="xMidYMid slice" />}
    <rect x="392" y="172" width="77" height="6" rx="3" fill={hero['color.text']} />
    <rect x={inset} y="259" width="92" height="7" rx="3" fill={band['color.text']} />
    <circle cx="554" cy="263" r="12" fill={band['color.accent']} />
    {lettering && s.lines.map((l) => <svg key={l.y + l.x} x={l.x} y={l.y - l.size} width={l.width} height={l.size * 1.3} overflow="hidden">
      <text y={l.size} fontFamily={l.family} fontWeight={l.weight} fontSize={l.size} fill={l.color}>{l.text}</text>
    </svg>)}
  </svg>
}

export function SkinSpecimen({guide, name}: {guide: GuideState; name: string}) {
  const scene = useMemo(() => themeScene(guide, name), [guide, name])
  return <SceneDrawing scene={scene} />
}

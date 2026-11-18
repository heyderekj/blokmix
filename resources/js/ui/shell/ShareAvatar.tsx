import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { ShaderMount } from '@paper-design/shaders'
import { hash } from '@/core/hash'
// Bundle the small crop so the poster and shader share one texture without a separate request.
import paintUrl from '@/assets/share-paint.webp?inline'

const GUEST_HUES = [48, 90, 145, 190, 230, 275]

// Bend the color bands with two traveling waves. The center and rim stay anchored to the crop.
const PAINT_FLOW = `#version 300 es
precision highp float;
uniform mediump vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_paint;
uniform float u_angle;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x, 1.0 - uv.y) - 0.5;
  vec2 phase = vec2(3.1, -2.35) * u_time;
  vec2 wave = sin(vec2(p.y * 9.0, p.x * 8.0) + phase) - sin(phase);
  float strength = 1.0 - smoothstep(0.17, 0.49, length(p));
  p += wave * strength * vec2(0.06, 0.095);

  float c = cos(u_angle), s = sin(u_angle);
  fragColor = texture(u_paint, mat2(c, s, -s, c) * p + 0.5);
}`

export function ShareAvatar({ name, mixId, memberId, owner, size = 32, live = false }: {
  name: string
  mixId: string
  memberId: number
  owner: boolean
  size?: number
  live?: boolean
}) {
  const host = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const reducedMotion = useReducedMotion()
  // Link guests have a stable variation across refreshes and in the People list.
  const seed = parseInt(hash(`${mixId}:${memberId}`), 36)
  const hue = owner ? 0 : GUEST_HUES[seed % GUEST_HUES.length]
  const rotation = owner ? 0 : ((seed >>> 8) % 4) * 90
  const animated = (live || hovered) && !reducedMotion

  useEffect(() => {
    const element = host.current
    if (!animated || !element) return

    let cancelled = false
    let mount: ShaderMount | undefined
    const dispose = () => {
      const current = mount
      mount = undefined
      current?.dispose()
    }

    void (async () => {
      const image = new Image()
      image.src = paintUrl
      try {
        const [{ ShaderMount }] = await Promise.all([import('@paper-design/shaders'), image.decode()])
        if (cancelled) return
        mount = new ShaderMount(element, PAINT_FLOW, {
          u_paint: image,
          u_angle: -rotation * Math.PI / 180,
        }, { antialias: false }, 0.5, 0, 1, 64 * 64, ['u_paint'])
        mount.canvasElement.addEventListener('webglcontextlost', dispose, { once: true })
      } catch {
        // The cropped still remains visible if the canvas fails to start.
        if (!cancelled) element.replaceChildren()
      }
    })()

    return () => {
      cancelled = true
      dispose()
    }
  }, [animated, rotation])

  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full bg-key-soft ring-2 ring-[var(--lift)]"
      style={{ width: size, height: size }}
      title={name}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{ filter: hue ? `hue-rotate(${hue}deg)` : undefined }}
      >
        <img
          src={paintUrl}
          alt=""
          className="block size-full"
          style={{ rotate: rotation ? `${rotation}deg` : undefined }}
        />
        {/* ShaderMount also sets position on its host. Keep the canvas over the poster. */}
        <span ref={host} className="inset-0 block" style={{ position: 'absolute' }} />
      </span>
    </span>
  )
}

// What a treatment's dials are. One spec drives the dial panel, the agent's input
// schema, the packet's description and the defaults, so they never disagree.

import { z } from 'zod'
import type { TokenKey, TokenSet } from '../types'
import { cssVarName, hexToRgb } from '../tokens'

/** The palette roles a treatment's colors point at, so they re-theme with the style guide. */
export const COLOR_ROLES = ['bg', 'surface', 'text', 'muted', 'border', 'primary', 'onPrimary', 'accent'] as const
export type ColorRole = (typeof COLOR_ROLES)[number]

/** A role ("primary") or your own color ("#ff5a1f"). */
export type ColorValue = ColorRole | string

export type ParamSpec =
  | { kind: 'slider'; label: string; min: number; max: number; step?: number; unit?: string; default: number }
  | { kind: 'color'; label: string; default: ColorValue }
  | { kind: 'stops'; label: string; min: number; max: number; default: ColorValue[] }
  | { kind: 'choice'; label: string; options: readonly { id: string; label: string }[]; default: string }
  | { kind: 'toggle'; label: string; default: boolean }

export type ParamSpecs = Record<string, ParamSpec>
export type ParamValue = number | string | boolean | string[]
export type ParamValues = Record<string, ParamValue>

/** A treatment as it's kept: which one, its dials (only what differs from the defaults), and its seed. */
export interface TreatmentValue {
  id: string
  params?: ParamValues
  seed?: number
  /** The preset it started from, if any. */
  preset?: string
}

export interface Preset {
  id: string
  label: string
  values: ParamValues
}

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i
const isRole = (v: unknown): v is ColorRole => typeof v === 'string' && (COLOR_ROLES as readonly string[]).includes(v)
const isColor = (v: unknown): v is ColorValue => isRole(v) || (typeof v === 'string' && HEX.test(v))

export function defaultsFor(specs: ParamSpecs): ParamValues {
  return Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, Array.isArray(s.default) ? [...s.default] : s.default]))
}

/** Every dial with a valid value: what's given where it fits, the default where it doesn't. */
export function clampParams(specs: ParamSpecs, values: ParamValues | undefined): ParamValues {
  const out: ParamValues = {}
  for (const [k, s] of Object.entries(specs)) {
    const v = values?.[k]
    switch (s.kind) {
      case 'slider': {
        const n = typeof v === 'number' && Number.isFinite(v) ? v : s.default
        out[k] = Math.min(s.max, Math.max(s.min, n))
        break
      }
      case 'color':
        out[k] = isColor(v) ? v : s.default
        break
      case 'stops': {
        const list = Array.isArray(v) ? v.filter(isColor) : []
        out[k] = list.length >= s.min ? list.slice(0, s.max) : [...s.default]
        break
      }
      case 'choice':
        out[k] = typeof v === 'string' && s.options.some((o) => o.id === v) ? v : s.default
        break
      case 'toggle':
        out[k] = typeof v === 'boolean' ? v : s.default
        break
    }
  }
  return out
}

/** Only the dials that differ from their defaults, which is what a mix keeps. */
export function changedParams(specs: ParamSpecs, values: ParamValues): ParamValues | undefined {
  const d = defaultsFor(specs)
  const out = Object.fromEntries(Object.entries(values).filter(([k, v]) => k in specs && JSON.stringify(v) !== JSON.stringify(d[k])))
  return Object.keys(out).length ? out : undefined
}

/** The agent's input for a treatment's dials: every dial optional. */
export function zodFor(specs: ParamSpecs) {
  const color = z.string().refine(isColor, 'A palette role (primary, accent…) or a hex color')
  const shape = Object.fromEntries(
    Object.entries(specs).map(([k, s]) => {
      const d = s.label
      switch (s.kind) {
        case 'slider':
          return [k, z.number().min(s.min).max(s.max).optional().describe(`${d}, ${s.min}–${s.max}${s.unit ?? ''}`)]
        case 'color':
          return [k, color.optional().describe(`${d}: ${COLOR_ROLES.join(', ')} or a hex color`)]
        case 'stops':
          return [k, z.array(color).min(s.min).max(s.max).optional().describe(`${d}: ${s.min}–${s.max} colors, roles or hex`)]
        case 'choice':
          return [k, z.enum(s.options.map((o) => o.id) as [string, ...string[]]).optional().describe(d)]
        case 'toggle':
          return [k, z.boolean().optional().describe(d)]
      }
    }),
  )
  return z.object(shape).strict()
}

/** Dials in words, for the packet: "Elevation 18px, tint text, layers 4". */
export function describeParams(specs: ParamSpecs, values: ParamValues | undefined): string {
  const v = clampParams(specs, values)
  return Object.entries(specs)
    .map(([k, s]) => {
      const x = v[k]
      if (s.kind === 'slider') return `${s.label.toLowerCase()} ${x}${s.unit ?? ''}`
      if (s.kind === 'choice') return `${s.label.toLowerCase()} ${s.options.find((o) => o.id === x)?.label.toLowerCase() ?? x}`
      if (s.kind === 'toggle') return x ? s.label.toLowerCase() : null
      if (s.kind === 'stops') return `${s.label.toLowerCase()} ${(x as string[]).join(' → ')}`
      return `${s.label.toLowerCase()} ${x}`
    })
    .filter(Boolean)
    .join(', ')
}

const roleKey = (r: ColorRole) => `color.${r}` as TokenKey

/** A color as CSS: a role is its token variable (it re-themes live), your own color is itself. */
export function cssColor(v: ColorValue): string {
  return isRole(v) ? `var(${cssVarName(roleKey(v))})` : v
}

/** A color as hex, for pictures drawn as SVG (which can't read CSS variables). */
export function hexColor(v: ColorValue, tokens: TokenSet): string {
  return isRole(v) ? tokens[roleKey(v)] : v
}

/** "primary" over transparent at a share, in CSS. */
export function tint(v: ColorValue, pct: number): string {
  const p = Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10
  return p >= 100 ? cssColor(v) : `color-mix(in oklab, ${cssColor(v)} ${p}%, transparent)`
}

/** A tiny seeded random, so a treatment looks the same every time until you shuffle it. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random dials within their ranges (colors stay on the palette), for Randomize. */
export function randomParams(specs: ParamSpecs, seed: number): ParamValues {
  const r = rng(seed * 7919 + 13)
  const roles: ColorRole[] = ['primary', 'accent', 'surface', 'text', 'muted']
  const out: ParamValues = {}
  for (const [k, s] of Object.entries(specs)) {
    if (s.kind === 'slider') {
      const step = s.step ?? 1
      out[k] = Math.round((s.min + r() * (s.max - s.min)) / step) * step
    } else if (s.kind === 'choice') out[k] = s.options[Math.floor(r() * s.options.length)].id
    else if (s.kind === 'toggle') out[k] = r() > 0.5
    else if (s.kind === 'color') out[k] = isRole(s.default) ? roles[Math.floor(r() * roles.length)] : s.default
    else {
      const n = s.min + Math.floor(r() * (Math.min(s.max, s.min + 2) - s.min + 1))
      out[k] = Array.from({ length: n }, () => roles[Math.floor(r() * roles.length)])
    }
  }
  return out
}

/** Round to a sensible number of decimals for CSS. */
export const n2 = (x: number) => Math.round(x * 100) / 100

/** Mix two hex colors (t = share of `a`). */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return a
  return `#${x.map((c, i) => Math.round(c * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`
}

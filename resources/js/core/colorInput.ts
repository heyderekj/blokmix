// Colors as people paste them: "#a83607", "a83607", "#abc", "rgb(168, 54, 7)", "rgb(168 54 7)". Always back as
// lowercase #rrggbb, or null when it isn't a color. Pure.

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')

export function parseColor(input: string): string | null {
  const t = input.trim().toLowerCase()
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(t)
  if (hex) {
    const h = hex[1]
    if (h.length === 3) return `#${h.split('').map((c) => c + c).join('')}`
    return `#${h.slice(0, 6)}`
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(t)
  if (rgb) return `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`
  return null
}

/** A few starting points, named the way people describe them. */
export const NAMED_COLORS: { name: string; hex: string }[] = [
  { name: 'Tomato', hex: '#e2482d' },
  { name: 'Clay', hex: '#b5562f' },
  { name: 'Marigold', hex: '#e8a317' },
  { name: 'Fern', hex: '#3f8a4c' },
  { name: 'Teal', hex: '#11807e' },
  { name: 'Ink blue', hex: '#2747a8' },
  { name: 'Iris', hex: '#6a4fd8' },
  { name: 'Plum', hex: '#8a2f6c' },
  { name: 'Rose', hex: '#e0507a' },
  { name: 'Charcoal', hex: '#2e2b2a' },
]

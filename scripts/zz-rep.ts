import { library } from '../resources/js/data/library'
import { parseHtml, attr, type HEl, type HNode } from '../resources/js/core/html/parse'
const els = (n: HNode[]) => n.filter((x): x is HEl => x.t === 'el')
const fieldsIn = (e: HEl): string[] => [...(attr(e, 'data-mx-field') ? [attr(e, 'data-mx-field')!] : []), ...els(e.kids).flatMap(fieldsIn)]
const out: string[] = []
const walk = (e: HEl, id: string) => {
  const kids = els(e.kids)
  if (attr(e, 'data-mx-block') !== 'list') {
    const groups = new Map<string, HEl[]>()
    for (const k of kids) {
      if (attr(k, 'data-mx-mirror') || attr(k, 'aria-hidden') === 'true') continue
      const key = k.tag + '.' + (attr(k, 'class') ?? '').split(/\s+/).filter((c) => !/^(col|start|t-col|m-col)-/.test(c)).sort().join('.')
      groups.set(key, [...(groups.get(key) ?? []), k])
    }
    for (const [key, g] of groups) {
      if (g.length < 2) continue
      const f = g.map(fieldsIn)
      if (f.every((x) => x.length) && f.every((x) => x.length === f[0].length)) out.push(`${id}  ${g.length}× ${key}  e.g. ${f[0].join(',')}`)
    }
  }
  kids.forEach((k) => walk(k, id))
}
for (const id of Object.keys(library.clips)) {
  const c = library.clips[id]; if (c.origin !== 'layout') continue
  els(parseHtml(c.html)).forEach((e) => walk(e, id))
}
console.log('FOUND', out.length); console.log(out.join('\n'))

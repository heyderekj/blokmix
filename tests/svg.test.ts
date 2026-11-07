import { describe, expect, it } from 'vitest'
import { cleanSvg, looksLikeSvg, svgDataUrl } from '@/core/svg'
import { dataUrlBytes } from '@/core/media'

const LOGO = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: a design tool -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><style><![CDATA[.a{fill:#123}]]></style><path class="a" d="M0 0h240v60H0z"/></svg>`

describe('SVG pictures and logos', () => {
  it('knows SVG code from other text', () => {
    expect(looksLikeSvg(LOGO)).toBe(true)
    expect(looksLikeSvg('  <svg width="10" height="10"></svg>')).toBe(true)
    expect(looksLikeSvg('<html><svg></svg></html>')).toBe(false)
    expect(looksLikeSvg('Fresh bread')).toBe(false)
  })

  it('keeps the drawing and its size, and gives it one when it has only a viewBox', () => {
    const c = cleanSvg(LOGO)!
    expect(c.width).toBe(240)
    expect(c.height).toBe(60)
    expect(c.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 240 60" width="240" height="60">/)
    expect(c.svg).toContain('.a{fill:#123}')
    expect(c.svg).not.toContain('<?xml')
    expect(cleanSvg('<svg width="32px" height="16"></svg>')).toMatchObject({ width: 32, height: 16 })
    expect(cleanSvg('<svg width="100%" viewBox="0 0 50 25"></svg>')!.svg).toContain('width="50"')
  })

  it('takes away anything that could run or reach out', () => {
    const bad = `<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><script href="x.js"/>
      <a href="javascript:alert(3)"><rect onclick='alert(4)' width="10" height="10"/></a>
      <a xlink:href="https://evil.example"><circle r="2" style="fill:url(https://x.example/a); stroke:url(#g)"/></a>
      <use href="#p"/><image href="data:image/png;base64,AAAA"/><image href="https://x.example/t.png"/>
      <style>@import url(https://x.example/a.css); .b{fill:red}</style>
      <foreignObject><iframe src="https://x.example"></iframe></foreignObject>
      <set attributeName="href" to="javascript:alert(5)"/><animate attributeName="onclick" values="alert(6)"/></svg>`
    const out = cleanSvg(bad)!.svg
    for (const gone of ['onload', 'onclick', '<script', 'alert', 'javascript', 'evil.example', 'x.example', 'foreignObject', 'iframe', '@import', '<set', '<animate'])
      expect(out, gone).not.toContain(gone)
    expect(out).toContain('href="#p"')
    expect(out).toContain('href="data:image/png;base64,AAAA"')
    expect(out).toContain('url(#g)')
    expect(out).toContain('.b{fill:red}')
  })

  it('refuses what isn’t an SVG, or is too big', () => {
    expect(cleanSvg('<div>hi</div>')).toBeNull()
    expect(cleanSvg(`<svg>${'x'.repeat(2 * 1024 * 1024)}</svg>`)).toBeNull()
  })

  it('exports as a .svg file', () => {
    const file = dataUrlBytes(svgDataUrl(cleanSvg(LOGO)!.svg))!
    expect(file.ext).toBe('svg')
    expect(new TextDecoder().decode(file.bytes)).toContain('viewBox="0 0 240 60"')
  })
})

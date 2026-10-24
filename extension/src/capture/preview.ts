// A standalone page that renders a captured clip the way a Blokmix frame does:
// the clip's tokens as --mx-* variables, the shared base CSS, then the clip.

import type { TokenSet } from '@/core/types'
import { BASE_TOKENS, expandTokens, fontHrefs, varsToCss } from '@/core/tokens'
import { BASE_CSS } from '@/core/export/base-css'
import type { CaptureResult } from './index'

export function previewDoc(res: Pick<CaptureResult, 'html' | 'css' | 'motionCss' | 'meta' | 'source'>, opts: { motion?: boolean; fonts?: boolean } = {}): string {
  const tokens = { ...BASE_TOKENS, ...res.source.tokens, ...res.meta.tokens } as TokenSet
  const vh = `${res.meta.capture.viewport.height / 100}px`
  const links = opts.fonts === false ? [] : fontHrefs(res.source.fonts).map((h) => `<link rel="stylesheet" href="${h.replace(/&/g, '&amp;')}">`)
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${links.join('\n')}
<style>${varsToCss(expandTokens(tokens, { vh }))}</style>
<style>${BASE_CSS}</style>
<style>${res.css}</style>
${opts.motion === false || !res.motionCss ? '' : `<style>${res.motionCss}</style>`}
</head><body>
${res.html}
</body></html>`
}

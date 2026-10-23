import { BASE_CSS } from '@/core/export/base-css'

/**
 * Runs inside every sandboxed clip iframe. Live changes (tokens, motion, copy,
 * fonts) arrive by postMessage so frames never reload or flash; height goes back
 * to the parent so frames size to their content.
 */
const BRIDGE = `(function () {
  var tokens = document.getElementById('mx-tokens');
  var motion = document.getElementById('mx-motion');
  var last = -1;
  function report() {
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    if (h !== last) { last = h; parent.postMessage({ ns: 'mx', height: h }, '*'); }
  }
  function sections() {
    var out = [];
    document.querySelectorAll('[data-mx-slot]').forEach(function (el) {
      out.push({ slot: el.getAttribute('data-mx-slot'), top: el.offsetTop, height: el.offsetHeight });
    });
    return out;
  }
  new ResizeObserver(function () { report(); parent.postMessage({ ns: 'mx', sections: sections() }, '*'); }).observe(document.body);
  if (document.fonts) document.fonts.ready.then(report);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.ns !== 'mx') return;
    if (typeof d.css === 'string') tokens.textContent = d.css;
    if (typeof d.motion === 'boolean' && motion) motion.media = d.motion ? 'all' : 'not all';
    if (d.fonts) d.fonts.forEach(function (href) {
      if (!href || document.querySelector('link[href="' + href + '"]')) return;
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
      l.onload = report;
    });
    if (d.fields !== undefined) document.querySelectorAll('[data-mx-field],[data-mx-mirror]').forEach(function (el) {
      if (!el.hasAttribute('data-mx-original')) el.setAttribute('data-mx-original', el.textContent);
      var k = el.getAttribute('data-mx-field') || el.getAttribute('data-mx-mirror');
      var v = d.fields && d.fields[k] != null ? d.fields[k] : el.getAttribute('data-mx-original');
      if (el.textContent !== v) el.textContent = v;
    });
    if (typeof d.outline === 'boolean') document.documentElement.toggleAttribute('data-mx-outline', d.outline);
    if (d.replay) document.getAnimations().forEach(function (a) { try { a.cancel(); a.play(); } catch (_) {} });
    requestAnimationFrame(report);
  });
  parent.postMessage({ ns: 'mx', ready: true }, '*');
  report();
})();`

const FRAME_CSS = `html, body { overflow: hidden; }
html[data-mx-outline] body > * { outline: 2px dashed color-mix(in srgb, currentColor 35%, transparent); outline-offset: -6px; }
`

export interface SrcdocInput {
  html: string
  css: string
  motionCss?: string | null
  tokensCss: string
  fontHrefs: (string | null)[]
  motion?: boolean
  outline?: boolean
}

export function buildSrcdoc(i: SrcdocInput): string {
  const links = i.fontHrefs
    .filter(Boolean)
    .map((h) => `<link rel="stylesheet" href="${h}">`)
    .join('\n')
  return `<!doctype html>
<html${i.outline ? ' data-mx-outline' : ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${links}
<style id="mx-tokens">${i.tokensCss}</style>
<style id="mx-base">${BASE_CSS}${FRAME_CSS}</style>
<style id="mx-clip">${i.css}</style>
<style id="mx-motion"${i.motion === false ? ' media="not all"' : ''}>${i.motionCss ?? ''}</style>
</head><body>
${i.html}
<script>${BRIDGE}</script>
</body></html>`
}

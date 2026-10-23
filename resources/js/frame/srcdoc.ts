import { BASE_CSS, LAYER_ORDER } from '@/core/export/base-css'

/**
 * Runs inside every sandboxed clip iframe. Live changes (tokens, motion, copy,
 * fonts) arrive by postMessage so frames never reload or flash; height goes back
 * to the parent so frames size to their content.
 */
const BRIDGE = `(function () {
  var tokens = document.getElementById('mx-tokens');
  var motion = document.getElementById('mx-motion');
  var blockStyle = document.getElementById('mx-blocks');
  var post = function (m) { m.ns = 'mx'; parent.postMessage(m, '*'); };
  var last = -1;
  function report() {
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    if (h !== last) { last = h; post({ height: h }); }
  }
  function sections() {
    var out = [];
    document.querySelectorAll('[data-mx-slot]').forEach(function (el) {
      out.push({ slot: el.getAttribute('data-mx-slot'), top: el.offsetTop, height: el.offsetHeight });
    });
    return out;
  }

  // ---- blocks: ids in document order, matching core/blocks.ts indexBlocks ----
  document.querySelectorAll('[data-mx-block]').forEach(function (el, i) { el.setAttribute('data-mx-b', 'b' + i); });
  var byId = function (id) { return id ? document.querySelector('[data-mx-b="' + id + '"]') : null; };
  var up = function (el) { return el && el.parentElement ? el.parentElement.closest('[data-mx-block]') : null; };
  var rect = function (el) { if (!el) return null; var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  var editMode = false, sel = null, hoverId = null, editing = null;

  /* Figma-style depth: click selects the outermost block, then one level deeper each click. */
  function target(node) {
    var start = node && node.closest ? node.closest('[data-mx-block]') : null;
    if (!start) return null;
    var chain = [];
    for (var n = start; n; n = up(n)) chain.unshift(n);
    var s = byId(sel);
    for (var ctx = s; ctx; ctx = up(ctx)) {
      var k = chain.indexOf(ctx);
      if (k >= 0) return chain[Math.min(k + 1, chain.length - 1)];
    }
    return chain[0];
  }
  function fieldEl(el) {
    if (!el) return null;
    if (el.hasAttribute('data-mx-field')) return el;
    var all = el.querySelectorAll('[data-mx-field]');
    for (var i = 0; i < all.length; i++) if (all[i].closest('[data-mx-block]') === el) return all[i];
    return null;
  }
  function reportSel() { post({ selRect: rect(byId(sel)) }); }

  document.addEventListener('pointermove', function (e) {
    if (!editMode || editing) return;
    var t = target(e.target);
    var id = t ? t.getAttribute('data-mx-b') : null;
    if (id !== hoverId) { hoverId = id; post({ hover: id ? { id: id, rect: rect(t) } : null }); }
  });
  document.addEventListener('pointerleave', function () { if (hoverId) { hoverId = null; post({ hover: null }); } });
  document.addEventListener('click', function (e) {
    if (!editMode) return;
    if (editing && editing.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var t = target(e.target);
    post({ pick: t ? t.getAttribute('data-mx-b') : null });
  }, true);
  document.addEventListener('dblclick', function (e) {
    if (!editMode) return;
    e.preventDefault();
    var t = byId(sel) || target(e.target);
    var f = fieldEl(t);
    if (f) startEdit(f);
  }, true);
  function startEdit(f) {
    if (editing) return;
    editing = f;
    var before = f.textContent;
    f.setAttribute('contenteditable', 'plaintext-only');
    f.setAttribute('data-mx-editing', '');
    f.focus();
    var r = document.createRange(); r.selectNodeContents(f);
    var ws = getSelection(); ws.removeAllRanges(); ws.addRange(r);
    var done = function (keep) {
      if (editing !== f) return;
      editing = null;
      f.removeAttribute('contenteditable'); f.removeAttribute('data-mx-editing');
      f.removeEventListener('keydown', onKey); f.removeEventListener('blur', onBlur);
      var ws2 = getSelection(); if (ws2) ws2.removeAllRanges();
      var text = f.textContent.replace(/\\s+/g, ' ').trim();
      if (!keep || !text) { f.textContent = before; post({ editing: false }); return; }
      post({ word: { field: f.getAttribute('data-mx-field'), value: text }, editing: false });
    };
    var onKey = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); done(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
    };
    var onBlur = function () { done(true); };
    f.addEventListener('keydown', onKey); f.addEventListener('blur', onBlur);
    post({ editing: true });
    requestAnimationFrame(report);
  }
  /* Keys pressed while the frame has focus still drive the canvas. */
  document.addEventListener('keydown', function (e) {
    if (editing) return;
    if (editMode && e.key === 'Enter' && sel) { var f = fieldEl(byId(sel)); if (f) { e.preventDefault(); startEdit(f); return; } }
    post({ key: { key: e.key, code: e.code, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey } });
    if (e.key === ' ' || e.key === 'Tab' || e.key.indexOf('Arrow') === 0) e.preventDefault();
  });

  new ResizeObserver(function () { report(); post({ sections: sections() }); if (sel) reportSel(); }).observe(document.body);
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
      if (el === editing) return;
      if (!el.hasAttribute('data-mx-original')) el.setAttribute('data-mx-original', el.textContent);
      var k = el.getAttribute('data-mx-field') || el.getAttribute('data-mx-mirror');
      var v = d.fields && d.fields[k] != null ? d.fields[k] : el.getAttribute('data-mx-original');
      if (el.textContent !== v) el.textContent = v;
    });
    if (typeof d.outline === 'boolean') document.documentElement.toggleAttribute('data-mx-outline', d.outline);
    if (d.blocks) {
      blockStyle.textContent = d.blocks.css;
      document.querySelectorAll('[data-mx-b]').forEach(function (el) {
        var v = d.blocks.variants[el.getAttribute('data-mx-b')];
        if (v) el.setAttribute('data-mx-v', v); else el.removeAttribute('data-mx-v');
      });
    }
    if (typeof d.edit === 'boolean') {
      editMode = d.edit;
      document.documentElement.toggleAttribute('data-mx-edit', d.edit);
      if (!d.edit && hoverId) { hoverId = null; post({ hover: null }); }
    }
    if (d.select !== undefined) { sel = d.select; reportSel(); }
    if (d.editText) { var f = fieldEl(byId(d.editText)); if (f) startEdit(f); }
    if (d.replay) document.getAnimations().forEach(function (a) { try { a.cancel(); a.play(); } catch (_) {} });
    requestAnimationFrame(function () { report(); if (sel) reportSel(); });
  });
  post({ ready: true });
  report();
})();`

const FRAME_CSS = `html, body { overflow: hidden; }
html[data-mx-outline] body > * { outline: 2px dashed color-mix(in srgb, currentColor 35%, transparent); outline-offset: -6px; }
html[data-mx-edit] [data-mx-block] { cursor: default; }
html[data-mx-edit] [data-mx-field] { cursor: text; }
[data-mx-editing] { outline: none; cursor: text; caret-color: currentColor; }
`


export interface SrcdocInput {
  html: string
  css: string
  motionCss?: string | null
  tokensCss: string
  fontHrefs: (string | null)[]
  motion?: boolean
  outline?: boolean
  blocksCss?: string
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
<style>${LAYER_ORDER}</style>
<style id="mx-tokens">${i.tokensCss}</style>
<style id="mx-base">@layer base {\n${BASE_CSS}}\n${FRAME_CSS}</style>
<style id="mx-clip">@layer clip {\n${i.css}\n}</style>
<style id="mx-motion"${i.motion === false ? ' media="not all"' : ''}>@layer motion {\n${i.motionCss ?? ''}\n}</style>
<style id="mx-blocks">${i.blocksCss ?? ''}</style>
</head><body>
${i.html}
<script>${BRIDGE}</script>
</body></html>`
}

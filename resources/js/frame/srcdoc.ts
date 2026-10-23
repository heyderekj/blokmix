import { BASE_CSS, LAYER_ORDER } from '@/core/export/base-css'
import { MEDIA_CSS, MEDIA_JS } from '@/core/export/media-runtime'

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
  document.querySelectorAll('[data-mx-block]').forEach(function (el, i) { if (!el.hasAttribute('data-mx-b')) el.setAttribute('data-mx-b', 'b' + i); });
  var byId = function (id) { return id ? document.querySelector('[data-mx-b="' + id + '"]') : null; };
  var up = function (el) { return el && el.parentElement ? el.parentElement.closest('[data-mx-block]') : null; };
  var rect = function (el) { if (!el) return null; var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  var editMode = false, noteMode = false, sel = null, hoverId = null, editing = null, tracked = [], drag = null;
  function reportTracked() {
    if (!tracked.length) return;
    var out = {};
    tracked.forEach(function (id) { var el = byId(id); if (el) out[id] = rect(el); });
    post({ rects: out });
  }

  /* Figma-style depth: click selects the outermost block, then one level deeper each click. */
  function target(node) {
    var start = node && node.closest ? node.closest('[data-mx-block]') : null;
    if (!start) return null;
    if (noteMode) return start; /* feedback snaps to the smallest block under the pointer */
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
    if (!editMode || editing || drag) return;
    var t = target(e.target);
    var id = t ? t.getAttribute('data-mx-b') : null;
    if (id !== hoverId) { hoverId = id; post({ hover: id ? { id: id, rect: rect(t) } : null }); }
  });
  document.addEventListener('pointerleave', function () { if (hoverId) { hoverId = null; post({ hover: null }); } });
  /* Note mode: click marks a block, drag marks an area. */
  document.addEventListener('pointerdown', function (e) {
    if (!editMode || !noteMode || e.button !== 0) return;
    /* Starting on words lets the browser select them (Koati-style "select text to change it"). */
    var field = e.target.closest ? e.target.closest('[data-mx-field]') : null;
    if (!field) e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, moved: false, field: field };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var w = e.clientX - drag.x, h = e.clientY - drag.y;
    if (drag.field) return; /* selecting text, not drawing */
    if (!drag.moved && Math.abs(w) + Math.abs(h) < 6) return;
    /* Dragging lets go of the snapped block and draws a free area instead. */
    if (!drag.moved && hoverId) { hoverId = null; post({ hover: null }); }
    drag.moved = true;
    post({ drag: { x: Math.min(drag.x, e.clientX), y: Math.min(drag.y, e.clientY), w: Math.abs(w), h: Math.abs(h) } });
  }, true);
  document.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var d = drag; drag = null;
    var px = e.clientX, py = e.clientY, tgt = e.target;
    /* The selection settles just after the pointer lifts, so look a tick later. */
    setTimeout(function () {
      if (d.field) {
        var ws = getSelection();
        var quote = ws ? ws.toString().replace(/\s+/g, ' ').trim() : '';
        if (quote && ws.rangeCount && d.field.contains(ws.getRangeAt(0).commonAncestorContainer)) {
          var r = ws.getRangeAt(0).getBoundingClientRect();
          var b = d.field.closest('[data-mx-block]');
          post({ words: { block: b ? b.getAttribute('data-mx-b') : null, field: d.field.getAttribute('data-mx-field'), quote: quote, rect: { x: r.left, y: r.top, w: r.width, h: r.height } } });
          return;
        }
        if (ws) ws.removeAllRanges();
      }
      if (d.moved) {
        post({ drag: null, area: { x: Math.min(d.x, px), y: Math.min(d.y, py), w: Math.abs(px - d.x), h: Math.abs(py - d.y) } });
      } else {
        var t = target(tgt);
        post({ notePick: t ? t.getAttribute('data-mx-b') : null, rect: t ? rect(t) : null, at: { x: px, y: py } });
      }
    }, 0);
  }, true);
  document.addEventListener('click', function (e) {
    if (!editMode) return;
    if (noteMode) { e.preventDefault(); e.stopPropagation(); return; }
    if (editing && editing.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    /* Pressing the words of the block already selected puts the caret right there. */
    var s = byId(sel), w = s && e.target.closest ? e.target.closest('[data-mx-field]') : null;
    if (w && s && (w === s || s.contains(w)) && fieldEl(w.closest('[data-mx-block]')) === w) { startEdit(w, caretAt(e.clientX, e.clientY)); return; }
    var t = target(e.target);
    post({ pick: t ? t.getAttribute('data-mx-b') : null });
  }, true);
  document.addEventListener('dblclick', function (e) {
    if (!editMode || noteMode) return;
    if (editing && editing.contains(e.target)) return; /* the page's own word selection */
    e.preventDefault();
    var w = e.target.closest ? e.target.closest('[data-mx-field]') : null;
    var f = w && fieldEl(w.closest('[data-mx-block]')) === w ? w : fieldEl(byId(sel) || target(e.target));
    if (f) { post({ pick: f.closest('[data-mx-block]').getAttribute('data-mx-b') }); startEdit(f, caretAt(e.clientX, e.clientY)); }
  }, true);
  /* The caret where a press landed (Koati's caretAt). */
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) { var p = document.caretPositionFromPoint(x, y); if (!p) return null; var r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); return r; }
    return document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
  }
  /* Edit words in place: with the caret where you pressed, or (from ↵ or the bar) all of them selected. */
  function startEdit(f, caret) {
    if (editing) return;
    editing = f;
    var before = f.textContent;
    f.setAttribute('contenteditable', 'plaintext-only');
    f.setAttribute('data-mx-editing', '');
    f.focus();
    var r = caret && f.contains(caret.startContainer) ? caret : null;
    if (!r) { r = document.createRange(); r.selectNodeContents(f); }
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
    if (e.key === ' ' || e.key === 'Tab' || e.key.indexOf('Arrow') === 0 || ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D'))) e.preventDefault();
  });

  /* ---- pictures and moving media in image blocks (same elements the exports write) ---- */
  var blobUrls = {}, lastMedia = null;
  function mk(tag, attrs) { var e = document.createElement(tag); Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); }); return e; }
  function drawMedia(media) {
    document.querySelectorAll('[data-mx-block="image"]').forEach(function (el) {
      var m = media[el.getAttribute('data-mx-b')];
      var key = m ? JSON.stringify(m) + (m.asset && blobUrls[m.asset] ? '+' : '') : '';
      if (el.__mxKey === key) return;
      el.__mxKey = key;
      el.querySelectorAll(':scope > .mx-media, :scope > .mx-play').forEach(function (x) { x.remove(); });
      if (!m) { el.removeAttribute('data-mx-has-media'); el.removeAttribute('data-lightbox'); el.removeAttribute('data-wired'); return; }
      if (getComputedStyle(el).position === 'static') el.setAttribute('data-mx-rel', '');
      el.setAttribute('data-mx-has-media', m.fit);
      el.toggleAttribute('data-lightbox', !!m.lightbox);
      el.removeAttribute('data-wired');
      var src = m.asset ? blobUrls[m.asset] : m.src;
      var label = m.alt || null;
      if (m.kind === 'video') {
        if (!src) { if (m.poster) el.appendChild(mk('img', { class: 'mx-media', src: m.poster, alt: '' })); return; }
        var v = mk('video', { class: 'mx-media', src: src, poster: m.poster, playsinline: '', muted: '', preload: 'metadata', 'data-play': m.play || 'inview', 'aria-label': label, 'data-asset': m.asset || null });
        v.muted = true; if (m.loop) v.loop = true;
        v.addEventListener('loadeddata', report);
        el.appendChild(v);
      } else if (m.kind === 'lottie') {
        if (!src) return;
        el.appendChild(mk('canvas', { class: 'mx-media', 'data-lottie': src, 'data-play': m.play || 'inview', 'data-loop': String(m.loop !== false), role: 'img', 'aria-label': label, 'data-asset': m.asset || null }));
      } else if (m.kind === 'embed') {
        if (m.poster) el.appendChild(mk('img', { class: 'mx-media', src: m.poster, alt: m.alt || '' }));
        el.appendChild(mk('button', { type: 'button', class: 'mx-play', 'data-embed': m.player, 'aria-label': label ? 'Play video: ' + label : 'Play video' }));
      } else {
        var img = mk('img', { class: 'mx-media', src: src, alt: m.alt || '' });
        img.onload = report;
        el.appendChild(img);
      }
      if (window.mxMedia) window.mxMedia.wire(el);
    });
  }
  /* ---- named icons, redrawn in the style guide's set ---- */
  var iconOrig = null;
  var KEEP_OUT = /^(viewbox|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|xmlns)$/i;
  function drawIcons(ic) {
    if (!iconOrig) iconOrig = [];
    /* New icons arrive with list items you add, so look for unseen ones every time. */
    document.querySelectorAll('svg:not([data-mx-i])').forEach(function (svg) {
      var b = svg.closest('[data-mx-block]');
      var iconBlock = b && b.getAttribute('data-mx-block') === 'icon' && b.querySelector('svg') === svg ? b.getAttribute('data-mx-b') : null;
      if (!svg.hasAttribute('data-mx-icon') && !iconBlock) return;
      svg.setAttribute('data-mx-i', String(iconOrig.length));
      iconOrig.push({ html: svg.outerHTML, block: iconBlock, name: svg.getAttribute('data-mx-icon'), animated: !!svg.querySelector('[class]') });
    });
    iconOrig.forEach(function (o, i) {
      var cur = document.querySelector('[data-mx-i="' + i + '"]');
      if (!cur) return;
      var ov = ic && o.block ? ic.overrides[o.block] : null;
      var name = ov || o.name;
      var html = o.html;
      if (ic && name && ic.glyphs[name] && !(o.animated && !ov)) {
        var t = document.createElement('template'); t.innerHTML = ic.glyphs[name];
        var next = t.content.firstElementChild;
        var orig = document.createElement('template'); orig.innerHTML = o.html;
        Array.prototype.forEach.call(orig.content.firstElementChild.attributes, function (a) { if (!KEEP_OUT.test(a.name)) next.setAttribute(a.name, a.value); });
        next.setAttribute('data-mx-icon', name);
        html = next.outerHTML;
      }
      if (cur.outerHTML !== html) cur.outerHTML = html;
    });
  }

  /* ---- lists you changed: swap the list (or a marquee's mirrored copy) in place ---- */
  var listOrig = {}, listPatched = [], listKey = '[]';
  function patchLists(patches) {
    var key = JSON.stringify(patches);
    if (key === listKey) return;
    listKey = key;
    var had = {};
    document.querySelectorAll('[data-mx-b]').forEach(function (el) { had[el.getAttribute('data-mx-b')] = true; });
    /* Things the section added (a banner) come out, then go back in where they're still wanted. */
    document.querySelectorAll('[data-mx-extra]').forEach(function (x) { x.remove(); });
    listPatched.forEach(function (sel) { var cur = document.querySelector(sel); if (cur && listOrig[sel]) cur.replaceWith(listOrig[sel].cloneNode(true)); });
    listPatched = [];
    patches.forEach(function (p) {
      var cur = document.querySelector(p.sel);
      if (!cur) return;
      var t = document.createElement('template'); t.innerHTML = p.html;
      var next = t.content.firstElementChild;
      if (!next) return;
      if (p.before) cur.before(next);
      else {
        if (!listOrig[p.sel]) listOrig[p.sel] = cur.cloneNode(true);
        cur.replaceWith(next);
        listPatched.push(p.sel);
      }
      /* Items that were already on the page don't play their entrance again; new ones do. */
      next.getAnimations({ subtree: true }).forEach(function (a) {
        var tg = a.effect && a.effect.target, item = tg && tg.closest && tg.closest('[data-mx-b]');
        if (!item || had[item.getAttribute('data-mx-b')]) { try { a.finish(); } catch (_) {} }
      });
    });
    if (window.mxMedia) window.mxMedia.wire(document);
  }

  /* The lightbox opens over the whole app, not inside this section's frame. */
  window.__mxLightbox = function (p) {
    var clean = { kind: p.kind, src: p.src, poster: p.poster, alt: p.alt, player: p.player };
    post({ lightbox: clean, asset: (p.asset || null) });
  };

  new ResizeObserver(function () { report(); post({ sections: sections() }); if (sel) reportSel(); reportTracked(); }).observe(document.body);
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
    if (d.lists) patchLists(d.lists);
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
    if (d.blobs) Object.keys(d.blobs).forEach(function (id) { if (!blobUrls[id]) blobUrls[id] = URL.createObjectURL(d.blobs[id]); });
    if (d.media) lastMedia = d.media;
    if (d.media || d.blobs) drawMedia(lastMedia || {});
    if (d.icons !== undefined) drawIcons(d.icons);
    if (typeof d.edit === 'boolean') {
      editMode = d.edit;
      document.documentElement.toggleAttribute('data-mx-edit', d.edit);
      if (!d.edit && hoverId) { hoverId = null; post({ hover: null }); }
    }
    if (d.select !== undefined) {
      sel = d.select;
      document.querySelectorAll('[data-mx-sel]').forEach(function (x) { x.removeAttribute('data-mx-sel'); });
      var se = byId(sel); if (se) se.setAttribute('data-mx-sel', '');
      reportSel();
    }
    if (d.clearSelection) { var cs = getSelection(); if (cs) cs.removeAllRanges(); }
    if (typeof d.noteMode === 'boolean') { noteMode = d.noteMode; document.documentElement.toggleAttribute('data-mx-note', d.noteMode); }
    if (d.track) { tracked = d.track; reportTracked(); }
    if (d.editText) { var f = fieldEl(byId(d.editText)); if (f) startEdit(f); }
    if (d.replay) document.getAnimations().forEach(function (a) { try { a.cancel(); a.play(); } catch (_) {} });
    requestAnimationFrame(function () { report(); if (sel) reportSel(); reportTracked(); });
  });
  post({ ready: true });
  report();
})();`

const FRAME_CSS = `html, body { overflow: hidden; }
html[data-mx-outline] body > * { outline: 2px dashed color-mix(in srgb, currentColor 35%, transparent); outline-offset: -6px; }
html[data-mx-edit], html[data-mx-edit] * { cursor: crosshair; }
html[data-mx-edit] [data-mx-sel] [data-mx-field], html[data-mx-edit] [data-mx-sel][data-mx-field] { cursor: text; }
html[data-mx-note], html[data-mx-note] * { cursor: crosshair !important; user-select: none; }
html[data-mx-note] [data-mx-field], html[data-mx-note] [data-mx-field] * { cursor: text !important; user-select: text; }
html[data-mx-note] ::selection { background: color-mix(in srgb, #ff6aa8 35%, transparent); }
html[data-mx-edit] [data-mx-editing], html[data-mx-edit] [data-mx-editing] * { outline: none; cursor: text; caret-color: currentColor; }
html[data-mx-edit] [data-mx-editing]::selection { background: color-mix(in srgb, #ff6aa8 32%, transparent); }
[data-mx-rel] { position: relative; }
[data-mx-has-media] { overflow: hidden; }
[data-mx-has-media] > :not(.mx-media, .mx-play) { visibility: hidden; }
img.mx-media { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; object-fit: cover; display: block; border-radius: inherit; }
[data-mx-has-media='contain'] > img.mx-media { object-fit: contain; }
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
<style id="mx-media-css">${MEDIA_CSS}</style>
</head><body>
${i.html}
<script>${BRIDGE}</script>
<script>${MEDIA_JS}</script>
</body></html>`
}

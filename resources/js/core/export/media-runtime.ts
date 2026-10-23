// The small player that makes moving media behave: triggers (autoplay, hover,
// in view, click, scroll-scrub for Lotties), lazy embeds, and a lightbox. The
// same code runs inside canvas frames and ships with exported sites as
// /mx-media.js, so what you see on the canvas is what the build does.
//
// Reduced motion: nothing plays by itself; posters and first frames show, and
// clicking (or the lightbox) still plays on request.

export const DOTLOTTIE_URL = 'https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.81.0/+esm'

export const MEDIA_JS = `(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lottieLib = null;
  function lottie() { return lottieLib || (lottieLib = import('${DOTLOTTIE_URL}').then(function (m) { return m.DotLottie; })); }
  function inView(el, cb) {
    if (!('IntersectionObserver' in window)) return cb(true);
    new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.isIntersecting); }); }, { threshold: 0.25 }).observe(el);
  }
  function host(el) { return el.closest('[data-lightbox]') || el.parentElement; }
  function play(p) { try { var r = p.play(); if (r && r.catch) r.catch(function () {}); } catch (_) {} }

  function wireVideo(v) {
    var p = v.dataset.play;
    if (p !== 'click') v.muted = true;
    if (reduce && p !== 'click') { v.removeAttribute('autoplay'); v.pause(); return; }
    if (p === 'autoplay') play(v);
    else if (p === 'hover') { host(v).addEventListener('pointerenter', function () { play(v); }); host(v).addEventListener('pointerleave', function () { v.pause(); }); }
    else if (p === 'inview') inView(v, function (on) { on ? play(v) : v.pause(); });
    else if (p === 'click' && !v.closest('[data-lightbox]')) v.controls = true;
  }

  function wireLottie(c) {
    var p = c.dataset.play, loop = c.dataset.loop !== 'false';
    lottie().then(function (DotLottie) {
      var src = c.dataset.lottie, opts = { canvas: c, loop: loop, autoplay: !reduce && p === 'autoplay' };
      if (c.__mxData) opts.data = c.__mxData; else opts.src = src;
      var d = new DotLottie(opts);
      c.__mxLottie = d;
      if (reduce) return;
      if (p === 'hover') { host(c).addEventListener('pointerenter', function () { d.play(); }); host(c).addEventListener('pointerleave', function () { d.pause(); }); }
      else if (p === 'inview') inView(c, function (on) { on ? d.play() : d.pause(); });
      else if (p === 'click' && !c.closest('[data-lightbox]')) c.addEventListener('click', function () { d.isPlaying ? d.pause() : d.play(); });
      else if (p === 'scrub') d.addEventListener('load', function () {
        var update = function () {
          var r = c.getBoundingClientRect(), vh = window.innerHeight || 1;
          var t = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
          d.setFrame(Math.round(t * Math.max(0, d.totalFrames - 1)));
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
      });
    }).catch(function () {});
  }

  /* Lightbox: one dialog, filled with a larger copy of whatever was clicked. */
  var dialog = null;
  function lightbox(payload) {
    if (window.__mxLightbox) return window.__mxLightbox(payload);
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'mx-lightbox';
      dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
      dialog.addEventListener('close', function () { dialog.innerHTML = ''; });
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = '<button class="mx-lightbox-close" aria-label="Close">\\u00d7</button>';
    dialog.firstChild.addEventListener('click', function () { dialog.close(); });
    var el;
    if (payload.kind === 'embed') { el = document.createElement('iframe'); el.src = payload.player; el.allow = 'autoplay; fullscreen; picture-in-picture'; el.allowFullscreen = true; el.title = payload.alt || 'Video'; }
    else if (payload.kind === 'video') { el = document.createElement('video'); el.src = payload.src; el.controls = true; el.playsInline = true; el.autoplay = true; if (payload.poster) el.poster = payload.poster; }
    else if (payload.kind === 'lottie') { el = document.createElement('canvas'); el.dataset.lottie = payload.src; el.dataset.play = 'autoplay'; if (payload.data) el.__mxData = payload.data; setTimeout(function () { wireLottie(el); }); }
    else { el = document.createElement('img'); el.src = payload.src; el.alt = payload.alt || ''; }
    el.className = 'mx-lightbox-media';
    dialog.appendChild(el);
    dialog.showModal();
  }

  function payloadOf(block) {
    var m = block.querySelector('.mx-media');
    if (!m) return null;
    var embed = block.querySelector('[data-embed]');
    if (embed) return { kind: 'embed', player: embed.dataset.embed, alt: embed.getAttribute('aria-label') };
    if (m.tagName === 'VIDEO') return { kind: 'video', src: m.currentSrc || m.src, poster: m.poster, asset: m.dataset.asset };
    if (m.tagName === 'CANVAS') return { kind: 'lottie', src: m.dataset.lottie, data: m.__mxData, asset: m.dataset.asset };
    return { kind: 'image', src: m.currentSrc || m.src, alt: m.alt };
  }

  function wire(root) {
    root.querySelectorAll('video.mx-media[data-play]:not([data-wired])').forEach(function (v) { v.setAttribute('data-wired', ''); wireVideo(v); });
    root.querySelectorAll('canvas.mx-media[data-lottie]:not([data-wired])').forEach(function (c) { c.setAttribute('data-wired', ''); wireLottie(c); });
    root.querySelectorAll('[data-embed]:not([data-wired])').forEach(function (b) {
      b.setAttribute('data-wired', '');
      if (b.closest('[data-lightbox]')) return;
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var f = document.createElement('iframe');
        f.src = b.dataset.embed; f.allow = 'autoplay; fullscreen; picture-in-picture'; f.allowFullscreen = true; f.className = 'mx-media'; f.title = b.getAttribute('aria-label') || 'Video';
        b.parentElement.appendChild(f); b.remove();
      });
    });
    root.querySelectorAll('[data-lightbox]:not([data-wired])').forEach(function (block) {
      block.setAttribute('data-wired', '');
      block.addEventListener('click', function (e) { var p = payloadOf(block); if (p) { e.preventDefault(); lightbox(p); } });
    });
  }

  window.mxMedia = { wire: wire, lightbox: lightbox };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { wire(document); });
  else wire(document);
})();`

/** Styles for the play button and the lightbox, written in the page's tokens. */
export const MEDIA_CSS = `[data-lightbox] { cursor: zoom-in; }
[data-lightbox]:has(video, [data-embed]) { cursor: pointer; }
.mx-play {
  position: absolute; inset: 0; margin: auto; z-index: 1;
  display: grid; place-items: center; width: 64px; height: 64px; border: 0; border-radius: 999px;
  background: color-mix(in oklab, var(--mx-color-bg) 88%, transparent); color: var(--mx-color-text);
  box-shadow: var(--mx-shadow-card); cursor: pointer;
  transition: scale 160ms cubic-bezier(0.23, 1, 0.32, 1);
}
.mx-play::before { content: ""; margin-left: 4px; border-style: solid; border-width: 11px 0 11px 18px; border-color: transparent transparent transparent currentColor; }
@media (hover: hover) and (pointer: fine) { .mx-play:hover { scale: 1.06; } }
.mx-play:active { scale: 0.97; }
dialog.mx-lightbox {
  width: min(92vw, 1200px); max-height: 90vh; padding: 0; border: 0; border-radius: var(--mx-radius-lg);
  background: var(--mx-color-text); overflow: hidden;
}
dialog.mx-lightbox::backdrop { background: color-mix(in oklab, var(--mx-color-text) 72%, transparent); backdrop-filter: blur(6px); }
.mx-lightbox-media { display: block; width: 100%; max-height: 90vh; aspect-ratio: 16 / 9; object-fit: contain; border: 0; background: #000; }
.mx-lightbox-close {
  position: absolute; top: 10px; right: 10px; z-index: 1; width: 36px; height: 36px; border: 0; border-radius: 999px;
  background: color-mix(in oklab, var(--mx-color-bg) 85%, transparent); color: var(--mx-color-text); font-size: 22px; line-height: 1; cursor: pointer;
}
@media (prefers-reduced-motion: no-preference) {
  dialog.mx-lightbox[open] { animation: mx-lightbox-in 220ms cubic-bezier(0.23, 1, 0.32, 1); }
  @keyframes mx-lightbox-in { from { opacity: 0; scale: 0.96; } }
}
`

// The small script behind sliders: arrows, dots and a count over a track that scrolls natively, so any number of slides
// works, and swiping works without it. The same code runs in canvas frames and ships with exports as /mx-slider.js.
//
// Markup: [data-slider] holds [data-slider-track] (its children are the slides), [data-slider-prev], [data-slider-next],
// [data-slider-dots] and [data-slider-count]. Controls show once [data-slider-ready] is set, and hide when everything fits.

export const SLIDER_JS = `(function () {
  if (window.__mxSlider) return;
  window.__mxSlider = true;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function parts(root) {
    var track = root.querySelector('[data-slider-track]');
    return track && { track: track, slides: Array.prototype.slice.call(track.children) };
  }
  function measure(p) {
    var n = p.slides.length;
    var step = n > 1 ? p.slides[1].offsetLeft - p.slides[0].offsetLeft : p.track.clientWidth;
    if (!(step > 0)) return null;
    var show = Math.max(1, Math.round((p.track.clientWidth + (step - (p.slides[0] ? p.slides[0].offsetWidth : 0))) / step));
    var pages = Math.max(1, n - show + 1);
    return { step: step, pages: pages, at: Math.min(pages - 1, Math.round(p.track.scrollLeft / step)) };
  }
  function go(root, i) {
    var p = parts(root); var m = p && measure(p);
    if (!m) return;
    p.track.scrollTo({ left: Math.max(0, Math.min(m.pages - 1, i)) * m.step, behavior: reduce ? 'auto' : 'smooth' });
  }
  function sync(root) {
    var p = parts(root); var m = p && measure(p);
    if (!m) return;
    root.setAttribute('data-slider-ready', '');
    root.toggleAttribute('data-slider-fits', m.pages < 2);
    var dots = root.querySelector('[data-slider-dots]');
    if (dots) {
      if (dots.children.length !== m.pages) {
        dots.textContent = '';
        for (var i = 0; i < m.pages; i++) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'dot'; b.setAttribute('data-slider-dot', String(i)); b.setAttribute('aria-label', 'Show slide ' + (i + 1));
          var pip = document.createElement('span'); pip.className = 'pip'; b.appendChild(pip);
          dots.appendChild(b);
        }
      }
      for (var k = 0; k < dots.children.length; k++) {
        if (k === m.at) dots.children[k].setAttribute('aria-current', 'true'); else dots.children[k].removeAttribute('aria-current');
      }
    }
    var count = root.querySelector('[data-slider-count]');
    if (count) {
      var words = String(m.at + 1).padStart(2, '0') + ' / ' + String(m.pages).padStart(2, '0');
      if (count.textContent !== words) count.textContent = words;
    }
    var prev = root.querySelector('[data-slider-prev]'); if (prev) prev.disabled = m.at === 0;
    var next = root.querySelector('[data-slider-next]'); if (next) next.disabled = m.at >= m.pages - 1;
  }
  function syncAll() { document.querySelectorAll('[data-slider]').forEach(sync); }
  var queued = 0;
  function later() { if (!queued) queued = requestAnimationFrame(function () { queued = 0; syncAll(); }); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-slider-prev], [data-slider-next], [data-slider-dot]');
    var root = t && t.closest('[data-slider]');
    if (!root) return;
    var p = parts(root); var m = p && measure(p);
    if (!m) return;
    if (t.hasAttribute('data-slider-dot')) go(root, Number(t.getAttribute('data-slider-dot')));
    else go(root, m.at + (t.hasAttribute('data-slider-next') ? 1 : -1));
  });
  document.addEventListener('scroll', later, true);
  window.addEventListener('resize', later);
  window.addEventListener('load', later);
  /* Slides added, or the number shown changed: count again. */
  new MutationObserver(later).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-show', 'data-slide', 'data-intro'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  later();
})();`

// The small script behind sliders: arrows, dots and a count over a track that scrolls natively, so any number of slides
// works, and swiping works without it. The same code runs in canvas frames and ships with exports as /mx-slider.js.
//
// Markup: [data-slider] holds [data-slider-track] (its children are the slides), [data-slider-prev], [data-slider-next],
// [data-slider-dots] and [data-slider-count]. Controls show once [data-slider-ready] is set, and hide when everything fits.

export const SLIDER_JS = `(function () {
  if (window.__mxSlider) return;
  window.__mxSlider = true;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function measure(root) {
    var track = root && root.querySelector('[data-slider-track]');
    if (!track || !track.clientWidth) return null;
    var direction = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
    var slides = Array.prototype.filter.call(track.children, function (slide) { return slide.offsetWidth > 0; });
    var end = track.scrollWidth - track.clientWidth;
    var stops = [0];
    if (slides.length && end > 1) {
      var start = slides[0].offsetLeft;
      slides.slice(1).forEach(function (slide) {
        var stop = direction * (slide.offsetLeft - start);
        if (stop > stops[stops.length - 1] + 1 && stop < end - 1) stops.push(stop);
      });
      stops.push(end);
    }
    var offset = direction * track.scrollLeft;
    var at = stops.reduce(function (closest, stop, i) {
      return Math.abs(stop - offset) < Math.abs(stops[closest] - offset) ? i : closest;
    }, 0);
    return { track: track, direction: direction, stops: stops, pages: stops.length, at: at };
  }
  function go(m, i) {
    var at = Math.max(0, Math.min(m.pages - 1, i));
    m.track.scrollTo({ left: m.stops[at] * m.direction, behavior: reduce ? 'auto' : 'smooth' });
  }
  function sync(root) {
    var m = measure(root);
    if (!m) return;
    root.setAttribute('data-slider-ready', '');
    if (m.pages > 1 && !m.track.hasAttribute('tabindex')) m.track.tabIndex = 0;
    root.toggleAttribute('data-slider-fits', m.pages < 2);
    var dots = root.querySelector('[data-slider-dots]');
    if (dots) {
      if (dots.children.length !== m.pages) {
        dots.textContent = '';
        for (var i = 0; i < m.pages; i++) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'dot'; b.setAttribute('data-slider-dot', String(i)); b.setAttribute('aria-label', 'Go to position ' + (i + 1) + ' of ' + m.pages);
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
    var m = measure(root);
    if (!m) return;
    if (t.hasAttribute('data-slider-dot')) go(m, Number(t.getAttribute('data-slider-dot')));
    else go(m, m.at + (t.hasAttribute('data-slider-next') ? 1 : -1));
  });
  document.addEventListener('keydown', function (e) {
    if (!e.target.matches || !e.target.matches('[data-slider-track]')) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
    var m = measure(e.target.closest('[data-slider]'));
    if (!m || m.pages < 2) return;
    e.preventDefault();
    var at = e.key === 'Home' ? 0 : e.key === 'End' ? m.pages - 1 : m.at + (e.key === 'ArrowRight' ? m.direction : -m.direction);
    go(m, at);
  });
  document.addEventListener('scroll', function (e) {
    if (e.target.matches && e.target.matches('[data-slider-track]')) later();
  }, true);
  window.addEventListener('resize', later);
  window.addEventListener('load', later);
  /* Slides added, or the number shown changed: count again. */
  new MutationObserver(later).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-show', 'data-slide', 'data-intro'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  later();
})();`

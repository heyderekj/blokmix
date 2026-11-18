// Compact navigation keeps the authored links in the document at every width.
// Without the script, the narrow layout shows those links inline.

export const NAV_CSS = `@layer navigation {
  [data-site-nav] [data-nav-toggle] { display: none; }
  [data-site-nav] :is(.link, .entry, .trigger, .quiet, .cta, .btn, .go) {
    min-block-size: 44px;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  [data-site-nav] :is(.brand, .name) { min-inline-size: 0; white-space: normal; overflow-wrap: anywhere; }
  [data-site-nav] :is(a, summary, button):focus-visible {
    outline: 2px solid var(--mx-color-text);
    outline-offset: 2px;
  }

  @container (max-width: 800px) {
    [data-site-nav] [data-nav-bar] {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: none;
      gap: 0 var(--mx-space-3);
      align-items: center;
      text-align: start;
      padding-block: var(--mx-space-2);
    }
    [data-site-nav] [data-nav-group] { display: contents; }
    [data-site-nav] [data-nav-brand] {
      grid-area: 1 / 1;
      justify-self: start;
      min-block-size: 44px;
      margin: 0;
      border: 0;
    }
    [data-site-nav][data-nav-ready] [data-nav-toggle] {
      grid-area: 1 / 2;
      display: inline-flex;
      align-items: center;
      gap: 0.625em;
      min-block-size: 44px;
      padding-inline: 0.75em;
      border: var(--mx-stroke) solid var(--mx-color-border);
      border-radius: var(--mx-radius);
      font-size: var(--mx-text-sm);
      font-weight: 600;
    }
    [data-nav-toggle] .nav-toggle-icon {
      position: relative;
      width: 1em;
      height: 1em;
    }
    [data-nav-toggle] .nav-toggle-icon::before,
    [data-nav-toggle] .nav-toggle-icon::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: calc(50% - 1px);
      border-block-start: 1.5px solid currentColor;
    }
    [data-nav-toggle] .nav-toggle-icon::before { transform: translateY(-3px); }
    [data-nav-toggle] .nav-toggle-icon::after { transform: translateY(3px); }
    [data-nav-toggle][aria-expanded="true"] .nav-toggle-icon::before { transform: rotate(45deg); }
    [data-nav-toggle][aria-expanded="true"] .nav-toggle-icon::after { transform: rotate(-45deg); }

    [data-site-nav] [data-nav-panel] {
      grid-column: 1 / -1;
      grid-row: auto;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      min-inline-size: 0;
      justify-self: stretch;
      margin: 0;
      padding: 0;
      border: 0;
      overflow: visible;
    }
    [data-site-nav] [data-nav-panel] :is(li, .link, .trigger, .entry, .quiet) { border: 0; }
    [data-site-nav] [data-nav-panel] :is(.link, .trigger, .entry, .quiet) {
      display: flex;
      width: 100%;
      justify-content: flex-start;
      padding-inline: var(--mx-space-3);
      border-radius: var(--mx-radius);
      font-size: var(--mx-text-base);
      color: var(--mx-color-text);
    }
    [data-site-nav] [data-nav-panel] :is(.link, .trigger, .entry, .quiet):is(:hover, :focus-visible) {
      background: color-mix(in oklab, currentColor 8%, transparent);
    }
    [data-site-nav] [data-nav-action] {
      grid-column: 1 / -1;
      grid-row: auto;
      justify-self: stretch;
      text-align: center;
      margin: var(--mx-space-2) 0 0;
    }
    [data-site-nav][data-nav-ready]:not([data-nav-open]) :is([data-nav-panel], [data-nav-action]) { display: none !important; }
    [data-site-nav] .nav-frame { padding-inline: var(--mx-space-3); border-radius: var(--mx-radius-lg); }
    [data-site-nav] :is(.spacer, .rule) { display: none; }
    [data-site-nav] .search[data-nav-panel] {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      min-height: 44px;
      width: auto;
      gap: var(--mx-space-2);
      padding-inline: var(--mx-space-3);
    }
    [data-site-nav] .search[data-nav-panel]::after { content: 'Search'; }
  }
}
`

export const NAV_JS = `(function () {
  if (window.__mxNav) return;
  window.__mxNav = true;

  function setOpen(nav, button, open) {
    nav.toggleAttribute('data-nav-open', open);
    button.setAttribute('aria-expanded', String(open));
  }
  function close(nav) {
    var toggle = nav.querySelector('[data-nav-toggle]');
    if (toggle) setOpen(nav, toggle, false);
    nav.querySelectorAll('details[data-nav-disclosure][open]').forEach(function (details) { details.open = false; });
  }
  function sync() {
    document.querySelectorAll('[data-site-nav]:not([data-nav-ready])').forEach(function (nav) {
      nav.setAttribute('data-nav-ready', '');
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest || e.defaultPrevented) return;
    var nav = e.target.closest('[data-site-nav]');
    var toggle = e.target.closest('[data-nav-toggle]');
    if (nav && toggle) {
      setOpen(nav, toggle, !nav.hasAttribute('data-nav-open'));
      return;
    }
    document.querySelectorAll('[data-site-nav]').forEach(function (bar) {
      if (bar !== nav || e.target.closest('a[href]:not([href="#"])')) close(bar);
      else bar.querySelectorAll('details[data-nav-disclosure][open]').forEach(function (details) {
        if (!details.contains(e.target)) details.open = false;
      });
    });
  });
  document.addEventListener('focusout', function (e) {
    var nav = e.target.closest && e.target.closest('[data-site-nav]');
    if (nav && e.relatedTarget && !nav.contains(e.relatedTarget)) close(nav);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !e.target.closest) return;
    var nav = e.target.closest('[data-site-nav]');
    if (!nav) return;
    var details = e.target.closest('details[data-nav-disclosure][open]');
    var trigger = details ? details.querySelector('summary') : nav.hasAttribute('data-nav-open') && nav.querySelector('[data-nav-toggle]');
    if (!trigger) return;
    e.preventDefault();
    if (details) details.open = false;
    else setOpen(nav, trigger, false);
    trigger.focus();
  });

  new MutationObserver(function (changes) {
    if (changes.some(function (change) {
      return Array.prototype.some.call(change.addedNodes, function (node) {
        return node.nodeType === 1 && (node.matches('[data-site-nav]') || node.querySelector('[data-site-nav]'));
      });
    })) sync();
  }).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();`

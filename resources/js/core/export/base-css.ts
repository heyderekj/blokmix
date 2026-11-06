/** Reset shared by the canvas iframes, the reference build and both exporters. */
export const BASE_CSS = `*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  display: flow-root;
  background: var(--mx-color-bg);
  color: var(--mx-color-text);
  font-family: var(--mx-font-body);
  font-size: var(--mx-text-base);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
h1, h2, h3, h4, h5, h6, p, figure, blockquote, ul, ol, dl, dd { margin: 0; }
/* Wrapping: balanced headings, no lonely last words in paragraphs, long words never overflow. */
h1, h2, h3, h4, h5, h6, blockquote { text-wrap: balance; }
p, li, dd, figcaption { text-wrap: pretty; }
body { overflow-wrap: break-word; }
/* A display word wider than a phone (a big heading in a centered column) breaks rather than scrolling the page. */
h1, h2, h3 { overflow-wrap: anywhere; }
ul, ol { padding: 0; list-style: none; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
img, svg { display: block; max-width: 100%; }
input, select, textarea { font: inherit; color: inherit; }
/* Every section answers to its own width: a clip's breakpoints are container queries (core/containerize.ts), so a
   layout fits wherever it sits. Containment makes each section its own layer, so a nav's dropdown stays above the rest. */
[data-mx-section], .mx-section { container-type: inline-size; }
:where([data-mx-section="nav"], nav.mx-section) { position: relative; z-index: 10; }
`

/**
 * Later layers win: a section's backdrop beats the clip's own background, and a
 * block's look always beats both, whatever the clip's selectors.
 */
export const LAYER_ORDER = '@layer base, clip, effects, motion, blocks;'

/**
 * When a section's list grows or shrinks, its grid rebalances (core/lists.ts `rebalance`): items get a span and the last
 * row a start, as data attributes, since a clip only carries the column rules it uses. Wide screens only (the section is
 * the container); tablets and phones keep the layout's own re-spans. Unlayered, so it beats the clip's own `.col-N`.
 */
export const GRID_SPAN_CSS = `@container (min-width: 953px) {
${[2, 3, 4, 6].map((n) => `  [data-mx-section] .grid > [data-mx-span="${n}"] { grid-column: auto / span ${n}; }`).join('\n')}
${Array.from({ length: 11 }, (_, i) => i + 2).map((n) => `  [data-mx-section] .grid > [data-mx-span][data-mx-start="${n}"] { grid-column-start: ${n}; }`).join('\n')}
}
`

/** The reset as exported: layer order first, then the reset in the lowest layer, then the grid spans. */
export const BASE_CSS_LAYERED = `${LAYER_ORDER}\n\n@layer base {\n${BASE_CSS}}\n\n${GRID_SPAN_CSS}`

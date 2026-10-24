// What the page side of a capture hands to the pure side: the picked section's
// DOM with the computed styles that matter, plus the page's keyframes, hover
// rules and font links. Plain JSON, so it travels in an extension message and
// can be saved as a fixture.

export type Decls = Record<string, string>

export interface SnapEl {
  t: 'el'
  id: number
  tag: string
  ns: 'html' | 'svg'
  /** Original attributes worth keeping or reading hints from (class, aria-*, alt, type…). */
  attrs: [string, string][]
  /**
   * Computed styles, as a diff: inherited properties when they differ from the
   * parent (the root carries all of them), the rest when they differ from the
   * tag's browser default (see Snapshot.defaults).
   */
  style: Decls
  /** x, y, width, height relative to the root's box. */
  rect: [number, number, number, number]
  kids: SnapNode[]
  before?: Decls
  after?: Decls
  /** Declarations from :hover rules on this element (vars resolved, colours as rgba()). */
  hover?: Decls
  /** :hover rules on this element that restyle a descendant (`.card:hover .title`). */
  groupHover?: { target: number; decls: Decls }[]
  /** <svg> only: its markup with <use> inlined and computed fill/stroke as attributes. */
  svg?: string
  /** <img>, <video>, <picture>, <iframe>, <canvas>: the media's own size and alt text. */
  media?: { kind: string; alt: string; w: number; h: number }
}

export interface SnapText {
  t: 'text'
  v: string
}

export type SnapNode = SnapEl | SnapText

export interface Keyframe {
  key: string
  decls: Decls
}

export interface Snapshot {
  version: 1
  url: string
  title: string
  siteName?: string
  viewport: { width: number; height: number }
  capturedAt: string
  selector: string
  root: SnapEl
  /** What the section sits on: the first opaque background above it, and the page's text style. */
  context: { bg: string; color: string; fontFamily: string; fontSize: string }
  /** Browser defaults per tag (computed in a blank document), for the tags in the capture plus div and span. */
  defaults: Record<string, Decls>
  keyframes: Record<string, Keyframe[]>
  /** Stylesheet links to font providers (Google Fonts, Fontshare, Fontsource). */
  fontLinks: string[]
  notes: string[]
}

export interface SnapshotOptions {
  /** Text of stylesheets the page can't read itself (cross-origin), fetched by the extension. */
  sheetTexts?: string[]
}

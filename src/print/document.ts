/**
 * Turning a printable sheet into the HTML the PDF is rendered from.
 *
 * The document is built here rather than in Rust for one reason: every
 * user-facing string in this app lives in `src/i18n/el.ts` and is resolved
 * through one lookup, and a printed page is user-facing text like any other.
 * Rust owns the page geometry and the file; this owns the words.
 *
 * Three things in the stylesheet below are load-bearing rather than taste:
 *
 * * **`color-scheme: light` and explicit black-on-white.** The app's own
 *   stylesheet follows the OS's dark mode. A PDF must not: a teacher printing
 *   at night would otherwise get white text on a dark page, or — worse, since
 *   backgrounds are often dropped — white text on white paper.
 * * **A font stack of fonts that actually have Greek.** This is the classic
 *   failure point the spec calls out. The stack names the system UI fonts that
 *   ship with full Greek coverage on each platform, so the renderer never has
 *   to fall back to a face that has only Latin and draws tofu for `ή`.
 * * **No external resource of any kind** — no webfont, no image URL, no
 *   stylesheet link. The spec forbids a PDF that depends on the network, and
 *   the app's CSP would block it anyway.
 */

/** A cell on a printed sheet. */
export interface PrintCell {
  text: string;
  align?: "left" | "center" | "right";
  strong?: boolean;
  muted?: boolean;
  /** A wider column — a name or a comment rather than a mark. */
  wide?: boolean;
}

export interface PrintTable {
  head: PrintCell[];
  /** An extra header row under the first, for the gradebook's weight row. */
  subHead?: PrintCell[];
  rows: PrintCell[][];
}

export interface PrintDocument {
  title: string;
  /** The sheet's header fields — class, subject, period, scale, threshold. */
  meta: { label: string; value: string }[];
  table: PrintTable;
  /** The small print under the table, if the source sheet has one. */
  note?: string;
  footer: string;
}

/**
 * A4 at 72 points to the inch, in the CSS pixels the print window renders in.
 *
 * One CSS pixel is one PDF point in what the capture produces — measured, not
 * assumed: an 800px-wide window came back as an 800pt-wide page. So a block
 * laid out at these sizes is captured as exactly A4.
 *
 * **These numbers are the same ones `src-tauri/src/pdf.rs` uses**, and they have
 * to stay that way: the app lays the document out into pages of this size and
 * the Rust side captures rectangles of this size. A test pins them together.
 */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
/** 10mm, the source product's own page margin. */
export const PAGE_MARGIN = 28.35;

export function pageGeometry(landscape: boolean): { width: number; height: number; margin: number } {
  return {
    width: landscape ? A4_HEIGHT : A4_WIDTH,
    height: landscape ? A4_WIDTH : A4_HEIGHT,
    margin: PAGE_MARGIN,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(c: PrintCell, tag: "td" | "th"): string {
  const classes = [
    c.align && c.align !== "left" ? c.align : "",
    c.strong ? "strong" : "",
    c.muted ? "muted" : "",
    c.wide ? "wide" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attr = classes ? ` class="${classes}"` : "";
  return `<${tag}${attr}>${escapeHtml(c.text)}</${tag}>`;
}

/**
 * The stylesheet every exported sheet shares.
 *
 * `@page` is deliberately left to say only `margin: 0`: the paper size,
 * orientation and margins come from the platform's print settings on the Rust
 * side, so the two operating systems are told the same page in the same units
 * instead of each interpreting a CSS page rule its own way.
 */
const STYLES = `
  :root { color-scheme: light; }
  @page { margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
  }
  body {
    font-family: "Helvetica Neue", Helvetica, "Segoe UI", "Noto Sans", Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 {
    font-size: 13pt;
    margin: 0 0 2mm;
    letter-spacing: 0.02em;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm 6mm;
    margin: 0 0 3mm;
    padding: 0 0 2mm;
    border-bottom: 0.4pt solid #000;
  }
  .meta div { font-size: 8pt; }
  .meta .label {
    color: #444;
    letter-spacing: 0.06em;
    margin-right: 1.5mm;
  }
  .meta .value { font-weight: 600; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th, td {
    border: 0.4pt solid #666;
    padding: 1.2mm 1.4mm;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  thead th {
    background: #eee;
    font-weight: 600;
    font-size: 8pt;
  }
  /* The header repeats when a long roster runs onto a second page, and no
     row is ever split across the page break. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  td.center, th.center { text-align: center; }
  td.right, th.right { text-align: right; }
  td.strong, th.strong { font-weight: 700; }
  td.muted, th.muted { color: #666; }
  .wide { width: 22%; }
  /* One block per sheet of paper, at exactly A4. macOS captures one rectangle
     of this size per block; Windows' own print-to-PDF breaks at the same
     blocks. */
  .page {
    box-sizing: border-box;
    overflow: hidden;
    background: #fff;
    break-after: page;
    page-break-after: always;
  }
  /* The page is a clipped fixed-size box; this is the part that is measured,
     because a clipped box reports the height it was given, not its content's. */
  .page-inner { display: block; }
  .page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .note {
    margin-top: 3mm;
    font-size: 7.5pt;
    color: #444;
  }
  .footer {
    margin-top: 2mm;
    font-size: 7pt;
    color: #666;
  }
`;

/**
 * The complete standalone document handed to the print window.
 *
 * It comes out as one flowing sheet, not as pages: the print window measures
 * it and cuts it into A4 blocks, because only the browser knows how tall a row
 * of the teacher's own text actually turns out to be. The geometry it needs
 * travels on the wrapper's data attributes.
 */
export function renderPrintDocument(doc: PrintDocument, landscape = true): string {
  const meta = doc.meta
    .map(
      (m) =>
        `<div><span class="label">${escapeHtml(m.label)}</span>` +
        `<span class="value">${escapeHtml(m.value)}</span></div>`,
    )
    .join("");

  const head = `<tr>${doc.table.head.map((c) => cell(c, "th")).join("")}</tr>`;
  const subHead = doc.table.subHead
    ? `<tr>${doc.table.subHead.map((c) => cell(c, "th")).join("")}</tr>`
    : "";
  const body = doc.table.rows
    .map((row) => `<tr>${row.map((c) => cell(c, "td")).join("")}</tr>`)
    .join("");

  const { width, height, margin } = pageGeometry(landscape);
  const geometry =
    `data-page-width="${width}" data-page-height="${height}" data-page-margin="${margin}"`;

  return [
    `<style>${STYLES}
  .page { width: ${width}px; height: ${height}px; padding: ${margin}px; }
</style>`,
    `<div id="sheet" ${geometry}>`,
    `<header><h1>${escapeHtml(doc.title)}</h1>`,
    `<div class="meta">${meta}</div></header>`,
    `<table><thead>${head}${subHead}</thead><tbody>${body}</tbody></table>`,
    `<footer>`,
    doc.note ? `<p class="note">${escapeHtml(doc.note)}</p>` : "",
    `<p class="footer">${escapeHtml(doc.footer)}</p>`,
    `</footer>`,
    `</div>`,
  ].join("\n");
}

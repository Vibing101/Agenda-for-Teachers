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
  /**
   * An explicit column width, as a CSS length or percentage.
   *
   * Set on a **header** cell: the table is laid out `fixed`, so the first row
   * decides every column's width and the rest of the sheet follows. It is what
   * makes a 31-day attendance grid fit across a landscape sheet instead of
   * letting the engine give a one-character column the same room as a name.
   */
  width?: string;
  /**
   * Never break this cell's text across lines.
   *
   * Added at M5, for a column that is short and must stay legible: a date read
   * as `05.11.20` / `26` down two lines is not a date. The page's default is
   * `overflow-wrap: anywhere`, which is right for a teacher's sentence and
   * wrong for a formatted number — this is the opt-out, and it is deliberately
   * per-cell rather than a change to the default, because the default is what
   * stops a long word overflowing the sheet.
   */
  nowrap?: boolean;
}

/**
 * A boxed area under the table, matching the source pages' own captioned
 * boxes — "ΠΡΟΣΘΕΤΕΣ ΣΗΜΕΙΩΣΕΙΣ" on the incident register, "ΠΡΟΣΟΧΗ · ΣΥΧΝΕΣ
 * ΑΠΟΥΣΙΕΣ" and "ΓΟΝΕΙΣ ΕΝΗΜΕΡΩΘΗΚΑΝ · ΕΝΕΡΓΕΙΕΣ" on the absence register,
 * "ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ" on the support overview.
 *
 * A box either **lists what is stored** — each line copied verbatim from a
 * record's own field, never counted, summarised or inferred — or is left
 * **blank**, as a ruled area the teacher writes in by hand. Blank is what a box
 * gets when the app stores nothing that belongs in it: M4.5 adds no fields, so
 * a box with no source stays a box on the paper rather than becoming one.
 */
export interface PrintBox {
  caption: string;
  /** One line per stored entry, already worded by the sheet that built it. */
  lines: string[];
  /** Printed as empty ruled space when there is nothing stored for it. */
  emptyText?: string;
}

/**
 * A block of a printed *letter*, as opposed to a row of a printed register.
 *
 * **M5 is the first milestone whose printed output is not a table**, and this
 * is the extension that made room for it rather than a second renderer. The
 * source's seven parent letters are forms: a row of small captioned fields, a
 * fixed sentence or two, captioned areas the teacher writes into, and — on two
 * of them — a reply slip ruled off at the foot of the page. Each of those is a
 * block here, and `renderPrintDocument` stays the one way HTML is produced.
 *
 * - `fields` — a row of small captioned values, the source's own page head.
 * - `prose` — fixed sentences from the language bundle.
 * - `area` — a captioned box holding what the teacher typed, or ruled space
 *   when she typed nothing. `rows` is how many lines tall the blank is, which
 *   is what makes an unfilled letter printable as a form.
 * - `slip` — `ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ`: a cut rule, a caption, a sentence and
 *   its signature lines. Marked `break-inside: avoid`, so it is never cut in
 *   half by a page break — a reply slip split across two sheets is not a reply
 *   slip.
 * - `signatures` — a row of ruled lines with captions beneath them.
 * - `award` — the certificate's centred name-and-reason block.
 */
export type PrintBlock =
  | {
      kind: "fields";
      fields: PrintField[];
      /**
       * Every field on one line, however many there are. A letter's head has
       * three fields and wraps at three; M7's forms and folder pages carry four
       * or five across, as their source pages do.
       */
      tight?: boolean;
    }
  | { kind: "prose"; lines: string[] }
  | { kind: "area"; caption: string; text: string; rows?: number }
  | {
      kind: "slip";
      caption: string;
      text: string;
      fields: { label: string; value: string }[];
    }
  | { kind: "signatures"; fields: { label: string; value: string }[] }
  | { kind: "award"; receivesCaption: string; name: string; forCaption: string; reason: string }
  // ------------------------------------------------------------- M7 ---
  /** Captioned areas side by side — the source's two-up boxes. */
  | { kind: "areas"; areas: { caption: string; text: string; rows?: number }[] }
  /**
   * A room plan: the board across the front and a grid of desks, one name
   * each. `names` is row by row from the front; a blank name is an empty desk.
   * `height` is one desk's height in millimetres, chosen by the sheet that
   * knows how much of its page the grid may take.
   */
  | { kind: "desks"; board: string; names: string[][]; height: number }
  /**
   * Columns of items, each with a round tick box. A tick is drawn, never
   * typed: a check-mark glyph is not in every face that carries Greek.
   */
  | {
      kind: "checklist";
      columns: { caption: string; items: { text: string; checked: boolean }[] }[];
    }
  /** Columns of captioned label → value rows, the folder's contacts page. */
  | {
      kind: "pairs";
      columns: { caption: string; rows: { label: string; value: string }[] }[];
    }
  /**
   * A framed group of blocks, kept whole on one page. `cut` draws the frame
   * dashed, for the parent note's "κόψτε κατά μήκος της γραμμής".
   */
  | { kind: "card"; title?: string; cut?: boolean; blocks: PrintBlock[] };

/** One captioned value in a row of fields. */
export interface PrintField {
  label: string;
  value: string;
  /** A relative width within a `tight` row — `2` takes twice a `1`. */
  grow?: number;
}

export interface PrintTable {
  head: PrintCell[];
  /** An extra header row under the first, for the gradebook's weight row. */
  subHead?: PrintCell[];
  rows: PrintCell[][];
}

export interface PrintDocument {
  title: string;
  /** The italic line under the title that the source's letters carry. */
  subtitle?: string;
  /** The sheet's header fields — class, subject, period, scale, threshold. */
  meta: { label: string; value: string }[];
  /**
   * The sheet's one table. **Optional since M5**: a letter has no table, and
   * carries [`blocks`] instead. A document may have both, and a register that
   * has only a table is exactly what it was before.
   */
  table?: PrintTable;
  /**
   * Blocks inside the sheet's header, under its meta line — so they repeat on
   * every page, as the header does. Added at M7 for a form whose captioned
   * fields sit *above* a ruled table (`ΤΜΗΜΑ · ΜΗΝΑΣ` over the monthly card),
   * where a block in `blocks` would print below it.
   */
  head?: PrintBlock[];
  /** A letter's blocks, printed under the table if there is one. */
  blocks?: PrintBlock[];
  /** The small print under the table, if the source sheet has one. */
  note?: string;
  /** The source page's own captioned boxes, under the table. */
  boxes?: PrintBox[];
  /**
   * A tighter table, for a sheet with far more columns than words in them —
   * the monthly attendance card, whose cells hold one character each and whose
   * columns number up to 31 plus four totals.
   *
   * Until M7 this was emitted into the per-document style block, because the
   * paginator rebuilt each page from scratch and only the stylesheet survived
   * that. It is a class on the sheet now: the paginator copies a sheet's
   * classes onto its pages, and a bundle of several documents must not let one
   * dense sheet tighten every other sheet's table.
   */
  dense?: boolean;
  /**
   * A certificate: one centred page inside a ruled frame, as the source's
   * `Έπαινος` and `Βραβείο επίδοσης` pages are.
   *
   * Worth recording, because the M5 brief said otherwise: those two pages are
   * **one certificate each on a full A4 portrait sheet**, not two up. The pages
   * were rendered and looked at to be sure.
   */
  certificate?: boolean;
  /**
   * Table rows tall enough to write in by hand. A blank form's rows hold
   * nothing yet, and a row with no text in it is otherwise only as tall as its
   * padding.
   */
  ruled?: boolean;
  /** A folder's cover: a large title, and the contents under it. */
  cover?: boolean;
  footer: string;
}

/**
 * A document that certainly has a table — every register and grade sheet this
 * app prints.
 *
 * `PrintDocument.table` became optional at M5, when the seven parent letters
 * arrived and turned out not to be tables at all. The register builders still
 * always produce one, and saying so here keeps their callers — and M2's and
 * M4.5's tests — reading `doc.table.rows` without a narrowing dance for a case
 * that cannot arise.
 */
export type TableDocument = PrintDocument & { table: PrintTable };

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
    c.nowrap ? "nowrap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attr = classes ? ` class="${classes}"` : "";
  const width = c.width ? ` style="width:${escapeHtml(c.width)}"` : "";
  return `<${tag}${attr}${width}>${escapeHtml(c.text)}</${tag}>`;
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
    /* A cell may stack several stored values, one per line — a student's two
       plans, say — and a teacher's own multi-line note keeps its lines. */
    white-space: pre-line;
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
  /* A short, formatted value — a date, a clock time, a vocabulary label — that
     would be unreadable broken across lines. */
  td.nowrap, th.nowrap { overflow-wrap: normal; word-break: keep-all; white-space: nowrap; }
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
  /* The source pages' captioned boxes, under the table. They travel inside
     <footer>, which is what the paginator carries to the last page (or on to a
     page of its own when it will not fit) — so a box is never cut in half and
     never silently dropped. */
  .boxes {
    display: flex;
    gap: 4mm;
    margin-top: 3mm;
  }
  .box {
    flex: 1;
    border: 0.4pt solid #666;
    padding: 1.4mm 1.6mm;
    min-height: 14mm;
  }
  .box .caption {
    display: block;
    font-size: 7pt;
    letter-spacing: 0.08em;
    color: #444;
    margin-bottom: 1mm;
  }
  .box ul {
    margin: 0;
    padding-left: 4mm;
    font-size: 7.5pt;
  }
  .box .empty { color: #999; font-size: 7.5pt; }
  .footer {
    margin-top: 2mm;
    font-size: 7pt;
    color: #666;
  }
  /* ------------------------------------------------- M5: letter blocks --- */
  /* A letter is prose and ruled space rather than a table, so these are the
     first print styles in this file that are not about rows and columns. */
  .subtitle {
    font-size: 10pt;
    font-style: italic;
    color: #444;
    margin: -1mm 0 2mm;
  }
  .block { margin: 0 0 3mm; }
  /* A row of small captioned values across the head of a letter — the class,
     the school year and the date, as the source page carries them. */
  .fieldrow {
    display: flex;
    flex-wrap: wrap;
    gap: 3mm 6mm;
  }
  .fieldrow .field { flex: 1 1 28%; min-width: 28%; }
  .fieldrow .caption,
  .block .caption {
    display: block;
    font-size: 7pt;
    letter-spacing: 0.08em;
    color: #444;
    margin-bottom: 0.8mm;
  }
  /* The value sits on a rule, so a field left blank is a line to write on —
     which is what the source's own paper gives the teacher. */
  .fieldrow .value {
    display: block;
    border-bottom: 0.4pt solid #666;
    min-height: 5mm;
    font-weight: 600;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .prose { margin: 0 0 2mm; white-space: pre-line; overflow-wrap: anywhere; }
  /* A captioned area the teacher writes into. Its minimum height is set per
     block from its own row count, so an unfilled newsletter still prints as a
     form with room in it rather than as a caption with nothing under it. */
  .area {
    border: 0.4pt solid #666;
    padding: 1.4mm 1.6mm;
  }
  .area .text {
    white-space: pre-line;
    overflow-wrap: anywhere;
    display: block;
  }
  /* The detach-and-return reply slip: ruled off above, and never split across
     a page break. A slip that arrives on two sheets is not a slip. */
  .slip {
    border-top: 0.8pt dashed #666;
    padding-top: 2mm;
    margin-top: 4mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .signatures {
    display: flex;
    gap: 6mm;
    margin-top: 5mm;
  }
  .signatures .field { flex: 1; }
  .signatures .value {
    display: block;
    border-bottom: 0.4pt solid #000;
    min-height: 7mm;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .signatures .caption {
    display: block;
    font-size: 7pt;
    letter-spacing: 0.08em;
    color: #444;
    margin-top: 0.8mm;
  }
  /* The certificate: one centred page inside a ruled frame. The source's two
     award pages are one each on a full A4 portrait sheet — verified against
     the source PDF, because the M5 brief said they were two up. */
  .certificate .page-inner {
    border: 1.2pt solid #000;
    padding: 12mm 10mm;
    height: 100%;
    box-sizing: border-box;
    text-align: center;
  }
  .certificate h1 { font-size: 26pt; margin: 18mm 0 2mm; }
  .certificate .meta { display: none; }
  .award { margin: 10mm 0; }
  .award .caption {
    display: block;
    font-size: 7pt;
    letter-spacing: 0.14em;
    color: #444;
  }
  .award .name {
    display: block;
    border-bottom: 0.8pt solid #000;
    min-height: 11mm;
    font-size: 16pt;
    margin: 2mm 18mm 6mm;
    overflow-wrap: anywhere;
  }
  .award .reason {
    display: block;
    border-bottom: 0.4pt solid #666;
    min-height: 16mm;
    margin: 2mm 12mm;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .certificate .signatures { margin: 14mm 14mm 0; }
  /* ------------------------------------- M7: forms and the substitute folder --- */
  /* A dense or ruled sheet says so with a class on the sheet, which the
     paginator copies onto every page cut from it — so in a bundle of several
     documents, one dense sheet does not tighten the tables of the others. */
  .dense th, .dense td { padding: 0.7mm 0.5mm; font-size: 7.5pt; }
  .dense thead th { font-size: 7pt; padding: 0.7mm 0.1mm; }
  /* A cell's height is its content box: the padding comes on top, so these
     give a ruled row of about 7mm and a dense one of about 4.5mm. */
  .ruled td { height: 4.4mm; }
  /* The 31-day card's rows: thirty of them on one portrait sheet. */
  .dense.ruled td { height: 3.1mm; }
  .fieldrow.tight { flex-wrap: nowrap; }
  .fieldrow.tight .field { flex: 1 1 0; min-width: 0; }
  header .fieldrow { margin: 0 0 3mm; }
  .areas { display: flex; gap: 4mm; }
  .areas .area { flex: 1 1 0; min-width: 0; }
  .desks .board {
    background: #222;
    color: #fff;
    text-align: center;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.12em;
    padding: 1.4mm;
    margin-bottom: 3mm;
    border-radius: 1mm;
  }
  .desks .grid { display: grid; gap: 3mm; }
  .desk {
    border: 0.4pt solid #666;
    border-radius: 1mm;
    padding: 1.2mm;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    text-align: center;
    font-size: 8pt;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .checklist, .pairs { display: flex; gap: 8mm; }
  .checklist .col, .pairs .col { flex: 1 1 0; min-width: 0; }
  .checklist ul { list-style: none; margin: 0; padding: 0; }
  .checklist li { display: flex; gap: 2mm; margin: 0 0 2mm; align-items: flex-start; }
  /* A tick is a drawn circle, filled when ticked — never a glyph. */
  .tick {
    flex: 0 0 auto;
    width: 3mm;
    height: 3mm;
    margin-top: 0.4mm;
    border: 0.5pt solid #444;
    border-radius: 50%;
    box-sizing: border-box;
  }
  .tick.on { background: #000; }
  .pair { display: flex; gap: 2mm; margin: 0 0 1.8mm; align-items: flex-end; }
  .pair .label { flex: 0 0 42%; font-size: 8pt; color: #333; }
  .pair .value {
    flex: 1 1 0;
    min-width: 0;
    border-bottom: 0.4pt solid #666;
    min-height: 5mm;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .card {
    border: 0.4pt solid #999;
    border-radius: 2mm;
    padding: 3mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* The cut line. The parent note is two to a page and cut apart by hand. */
  .card.cut { border: 0.9pt dashed #555; }
  .card > * { margin: 0 0 2.5mm; }
  .card > *:last-child { margin-bottom: 0; }
  .cardtitle { font-size: 11pt; font-weight: 700; }
  /* A folder's cover page. */
  .cover h1 { font-size: 30pt; margin: 30mm 0 3mm; }
  .cover .subtitle { font-size: 12pt; }
`;

/** One letter block as HTML. See [`PrintBlock`] for what each kind is. */
function block(b: PrintBlock): string {
  const caption = (text: string) => `<span class="caption">${escapeHtml(text)}</span>`;
  const ruled = (fields: { label: string; value: string }[]) =>
    fields
      .map(
        (f) =>
          `<div class="field"><span class="value">${escapeHtml(f.value)}</span>` +
          caption(f.label) +
          `</div>`,
      )
      .join("");

  switch (b.kind) {
    case "fields":
      return (
        `<div class="block fieldrow${b.tight ? " tight" : ""}">` +
        b.fields
          .map(
            (f) =>
              `<div class="field"${b.tight && f.grow ? ` style="flex-grow:${f.grow}"` : ""}>` +
              caption(f.label) +
              `<span class="value">${escapeHtml(f.value)}</span></div>`,
          )
          .join("") +
        `</div>`
      );
    case "prose":
      return b.lines
        .map((line) => `<p class="block prose">${escapeHtml(line)}</p>`)
        .join("");
    case "area":
      return areaHtml(b.caption, b.text, b.rows, "block ");
    case "slip":
      return (
        `<div class="block slip">${caption(b.caption)}` +
        `<p class="prose">${escapeHtml(b.text)}</p>` +
        `<div class="signatures">${ruled(b.fields)}</div></div>`
      );
    case "signatures":
      return `<div class="block signatures">${ruled(b.fields)}</div>`;
    case "award":
      return (
        `<div class="block award">${caption(b.receivesCaption)}` +
        `<span class="name">${escapeHtml(b.name)}</span>` +
        caption(b.forCaption) +
        `<span class="reason">${escapeHtml(b.reason)}</span></div>`
      );
    case "areas":
      return (
        `<div class="block areas">` +
        b.areas.map((a) => areaHtml(a.caption, a.text, a.rows, "")).join("") +
        `</div>`
      );
    case "desks": {
      const cols = Math.max(1, ...b.names.map((row) => row.length));
      return (
        `<div class="block desks"><div class="board">${escapeHtml(b.board)}</div>` +
        `<div class="grid" style="grid-template-columns:repeat(${cols}, 1fr)">` +
        b.names
          .flatMap((row) =>
            row.map(
              (name) =>
                `<div class="desk" style="min-height:${b.height}mm">${escapeHtml(name)}</div>`,
            ),
          )
          .join("") +
        `</div></div>`
      );
    }
    case "checklist":
      return (
        `<div class="block checklist">` +
        b.columns
          .map(
            (col) =>
              `<div class="col">${caption(col.caption)}<ul>` +
              col.items
                .map(
                  (item) =>
                    `<li><span class="tick${item.checked ? " on" : ""}"></span>` +
                    `<span class="text">${escapeHtml(item.text)}</span></li>`,
                )
                .join("") +
              `</ul></div>`,
          )
          .join("") +
        `</div>`
      );
    case "pairs":
      return (
        `<div class="block pairs">` +
        b.columns
          .map(
            (col) =>
              `<div class="col">${caption(col.caption)}` +
              col.rows
                .map(
                  (r) =>
                    `<div class="pair"><span class="label">${escapeHtml(r.label)}</span>` +
                    `<span class="value">${escapeHtml(r.value)}</span></div>`,
                )
                .join("") +
              `</div>`,
          )
          .join("") +
        `</div>`
      );
    case "card":
      return (
        `<div class="block card${b.cut ? " cut" : ""}">` +
        (b.title ? `<p class="cardtitle">${escapeHtml(b.title)}</p>` : "") +
        // Nested blocks lose their own `block` class, so the paginator — which
        // flows the sheet's *direct* blocks — moves the card as one piece.
        b.blocks.map((inner) => block(inner).replace(/class="block /g, 'class="')).join("") +
        `</div>`
      );
  }
}

/** A captioned area: what was typed, or ruled space `rows` lines tall. */
function areaHtml(caption: string, text: string, rows: number | undefined, extra: string): string {
  // Six millimetres a line is the height this stylesheet's 9pt text with its
  // 1.35 line-height actually occupies, rounded up so a blank never comes out
  // shorter than the writing it is standing in for.
  const height = `min-height:${Math.max(1, rows ?? 4) * 6}mm`;
  return (
    `<div class="${extra}area" style="${height}">` +
    `<span class="caption">${escapeHtml(caption)}</span>` +
    `<span class="text">${escapeHtml(text)}</span></div>`
  );
}

/**
 * The complete standalone document handed to the print window.
 *
 * It comes out as one flowing sheet, not as pages: the print window measures
 * it and cuts it into A4 blocks, because only the browser knows how tall a row
 * of the teacher's own text actually turns out to be. The geometry it needs
 * travels on the wrapper's data attributes.
 */
export function renderPrintDocument(doc: PrintDocument, landscape = true): string {
  return renderPrintBundle([doc], landscape);
}

/**
 * Several documents as **one** file — M7's substitute folder, whose spec line
 * is "one combined multi-page PDF, not 5 separate files".
 *
 * Every sheet this project printed before M7 was one document per file. The
 * machinery needed nothing on the Rust side to change: the print window cuts
 * every sheet it is given into A4 pages in order (see `paginate.ts`), macOS
 * captures however many pages that came to, and WebView2 breaks at the same
 * page blocks. So a bundle is simply more than one sheet in the document, with
 * each starting a page of its own.
 *
 * **One orientation per file.** The platforms are told one page geometry per
 * export, so every document in a bundle is laid out on the same A4 side.
 */
export function renderPrintBundle(docs: PrintDocument[], landscape = true): string {
  const { width, height, margin } = pageGeometry(landscape);
  return [
    `<style>${STYLES}
  .page { width: ${width}px; height: ${height}px; padding: ${margin}px; }
</style>`,
    // The first sheet keeps the `id` a single document has always had.
    ...docs.map((doc, i) => sheetHtml(doc, landscape, i === 0)),
  ].join("\n");
}

function sheetHtml(doc: PrintDocument, landscape: boolean, first: boolean): string {
  const meta = doc.meta
    .map(
      (m) =>
        `<div><span class="label">${escapeHtml(m.label)}</span>` +
        `<span class="value">${escapeHtml(m.value)}</span></div>`,
    )
    .join("");

  // A letter has no table at all. `table` became optional at M5 for exactly
  // that, and a register that has one is emitted byte-for-byte as before.
  const table = doc.table
    ? `<table><thead>` +
      `<tr>${doc.table.head.map((c) => cell(c, "th")).join("")}</tr>` +
      (doc.table.subHead
        ? `<tr>${doc.table.subHead.map((c) => cell(c, "th")).join("")}</tr>`
        : "") +
      `</thead><tbody>` +
      doc.table.rows.map((row) => `<tr>${row.map((c) => cell(c, "td")).join("")}</tr>`).join("") +
      `</tbody></table>`
    : "";

  const blocks = (doc.blocks ?? []).map(block).join("\n");
  // Header blocks are part of the header, so they must not be picked up as
  // flowing blocks: they lose the `block` class the paginator looks for.
  const head = (doc.head ?? []).map((b) => block(b).replace(/class="block /g, 'class="')).join("");

  const { width, height, margin } = pageGeometry(landscape);
  const geometry =
    `data-sheet data-page-width="${width}" data-page-height="${height}" data-page-margin="${margin}"`;

  const boxes = (doc.boxes ?? []).length
    ? `<div class="boxes">` +
      doc
        .boxes!.map(
          (b) =>
            `<div class="box"><span class="caption">${escapeHtml(b.caption)}</span>` +
            (b.lines.length
              ? `<ul>${b.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
              : `<span class="empty">${escapeHtml(b.emptyText ?? "")}</span>`) +
            `</div>`,
        )
        .join("") +
      `</div>`
    : "";

  const classes = [
    doc.certificate ? "certificate" : "",
    doc.dense ? "dense" : "",
    doc.ruled ? "ruled" : "",
    doc.cover ? "cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `<div${first ? ` id="sheet"` : ""} ${geometry}${classes ? ` class="${classes}"` : ""}>`,
    `<header><h1>${escapeHtml(doc.title)}</h1>`,
    doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : "",
    `<div class="meta">${meta}</div>${head}</header>`,
    table,
    blocks,
    `<footer>`,
    boxes,
    doc.note ? `<p class="note">${escapeHtml(doc.note)}</p>` : "",
    `<p class="footer">${escapeHtml(doc.footer)}</p>`,
    `</footer>`,
    `</div>`,
  ].join("\n");
}

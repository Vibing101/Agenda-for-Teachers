/**
 * Cutting a printable sheet into A4 pages.
 *
 * **Why the app paginates instead of the renderer.** The two engines this app
 * prints through cannot both be left to do it: macOS's `createPDF` does not
 * paginate at all, and WebView2 would apply its own rules. Measuring the
 * rendered rows here and placing them into fixed A4 blocks gives both platforms
 * the same page structure — same header on every page, same rows in the same
 * order, same A4 sheet — and is what lets the macOS side capture one exact A4
 * rectangle per page.
 *
 * What it does **not** promise is that a given row lands on the same page
 * number on both. The measurement is the platform's own: WebView2 and WebKit
 * draw the same text at slightly different heights, so a sheet that just fits
 * on one machine can take one more page on the other (observed at the M2 gate:
 * a 45-row roster came out as five pages on macOS and six on Windows, the
 * difference being whether the closing note shared the last page). The content
 * is identical either way.
 *
 * The rules are the source product's: the header block and the column headers
 * repeat on every page, and a row is never cut in half — one that does not fit
 * starts the next page instead.
 *
 * **M5 taught it a second kind of item.** Until then every printable surface was
 * a table and the only thing that could be broken between pages was a row. A
 * letter is not a table: it is a sequence of blocks — a field row, a paragraph,
 * a captioned area, a reply slip — and those flow down the page alongside rows
 * rather than instead of them. So the loop below walks *items* in document
 * order, where an item is either a table row or a block, and a page grows a
 * table only when a row actually lands on it. A document that is all table
 * paginates exactly as it did before, which is what keeps M2's and M4.5's four
 * sheets unchanged.
 *
 * What is **not** given back to the engine is the decision: the app still
 * measures and still places. A block that must not be cut says so in CSS
 * (`break-inside: avoid` on a reply slip) *and* is kept whole here, because
 * only the second of those two is binding on a fixed-height captured page.
 */

export interface Pagination {
  pages: number;
  pageWidth: number;
  pageHeight: number;
}

/**
 * How tall a page's content currently is.
 *
 * Passed in so the rule can be tested without a layout engine, and measured on
 * the *inner* wrapper rather than the page itself: a page is a fixed-height box
 * with `overflow: hidden`, and a clipped box reports the height it was given
 * rather than the height of what is inside it — which silently dropped
 * two-thirds of a 45-student roster the first time this was written.
 */
export type Measure = (element: HTMLElement) => number;

const measureOffsetHeight: Measure = (element) => element.offsetHeight;

export function paginate(root: HTMLElement, measure: Measure = measureOffsetHeight): Pagination {
  const sheet = root.querySelector<HTMLElement>("#sheet");
  if (!sheet) return { pages: 0, pageWidth: 0, pageHeight: 0 };

  const pageWidth = Number(sheet.dataset.pageWidth);
  const pageHeight = Number(sheet.dataset.pageHeight);
  const margin = Number(sheet.dataset.pageMargin);
  const content = pageHeight - 2 * margin;

  const header = sheet.querySelector("header");
  const table = sheet.querySelector("table");
  const footer = sheet.querySelector("footer");
  // A letter has no table, so only the header is required now.
  if (!header) return { pages: 0, pageWidth, pageHeight };

  const head = table?.querySelector("thead") ?? null;

  // The things that flow, in document order: every table row, then every
  // letter block. A register has only the first kind and a letter only the
  // second; nothing stops a document having both.
  const items: Element[] = [
    ...Array.from(table?.tBodies[0]?.rows ?? []),
    ...Array.from(sheet.querySelectorAll<HTMLElement>(":scope > .block")),
  ];

  const pages = document.createElement("div");
  // Attached to the document *before* anything is measured: an element that is
  // not in the document has no layout, so every height would read as zero and
  // the whole roster would end up on one clipped page.
  sheet.before(pages);
  let current = newPage(pages, header);
  let onPage = 0;

  for (const item of items) {
    place(current, item, head);
    onPage += 1;
    // The first item on a page is always kept, even if it overflows on its
    // own: dropping it for never fitting would lose it altogether, and a row
    // taller than a sheet is still a row the teacher wrote.
    if (measure(inner(current)) > content && onPage > 1) {
      remove(item);
      current = newPage(pages, header);
      place(current, item, head);
      onPage = 1;
    }
  }

  if (footer) {
    inner(current).appendChild(footer);
    if (measure(inner(current)) > content && onPage > 0) {
      // The note and the footer would spill off the bottom: give them a page
      // of their own rather than losing them.
      current = newPage(pages, header);
      current.querySelector("table")?.remove();
      inner(current).appendChild(footer);
    }
  }

  sheet.remove();
  return { pages: pages.children.length, pageWidth, pageHeight };
}

function inner(page: HTMLElement): HTMLElement {
  return page.querySelector<HTMLElement>(".page-inner")!;
}

/**
 * Puts one flowing item onto a page: a row into the page's table, a block
 * straight onto the page.
 *
 * A page grows its table **lazily**, when a row first needs it, so a page of a
 * letter does not carry an empty table and a stray set of column headers.
 */
function place(page: HTMLElement, item: Element, head: Element | null): void {
  if (item.tagName === "TR") {
    let body = page.querySelector("tbody");
    if (!body) {
      const table = document.createElement("table");
      if (head) table.appendChild(head.cloneNode(true));
      body = document.createElement("tbody");
      table.appendChild(body);
      inner(page).appendChild(table);
    }
    body.appendChild(item);
  } else {
    inner(page).appendChild(item);
  }
}

function remove(item: Element): void {
  item.parentElement?.removeChild(item);
}

/**
 * A fresh page carrying the sheet's header.
 *
 * The column headers are **not** added here any more: [`place`] adds the table
 * and its `thead` when a row first lands on the page, so a page holding only
 * letter blocks does not carry an empty table.
 */
function newPage(container: HTMLElement, header: Element): HTMLElement {
  const page = document.createElement("div");
  page.className = "page";
  const wrapper = document.createElement("div");
  wrapper.className = "page-inner";
  page.appendChild(wrapper);

  wrapper.appendChild(header.cloneNode(true));
  container.appendChild(page);
  return page;
}

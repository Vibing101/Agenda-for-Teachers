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
  if (!header || !table) return { pages: 0, pageWidth, pageHeight };

  const head = table.querySelector("thead");
  const rows = Array.from(table.tBodies[0]?.rows ?? []);

  const pages = document.createElement("div");
  // Attached to the document *before* anything is measured: an element that is
  // not in the document has no layout, so every height would read as zero and
  // the whole roster would end up on one clipped page.
  sheet.before(pages);
  let current = newPage(pages, header, head);

  for (const row of rows) {
    const body = current.querySelector("tbody")!;
    body.appendChild(row);
    if (measure(inner(current)) > content && body.rows.length > 1) {
      // It did not fit: take it back off and start the page it belongs on.
      body.removeChild(row);
      current = newPage(pages, header, head);
      current.querySelector("tbody")!.appendChild(row);
    }
  }

  if (footer) {
    inner(current).appendChild(footer);
    if (measure(inner(current)) > content) {
      // The note and the footer would spill off the bottom: give them a page
      // of their own rather than losing them.
      current = newPage(pages, header, head);
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

/** A fresh page carrying the sheet's header and the column headers. */
function newPage(container: HTMLElement, header: Element, head: Element | null): HTMLElement {
  const page = document.createElement("div");
  page.className = "page";
  const wrapper = document.createElement("div");
  wrapper.className = "page-inner";
  page.appendChild(wrapper);

  wrapper.appendChild(header.cloneNode(true));

  const table = document.createElement("table");
  if (head) table.appendChild(head.cloneNode(true));
  table.appendChild(document.createElement("tbody"));
  wrapper.appendChild(table);

  container.appendChild(page);
  return page;
}

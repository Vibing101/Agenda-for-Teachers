/**
 * Cutting a sheet into A4 pages.
 *
 * jsdom has no layout engine, so the measurement is injected: each test says
 * how tall a page's content "is" and then asserts where the breaks landed.
 * That is the whole of the rule worth testing — how tall a row really is, is
 * the browser's business, and the gate's.
 */
import { describe, expect, it } from "vitest";
import { paginate, type Measure } from "../../src/print/paginate";
import {
  renderPrintBundle,
  renderPrintDocument,
  type PrintDocument,
} from "../../src/print/document";

function sheet(rowCount: number): HTMLElement {
  const doc: PrintDocument = {
    title: "Βαθμοί τάξης",
    meta: [{ label: "ΤΑΞΗ", value: "Α1" }],
    table: {
      head: [{ text: "Αρ." }, { text: "Ονοματεπώνυμο" }],
      subHead: [{ text: "" }, { text: "ΒΑΡΥΤΗΤΑ" }],
      rows: Array.from({ length: rowCount }, (_, i) => [
        { text: String(i + 1) },
        { text: `Μαθητής ${i + 1}` },
      ]),
    },
    note: "Σημείωση",
    footer: "Ατζέντα Εκπαιδευτικού",
  };
  const root = document.createElement("div");
  root.innerHTML = renderPrintDocument(doc, true);
  document.body.appendChild(root);
  return root;
}

/** Every row is `rowHeight` tall, on top of a fixed header cost. */
function measuring(rowHeight: number, header = 100): Measure {
  return (element) => header + element.querySelectorAll("tbody tr").length * rowHeight;
}

describe("paginating a sheet", () => {
  it("keeps a sheet that fits on one page", () => {
    const root = sheet(5);
    // A4 landscape content height is 595.28 - 2×28.35 ≈ 538.
    const result = paginate(root, measuring(20));
    expect(result.pages).toBe(1);
    expect(result.pageWidth).toBeCloseTo(841.89, 2);
    expect(result.pageHeight).toBeCloseTo(595.28, 2);
  });

  it("starts a new page rather than cutting a row in half", () => {
    const root = sheet(40);
    // 100 + 22n ≤ 538 → 19 rows a page.
    paginate(root, measuring(22));
    const pages = root.querySelectorAll(".page");
    expect(pages.length).toBeGreaterThan(1);
    const perPage = Array.from(pages).map((p) => p.querySelectorAll("tbody tr").length);
    expect(perPage[0]).toBe(19);
    // Every row survives, exactly once.
    expect(perPage.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("repeats the sheet header and the column headers on every page", () => {
    const root = sheet(40);
    paginate(root, measuring(22));
    for (const page of root.querySelectorAll(".page")) {
      expect(page.querySelector("header h1")?.textContent).toBe("Βαθμοί τάξης");
      expect(page.querySelector("thead")).not.toBeNull();
      expect(page.textContent).toContain("ΒΑΡΥΤΗΤΑ");
    }
  });

  it("puts the note and the footer at the end, once", () => {
    const root = sheet(40);
    paginate(root, measuring(22));
    expect(root.querySelectorAll("footer").length).toBe(1);
    const pages = Array.from(root.querySelectorAll(".page"));
    expect(pages[pages.length - 1].querySelector("footer")).not.toBeNull();
  });

  it("never loses a row that is taller than a page on its own", () => {
    const root = sheet(3);
    // Each row alone overflows: the rule must still place one per page rather
    // than dropping it for never fitting.
    paginate(root, measuring(900));
    const perPage = Array.from(root.querySelectorAll(".page")).map(
      (p) => p.querySelectorAll("tbody tr").length,
    );
    expect(perPage.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("still produces a page for a sheet with no rows at all", () => {
    const root = sheet(0);
    const result = paginate(root, measuring(20));
    expect(result.pages).toBe(1);
    expect(root.querySelector(".page header h1")?.textContent).toBe("Βαθμοί τάξης");
  });

  it("flows blocks above a table, then its rows, then blocks below, in that order (M10)", () => {
    // A meeting's minutes: fields and captioned areas, then the agreements
    // register, then a closing area. Every item in document order, and a page
    // break that lands in the rows repeats the column headers.
    const doc: PrintDocument = {
      title: "Πρακτικό",
      meta: [],
      lead: [
        { kind: "prose", lines: ["ΠΡΙΝ-1"] },
        { kind: "prose", lines: ["ΠΡΙΝ-2"] },
      ],
      table: {
        head: [{ text: "Ποιος" }, { text: "Τι" }],
        rows: Array.from({ length: 6 }, (_, i) => [{ text: `Σ${i + 1}` }, { text: "" }]),
      },
      blocks: [{ kind: "prose", lines: ["ΜΕΤΑ"] }],
      footer: "Ατζέντα Εκπαιδευτικού",
    };
    const root = document.createElement("div");
    root.innerHTML = renderPrintDocument(doc, false);
    document.body.appendChild(root);
    // Every item is 100 tall on a 785-tall portrait page: seven to a page.
    const measure: Measure = (el) => el.querySelectorAll("tbody tr, p.prose").length * 100;
    paginate(root, measure);

    const order = Array.from(root.querySelectorAll(".page")).map((page) =>
      Array.from(page.querySelectorAll("tbody tr td:first-child, p.prose")).map(
        (e) => e.textContent,
      ),
    );
    expect(order).toEqual([
      ["ΠΡΙΝ-1", "ΠΡΙΝ-2", "Σ1", "Σ2", "Σ3", "Σ4", "Σ5"],
      ["Σ6", "ΜΕΤΑ"],
    ]);
    const pages = root.querySelectorAll(".page");
    expect(pages[1].querySelector("thead")?.textContent).toContain("Ποιος");
    // The lead blocks are not a header: they are not repeated.
    expect(pages[1].textContent).not.toContain("ΠΡΙΝ-1");
  });

  it("carries the page geometry the Rust side captures against", () => {
    // These two numbers are the contract between the document and the native
    // capture: the app lays out A4 blocks and Rust takes A4 rectangles.
    const root = sheet(1);
    const result = paginate(root, measuring(20));
    expect([result.pageWidth, result.pageHeight]).toEqual([841.89, 595.28]);
  });
});

/**
 * M7: several documents in one file — the substitute folder's "one combined
 * multi-page PDF, not 5 separate files". The print window cuts every sheet it
 * is given onto pages in order, each sheet starting a page of its own, and the
 * Rust side captures however many pages that comes to.
 */
describe("paginating several documents into one file", () => {
  const doc = (title: string, rows = 0, extra: Partial<PrintDocument> = {}): PrintDocument => ({
    title,
    meta: [],
    table: rows
      ? {
          head: [{ text: "Ώρα" }],
          rows: Array.from({ length: rows }, (_, i) => [{ text: `${title} ${i + 1}` }]),
        }
      : undefined,
    blocks: rows ? [] : [{ kind: "prose", lines: [`Κείμενο του ${title}`] }],
    footer: "Ατζέντα Εκπαιδευτικού",
    ...extra,
  });

  function bundle(docs: PrintDocument[]): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = renderPrintBundle(docs, true);
    document.body.appendChild(root);
    return root;
  }

  it("gives every document its own page, in order, in one file", () => {
    const titles = ["Εξώφυλλο", "Πληροφορίες", "Εβδομάδα", "Αίθουσα", "Μέρα", "Επαφές"];
    const root = bundle(titles.map((t) => doc(t)));
    const result = paginate(root, measuring(20));

    expect(result.pages).toBe(6);
    const pages = Array.from(root.querySelectorAll(".page"));
    expect(pages.map((p) => p.querySelector("header h1")?.textContent)).toEqual(titles);
    // Each page carries its own document's content and no other's.
    pages.forEach((page, i) => {
      expect(page.textContent).toContain(`Κείμενο του ${titles[i]}`);
      titles
        .filter((_, j) => j !== i)
        .forEach((other) => expect(page.textContent).not.toContain(`Κείμενο του ${other}`));
    });
    // No sheet is left behind unpaginated.
    expect(root.querySelectorAll("[data-sheet]")).toHaveLength(0);
  });

  it("starts the next document on a fresh page even when the last one ran over", () => {
    // 100 + 22n ≤ 538 → 19 rows a page, so 30 rows take two pages.
    const root = bundle([doc("Εβδομάδα", 30), doc("Αίθουσα", 3)]);
    const result = paginate(root, measuring(22));

    expect(result.pages).toBe(3);
    const pages = Array.from(root.querySelectorAll(".page"));
    expect(pages.map((p) => p.querySelector("header h1")?.textContent)).toEqual([
      "Εβδομάδα",
      "Εβδομάδα",
      "Αίθουσα",
    ]);
    expect(pages[2].textContent).not.toContain("Εβδομάδα 30");
    expect(pages[1].textContent).toContain("Εβδομάδα 30");
  });

  it("leaves a single document exactly as it paginated before", () => {
    const single = document.createElement("div");
    single.innerHTML = renderPrintDocument(doc("Βαθμοί", 40), true);
    document.body.appendChild(single);
    const viaBundle = bundle([doc("Βαθμοί", 40)]);

    expect(paginate(single, measuring(22)).pages).toBe(paginate(viaBundle, measuring(22)).pages);
    expect(single.innerHTML).toBe(viaBundle.innerHTML);
  });

  /**
   * A regression test for a defect found while writing this: the stylesheet
   * frames a certificate as `.certificate .page-inner`, but the element that
   * carried `certificate` was the sheet — which the paginator removes — so no
   * page ever matched, and M5's two award certificates printed with no frame
   * and an ordinary-sized title. Confirmed to fail against the pre-M7
   * paginator.
   */
  it("carries a sheet's classes onto its pages, so a certificate keeps its frame", () => {
    const root = bundle([doc("Έπαινος", 0, { certificate: true })]);
    paginate(root, measuring(20));
    const page = root.querySelector(".page")!;
    expect(page.classList.contains("certificate")).toBe(true);
    expect(page.querySelector(".certificate .page-inner, .page-inner")).not.toBeNull();
    expect(root.querySelector(".certificate .page-inner")).not.toBeNull();
  });

  it("keeps one dense sheet from tightening the others in its bundle", () => {
    const root = bundle([doc("Κάρτα", 2, { dense: true }), doc("Μητρώο", 2)]);
    paginate(root, measuring(20));
    const [dense, plain] = Array.from(root.querySelectorAll(".page"));
    expect(dense.classList.contains("dense")).toBe(true);
    expect(plain.classList.contains("dense")).toBe(false);
  });
});


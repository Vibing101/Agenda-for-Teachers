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
import { renderPrintDocument, type PrintDocument } from "../../src/print/document";

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

  it("carries the page geometry the Rust side captures against", () => {
    // These two numbers are the contract between the document and the native
    // capture: the app lays out A4 blocks and Rust takes A4 rectangles.
    const root = sheet(1);
    const result = paginate(root, measuring(20));
    expect([result.pageWidth, result.pageHeight]).toEqual([841.89, 595.28]);
  });
});

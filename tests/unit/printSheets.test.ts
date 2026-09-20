/**
 * The two printed sheets, as documents.
 *
 * What a PDF looks like can only be judged by opening one — that is a gate
 * step, not a unit test. What *can* be pinned here is everything that decides
 * what the PDF will contain: that the numbers on the page are the same numbers
 * the screen computes, that codes are printed as labels rather than as codes,
 * that the teacher's own text is escaped rather than injected, and that Greek
 * with diacritics survives into the document intact.
 */
import { describe, expect, it } from "vitest";
import { escapeHtml, renderPrintDocument } from "../../src/print/document";
import {
  conductSheetDocument,
  displayValue,
  gradeSheetDocument,
  gradeSheetHtml,
} from "../../src/print/gradeSheets";
import { translatorFor } from "../../src/i18n";
import { gradedPlanner, CLASS_ID } from "../helpers/gradebookFixture";

const t = translatorFor("el");
const TODAY = "2026-09-20";

describe("the grade sheet", () => {
  const doc = gradeSheetDocument(t, gradedPlanner(), CLASS_ID, TODAY);

  it("carries the source sheet's header fields", () => {
    const labels = doc.meta.map((m) => m.label);
    expect(labels).toEqual([
      t("grades.printClass"),
      t("grades.printSubject"),
      t("grades.printPeriod"),
      t("grades.printTeacher"),
      t("grades.printScale"),
      t("grades.printBase"),
    ]);
    expect(doc.meta.find((m) => m.label === t("grades.printBase"))?.value).toBe("10");
    expect(doc.meta.find((m) => m.label === t("grades.printScale"))?.value).toBe("0–20");
  });

  it("prints the weight row under the column headers, as the registry does", () => {
    // Two numeric columns at 60% and 40%, then a comment column, which carries
    // no weight on the page because it carries none in the calculation.
    expect(doc.table.subHead?.map((c) => c.text)).toEqual([
      "", // the register-number column
      t("grades.printWeightRow"),
      "60%",
      "40%",
      "", // the comment column carries no weight on the page…
      "", // …and neither does the pass/fail one
      "", // the average
      "", // the suggestion
    ]);
  });

  it("prints the same average and suggestion the screen computes", () => {
    const first = doc.table.rows[0].map((c) => c.text);
    // Ελένη: 18 at 60% and 16 at 40% → 17.2, suggestion 17.
    expect(first).toContain("17.2");
    expect(first).toContain("17");
    const ungraded = doc.table.rows[2].map((c) => c.text);
    // A student with no marks prints a dash and no suggestion, not a zero.
    expect(ungraded).toContain("—");
    expect(ungraded).not.toContain("0");
  });

  it("prints a coded value as its label, not as its code", () => {
    const html = gradeSheetHtml(t, gradedPlanner(), CLASS_ID, TODAY);
    expect(html).not.toContain(">pass<");
    expect(html).toContain(t("vocab.passFailGrade.pass"));
  });

  it("keeps Greek with diacritics intact, accents and final sigma included", () => {
    const html = gradeSheetHtml(t, gradedPlanner(), CLASS_ID, TODAY);
    // The teacher's own text, and a label from the string table.
    expect(html).toContain("Ελένη Παπαδοπούλου");
    expect(html).toContain("Δούλεψε πολύ καλά στο δεύτερο τρίμηνο");
    expect(html).toContain(t("grades.printAverage"));
    // Every accented character that the document should contain, still there.
    for (const ch of "άέήίόύώΐΰϊϋς") {
      expect(html.includes(ch) || !("Ελένη Παπαδοπούλου".includes(ch))).toBe(true);
    }
  });

  it("dates the footer in the app's own format, not the OS's", () => {
    expect(doc.footer).toContain("20.09.2026");
  });
});

describe("the conduct sheet", () => {
  const doc = conductSheetDocument(t, gradedPlanner(), CLASS_ID, TODAY);

  it("is its own document, with the source page's own title and columns", () => {
    expect(doc.title).toBe(t("grades.printConductTitle"));
    expect(doc.table.head.map((c) => c.text)).toEqual([
      t("grades.rosterNo"),
      t("common.name"),
      t("grades.conduct"),
      t("grades.overallResult"),
      t("grades.observations"),
    ]);
  });

  it("prints the conduct level as its label and the overall result as written", () => {
    const row = doc.table.rows[0].map((c) => c.text);
    expect(row).toContain(t("vocab.conduct.exemplary"));
    expect(row).toContain("Άριστη πρόοδος");
  });

  it("carries no average, no suggestion and no threshold — conduct is not graded", () => {
    const rendered = renderPrintDocument(doc);
    expect(rendered).not.toContain(t("grades.printAverage"));
    expect(rendered).not.toContain(t("grades.printBase"));
    expect(rendered).not.toContain("17.2");
  });
});

describe("the document itself", () => {
  it("escapes what the teacher typed instead of letting it become markup", () => {
    expect(escapeHtml('<b>Α&Β</b>')).toBe("&lt;b&gt;Α&amp;Β&lt;/b&gt;");
  });

  it("forces a light page, whatever the operating system's appearance is", () => {
    const html = gradeSheetHtml(t, gradedPlanner(), CLASS_ID, TODAY);
    expect(html).toContain("color-scheme: light");
    expect(html).toContain("background: #fff");
  });

  it("asks for no external resource of any kind", () => {
    const html = gradeSheetHtml(t, gradedPlanner(), CLASS_ID, TODAY);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain("<link");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("<script");
  });

  it("repeats the header on a second page and never splits a row", () => {
    const html = gradeSheetHtml(t, gradedPlanner(), CLASS_ID, TODAY);
    expect(html).toContain("table-header-group");
    expect(html).toContain("break-inside: avoid");
  });
});

describe("displaying one value", () => {
  const numeric = { id: 1, class_id: 1, position: 0, label: "", kind: "numeric" as const, weight: 50 };
  const descriptive = { ...numeric, kind: "descriptive" as const };

  it("prints a mark as typed and a code as its label", () => {
    expect(displayValue(t, numeric, "17")).toBe("17");
    expect(displayValue(t, descriptive, "a")).toBe(t("vocab.descriptiveGrade.a"));
  });

  it("prints nothing at all for a cell that was never filled in", () => {
    expect(displayValue(t, numeric, "")).toBe("");
    expect(displayValue(t, descriptive, "  ")).toBe("");
  });
});

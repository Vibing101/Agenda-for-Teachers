/**
 * The two sheets M2 prints: the class gradebook and the conduct sheet.
 *
 * Both follow the source product's own pages — "Βαθμοί τάξης" and
 * "Συμπεριφορά και στάση" — in their header fields, their column order and
 * their wording, so the teacher recognises what comes out of the printer. They
 * are **two separate documents**, as they are two separate pages in the source
 * product; see the release note's open question.
 *
 * Everything here is pure: planner in, HTML out. That means the exact document
 * that will be rendered can be asserted in a test — including that Greek
 * diacritics survive into it — without a webview.
 */
import { formatDate } from "../domain/dates";
import {
  classRoster,
  columnsFor,
  gradingFor,
  resultsFor,
  rowFor,
  valueOf,
} from "../domain/gradebook";
import { formatAverage, isNumericColumn, type GradeColumn } from "../domain/grades";
import type { Planner } from "../domain/types";
import type { Translate } from "../i18n";
import {
  conductLabel,
  descriptiveGradeLabel,
  passFailGradeLabel,
} from "../i18n/vocabularies";
import {
  renderPrintBundle,
  renderPrintDocument,
  type PrintCell,
  type TableDocument,
} from "./document";

/**
 * What one cell reads as on paper.
 *
 * A code is turned into its label here and only here — the database stores
 * `pass`, the page prints "Επιτυχία", and at M9 the same code prints "Pass"
 * with nothing else changing. A numeric mark and a comment are the teacher's
 * own text and print exactly as she typed them.
 */
export function displayValue(t: Translate, column: GradeColumn, raw: string): string {
  const value = raw.trim();
  if (value === "") return "";
  switch (column.kind) {
    case "descriptive":
      return t(descriptiveGradeLabel(value));
    case "pass_fail":
      return t(passFailGradeLabel(value));
    default:
      return value;
  }
}

/** The header fields both sheets carry, from the source sheet's own header. */
function sheetMeta(
  t: Translate,
  planner: Planner,
  classId: number,
  includeScale: boolean,
): TableDocument["meta"] {
  const schoolClass = planner.classes.find((c) => c.id === classId);
  const grading = gradingFor(planner, classId);
  const meta = [
    { label: t("grades.printClass"), value: schoolClass?.name.trim() || t("common.unnamed") },
    { label: t("grades.printSubject"), value: schoolClass?.subject.trim() || "—" },
    { label: t("grades.printPeriod"), value: grading.period.trim() || "—" },
    { label: t("grades.printTeacher"), value: schoolClass?.responsible.trim() || "—" },
  ];
  if (includeScale) {
    meta.push(
      { label: t("grades.printScale"), value: `0–${formatAverage(grading.scale_max)}` },
      { label: t("grades.printBase"), value: formatAverage(grading.pass_threshold) },
    );
  }
  return meta;
}

function footer(t: Translate, today: string): string {
  return `${t("app.title")} · ${t("grades.printedOn", { date: formatDate(today) })}`;
}

/** The weight shown in the sheet's ΒΑΡΥΤΗΤΑ row: a percentage, or blank. */
function weightText(column: GradeColumn): string {
  if (!isNumericColumn(column) || column.weight === null) return "";
  return `${formatAverage(column.weight)}%`;
}

/**
 * The gradebook: one row per student, one column per assessment, then the
 * average and the whole-number suggestion.
 *
 * The weight row sits directly under the column headers, as it does in the
 * source registry, so a teacher reading the printout can see what produced the
 * average in the last column.
 */
export function gradeSheetDocument(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): TableDocument {
  const columns = columnsFor(planner, classId);
  const roster = classRoster(planner, classId);
  const results = resultsFor(planner, classId);

  const head: PrintCell[] = [
    { text: t("grades.rosterNo"), align: "center" },
    { text: t("common.name"), wide: true },
    ...columns.map((c) => ({ text: c.label.trim() || t("grades.noValue"), align: "center" as const })),
    { text: t("grades.printAverage"), align: "center", strong: true },
    { text: t("grades.suggestion"), align: "center", strong: true },
  ];

  const subHead: PrintCell[] = [
    { text: "" },
    { text: t("grades.printWeightRow"), muted: true },
    ...columns.map((c) => ({ text: weightText(c), align: "center" as const, muted: true })),
    { text: "" },
    { text: "" },
  ];

  const rows = roster.map((entry, index) => {
    const result = results.find((r) => r.student_id === entry.student.id);
    return [
      { text: String(entry.enrollment.roster_no || index + 1), align: "center" as const },
      { text: entry.student.full_name, wide: true },
      ...columns.map((column) => ({
        text: displayValue(t, column, valueOf(planner, column.id, entry.student.id)),
        align: "center" as const,
      })),
      {
        text: result ? formatAverage(result.average) : t("grades.noValue"),
        align: "center" as const,
        strong: true,
      },
      {
        text: result?.suggested === null || result === undefined ? "" : String(result.suggested),
        align: "center" as const,
        strong: true,
      },
    ];
  });

  return {
    title: t("grades.sheet"),
    meta: sheetMeta(t, planner, classId, true),
    table: { head, subHead, rows },
    note: t("grades.printNote"),
    footer: footer(t, today),
  };
}

/**
 * The conduct sheet, kept as its own page exactly as the source product keeps
 * it.
 *
 * The overall-result column prints whatever the teacher wrote there and
 * nothing else: it is never derived from the conduct level, from the average,
 * or from anything else the app knows.
 */
export function conductSheetDocument(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): TableDocument {
  const roster = classRoster(planner, classId);

  const head: PrintCell[] = [
    { text: t("grades.rosterNo"), align: "center" },
    { text: t("common.name"), wide: true },
    { text: t("grades.conduct") },
    { text: t("grades.overallResult") },
    { text: t("grades.observations"), wide: true },
  ];

  const rows = roster.map((entry, index) => {
    const row = rowFor(planner, classId, entry.student.id);
    return [
      { text: String(entry.enrollment.roster_no || index + 1), align: "center" as const },
      { text: entry.student.full_name, wide: true },
      { text: row.conduct === "" ? "" : t(conductLabel(row.conduct)) },
      { text: row.overall_result },
      { text: row.observations, wide: true },
    ];
  });

  return {
    title: t("grades.printConductTitle"),
    meta: sheetMeta(t, planner, classId, false),
    table: { head, rows },
    footer: footer(t, today),
  };
}

export function gradeSheetHtml(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): string {
  return renderPrintDocument(gradeSheetDocument(t, planner, classId, today));
}

/**
 * The grade sheet and the conduct sheet as **one** PDF (M10).
 *
 * M2 printed them as two files, matching the source's two pages, and asked
 * whether they should be one; the product owner's answer on 2026-09-25 is that
 * they should. They stay two *documents* — each with its own header, each
 * starting a page of its own — bundled into one file by M7's
 * `renderPrintBundle()`, which is why this needed no new machinery: both are
 * landscape, and a bundle carries one orientation. The conduct sheet keeps its
 * own button for printing it alone.
 */
export function gradeAndConductHtml(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): string {
  return renderPrintBundle([
    gradeSheetDocument(t, planner, classId, today),
    conductSheetDocument(t, planner, classId, today),
  ]);
}

export function conductSheetHtml(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): string {
  return renderPrintDocument(conductSheetDocument(t, planner, classId, today));
}

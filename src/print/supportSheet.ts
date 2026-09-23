/**
 * The printed cross-class support overview.
 *
 * The source page is "Στήριξη και προσαρμογές — Μαθητές με προσαρμογές ή δικό
 * τους πλάνο · ετήσια επισκόπηση", with columns `Μαθητής | Τάξη | Είδος
 * στήριξης | Προσαρμογές / Στήριξη | Αξιολόγηση | Πλάνο` and a page-level box,
 * "ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ".
 *
 * **The sheet prints seven columns, not the source's six.** The seventh is the
 * screen's "Στήριξη ανά τμήμα": M4 established — and the spec's Resolved table
 * records — that a "card-level support flag" is *two* different flags,
 * `Student.sen_status` and each class's `Enrollment.support` with its own note,
 * and that the overview needs both shown separately. Folding one into the other
 * for print would make the paper disagree with the screen, which is the one
 * thing M4.5's second acceptance criterion forbids.
 *
 * **A plan's status prints as the teacher typed it, and nothing here reads a
 * goal.** The spec calls that field "written by the teacher, never computed",
 * and this file imports neither [`goalsOfPlan`] nor `goalSummary`: there is no
 * "3/4 goals met", no derived status, and no colour by progress. The `Πλάνο`
 * column is her sentence and the `Αξιολόγηση` column is the date she set.
 */
import { formatDate } from "../domain/dates";
import { supportOverview, type SupportOverviewRow } from "../domain/support";
import type { Planner } from "../domain/types";
import type { Translate } from "../i18n";
import { senStatusLabel } from "../i18n/vocabularies";
import { renderPrintDocument, type PrintCell, type TableDocument } from "./document";
import { printFooter } from "./sheetParts";

/** Several values in one cell, one per line, as the screen stacks them. */
function stacked(values: string[]): string {
  return values.join("\n");
}

function classesText(row: SupportOverviewRow, t: Translate): string {
  return row.classes.map((c) => c.name.trim() || t("common.unnamed")).join(", ");
}

function classSupportText(row: SupportOverviewRow, t: Translate): string {
  if (row.supportClasses.length === 0) return "";
  return stacked(
    row.supportClasses.map(({ schoolClass, note }) => {
      const name = schoolClass.name.trim() || t("common.unnamed");
      return note.trim() ? `${name} — ${note.trim()}` : name;
    }),
  );
}

export function supportOverviewDocument(
  t: Translate,
  planner: Planner,
  today: string,
): TableDocument {
  const rows = supportOverview(planner);

  const head: PrintCell[] = [
    { text: t("overview.student"), width: "15%" },
    { text: t("overview.classes"), width: "9%" },
    { text: t("overview.senStatus"), width: "13%" },
    { text: t("overview.classSupport"), width: "16%" },
    { text: t("overview.accommodations"), width: "17%" },
    { text: t("overview.printAssessment"), width: "11%" },
    { text: t("overview.printPlan"), width: "19%" },
  ];

  const body = rows.map((row) => [
    { text: row.student.full_name.trim() || t("common.unnamed") },
    { text: classesText(row, t) },
    { text: t(senStatusLabel(row.senStatus)) },
    { text: classSupportText(row, t) },
    { text: row.accommodations },
    // Each plan's next review date, in the same order as its status beside it.
    { text: stacked(row.plans.map((p) => (p.next_review ? formatDate(p.next_review) : ""))) },
    // The teacher's own sentence, exactly as typed. Nothing derives it.
    { text: stacked(row.plans.map((p) => p.status)) },
  ]);

  return {
    title: t("overview.heading"),
    meta: [{ label: t("overview.printStudents"), value: String(rows.length) }],
    table: { head, rows: body },
    boxes: [
      {
        // The one box on this page that the app does store something for: each
        // plan's own collaboration note, copied verbatim and attributed.
        caption: t("overview.printCollaboration"),
        lines: rows.flatMap((row) =>
          row.plans
            .filter((p) => p.collaboration.trim() !== "")
            .map(
              (p) =>
                `${row.student.full_name.trim() || t("common.unnamed")}: ${p.collaboration.trim()}`,
            ),
        ),
        emptyText: t("print.boxEmpty"),
      },
    ],
    note: `${t("overview.printSubtitle")} · ${t("overview.printNote")}`,
    footer: printFooter(t, today),
  };
}

export function supportOverviewHtml(t: Translate, planner: Planner, today: string): string {
  return renderPrintDocument(supportOverviewDocument(t, planner, today));
}

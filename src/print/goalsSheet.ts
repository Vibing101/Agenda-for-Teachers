/**
 * M1's six annual goals, "printed as one table" (M10).
 *
 * The spec's module 1 says the six fixed areas are "printed as one table", and
 * its "PDF output" section names "annual goals" among the surfaces that produce
 * a real file. M1 predated the print machinery; M6 checked that the phrase
 * means these six and not M6's annual *plan*, and raised it. The product owner
 * answered yes on 2026-09-25.
 *
 * One row per area, in the order the cards are shown (`annualGoalsInOrder`),
 * and one column per field the card has. **It prints what the six cards show**
 * — the screen's own draft, the rule M4.5 set: what prints is what the teacher
 * is looking at. Every cell is her text verbatim; the area is a code turned
 * into its label, the deadline a date formatted by the app; `status` stays her
 * sentence (Resolved: free text). Nothing is computed.
 *
 * Landscape: seven columns of prose do not fit a portrait sheet, and the other
 * tables this app prints are landscape too.
 */
import { formatDate } from "../domain/dates";
import { annualGoalsInOrder } from "../domain/schoolYear";
import type { AnnualGoal, SchoolYear } from "../domain/types";
import type { Translate } from "../i18n";
import { goalAreaLabel } from "../i18n/vocabularies";
import { renderPrintDocument, type PrintCell, type TableDocument } from "./document";
import { printFooter } from "./sheetParts";

export function goalsSheetDocument(
  t: Translate,
  goals: readonly AnnualGoal[],
  year: SchoolYear,
  today: string,
): TableDocument {
  const head: PrintCell[] = [
    { text: t("goalsSheet.area"), width: "13%" },
    { text: t("year.goal"), width: "16%" },
    { text: t("year.goalActions"), width: "16%" },
    { text: t("year.goalIndicators"), width: "15%" },
    { text: t("year.goalDeadline"), width: "10%", nowrap: true },
    { text: t("year.goalStatus"), width: "12%" },
    { text: t("year.goalReview"), width: "18%" },
  ];
  const rows: PrintCell[][] = annualGoalsInOrder(goals).map((g) => [
    { text: t(goalAreaLabel(g.area)), strong: true },
    { text: g.goal },
    { text: g.actions },
    { text: g.success_indicators },
    { text: g.deadline ? formatDate(g.deadline) : "", nowrap: true },
    { text: g.status },
    { text: g.review },
  ]);

  return {
    title: t("year.goals"),
    subtitle: t("year.goalsIntro"),
    meta: [
      {
        label: t("goalsSheet.yearStart"),
        value: year.start_date ? formatDate(year.start_date) : "—",
      },
    ],
    table: { head, rows },
    note: t("goalsSheet.note"),
    footer: printFooter(t, today),
  };
}

export function goalsSheetHtml(
  t: Translate,
  goals: readonly AnnualGoal[],
  year: SchoolYear,
  today: string,
): string {
  return renderPrintDocument(goalsSheetDocument(t, goals, year, today));
}

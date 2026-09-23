/**
 * The printed behaviour/incident register.
 *
 * The source page is "Διαγωγή και περιστατικά — Σημαντικά περιστατικά και
 * σημειώσεις · κατάλληλο για επίσημη τεκμηρίωση", a flat register with columns
 * `Ημερομηνία | Μαθητής | Τάξη | Τι συνέβη | Ενέργεια που έγινε | Γονείς
 * ενημερώθηκαν` and one page-level box, "ΠΡΟΣΘΕΤΕΣ ΣΗΜΕΙΩΣΕΙΣ".
 *
 * **What prints is what the teacher is looking at, filter included.** The spec
 * calls this register "filterable, printable", and a sheet that silently
 * printed everything — or silently printed something else — would be worse
 * than no sheet at all. So the rows come from [`filteredIncidents`], the same
 * selector the screen renders from, and the filter itself is printed in the
 * sheet's header so the paper says what it is a register *of*.
 *
 * **Nothing here is computed.** Every cell is a stored field printed as it is,
 * with a code turned into its label and a date formatted by the app. The count
 * in the header counts the rows on this sheet and nothing else.
 */
import { formatDate } from "../domain/dates";
import {
  classOf,
  filteredIncidents,
  studentOf,
  type IncidentFilter,
} from "../domain/behaviour";
import type { Planner } from "../domain/types";
import type { Translate } from "../i18n";
import { renderPrintDocument, type PrintCell, type PrintDocument } from "./document";
import { printFooter, tickText } from "./sheetParts";

/**
 * How the sheet's header names the filter it was printed under.
 *
 * A filter of `0` prints as "Όλα", so the paper distinguishes "every entry" from
 * "the entries of one student who happens to have them all".
 */
function filterValue(t: Translate, name: string | null): string {
  return name ?? t("print.filterAll");
}

export function incidentSheetDocument(
  t: Translate,
  planner: Planner,
  filter: IncidentFilter,
  today: string,
): PrintDocument {
  const rows = filteredIncidents(planner, filter);

  const filterStudent = planner.students.find((s) => s.id === filter.studentId);
  const filterClass = planner.classes.find((c) => c.id === filter.classId);

  const head: PrintCell[] = [
    { text: t("common.date"), width: "11%" },
    { text: t("behaviour.student"), width: "16%" },
    { text: t("behaviour.class"), width: "9%" },
    { text: t("behaviour.whatHappened"), width: "25%" },
    { text: t("behaviour.actionTaken"), width: "25%" },
    { text: t("behaviour.parentsInformed"), align: "center", width: "14%" },
  ];

  const table = rows.map((incident) => {
    const student = studentOf(planner, incident);
    const schoolClass = classOf(planner, incident);
    return [
      { text: incident.date ? formatDate(incident.date) : "" },
      { text: student?.full_name.trim() || t("common.unnamed") },
      { text: schoolClass?.name.trim() ?? "" },
      { text: incident.what_happened },
      { text: incident.action_taken },
      { text: tickText(t, incident.parents_informed), align: "center" as const },
    ];
  });

  return {
    title: t("behaviour.heading"),
    meta: [
      {
        label: t("behaviour.printFilterStudent"),
        value: filterValue(t, filterStudent?.full_name.trim() || null),
      },
      {
        label: t("behaviour.printFilterClass"),
        value: filterValue(t, filterClass?.name.trim() || null),
      },
      { label: t("behaviour.printCount"), value: String(rows.length) },
    ],
    table: { head, rows: table },
    // The source page's box has no field behind it — M4.5 adds none — so it
    // prints as the ruled space it is on the source's own paper.
    boxes: [
      {
        caption: t("behaviour.printExtraNotes"),
        lines: [],
        emptyText: t("print.boxEmpty"),
      },
    ],
    note: `${t("behaviour.printSubtitle")} · ${t("behaviour.printNote")}`,
    footer: printFooter(t, today),
  };
}

export function incidentSheetHtml(
  t: Translate,
  planner: Planner,
  filter: IncidentFilter,
  today: string,
): string {
  return renderPrintDocument(incidentSheetDocument(t, planner, filter, today));
}

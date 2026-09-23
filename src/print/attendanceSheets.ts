/**
 * The two printed attendance sheets, which are two registers and not one.
 *
 * * [`absenceRegisterDocument`] is the source's "Απουσίες και καθυστερήσεις —
 *   Μητρώο · μία γραμμή για κάθε απουσία ή καθυστέρηση", one line per stored
 *   `absence_event`.
 * * [`monthCardDocument`] is the source's "Απουσίες του μήνα", the roster
 *   against the days of one month, one symbol per cell, filled from stored
 *   `attendance_mark` rows.
 *
 * **They are as independent on paper as they are in the database, and this file
 * is where that could most easily have been broken.** M4's first acceptance
 * criterion is that the grid and the register hold different, non-derived data
 * for the same student and day, and M4.5's fourth is that the printed pair stays
 * that way. So: `absenceRegisterDocument` reads `absence_events` through
 * [`eventsOfClass`] and never touches a mark; `monthCardDocument` reads
 * `attendance_marks` through [`monthRows`] and [`monthTotals`] and never touches
 * an event. Neither sheet carries a figure the other produced, and each says so
 * in its own note — because printing them on the same afternoon is exactly what
 * would otherwise imply they agree.
 *
 * The fixture that proves it is M4's own: Ελένη is `present` in the grid on
 * 05.11 and carries a logged late arrival on 05.11 in the register. Both sheets
 * print their own version, unchanged.
 */
import {
  eventsOfClass,
  monthDays,
  monthRows,
  monthTotals,
  type AbsenceEvent,
} from "../domain/attendance";
import { dayOfMonth, formatDate, monthOf } from "../domain/dates";
import { gradingFor } from "../domain/gradebook";
import type { Planner, Student } from "../domain/types";
import type { Translate } from "../i18n";
import {
  absenceKindShortLabel,
  ABSENCE_KINDS,
  ATTENDANCE_STATES,
  attendanceStateLabel,
  attendanceSymbolLabel,
  followUpLabel,
  monthLabel,
} from "../i18n/vocabularies";
import { renderPrintDocument, type PrintCell, type TableDocument } from "./document";
import { boxLine, printFooter, tickText } from "./sheetParts";

/** The header the source register carries: ΤΑΞΗ / ΜΑΘΗΜΑ / ΠΕΡΙΟΔΟΣ. */
function classMeta(t: Translate, planner: Planner, classId: number): TableDocument["meta"] {
  const schoolClass = planner.classes.find((c) => c.id === classId);
  return [
    { label: t("grades.printClass"), value: schoolClass?.name.trim() || t("common.unnamed") },
    { label: t("grades.printSubject"), value: schoolClass?.subject.trim() || "—" },
    // M2's own per-class caption, reused rather than a second period field
    // invented for this sheet. M4.5 adds no stored state.
    { label: t("grades.printPeriod"), value: gradingFor(planner, classId).period.trim() || "—" },
  ];
}

function studentName(t: Translate, planner: Planner, studentId: number): string {
  const student: Student | undefined = planner.students.find((s) => s.id === studentId);
  return student?.full_name.trim() || t("common.unnamed");
}

// ------------------------------------------- the detailed absence register ---

/**
 * The register: one line per absence or late arrival, in the source's own
 * column order.
 *
 * `Απ.` and `Καθ.` are the source's two tick columns, and they are the stored
 * `kind` code shown in the shape the source page shows it — a tick under one of
 * two headings — not a count and not a judgement. `Δικ.` is the event's own
 * `justified` flag, which the spec puts on the event and not on the grid.
 *
 * The two page-level boxes hold fields M4 stores **per event**, because the
 * spec lists them among the event's own fields while the source page gives them
 * one box each at the foot of the sheet. They are printed as what they are:
 * each event's own note, verbatim, attributed to the student and date it was
 * written against. Nothing is totalled, and the app never decides that an
 * absence is "frequent" — the teacher wrote that, or she did not.
 */
export function absenceRegisterDocument(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): TableDocument {
  const events = eventsOfClass(planner, classId);

  const head: PrintCell[] = [
    { text: t("absences.printNo"), align: "center", width: "5%" },
    { text: t("common.date"), width: "11%" },
    { text: t("absences.clockTime"), align: "center", width: "7%" },
    { text: t("absences.student"), width: "20%" },
    { text: t(absenceKindShortLabel("absence")), align: "center", width: "6%" },
    { text: t(absenceKindShortLabel("late")), align: "center", width: "6%" },
    { text: t("absences.printJustified"), align: "center", width: "6%" },
    { text: t("absences.reason"), width: "39%" },
  ];

  const rows = events.map((event, index) => [
    { text: String(index + 1), align: "center" as const, muted: true },
    { text: event.date ? formatDate(event.date) : "" },
    { text: event.clock_time, align: "center" as const },
    { text: studentName(t, planner, event.student_id) },
    ...ABSENCE_KINDS.map((kind) => ({
      text: tickText(t, event.kind === kind),
      align: "center" as const,
    })),
    { text: tickText(t, event.justified), align: "center" as const },
    { text: reasonText(event) },
  ]);

  return {
    title: t("absences.heading"),
    meta: classMeta(t, planner, classId),
    table: { head, rows },
    boxes: [
      {
        caption: t("absences.printFrequent"),
        lines: events
          .filter((e) => e.frequent_note.trim() !== "")
          .map((e) =>
            boxLine(t, studentName(t, planner, e.student_id), e.date, e.frequent_note.trim()),
          ),
        emptyText: t("print.boxEmpty"),
      },
      {
        caption: t("absences.printFollowUp"),
        lines: events
          .filter((e) => e.follow_up !== "")
          .map((e) =>
            boxLine(t, studentName(t, planner, e.student_id), e.date, t(followUpLabel(e.follow_up))),
          ),
        emptyText: t("print.boxEmpty"),
      },
    ],
    note: `${t("absences.printSubtitle")} · ${t("absences.printNote")}`,
    footer: printFooter(t, today),
  };
}

/** The teaching hour is part of the source's "Αιτία / Σημείωση" column's line. */
function reasonText(event: AbsenceEvent): string {
  const hour = event.teaching_hour.trim();
  const reason = event.reason.trim();
  if (hour === "") return reason;
  return reason === "" ? hour : `${hour} — ${reason}`;
}

export function absenceRegisterHtml(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): string {
  return renderPrintDocument(absenceRegisterDocument(t, planner, classId, today));
}

// ------------------------------------------------- the monthly attendance card ---

/**
 * The source's "Απουσίες του μήνα": the roster down the side, the days of the
 * month across the top, one of the source's four symbols per cell, and the
 * month's totals per student at the right.
 *
 * **Why this sheet exists at all is a decision M4.5 was asked to take**, and it
 * is recorded in the spec's Resolved table and in the release note: the *blank*
 * grid is one of M7's eleven print forms, but a *filled* month for a real class
 * is a print view over live M4 data, which is a different artefact and is what
 * this milestone is for. M7 still owns the blank fillable form.
 *
 * It is the widest table this app draws — up to 31 day columns plus four totals
 * — so it is a landscape sheet with explicit column widths and a tighter table,
 * and it is the sheet most worth a human's eyes.
 *
 * **Every number on it is counted from marks alone.** [`monthTotals`] reads the
 * row's own marks and nothing else; no absence event reaches this sheet.
 */
export function monthCardDocument(
  t: Translate,
  planner: Planner,
  classId: number,
  month: string,
  today: string,
): TableDocument {
  const days = monthDays(month);
  const rows = monthRows(planner, classId, month);

  // 3% + 15% + the days' share + 4 totals at 4% leaves the day columns the rest
  // of the sheet, which is what keeps a 31-day month on one landscape page.
  const dayWidth = `${(66 / Math.max(days.length, 1)).toFixed(3)}%`;

  const head: PrintCell[] = [
    { text: t("attendance.rosterNo"), align: "center", width: "3%" },
    { text: t("attendance.roster"), width: "15%" },
    ...days.map((day) => ({
      text: String(dayOfMonth(day)),
      align: "center" as const,
      width: dayWidth,
    })),
    ...ATTENDANCE_STATES.map((state) => ({
      text: t(attendanceSymbolLabel(state)),
      align: "center" as const,
      strong: true,
      width: "4%",
    })),
  ];

  const body = rows.map((row) => {
    const totals = monthTotals(row);
    return [
      { text: String(row.rosterNo), align: "center" as const, muted: true },
      { text: row.student.full_name.trim() || t("common.unnamed") },
      ...row.marks.map((mark) => ({
        text: mark ? t(attendanceSymbolLabel(mark.state)) : "",
        align: "center" as const,
      })),
      ...ATTENDANCE_STATES.map((state) => ({
        text: totals[state] ? String(totals[state]) : "",
        align: "center" as const,
        strong: true,
      })),
    ];
  });

  const key = ATTENDANCE_STATES.map(
    (state) => `${t(attendanceSymbolLabel(state))} ${t(attendanceStateLabel(state))}`,
  ).join(" · ");

  return {
    title: t("attendance.heading"),
    meta: [
      ...classMeta(t, planner, classId).slice(0, 2),
      {
        label: t("attendance.printMonth"),
        value: `${t(monthLabel(monthOf(month)))} ${month.slice(0, 4)}`,
      },
    ],
    table: { head, rows: body },
    dense: true,
    note: `${t("attendance.printSymbols", { key })} · ${t("attendance.printNote")}`,
    footer: printFooter(t, today),
  };
}

export function monthCardHtml(
  t: Translate,
  planner: Planner,
  classId: number,
  month: string,
  today: string,
): string {
  return renderPrintDocument(monthCardDocument(t, planner, classId, month, today));
}

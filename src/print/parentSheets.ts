/**
 * The printed parent communication log and the printed appointment week.
 *
 * Both are tables, built the way M2 and M4.5 built theirs: a pure function of
 * `(t, planner, …, today)` returning a `PrintDocument`, with nothing computed.
 * Every cell is a stored field printed as it is, with a code turned into its
 * label and a date formatted by the app.
 *
 * **The two sheets are independent of each other, by construction.**
 * [`contactLogDocument`] reads `filteredContacts` and nothing else;
 * [`appointmentWeekDocument`] reads `appointmentWeek` and nothing else. Neither
 * selector is in the other's call path, so neither sheet can derive a figure
 * from the other's table — which is M5's second acceptance criterion held the
 * same way M4.5 held M4's, and tested the same way: push rows into one register
 * and assert the other's whole document compares equal.
 *
 * **What prints is what the teacher is looking at.** The log's rows come from
 * `filteredContacts`, the same selector the screen renders from, and the filter
 * is named in the sheet's own header — the rule M4.5 resolved after finding
 * that two functions agreeing today are not one function.
 */
import { formatDate } from "../domain/dates";
import {
  appointmentStudent,
  appointmentWeek,
  contactStudent,
  filteredContacts,
  type ContactFilter,
} from "../domain/parents";
import type { Planner } from "../domain/types";
import {
  appointmentModeLabel,
  appointmentStatusLabel,
  contactFormatLabel,
  weekdayLabel,
} from "../i18n/vocabularies";
import { renderPrintDocument, type PrintCell, type TableDocument } from "./document";
import { boxLine, printFooter } from "./sheetParts";
import type { Translate } from "../i18n";

/**
 * A vocabulary code as its label, and a blank as a blank.
 *
 * The same rule as `gradeSheets.ts`'s `displayValue`: the database stores the
 * code and the paper prints the label, so a language switch at M9 reaches the
 * printed page without touching a teacher's data.
 */
function label(t: Translate, id: ReturnType<typeof contactFormatLabel>): string {
  return t(id);
}

/** How the header names the filter. `0` prints as "Όλα", never as a blank. */
function filterValue(t: Translate, name: string | null): string {
  return name ?? t("print.filterAll");
}

/**
 * The communication log — the source's "Επικοινωνία με τους γονείς · Μητρώο
 * επικοινωνιών · κατάλληλο για επίσημη τεκμηρίωση", whose columns are
 * `Ημερομηνία | Μαθητής | Ποιος | Μορφή | Αιτία | Συμφωνίες | Επόμενα` over a
 * page-level `ΠΑΡΑΤΗΡΗΣΕΙΣ` box.
 *
 * The extra column against the source's seven is `Έκβαση`, which the spec's own
 * field list names ("outcome") and the source page does not have. Recorded in
 * the release note as a deliberate departure rather than an oversight.
 *
 * The `ΠΑΡΑΤΗΡΗΣΕΙΣ` box lists each line's own stored `remarks`, verbatim and
 * attributed — the shape M4.5 resolved for a source page's captioned box, and
 * it inherits M4.5's open question about how that reads at volume.
 */
export function contactLogDocument(
  t: Translate,
  planner: Planner,
  filter: ContactFilter,
  today: string,
): TableDocument {
  const rows = filteredContacts(planner, filter);
  const filterStudent = planner.students.find((s) => s.id === filter.studentId);
  const filterClass = planner.classes.find((c) => c.id === filter.classId);

  // Widths set from a real rendered sheet rather than guessed: at the first
  // pass the outcome and next-step columns were 9% each and broke a sentence
  // mid-word ("Συνεννοηθ/ήκαμε"), which is what eight columns of Greek on a
  // landscape sheet costs. The four narrative columns now share 58% evenly.
  const head: PrintCell[] = [
    { text: t("common.date"), width: "10%" },
    { text: t("contacts.student"), width: "13%" },
    { text: t("contacts.guardian"), width: "13%" },
    { text: t("contacts.format"), width: "9%" },
    { text: t("contacts.reason"), width: "14%" },
    { text: t("contacts.agreements"), width: "15%" },
    { text: t("contacts.outcome"), width: "13%" },
    { text: t("contacts.nextStep"), width: "13%" },
  ];

  const table = rows.map((contact) => {
    const student = contactStudent(planner, contact);
    return [
      { text: contact.date ? formatDate(contact.date) : "", nowrap: true },
      { text: student?.full_name.trim() || t("common.unnamed") },
      { text: contact.guardian },
      { text: label(t, contactFormatLabel(contact.format)), nowrap: true },
      { text: contact.reason },
      { text: contact.agreements },
      { text: contact.outcome },
      { text: contact.next_step },
    ];
  });

  const remarks = rows
    .filter((c) => c.remarks.trim())
    .map((c) =>
      boxLine(
        t,
        contactStudent(planner, c)?.full_name.trim() || t("common.unnamed"),
        c.date,
        c.remarks,
      ),
    );

  return {
    title: t("contacts.heading"),
    meta: [
      {
        label: t("contacts.printFilterStudent"),
        value: filterValue(t, filterStudent?.full_name.trim() || null),
      },
      {
        label: t("contacts.printFilterClass"),
        value: filterValue(t, filterClass?.name.trim() || null),
      },
      { label: t("contacts.printCount"), value: String(rows.length) },
    ],
    table: { head, rows: table },
    boxes: [
      {
        caption: t("contacts.printRemarks"),
        lines: remarks,
        emptyText: t("print.boxEmpty"),
      },
    ],
    note: `${t("contacts.printSubtitle")} · ${t("contacts.independent")}`,
    footer: printFooter(t, today),
  };
}

export function contactLogHtml(
  t: Translate,
  planner: Planner,
  filter: ContactFilter,
  today: string,
): string {
  return renderPrintDocument(contactLogDocument(t, planner, filter, today));
}

/**
 * The weekly appointment grid — the source's "Συναντήσεις με γονείς · Οι
 * εβδομαδιαίες συναντήσεις", an `Ώρα × Δευτέρα–Παρασκευή` sheet.
 *
 * **One row per clock time the week actually uses**, as on screen: the grid is
 * as tall as the teacher's week rather than a fixed ladder of hours, which is
 * what `appointmentWeek` builds and what this prints. A cell holds the guardian
 * and — under her — the student, the mode and the status, because the source's
 * own cell is one free-text box and this app has the parts separately.
 *
 * Landscape, like the source page, and like every register this app prints.
 */
export function appointmentWeekDocument(
  t: Translate,
  planner: Planner,
  anyDayInWeek: string,
  today: string,
): TableDocument {
  const week = appointmentWeek(planner, anyDayInWeek);

  const head: PrintCell[] = [
    { text: t("appointments.time"), width: "10%" },
    ...week.days.map((day, i) => ({
      text: `${t(weekdayLabel(i + 1))} ${formatDate(day)}`,
      width: "18%",
    })),
  ];

  const rows = week.times.map((time) => [
    { text: time, strong: true, nowrap: true },
    ...week.days.map((day) => {
      const appointment = week.cells.get(`${day} ${time}`);
      if (!appointment) return { text: "" };
      const student = appointmentStudent(planner, appointment);
      // Stacked lines rather than more columns: the source's cell is one box,
      // and the stylesheet keeps a cell's own line breaks (`white-space:
      // pre-line`), so this reads as the source page does.
      const lines = [
        appointment.guardian,
        student?.full_name.trim() ?? "",
        appointment.topic,
        [
          t(appointmentModeLabel(appointment.mode)),
          t(appointmentStatusLabel(appointment.status)),
          appointment.place,
        ]
          .filter(Boolean)
          .join(" · "),
        appointment.outcome,
      ].filter((line) => line.trim());
      return { text: lines.join("\n") };
    }),
  ]);

  return {
    title: t("appointments.heading"),
    meta: [
      { label: t("appointments.printWeek"), value: formatDate(week.days[0]) },
      { label: t("appointments.printCount"), value: String(week.appointments.length) },
    ],
    table: { head, rows },
    note: `${t("appointments.printSubtitle")} · ${t("contacts.independent")}`,
    footer: printFooter(t, today),
  };
}

export function appointmentWeekHtml(
  t: Translate,
  planner: Planner,
  anyDayInWeek: string,
  today: string,
): string {
  return renderPrintDocument(appointmentWeekDocument(t, planner, anyDayInWeek, today));
}

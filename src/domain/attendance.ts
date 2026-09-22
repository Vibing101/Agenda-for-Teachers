/**
 * Attendance, in the two shapes the spec deliberately keeps apart.
 *
 * **The monthly grid and the detailed register are independent, and nothing
 * here derives one from the other.** The spec says so twice — "Deliberately
 * independent of AttendanceRecord (a teacher may use either or both)" and
 * "nothing derives one from the other" — and it is M4's first acceptance
 * criterion. So there is no function in this file that reads an
 * `AbsenceEvent` to produce a mark, or a mark to produce an event; the two
 * halves below touch different arrays and never meet. [`monthTotals`] counts
 * marks only, and [`eventsOfClass`] counts nothing at all.
 *
 * **A mark is keyed by `(class, student, actual date)`.** There is no month
 * column, no year column and no day-of-month index anywhere — the month grid
 * is a *view*, built here from M3's [`monthGrid`], exactly as a week number is
 * derived rather than stored. The source product prints one card per month with
 * columns numbered 1–31, and keying the table by the column it prints would be
 * the same mistake the spec spent M1 ruling out: correcting the school year
 * would move data that should never move.
 */
import { monthGrid } from "./agenda";
import { monthOf } from "./dates";
import type { AbsenceKind, AttendanceState, FollowUpStatus } from "../i18n/vocabularies";
import type { Planner, SchoolClass, Student } from "./types";

/**
 * One cell of the monthly grid: what one student was, in one class, on one
 * actual day.
 *
 * An unmarked day has **no record at all** rather than a blank state, which is
 * what keeps "she has not said" different from "present".
 */
export interface AttendanceMark {
  class_id: number;
  student_id: number;
  /** `YYYY-MM-DD` — an actual date, never an index into a month. */
  date: string;
  state: AttendanceState;
}

/**
 * One line of the detailed absence register — the source's "μία γραμμή για κάθε
 * απουσία ή καθυστέρηση".
 *
 * Every field the spec lists is here and none of them is computed: the kind,
 * the clock time, which teaching hour, the reason, whether it was justified
 * independently, how the parent follow-up stands and the frequent-absence note.
 */
export interface AbsenceEvent {
  id: number;
  class_id: number;
  student_id: number;
  date: string;
  kind: AbsenceKind;
  clock_time: string;
  teaching_hour: string;
  reason: string;
  /** The source register's `Δικ.` column — justified on its own terms. */
  justified: boolean;
  /** A follow-up code, or empty when the teacher has not said. */
  follow_up: FollowUpStatus | "";
  frequent_note: string;
}

/** A blank event, so a new line and a stored one are the same shape to edit. */
export function emptyEvent(classId: number, studentId: number): AbsenceEvent {
  return {
    id: 0,
    class_id: classId,
    student_id: studentId,
    date: "",
    kind: "absence",
    clock_time: "",
    teaching_hour: "",
    reason: "",
    justified: false,
    follow_up: "",
    frequent_note: "",
  };
}

// ----------------------------------------------- the monthly grid (view) ---

/**
 * The stored mark for one student on one day, or `null` when she has not been
 * marked. Reads `attendance_marks` and nothing else.
 */
export function markAt(
  planner: Planner,
  classId: number,
  studentId: number,
  date: string,
): AttendanceMark | null {
  return (
    planner.attendance_marks.find(
      (m) => m.class_id === classId && m.student_id === studentId && m.date === date,
    ) ?? null
  );
}

/**
 * The days of the month containing `date`, in calendar order, as the grid's
 * columns.
 *
 * Built from M3's [`monthGrid`] rather than from a second piece of month
 * arithmetic: it already lays a month out Monday-first without spilling into
 * the neighbouring month, which is exactly the property the grid's columns
 * need — 1–31 with nothing borrowed from either side.
 */
export function monthDays(date: string): string[] {
  return monthGrid(date)
    .flat()
    .filter((day): day is string => day !== null);
}

/** One row of the grid: a student and her marks for each day of the month. */
export interface AttendanceRow {
  student: Student;
  rosterNo: number;
  /** One entry per day of the month, in the same order as [`monthDays`]. */
  marks: (AttendanceMark | null)[];
}

/**
 * The class's roster against the days of the month `date` falls in.
 *
 * The roster order is the enrolment's own `roster_no`, matching the source
 * card's `Αρ.` column, so the printed and on-screen orders agree.
 */
export function monthRows(planner: Planner, classId: number, date: string): AttendanceRow[] {
  const days = monthDays(date);
  return planner.enrollments
    .filter((e) => e.class_id === classId)
    .map((e) => ({
      enrollment: e,
      student: planner.students.find((s) => s.id === e.student_id) ?? null,
    }))
    .filter((row): row is { enrollment: typeof row.enrollment; student: Student } =>
      row.student !== null,
    )
    .sort(
      (a, b) =>
        a.enrollment.roster_no - b.enrollment.roster_no ||
        a.student.full_name.localeCompare(b.student.full_name, "el"),
    )
    .map(({ enrollment, student }) => ({
      student,
      rosterNo: enrollment.roster_no,
      marks: days.map((day) => markAt(planner, classId, student.id, day)),
    }));
}

/** How many of each state one student carries in one month. */
export type MonthTotals = Record<AttendanceState, number>;

/**
 * Counts one row's marks for the month.
 *
 * **Counts marks and only marks.** It never looks at `absence_events`: a total
 * that mixed the two registers would be exactly the derivation the spec rules
 * out, and would make the grid's numbers change when the teacher edited a log
 * she was keeping separately on purpose.
 */
export function monthTotals(row: AttendanceRow): MonthTotals {
  const totals: MonthTotals = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const mark of row.marks) {
    if (mark) totals[mark.state] += 1;
  }
  return totals;
}

// ------------------------------------------- the detailed register (log) ---

/**
 * One class's absence events, in date order.
 *
 * Reads `absence_events` and nothing else — the other half of the same
 * independence. Events with no date yet sort to the end, where a line the
 * teacher has just created and not filled in belongs.
 */
export function eventsOfClass(planner: Planner, classId: number): AbsenceEvent[] {
  return [...planner.absence_events]
    .filter((e) => e.class_id === classId)
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) || a.id - b.id;
    });
}

/** Every absence event recorded for one student, across all her classes. */
export function eventsOfStudent(planner: Planner, studentId: number): AbsenceEvent[] {
  return [...planner.absence_events]
    .filter((e) => e.student_id === studentId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/** The class a screen should open on: the one it was last on, or the first. */
export function firstClass(planner: Planner): SchoolClass | null {
  return planner.classes[0] ?? null;
}

/** Whether a date falls inside the month `reference` is in — for the grid. */
export function inSameMonth(date: string, reference: string): boolean {
  return date.slice(0, 4) === reference.slice(0, 4) && monthOf(date) === monthOf(reference);
}

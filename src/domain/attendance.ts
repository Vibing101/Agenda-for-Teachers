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
 * **A mark is keyed by `(class, student, actual date, timetable hour)`**, so
 * absences are counted per lesson rather than per day. There is no month
 * column, no year column and no day-of-month index anywhere — the month grid
 * is a *view*, built here from M3's [`monthGrid`], exactly as a week number is
 * derived rather than stored. The source product prints one card per month with
 * columns numbered 1–31, and keying the table by the column it prints would be
 * the same mistake the spec spent M1 ruling out: correcting the school year
 * would move data that should never move.
 */
import { monthGrid } from "./agenda";
import { monthOf, weekdayOf } from "./dates";
import { periodsOf, type TimetablePeriod } from "./timetable";
import type { AbsenceKind, AttendanceState, FollowUpStatus } from "../i18n/vocabularies";
import type { Planner, SchoolClass, Student } from "./types";

/**
 * One cell of the monthly grid: what one student was, in one class, in one
 * lesson on one actual day.
 *
 * Absences are counted **per lesson**, so a class taught twice in a day carries
 * two marks for it. The lesson is the timetable hour (`period_id`); `0` is a
 * lesson whose hour is not known, which is what a mark from before per-lesson
 * attendance became.
 *
 * An unmarked lesson has **no record at all** rather than a blank state, which
 * is what keeps "she has not said" different from "present".
 */
export interface AttendanceMark {
  class_id: number;
  student_id: number;
  /** `YYYY-MM-DD` — an actual date, never an index into a month. */
  date: string;
  period_id: number;
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
 * The stored mark for one student in one lesson, or `null` when she has not
 * been marked. Reads `attendance_marks` and nothing else.
 */
export function markAt(
  planner: Planner,
  classId: number,
  studentId: number,
  date: string,
  periodId: number,
): AttendanceMark | null {
  return (
    planner.attendance_marks.find(
      (m) =>
        m.class_id === classId &&
        m.student_id === studentId &&
        m.date === date &&
        m.period_id === periodId,
    ) ?? null
  );
}

/**
 * The days of the month containing `date`, in calendar order.
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

/** Why a day is not a school day for this class: greyed out on the grid. */
export type DayOff = "weekend" | "holiday" | "leave";

/**
 * One lesson of one class on one date: a column of the grid.
 *
 * `period` is the timetable hour, or `null` when the mark's hour is `0`
 * ("hour unknown", from before per-lesson attendance) or has since been
 * deleted from the timetable. The mark is still shown; only its label is lost.
 */
export interface LessonSlot {
  date: string;
  periodId: number;
  period: TimetablePeriod | null;
}

/** One day of the month, with the lessons the class has on it. */
export interface DayColumn {
  date: string;
  off: DayOff | null;
  /** The holiday's own name when `off` is `holiday`, otherwise empty. */
  offName: string;
  /** In timetable order. Empty on a day the class is not taught. */
  lessons: LessonSlot[];
}

/**
 * Whether `date` is a day off for a class, and why.
 *
 * Sunday always is. Saturday is too **unless the timetable has this class on a
 * Saturday**, because the timetable runs Δευτέρα–Σάββατο and a school that
 * teaches on Saturdays should not see its own lessons greyed out. A holiday
 * (ministry or school) covers every day from its start to its end date, and a
 * leave record is the teacher's own day off.
 */
export function dayOff(
  planner: Planner,
  classId: number,
  date: string,
): { off: DayOff; name: string } | null {
  const weekday = weekdayOf(date);
  const holiday = planner.holidays.find(
    (h) => h.start_date && date >= h.start_date && date <= (h.end_date || h.start_date),
  );
  if (holiday) return { off: "holiday", name: holiday.name.trim() };
  if (planner.leave_records.some((l) => l.date === date)) return { off: "leave", name: "" };
  if (weekday === 7) return { off: "weekend", name: "" };
  if (weekday === 6 && !planner.timetable_cells.some((c) => c.weekday === 6 && c.class_id === classId)) {
    return { off: "weekend", name: "" };
  }
  return null;
}

/**
 * The grid's columns for one class and one month: every day, each carrying
 * the lessons the class has on it.
 *
 * **A lesson is a timetable hour.** On an ordinary day the lessons are the
 * hours the master timetable gives this class on that weekday — so a class
 * taught 1η and 3η on Thursdays gets two columns every Thursday. On top of
 * those, any hour that already holds a mark for this class on that date is
 * kept, so editing the timetable mid-year never hides a mark entered under the
 * old one. On a day off the timetable's hours are **not** offered — there was
 * no lesson — but marks already there still show.
 */
export function monthColumns(planner: Planner, classId: number, date: string): DayColumn[] {
  const periods = periodsOf(planner);
  const order = (id: number) => {
    const at = periods.findIndex((p) => p.id === id);
    // "Hour unknown" first, then the timetable's own order, then hours that
    // have since been deleted.
    return id === 0 ? -1 : at === -1 ? periods.length : at;
  };
  return monthDays(date).map((day) => {
    const off = dayOff(planner, classId, day);
    const ids = new Set<number>();
    if (!off) {
      for (const cell of planner.timetable_cells) {
        if (cell.class_id === classId && cell.weekday === weekdayOf(day)) ids.add(cell.period_id);
      }
    }
    for (const mark of planner.attendance_marks) {
      if (mark.class_id === classId && mark.date === day) ids.add(mark.period_id);
    }
    const lessons = [...ids]
      .sort((a, b) => order(a) - order(b) || a - b)
      .map((periodId) => ({
        date: day,
        periodId,
        period: periods.find((p) => p.id === periodId) ?? null,
      }));
    return { date: day, off: off?.off ?? null, offName: off?.name ?? "", lessons };
  });
}

/** Every lesson of the month, in column order — what one row's marks line up with. */
export function lessonsOf(columns: DayColumn[]): LessonSlot[] {
  return columns.flatMap((column) => column.lessons);
}

/** One row of the grid: a student and her marks for each lesson of the month. */
export interface AttendanceRow {
  student: Student;
  rosterNo: number;
  /** One entry per lesson of the month, in the same order as [`lessonsOf`]. */
  marks: (AttendanceMark | null)[];
}

/**
 * The class's roster against the lessons of the month `date` falls in.
 *
 * The roster order is the enrolment's own `roster_no`, matching the source
 * card's `Αρ.` column, so the printed and on-screen orders agree.
 */
export function monthRows(planner: Planner, classId: number, date: string): AttendanceRow[] {
  const lessons = lessonsOf(monthColumns(planner, classId, date));
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
      marks: lessons.map((l) => markAt(planner, classId, student.id, l.date, l.periodId)),
    }));
}

/** How many of each state one student carries in one month. */
export type MonthTotals = Record<AttendanceState, number>;

/**
 * Counts one row's marks for the month — lessons, not days.
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

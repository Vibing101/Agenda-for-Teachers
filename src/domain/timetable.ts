/**
 * The teacher's master timetable: her named hours, and what she is doing in
 * each one.
 *
 * **This is the single register of the teacher's week.** M1 shipped a per-class
 * timetable and M3 replaced it with this one rather than adding a second one
 * beside it, for three reasons the spec forces:
 *
 * * a **cover or a duty** belongs to no class at all, so it cannot live in a
 *   per-class table;
 * * the spec calls the link to a class **optional**, and says it "fills
 *   subject/room" — i.e. the cell is the record and the class is a pointer;
 * * the Today view reads "from the master timetable", and one register is the
 *   only way it cannot list the same class twice.
 *
 * So a class's own hours are **derived** here ([`hoursOfClass`]) from the cells
 * that point at it. Nothing is typed twice, and nothing can disagree.
 */
import { weekdayOf } from "./dates";
import type { Planner, SchoolClass } from "./types";

/** One named hour of the week — a row of the grid, shared by every weekday. */
export interface TimetablePeriod {
  id: number;
  position: number;
  name: string;
  start_time: string;
  end_time: string;
}

/** What the teacher is doing in one hour on one weekday. */
export interface TimetableCell {
  period_id: number;
  /** 1 = Monday … 6 = Saturday. */
  weekday: number;
  /** The optional link to a class. `null` for a cover, a duty or a free hour. */
  class_id: number | null;
  /** Used when no class is linked; otherwise the class's subject is shown. */
  subject: string;
  /** An override. Empty means "the linked class's room". */
  room: string;
  /** "Αναπληρώσεις και άλλα καθήκοντα" — the cover or duty in this hour. */
  duty: string;
  notes: string;
}

/** A cell resolved for display: the class looked up, subject and room filled. */
export interface ScheduledHour {
  period: TimetablePeriod;
  cell: TimetableCell;
  weekday: number;
  /** The linked class, or `null` for a duty, a cover or a free-text hour. */
  schoolClass: SchoolClass | null;
  /** The cell's own subject, or the linked class's. */
  subject: string;
  /** The cell's own room override, or the linked class's room. */
  room: string;
}

export function periodsOf(planner: Planner): TimetablePeriod[] {
  return [...planner.timetable_periods].sort((a, b) => a.position - b.position || a.id - b.id);
}

/** The stored cell for one (hour, weekday), or `null` when the hour is free. */
export function cellAt(planner: Planner, periodId: number, weekday: number): TimetableCell | null {
  return (
    planner.timetable_cells.find((c) => c.period_id === periodId && c.weekday === weekday) ?? null
  );
}

/** A blank cell, so "free hour" and "filled hour" are the same shape to edit. */
export function emptyCell(periodId: number, weekday: number): TimetableCell {
  return {
    period_id: periodId,
    weekday,
    class_id: null,
    subject: "",
    room: "",
    duty: "",
    notes: "",
  };
}

/**
 * Resolves a cell for display.
 *
 * This is the "fills subject/room" the spec asks for, and it is a *lookup, not a
 * copy*: the class's subject and room are read at display time, so renaming a
 * class or moving it to another room updates every hour it is taught in, with
 * nothing to regenerate. The cell's own `subject`/`room` win when filled, which
 * is how a class that meets in the lab on Thursdays says so in one cell.
 */
export function resolveHour(
  planner: Planner,
  period: TimetablePeriod,
  cell: TimetableCell,
): ScheduledHour {
  const schoolClass = planner.classes.find((c) => c.id === cell.class_id) ?? null;
  return {
    period,
    cell,
    weekday: cell.weekday,
    schoolClass,
    subject: cell.subject.trim() || schoolClass?.subject.trim() || "",
    room: cell.room.trim() || schoolClass?.room.trim() || "",
  };
}

/** Every filled hour on one weekday, in grid order. */
export function hoursOn(planner: Planner, weekday: number): ScheduledHour[] {
  return periodsOf(planner).flatMap((period) => {
    const cell = cellAt(planner, period.id, weekday);
    return cell ? [resolveHour(planner, period, cell)] : [];
  });
}

/**
 * One class's hours across the week, derived from the cells that link to it.
 *
 * This is what replaced M1's `class_slot` rows. The class card renders it
 * read-only, because the master timetable is where it is edited.
 */
export function hoursOfClass(planner: Planner, classId: number): ScheduledHour[] {
  const periods = periodsOf(planner);
  return planner.timetable_cells
    .filter((cell) => cell.class_id === classId)
    .flatMap((cell) => {
      const period = periods.find((p) => p.id === cell.period_id);
      return period ? [resolveHour(planner, period, cell)] : [];
    })
    .sort(
      (a, b) =>
        a.weekday - b.weekday ||
        a.period.position - b.period.position ||
        a.period.id - b.period.id,
    );
}

/**
 * Today's scheduled hours, for the Today view.
 *
 * `today` is an argument rather than a call to the clock, which is what makes
 * the "only today's classes, on a spot-checked date" criterion testable at all.
 * A Sunday returns nothing: the source's grid is Δευτέρα–Σάββατο, so weekday 7
 * has no row to read.
 */
export function hoursToday(planner: Planner, today: string): ScheduledHour[] {
  return hoursOn(planner, weekdayOf(today));
}

/**
 * The distinct classes the teacher actually meets on `today`, in the order the
 * day runs.
 *
 * De-duplicated on purpose: a class taught twice in one day is two hours but one
 * lesson plan, so the Today view's links into the week's plans must not offer
 * the same class twice. The hour list above is the one that repeats it, because
 * there she really is in that room twice.
 */
export function classesToday(planner: Planner, today: string): SchoolClass[] {
  const seen = new Set<number>();
  const classes: SchoolClass[] = [];
  for (const hour of hoursToday(planner, today)) {
    if (hour.schoolClass && !seen.has(hour.schoolClass.id)) {
      seen.add(hour.schoolClass.id);
      classes.push(hour.schoolClass);
    }
  }
  return classes;
}

/** `09:20 – 10:05`, or just one end of it, or nothing. */
export function formatHourTimes(period: TimetablePeriod): string {
  const from = period.start_time.trim();
  const to = period.end_time.trim();
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

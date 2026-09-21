/**
 * A teacher's week, shaped like a real one, for the M3 screen tests.
 *
 * Deliberately not symmetrical — it holds every case the four M3 surfaces have
 * to get right:
 *
 * * **Α1 on Monday and Wednesday, Β2 twice on Wednesday.** A class met twice in
 *   one day is two hours but one weekly plan, which is what the Today view must
 *   not turn into two entries.
 * * **A Friday duty with no class at all**, which a per-class timetable could not
 *   have held and which is the reason the master timetable is its own register.
 * * **A room override on one of Β2's hours**, so the "fills subject/room" lookup
 *   is exercised against a cell that disagrees with its class.
 * * **A plan against the Monday of a November week** — the row M3's first
 *   acceptance criterion moves the school year's start date underneath.
 *
 * The school year starts Monday 14.09.2026, which makes 16.09.2026 a Wednesday
 * and the week of 02.11.2026 week 8. Those are the dates the tests spot-check on.
 */
import type { Planner, SchoolClass, TimetableCell } from "../../src/domain/types";
import { emptyPlanner } from "./fakeBackend";

export const A1 = 1;
export const B2 = 2;

/** Monday 14.09.2026 — the first Monday of the school year in these fixtures. */
export const YEAR_START = "2026-09-14";
/** A Wednesday, six weeks before the plan below. The Today view's spot-check. */
export const A_WEDNESDAY = "2026-09-16";
/** The Monday of the week the lesson plan is filed against. Week 8. */
export const PLAN_MONDAY = "2026-11-02";

export const FIRST_HOUR = 10;
export const SECOND_HOUR = 11;
export const THIRD_HOUR = 12;

function schoolClass(id: number, name: string, subject: string, room: string): SchoolClass {
  return {
    id,
    name,
    subject,
    room,
    responsible: "",
    notes: "",
    position: id,
    seating_rows: 5,
    seating_cols: 6,
    seating_notes: "",
  };
}

function cell(patch: Partial<TimetableCell> & { period_id: number; weekday: number }): TimetableCell {
  return {
    class_id: null,
    subject: "",
    room: "",
    duty: "",
    notes: "",
    ...patch,
  };
}

export function weekPlanner(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: YEAR_START };
  planner.classes = [
    schoolClass(A1, "Α1", "Μαθηματικά", "203"),
    schoolClass(B2, "Β2", "Φυσική", "Εργαστήριο"),
  ];
  planner.timetable_periods = [
    { id: FIRST_HOUR, position: 0, name: "1η", start_time: "08:30", end_time: "09:15" },
    { id: SECOND_HOUR, position: 1, name: "2η", start_time: "09:20", end_time: "10:05" },
    { id: THIRD_HOUR, position: 2, name: "3η", start_time: "10:15", end_time: "11:00" },
  ];
  planner.timetable_cells = [
    // Monday: Α1 only.
    cell({ period_id: FIRST_HOUR, weekday: 1, class_id: A1 }),
    // Wednesday: Β2 first, then Α1, then Β2 again — in the lab's stead, room 204.
    cell({ period_id: FIRST_HOUR, weekday: 3, class_id: B2 }),
    cell({ period_id: SECOND_HOUR, weekday: 3, class_id: A1 }),
    cell({ period_id: THIRD_HOUR, weekday: 3, class_id: B2, room: "204" }),
    // Friday: a duty that belongs to no class.
    cell({ period_id: SECOND_HOUR, weekday: 5, duty: "Εφημερία στο προαύλιο" }),
  ];
  planner.lesson_plans = [
    {
      class_id: A1,
      week_monday: PLAN_MONDAY,
      notes: "Κεφάλαιο 4: εξισώσεις πρώτου βαθμού",
      assessment: "Ολιγόλεπτο διαγώνισμα την Πέμπτη",
    },
  ];
  planner.agenda_notes = [
    { scope: "day", date: A_WEDNESDAY, body: "Συνάντηση με τη μητέρα στις 13:30" },
    { scope: "week", date: "2026-09-14", body: "Εβδομάδα γνωριμίας" },
    { scope: "month", date: "2026-09-01", body: "Εστίαση του μήνα: ρουτίνες" },
  ];
  return planner;
}

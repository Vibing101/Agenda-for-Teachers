/**
 * The attendance selectors.
 *
 * Two things are being pinned here rather than merely exercised:
 *
 * * **the month grid is a view over actual dates**, built from M3's
 *   `monthGrid()`, so no arithmetic in this app knows a day-of-month index; and
 * * **nothing derives one register from the other** — the grid's totals count
 *   marks only, and the register's list is unaffected by any mark.
 */
import { describe, expect, it } from "vitest";
import {
  emptyEvent,
  eventsOfClass,
  eventsOfStudent,
  markAt,
  monthDays,
  monthRows,
  monthTotals,
} from "../../src/domain/attendance";
import { monthGrid } from "../../src/domain/agenda";
import {
  A1,
  B2,
  CONTESTED_DAY,
  ELENI,
  IN_NOVEMBER,
  KOSTAS,
  NIKOS,
  supportPlanner,
} from "../helpers/supportFixture";

describe("the month the grid lays out", () => {
  it("is that month's own days, in order, with nothing borrowed from either side", () => {
    const days = monthDays(IN_NOVEMBER);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-11-01");
    expect(days[29]).toBe("2026-11-30");
    // Every day belongs to November: a grid that leaked would file a mark
    // under the wrong month.
    expect(days.every((d) => d.startsWith("2026-11"))).toBe(true);
  });

  it("is built from M3's monthGrid rather than from a second piece of arithmetic", () => {
    // Same days, same order — the grid's columns are the calendar's own.
    const fromAgenda = monthGrid(IN_NOVEMBER)
      .flat()
      .filter((d): d is string => d !== null);
    expect(monthDays(IN_NOVEMBER)).toEqual(fromAgenda);
  });

  it("handles February in a leap year and a 31-day month", () => {
    expect(monthDays("2028-02-10")).toHaveLength(29);
    expect(monthDays("2027-02-10")).toHaveLength(28);
    expect(monthDays("2026-12-25")).toHaveLength(31);
  });

  it("gives the same month whichever day of it is asked about", () => {
    expect(monthDays("2026-11-01")).toEqual(monthDays("2026-11-30"));
  });
});

describe("the monthly grid's rows", () => {
  it("are the class's roster in roster order, with one entry per day", () => {
    const rows = monthRows(supportPlanner(), A1, IN_NOVEMBER);
    expect(rows.map((r) => r.student.id)).toEqual([ELENI, NIKOS, KOSTAS]);
    expect(rows.map((r) => r.rosterNo)).toEqual([1, 2, 3]);
    expect(rows[0].marks).toHaveLength(30);
  });

  it("show a student's marks only for the class the grid is for", () => {
    const planner = supportPlanner();
    // Ελένη is in Β2 as well, but her marks were entered against Α1.
    const inB2 = monthRows(planner, B2, IN_NOVEMBER).find((r) => r.student.id === ELENI)!;
    expect(inB2.marks.every((m) => m === null)).toBe(true);
    const inA1 = monthRows(planner, A1, IN_NOVEMBER).find((r) => r.student.id === ELENI)!;
    expect(inA1.marks.filter((m) => m !== null)).toHaveLength(5);
  });

  it("count each state for the month, and only within that month", () => {
    const planner = supportPlanner();
    const eleni = monthRows(planner, A1, IN_NOVEMBER).find((r) => r.student.id === ELENI)!;
    // Hand-counted from the fixture: present 05, absent 06 and 09, late 10,
    // excused 12 — and the 15.10 absence is a different month.
    expect(monthTotals(eleni)).toEqual({ present: 1, absent: 2, late: 1, excused: 1 });

    const october = monthRows(planner, A1, "2026-10-08").find((r) => r.student.id === ELENI)!;
    expect(monthTotals(october)).toEqual({ present: 0, absent: 1, late: 0, excused: 0 });
  });

  it("read an unmarked day as no record rather than as present", () => {
    const planner = supportPlanner();
    expect(markAt(planner, A1, ELENI, "2026-11-04")).toBeNull();
    const kostas = monthRows(planner, A1, IN_NOVEMBER).find((r) => r.student.id === KOSTAS)!;
    expect(monthTotals(kostas)).toEqual({ present: 0, absent: 0, late: 0, excused: 0 });
  });
});

describe("the detailed absence register", () => {
  it("lists one class's events in date order, across every month", () => {
    const events = eventsOfClass(supportPlanner(), A1);
    expect(events.map((e) => e.date)).toEqual(["2026-10-20", CONTESTED_DAY, "2026-11-09"]);
  });

  it("carries every field the spec names, none of them computed", () => {
    const event = eventsOfClass(supportPlanner(), A1).find((e) => e.date === CONTESTED_DAY)!;
    expect(event.kind).toBe("late");
    expect(event.clock_time).toBe("08:35");
    expect(event.teaching_hour).toBe("1η");
    expect(event.reason).toBe("Καθυστέρηση λεωφορείου");
    expect(event.justified).toBe(true);
    expect(event.follow_up).toBe("informed");
    expect(event.frequent_note).toBe("Τρίτη φορά αυτόν τον μήνα");
  });

  it("sorts a line with no date yet to the end, where a new one belongs", () => {
    const planner = supportPlanner();
    planner.absence_events = [...planner.absence_events, emptyEvent(A1, ELENI)];
    const dates = eventsOfClass(planner, A1).map((e) => e.date);
    expect(dates[dates.length - 1]).toBe("");
  });

  it("follows one student across her classes when asked that way", () => {
    expect(eventsOfStudent(supportPlanner(), ELENI).map((e) => e.id)).toEqual([63, 61]);
    expect(eventsOfStudent(supportPlanner(), NIKOS).map((e) => e.id)).toEqual([62]);
  });
});

/**
 * **M4's first acceptance criterion, at the selector layer.**
 *
 * The fixture marks Ελένη `present` on 05.11 and logs a late arrival for her on
 * the same date. Both must be readable, and neither selector may consult the
 * other's array.
 */
describe("the grid and the register are independent", () => {
  it("hold different, non-derived data for the same student and date", () => {
    const planner = supportPlanner();

    expect(markAt(planner, A1, ELENI, CONTESTED_DAY)!.state).toBe("present");
    const logged = eventsOfClass(planner, A1).find(
      (e) => e.student_id === ELENI && e.date === CONTESTED_DAY,
    )!;
    expect(logged.kind).toBe("late");
  });

  it("do not count each other: the month totals ignore the register entirely", () => {
    const planner = supportPlanner();
    const before = monthTotals(monthRows(planner, A1, IN_NOVEMBER)[0]);

    // Add three more absence events for the same student in the same month.
    planner.absence_events = [
      ...planner.absence_events,
      { ...emptyEvent(A1, ELENI), id: 91, date: "2026-11-17", kind: "absence" },
      { ...emptyEvent(A1, ELENI), id: 92, date: "2026-11-18", kind: "absence" },
      { ...emptyEvent(A1, ELENI), id: 93, date: "2026-11-19", kind: "late" },
    ];

    const after = monthTotals(monthRows(planner, A1, IN_NOVEMBER)[0]);
    expect(after).toEqual(before);
    expect(after.absent).toBe(2);
  });

  it("do not mirror each other: adding a mark adds no event", () => {
    const planner = supportPlanner();
    const before = eventsOfClass(planner, A1).length;
    planner.attendance_marks = [
      ...planner.attendance_marks,
      { class_id: A1, student_id: ELENI, date: "2026-11-24", state: "absent" },
    ];
    expect(eventsOfClass(planner, A1)).toHaveLength(before);
  });

  it("survive each other's removal", () => {
    const planner = supportPlanner();
    // Every event gone: the grid is untouched.
    planner.absence_events = [];
    expect(markAt(planner, A1, ELENI, CONTESTED_DAY)!.state).toBe("present");

    const fresh = supportPlanner();
    // Every mark gone: the register is untouched.
    fresh.attendance_marks = [];
    expect(eventsOfClass(fresh, A1)).toHaveLength(3);
  });
});

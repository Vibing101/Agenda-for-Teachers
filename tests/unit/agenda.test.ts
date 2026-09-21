import { describe, expect, it } from "vitest";
import {
  agendaKey,
  daysInMonth,
  hasNote,
  monthGrid,
  noteFor,
  step,
  weekDays,
} from "../../src/domain/agenda";
import { emptyPlanner } from "../helpers/fakeBackend";

function plannerWithNotes() {
  const planner = emptyPlanner();
  planner.agenda_notes = [
    { scope: "day", date: "2026-11-05", body: "Συνάντηση με τη μητέρα" },
    { scope: "week", date: "2026-11-02", body: "Εβδομάδα επανάληψης" },
    { scope: "month", date: "2026-11-01", body: "Εστίαση: ανάγνωση" },
  ];
  return planner;
}

describe("agenda notes", () => {
  describe("the key each scope is stored against", () => {
    it("keeps the day for a day note", () => {
      expect(agendaKey("day", "2026-11-05")).toBe("2026-11-05");
    });

    it("snaps a week note back to its Monday", () => {
      expect(agendaKey("week", "2026-11-05")).toBe("2026-11-02");
      expect(agendaKey("week", "2026-11-08")).toBe("2026-11-02");
      expect(agendaKey("week", "2026-11-02")).toBe("2026-11-02");
    });

    it("snaps a month note back to the first", () => {
      expect(agendaKey("month", "2026-11-05")).toBe("2026-11-01");
      expect(agendaKey("month", "2026-11-30")).toBe("2026-11-01");
    });

    it("leaves a value that is not a date alone rather than inventing one", () => {
      expect(agendaKey("week", "")).toBe("");
    });
  });

  /**
   * The three scopes are independent records for the same date, so a week note
   * cannot stand on the day note of its own Monday.
   */
  it("keeps the three scopes apart for one date", () => {
    const planner = emptyPlanner();
    planner.agenda_notes = [
      { scope: "day", date: "2026-11-02", body: "ημέρα" },
      { scope: "week", date: "2026-11-02", body: "εβδομάδα" },
      { scope: "month", date: "2026-11-02", body: "μήνας" },
    ];
    expect(noteFor(planner, "day", "2026-11-02").body).toBe("ημέρα");
    expect(noteFor(planner, "week", "2026-11-02").body).toBe("εβδομάδα");
    // The month note above is filed against the 2nd, so the 1st reads blank —
    // which is exactly why the screen writes through `agendaKey`.
    expect(noteFor(planner, "month", "2026-11-02").body).toBe("");
  });

  it("finds a week note from any day of that week", () => {
    const planner = plannerWithNotes();
    expect(noteFor(planner, "week", "2026-11-06").body).toBe("Εβδομάδα επανάληψης");
    expect(noteFor(planner, "month", "2026-11-20").body).toBe("Εστίαση: ανάγνωση");
  });

  it("reads an unwritten note as blank rather than missing", () => {
    const note = noteFor(emptyPlanner(), "day", "2026-11-05");
    expect(note).toEqual({ scope: "day", date: "2026-11-05", body: "" });
    expect(hasNote(emptyPlanner(), "day", "2026-11-05")).toBe(false);
    expect(hasNote(plannerWithNotes(), "day", "2026-11-05")).toBe(true);
  });

  describe("adjacent-period navigation", () => {
    it("steps a day", () => {
      expect(step("day", "2026-11-05", 1)).toBe("2026-11-06");
      expect(step("day", "2026-11-01", -1)).toBe("2026-10-31");
    });

    it("steps a week and lands on a Monday", () => {
      expect(step("week", "2026-11-02", 1)).toBe("2026-11-09");
      expect(step("week", "2026-11-05", -1)).toBe("2026-10-26");
    });

    it("steps a month", () => {
      expect(step("month", "2026-11-05", 1)).toBe("2026-12-05");
      expect(step("month", "2026-11-05", -1)).toBe("2026-10-05");
    });

    it("steps a month across a year boundary", () => {
      expect(step("month", "2026-12-15", 1)).toBe("2027-01-15");
      expect(step("month", "2027-01-15", -1)).toBe("2026-12-15");
    });

    /** Stepping back from the 31st must not overshoot into the month after. */
    it("clamps to the target month's length", () => {
      expect(step("month", "2026-03-31", -1)).toBe("2026-02-28");
      expect(step("month", "2026-05-31", 1)).toBe("2026-06-30");
      expect(step("month", "2028-03-31", -1)).toBe("2028-02-29");
    });
  });

  it("counts the days in a month, leap years included", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("gives a week as Monday through Sunday", () => {
    expect(weekDays("2026-11-05")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  describe("the month grid", () => {
    it("lays a month out in Monday-first rows of seven", () => {
      // November 2026 starts on a Sunday, so the first row is six blanks then it.
      const grid = monthGrid("2026-11-01");
      expect(grid[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
      expect(grid.every((row) => row.length === 7)).toBe(true);
      const days = grid.flat().filter((d) => d !== null);
      expect(days).toHaveLength(30);
      expect(days[0]).toBe("2026-11-01");
      expect(days[29]).toBe("2026-11-30");
    });

    it("pads the last row rather than spilling into the next month", () => {
      const grid = monthGrid("2026-09-14");
      const days = grid.flat().filter((d) => d !== null);
      expect(days).toHaveLength(30);
      // Nothing from August or October is offered, so no note can be filed
      // against a day the page does not belong to.
      expect(days.every((d) => d!.startsWith("2026-09"))).toBe(true);
      expect(grid[grid.length - 1]).toContain(null);
    });

    it("needs no padding for a month that starts on a Monday and fills its rows", () => {
      // February 2027 starts on a Monday and has 28 days: exactly four rows.
      const grid = monthGrid("2027-02-10");
      expect(grid).toHaveLength(4);
      expect(grid.flat().every((d) => d !== null)).toBe(true);
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  cellAt,
  classesToday,
  emptyCell,
  formatHourTimes,
  hoursOfClass,
  hoursOn,
  hoursToday,
  periodsOf,
  resolveHour,
} from "../../src/domain/timetable";
import type { Planner, SchoolClass, TimetableCell } from "../../src/domain/types";
import { emptyPlanner } from "../helpers/fakeBackend";

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
  return { ...emptyCell(patch.period_id, patch.weekday), ...patch };
}

/**
 * A week shaped like a real one: three named hours, class Α1 on Monday and
 * Wednesday, Β2 twice on Wednesday, and a playground duty on Friday that belongs
 * to no class at all.
 */
function weekPlanner(): Planner {
  const planner = emptyPlanner();
  planner.classes = [
    schoolClass(1, "Α1", "Μαθηματικά", "203"),
    schoolClass(2, "Β2", "Φυσική", "Εργαστήριο"),
  ];
  planner.timetable_periods = [
    { id: 10, position: 0, name: "1η", start_time: "08:30", end_time: "09:15" },
    { id: 11, position: 1, name: "2η", start_time: "09:20", end_time: "10:05" },
    { id: 12, position: 2, name: "3η", start_time: "10:15", end_time: "11:00" },
  ];
  planner.timetable_cells = [
    cell({ period_id: 10, weekday: 1, class_id: 1 }),
    cell({ period_id: 11, weekday: 3, class_id: 1 }),
    cell({ period_id: 10, weekday: 3, class_id: 2 }),
    cell({ period_id: 12, weekday: 3, class_id: 2, room: "204" }),
    cell({ period_id: 11, weekday: 5, duty: "Εφημερία στο προαύλιο" }),
  ];
  return planner;
}

describe("the master timetable", () => {
  it("orders hours by position, not by insertion", () => {
    const planner = weekPlanner();
    planner.timetable_periods = [...planner.timetable_periods].reverse();
    expect(periodsOf(planner).map((p) => p.name)).toEqual(["1η", "2η", "3η"]);
  });

  it("reads a cell back by its hour and weekday, and nothing for a free hour", () => {
    const planner = weekPlanner();
    expect(cellAt(planner, 10, 1)?.class_id).toBe(1);
    expect(cellAt(planner, 10, 2)).toBeNull();
  });

  /**
   * The spec's "optional link to a Class (fills subject/room)". It is a lookup
   * rather than a copy, which is why renaming a class updates every hour it is
   * taught in with nothing to regenerate.
   */
  it("fills the subject and room from the linked class", () => {
    const planner = weekPlanner();
    const hour = resolveHour(planner, planner.timetable_periods[0], planner.timetable_cells[0]);
    expect(hour.schoolClass?.name).toBe("Α1");
    expect(hour.subject).toBe("Μαθηματικά");
    expect(hour.room).toBe("203");
  });

  it("lets a cell override the room without a second class record", () => {
    const planner = weekPlanner();
    const override = planner.timetable_cells.find((c) => c.room === "204")!;
    const hour = resolveHour(planner, planner.timetable_periods[2], override);
    expect(hour.schoolClass?.name).toBe("Β2");
    // The class's own room is Εργαστήριο; this one hour is elsewhere.
    expect(hour.room).toBe("204");
    expect(hour.subject).toBe("Φυσική");
  });

  it("reflects a renamed class in every hour it is taught in, with nothing to regenerate", () => {
    const planner = weekPlanner();
    planner.classes = planner.classes.map((c) =>
      c.id === 1 ? { ...c, name: "Α1α", room: "301" } : c,
    );
    const hours = hoursOfClass(planner, 1);
    expect(hours).toHaveLength(2);
    expect(hours.every((h) => h.schoolClass?.name === "Α1α")).toBe(true);
    expect(hours.every((h) => h.room === "301")).toBe(true);
  });

  /** The case a per-class timetable could not hold, and the reason for one register. */
  it("carries a duty that belongs to no class", () => {
    const planner = weekPlanner();
    const friday = hoursOn(planner, 5);
    expect(friday).toHaveLength(1);
    expect(friday[0].schoolClass).toBeNull();
    expect(friday[0].cell.duty).toBe("Εφημερία στο προαύλιο");
  });

  it("derives a class's own hours from the cells that link to it, in week order", () => {
    const hours = hoursOfClass(weekPlanner(), 2);
    expect(hours.map((h) => [h.weekday, h.period.name])).toEqual([
      [3, "1η"],
      [3, "3η"],
    ]);
  });

  it("gives a class with no hour on the grid an empty list rather than failing", () => {
    const planner = weekPlanner();
    planner.classes.push(schoolClass(3, "Γ3", "Χημεία", "Εργαστήριο"));
    expect(hoursOfClass(planner, 3)).toEqual([]);
  });

  describe("today", () => {
    /**
     * M3's second acceptance criterion, at the layer that decides it. 16.09.2026
     * is a Wednesday: the three Wednesday hours must come back and nothing from
     * Monday or Friday.
     */
    it("shows only the hours scheduled on the spot-checked date", () => {
      const planner = weekPlanner();
      const wednesday = hoursToday(planner, "2026-09-16");
      expect(wednesday.map((h) => h.period.name)).toEqual(["1η", "2η", "3η"]);
      expect(wednesday.every((h) => h.weekday === 3)).toBe(true);

      const monday = hoursToday(planner, "2026-09-14");
      expect(monday.map((h) => h.schoolClass?.name)).toEqual(["Α1"]);

      const friday = hoursToday(planner, "2026-09-18");
      expect(friday.map((h) => h.cell.duty)).toEqual(["Εφημερία στο προαύλιο"]);
    });

    it("shows nothing at all on a Sunday, which the grid has no row for", () => {
      // 20.09.2026 is a Sunday. The source's grid is Δευτέρα–Σάββατο.
      expect(hoursToday(weekPlanner(), "2026-09-20")).toEqual([]);
    });

    it("includes a Saturday, which the grid does have", () => {
      const planner = weekPlanner();
      planner.timetable_cells.push(cell({ period_id: 10, weekday: 6, class_id: 1 }));
      expect(hoursToday(planner, "2026-09-19").map((h) => h.schoolClass?.name)).toEqual(["Α1"]);
    });

    /**
     * A class taught twice in one day is two hours but one weekly plan, so the
     * list of classes must not offer it twice — the second half of "the Today
     * view must not list the same class twice".
     */
    it("lists a class met twice in a day once, while still showing both hours", () => {
      const planner = weekPlanner();
      expect(hoursToday(planner, "2026-09-16")).toHaveLength(3);
      expect(classesToday(planner, "2026-09-16").map((c) => c.name)).toEqual(["Β2", "Α1"]);
    });

    it("leaves a duty out of the class list, having no class to open a plan for", () => {
      expect(classesToday(weekPlanner(), "2026-09-18")).toEqual([]);
    });

    it("reads nothing from a planner with no timetable at all", () => {
      expect(hoursToday(emptyPlanner(), "2026-09-16")).toEqual([]);
      expect(classesToday(emptyPlanner(), "2026-09-16")).toEqual([]);
    });
  });

  it("formats an hour's clock times, and copes with only one end filled in", () => {
    expect(formatHourTimes({ id: 1, position: 0, name: "1η", start_time: "08:30", end_time: "09:15" })).toBe(
      "08:30 – 09:15",
    );
    expect(formatHourTimes({ id: 1, position: 0, name: "1η", start_time: "08:30", end_time: "" })).toBe("08:30");
    expect(formatHourTimes({ id: 1, position: 0, name: "1η", start_time: "", end_time: "" })).toBe("");
  });
});

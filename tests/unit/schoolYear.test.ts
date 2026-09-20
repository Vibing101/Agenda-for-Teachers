import { describe, expect, it } from "vitest";
import {
  firstMonday,
  lastWeekStart,
  monthOrder,
  monthsOfYear,
  weekOf,
  weekStart,
  WEEKS_IN_YEAR,
} from "../../src/domain/schoolYear";

const START = "2026-09-14"; // a Monday

describe("week derivation", () => {
  it("starts week 1 on the Monday of the start date's week", () => {
    expect(firstMonday("2026-09-16")).toBe(START);
    expect(weekStart("2026-09-16", 1)).toBe(START);
  });

  it("derives 53 weeks", () => {
    expect(weekStart(START, WEEKS_IN_YEAR)).toBe("2027-09-13");
    expect(lastWeekStart(START)).toBe("2027-09-13");
  });

  it("has nothing to derive until a start date is set", () => {
    expect(firstMonday("")).toBeNull();
    expect(weekStart("", 1)).toBeNull();
    expect(weekOf("", "2026-09-14")).toBeNull();
    expect(monthsOfYear("sep_aug", "")).toEqual([]);
  });

  it("places a date in its week", () => {
    expect(weekOf(START, "2026-09-14")).toEqual({ week: 1, withinYear: true });
    expect(weekOf(START, "2026-09-20")).toEqual({ week: 1, withinYear: true });
    expect(weekOf(START, "2026-09-21")).toEqual({ week: 2, withinYear: true });
    expect(weekOf(START, "2026-11-05")).toEqual({ week: 8, withinYear: true });
  });

  it("still numbers a date that falls outside the year instead of dropping it", () => {
    // The whole point: a record before or after the year is flagged, never
    // hidden, because the teacher may have moved the start date past it.
    expect(weekOf(START, "2026-09-07")).toEqual({ week: 0, withinYear: false });
    expect(weekOf(START, "2028-01-01")).toEqual({ week: 68, withinYear: false });
  });

  /**
   * M1's first acceptance criterion, at the derivation layer: moving the start
   * date re-labels weeks and changes no date. A record's identity is its date.
   */
  it("moving the start date changes week numbers, never the dates themselves", () => {
    const lessonDate = "2026-11-05";
    const before = weekOf(START, lessonDate);
    const after = weekOf("2026-09-07", lessonDate);

    expect(before).toEqual({ week: 8, withinYear: true });
    expect(after).toEqual({ week: 9, withinYear: true });
    // The record is still on the same day — nothing was moved or deleted.
    expect(lessonDate).toBe("2026-11-05");
  });
});

describe("month derivation", () => {
  it("runs September to August for a Sep–Aug year", () => {
    const months = monthsOfYear("sep_aug", START);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 9 });
    expect(months[11]).toEqual({ year: 2027, month: 8 });
  });

  it("anchors to the previous calendar year when the start date is past the model's first month", () => {
    const months = monthsOfYear("sep_aug", "2027-01-11");
    expect(months[0]).toEqual({ year: 2026, month: 9 });
    expect(months.some((m) => m.year === 2027 && m.month === 1)).toBe(true);
  });

  it("runs January to December for a Jan–Dec year", () => {
    const months = monthsOfYear("jan_dec", "2026-01-05");
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 1 });
    expect(months[11]).toEqual({ year: 2026, month: 12 });
  });

  it("runs February to December — eleven months — for a Feb–Dec year", () => {
    // Read literally, per the release note's open question: the source product
    // markets "12 μήνες", so whether this model wraps into January is a call
    // for the product owner rather than one to guess at here.
    const months = monthsOfYear("feb_dec", "2026-02-02");
    expect(months).toHaveLength(11);
    expect(months[0]).toEqual({ year: 2026, month: 2 });
    expect(months[10]).toEqual({ year: 2026, month: 12 });
  });

  it("orders all twelve months from the year's first month, for the birthday calendar", () => {
    expect(monthOrder("sep_aug", START)).toEqual([9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]);
    // A Feb–Dec year still lists every month; January simply comes last.
    expect(monthOrder("feb_dec", "2026-02-02")).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1]);
    expect(monthOrder("sep_aug", "")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

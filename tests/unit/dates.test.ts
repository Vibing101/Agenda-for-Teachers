import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfMonth,
  daysBetween,
  formatDate,
  isIsoDate,
  mondayOf,
  monthOf,
  weekdayOf,
} from "../../src/domain/dates";

describe("date helpers", () => {
  it("recognises real dates and rejects impossible ones", () => {
    expect(isIsoDate("2026-09-14")).toBe(true);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("14.09.2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("adds days across a month and a year boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("adds days across a daylight-saving change without drifting", () => {
    // Europe/Athens moves its clocks on the last Sunday of October.
    expect(addDays("2026-10-24", 7)).toBe("2026-10-31");
    expect(daysBetween("2026-10-24", "2026-10-31")).toBe(7);
  });

  it("counts Monday as 1 and Sunday as 7", () => {
    expect(weekdayOf("2026-09-14")).toBe(1);
    expect(weekdayOf("2026-09-20")).toBe(7);
  });

  it("snaps any day back to the Monday of its own week", () => {
    // The source product does the same, so a teacher who types the Wednesday
    // she went back to school gets the week she meant.
    expect(mondayOf("2026-09-16")).toBe("2026-09-14");
    expect(mondayOf("2026-09-14")).toBe("2026-09-14");
    expect(mondayOf("2026-09-20")).toBe("2026-09-14");
  });

  it("reads the month and day back out", () => {
    expect(monthOf("2014-03-07")).toBe(3);
    expect(dayOfMonth("2014-03-07")).toBe(7);
  });

  it("formats dates the way the source product asks for them", () => {
    expect(formatDate("2026-09-14")).toBe("14.09.2026");
    expect(formatDate("")).toBe("");
  });
});

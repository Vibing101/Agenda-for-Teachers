/**
 * M8's selectors: the budget roll-up (the one piece of arithmetic M8 has), the
 * staff search, the two registers of *Αναπλήρωση και άδειες*, the development
 * goals, and the wellbeing journal's derived week.
 *
 * Both acceptance criteria are tested here as **insensitivity**, not as a
 * count: a selector's output is compared with the other surface empty and full.
 */
import { describe, expect, it } from "vitest";
import { coverRegister, leaveRegister } from "../../src/domain/covers";
import {
  allDevelopmentGoals,
  schoolYearWindow,
  trainingSummary,
} from "../../src/domain/development";
import { parseWeight } from "../../src/domain/grades";
import { foldForSearch } from "../../src/domain/messages";
import { formatDecimal, formatMoney, parseDecimal, sumHundredths } from "../../src/domain/numbers";
import { searchStaff } from "../../src/domain/staff";
import { wellbeingJournal, wellbeingWeek } from "../../src/domain/wellbeing";
import {
  ANNA_STAFF,
  growthPlanner,
  SAME_DAY,
  SHARED_NAME,
  TRAINING_BLANK,
  TRAINING_OUTSIDE,
  WELLBEING_WEEK8,
  WELLBEING_WEEK9,
} from "../helpers/growthFixture";

describe("reading a typed number", () => {
  it("accepts a comma as readily as a dot, and keeps blank apart from invalid", () => {
    expect(parseDecimal("12,50")).toBe(12.5);
    expect(parseDecimal("12.50")).toBe(12.5);
    expect(parseDecimal(" 3 ")).toBe(3);
    expect(parseDecimal("0")).toBe(0);
    // Blank is "not entered" — null, never zero.
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    // Anything else is refused rather than guessed.
    expect(parseDecimal("δωρεάν")).toBeUndefined();
    expect(parseDecimal("-5")).toBeUndefined();
    expect(parseDecimal("1,2,3")).toBeUndefined();
    expect(parseDecimal("12 €")).toBeUndefined();
  });

  it("writes numbers back with a dot", () => {
    expect(formatMoney(12.5)).toBe("12.50");
    expect(formatMoney(0)).toBe("0.00");
    expect(formatDecimal(1.5)).toBe("1.5");
    expect(formatDecimal(3)).toBe("3");
  });

  it("adds money in hundredths, so cents do not drift", () => {
    expect(sumHundredths([0.1, 0.2])).toBe(0.3);
    expect(sumHundredths([])).toBe(0);
  });

  /** M2's weight parser now reads through the same function; its rules hold. */
  it("leaves M2's weight rules exactly as they were", () => {
    expect(parseWeight("40")).toBe(40);
    expect(parseWeight("12,5")).toBe(12.5);
    expect(parseWeight("")).toBeNull();
    expect(parseWeight("101")).toBeUndefined();
    expect(parseWeight("-1")).toBeUndefined();
    expect(parseWeight("abc")).toBeUndefined();
  });
});

describe("the budget summary roll-up", () => {
  /** The fixture's table, computed by hand — see `growthFixture.ts`. */
  it("matches the hand-computed figures for the fixture", () => {
    const s = trainingSummary(growthPlanner());
    expect(s.window).toEqual({ from: "2026-09-14", to: "2027-09-19" });
    expect(s.counted).toBe(3);
    expect(s.spent).toBe(12.5);
    expect(s.costed).toBe(2);
    expect(s.uncosted).toBe(1);
    expect(s.hours).toBe(6.5);
    expect(s.unhoured).toBe(0);
    expect(s.outside).toBe(1);
    expect(s.undated).toBe(0);
    expect(s.budget).toBe(100);
    expect(s.remaining).toBe(87.5);
  });

  it("never reads a blank cost as zero: it is left out and counted", () => {
    const planner = growthPlanner();
    const withBlank = trainingSummary(planner);
    // Remove the blank line: the sum does not move, and only the count of
    // lines without a cost changes. Were blank read as 0, `costed` would drop.
    planner.training_entries = planner.training_entries.filter((e) => e.id !== TRAINING_BLANK);
    const without = trainingSummary(planner);
    expect(without.spent).toBe(withBlank.spent);
    expect(without.costed).toBe(withBlank.costed);
    expect(withBlank.uncosted).toBe(1);
    expect(without.uncosted).toBe(0);
  });

  it("counts a cost of zero as a real, entered cost", () => {
    const planner = growthPlanner();
    planner.training_entries = planner.training_entries.map((e) => ({ ...e, cost: 0 }));
    const s = trainingSummary(planner);
    expect(s.spent).toBe(0);
    expect(s.costed).toBe(3);
    expect(s.uncosted).toBe(0);
    expect(s.remaining).toBe(100);
  });

  it("sums over the school year's own dates, not the calendar's", () => {
    const planner = growthPlanner();
    // Move the year back so June 2026 falls inside it and January 2027 does not.
    planner.school_year = { year_model: "sep_aug", start_date: "2025-09-15" };
    const s = trainingSummary(planner);
    expect(s.window).toEqual(schoolYearWindow("2025-09-15"));
    // Only the June line (40) is inside 15.09.2025–20.09.2026.
    expect(s.spent).toBe(40);
    expect(s.outside).toBe(3);
    // The outside line is named by id in the fixture for exactly this case.
    expect(planner.training_entries.find((e) => e.id === TRAINING_OUTSIDE)!.cost).toBe(40);
  });

  it("with no start date, counts every line and says there is no window", () => {
    const planner = growthPlanner();
    planner.school_year = { year_model: "sep_aug", start_date: "" };
    const s = trainingSummary(planner);
    expect(s.window).toBeNull();
    expect(s.counted).toBe(4);
    expect(s.spent).toBe(52.5);
    expect(s.outside).toBe(0);
  });

  it("counts an undated line apart rather than guessing its year", () => {
    const planner = growthPlanner();
    planner.training_entries.push({
      id: 999,
      date: "",
      activity: "",
      organiser: "",
      hours: null,
      format: "",
      cost: 30,
      certificate: "",
    });
    const s = trainingSummary(planner);
    expect(s.undated).toBe(1);
    expect(s.spent).toBe(12.5);
  });

  it("shows an overspend as a negative remainder, and none without a budget", () => {
    const planner = growthPlanner();
    planner.development_budget = { amount: 10, notes: "" };
    expect(trainingSummary(planner).remaining).toBe(-2.5);
    planner.development_budget = { amount: null, notes: "" };
    expect(trainingSummary(planner).remaining).toBeNull();
  });
});

describe("the staff directory's search", () => {
  it("folds accents and case, over name, role, phone and email", () => {
    const planner = growthPlanner();
    expect(searchStaff(planner, "γραμματεια").map((c) => c.full_name)).toEqual([
      "Μαρία Κωνσταντίνου",
    ]);
    expect(searchStaff(planner, "ΚΩΝΣΤΑΝΤΙΝΟΣ").map((c) => c.full_name)).toEqual([
      "Κωνσταντίνος Γεωργίου",
    ]);
    expect(searchStaff(planner, "555555")).toHaveLength(1);
    expect(searchStaff(planner, "office@")).toHaveLength(1);
    expect(searchStaff(planner, "")).toHaveLength(3);
  });

  it("finds a colleague who shares a guardian's name once, from the directory only", () => {
    const planner = growthPlanner();
    const found = searchStaff(planner, "παπαδοπουλου");
    expect(found.map((c) => c.id)).toEqual([ANNA_STAFF]);
    // The guardian's own phone is on the student card, never in the result.
    expect(found[0].phone).toBe("22 123456");
    // And the directory is insensitive to the students entirely.
    const noStudents = growthPlanner();
    noStudents.students = [];
    noStudents.enrollments = [];
    expect(searchStaff(noStudents, SHARED_NAME)).toEqual(found);
  });

  it("uses the message bank's folding rule rather than a second one", () => {
    expect(foldForSearch("Γραμματεία")).toBe(foldForSearch("γραμματεια"));
  });
});

/**
 * **M8's second acceptance criterion, at the selector layer.** Each register
 * is compared with the *other* table empty and full; it must not move.
 */
describe("the covers register and the leave register", () => {
  it("coexist as two entries on the same date", () => {
    const planner = growthPlanner();
    expect(coverRegister(planner).filter((c) => c.date === SAME_DAY)).toHaveLength(1);
    expect(leaveRegister(planner).filter((l) => l.date === SAME_DAY)).toHaveLength(1);
  });

  it("leave the covers register the same with the leave table empty or full", () => {
    const full = growthPlanner();
    const empty = growthPlanner();
    empty.leave_records = [];
    expect(coverRegister(full)).toEqual(coverRegister(empty));
    // And with a leave added on every cover's own date.
    const crowded = growthPlanner();
    crowded.leave_records = crowded.cover_records.map((c, i) => ({
      id: 5000 + i,
      date: c.date,
      reason: "x",
      documents: "",
    }));
    expect(coverRegister(crowded)).toEqual(coverRegister(empty));
  });

  it("leave the leave register the same with the cover table empty or full", () => {
    const full = growthPlanner();
    const empty = growthPlanner();
    empty.cover_records = [];
    expect(leaveRegister(full)).toEqual(leaveRegister(empty));
  });

  it("are not the timetable's planned duties", () => {
    const planner = growthPlanner();
    const noDuty = growthPlanner();
    noDuty.timetable_cells = [];
    noDuty.timetable_periods = [];
    expect(coverRegister(planner)).toEqual(coverRegister(noDuty));
    // The duty cell says "Αναπλήρωση" and still is not a cover she taught.
    expect(coverRegister(planner).some((c) => c.class_name.includes("Αναπλήρωση"))).toBe(false);
  });
});

/**
 * **M8's first acceptance criterion, at the selector layer**, in both
 * directions and including the annual area called `development`.
 */
describe("development goals and the six annual goals", () => {
  it("are not generated from the annual goals — filled, emptied or changed", () => {
    const filled = growthPlanner();
    const blank = growthPlanner();
    blank.annual_goals = blank.annual_goals.map((g) => ({
      ...g,
      goal: "",
      actions: "",
      success_indicators: "",
      deadline: "",
      status: "",
      review: "",
    }));
    expect(allDevelopmentGoals(filled)).toEqual(allDevelopmentGoals(blank));

    // An empty development list stays empty however full the annual area is.
    const none = growthPlanner();
    none.development_goals = [];
    expect(allDevelopmentGoals(none)).toEqual([]);
  });

  it("are not generated from M7's saved goals form either", () => {
    const withForm = growthPlanner();
    const withoutForm = growthPlanner();
    withoutForm.print_forms = [];
    expect(allDevelopmentGoals(withForm)).toEqual(allDevelopmentGoals(withoutForm));
  });
});

describe("the wellbeing journal", () => {
  it("reads newest first and derives each week from the start date", () => {
    const planner = growthPlanner();
    const journal = wellbeingJournal(planner);
    expect(journal.map((e) => e.id)).toEqual([WELLBEING_WEEK9, WELLBEING_WEEK8]);
    expect(wellbeingWeek(planner, journal[0])).toBe(9);
    expect(wellbeingWeek(planner, journal[1])).toBe(8);
  });

  it("re-labels the weeks when the start date moves, and moves no entry", () => {
    const planner = growthPlanner();
    const before = structuredClone(planner.wellbeing_entries);
    planner.school_year = { year_model: "sep_aug", start_date: "2026-09-07" };
    const journal = wellbeingJournal(planner);
    expect(wellbeingWeek(planner, journal[0])).toBe(10);
    expect(planner.wellbeing_entries).toEqual(before);
  });

  it("shows no week without a start date", () => {
    const planner = growthPlanner();
    planner.school_year = { year_model: "sep_aug", start_date: "" };
    expect(wellbeingWeek(planner, wellbeingJournal(planner)[0])).toBeNull();
  });
});

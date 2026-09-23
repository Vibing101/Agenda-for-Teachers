/**
 * The week-by-class progress matrix — **M6's first acceptance criterion at the
 * selector.**
 *
 * The criterion is that the matrix "correctly reflects entries made from the
 * per-class weekly plan (M3) without duplicate data entry", so these tests are
 * written as *insensitivity to duplication*, not as a row count: the matrix has
 * no input of its own, and what it shows is a function of `lesson_plans` alone.
 */
import { describe, expect, it } from "vitest";
import {
  PROGRESS_PAGE_WEEKS,
  planSummary,
  progressMatrix,
  weekWindowFor,
  writtenCount,
} from "../../src/domain/progress";
import { planFor } from "../../src/domain/plans";
import {
  A1,
  A1_WEEK8_FIRST_LINE,
  A_DAY,
  B2,
  G3,
  LATER_MONDAY,
  PLAN_MONDAY,
  planningPlanner,
} from "../helpers/planningFixture";

function cellFor(planner: ReturnType<typeof planningPlanner>, week: number, classId: number) {
  const matrix = progressMatrix(planner, A_DAY, week, 1);
  return matrix.rows[0].cells.find((c) => c.classId === classId)!;
}

describe("the progress matrix reflects the weekly plan", () => {
  it("shows what the teacher wrote on the weekly plan screen, with nothing else to fill in", () => {
    const planner = planningPlanner();
    const cell = cellFor(planner, 8, A1);

    expect(cell.written).toBe(true);
    // Her own words, not a summary the app invented.
    expect(cell.summary).toBe(A1_WEEK8_FIRST_LINE);
    expect(cell.plan).toEqual(planFor(planner, A1, PLAN_MONDAY));
    expect(cell.plan.notes).toContain("Φύλλο εργασίας 3");
  });

  /**
   * **The criterion, stated as the thing it actually forbids.** A cell is a
   * function of the lesson plan and of nothing else: emptying every other array
   * in the planner leaves the matrix identical.
   *
   * This is the shape M5's own criterion had to be rewritten into after a
   * mutation passed the weaker version — assert on the *whole output* under a
   * change that should not affect it, rather than on one field.
   */
  it("is a function of the lesson plans alone, so there is nothing else to enter", () => {
    const full = planningPlanner();
    const stripped = planningPlanner();
    // Everything M6 itself stores, taken away. If any of it fed the matrix,
    // the teacher would have had to fill it in for her plan to show up.
    stripped.units = [];
    stripped.exams = [];
    stripped.lesson_reflections = [];
    stripped.trips = [];
    stripped.trip_consents = [];
    stripped.textbooks = [];
    stripped.resources = [];

    expect(progressMatrix(stripped, A_DAY, 1, 12)).toEqual(progressMatrix(full, A_DAY, 1, 12));
  });

  it("changes exactly as the weekly plan changes, and only then", () => {
    const planner = planningPlanner();
    const before = cellFor(planner, 8, A1);

    const edited = planningPlanner();
    edited.lesson_plans = edited.lesson_plans.map((p) =>
      p.class_id === A1 && p.week_monday === PLAN_MONDAY
        ? { ...p, notes: "Αλλαγμένο πλάνο\nδεύτερη γραμμή" }
        : p,
    );
    const after = cellFor(edited, 8, A1);

    expect(before.summary).not.toBe(after.summary);
    expect(after.summary).toBe("Αλλαγμένο πλάνο");
  });

  it("leaves a class with no plan blank rather than dropping its column", () => {
    const planner = planningPlanner();
    const matrix = progressMatrix(planner, A_DAY, 8, 1);

    // Γ3 has no plan anywhere in the fixture, and is still a column.
    expect(matrix.classes.map((c) => c.id)).toEqual([A1, B2, G3]);
    const blank = matrix.rows[0].cells.find((c) => c.classId === G3)!;
    expect(blank.written).toBe(false);
    expect(blank.summary).toBe("");
  });

  it("marks the week that carries an assessment, and only that one", () => {
    const planner = planningPlanner();
    expect(cellFor(planner, 8, A1).hasAssessment).toBe(true);
    // Β2's week-8 plan has notes but no assessment.
    expect(cellFor(planner, 8, B2).written).toBe(true);
    expect(cellFor(planner, 8, B2).hasAssessment).toBe(false);
  });

  it("puts each plan on its own week rather than on every row", () => {
    const planner = planningPlanner();
    expect(cellFor(planner, 8, A1).written).toBe(true);
    expect(cellFor(planner, 9, A1).written).toBe(false);
    // Week 10 is the later Monday, deliberately not adjacent to week 8.
    expect(cellFor(planner, 10, A1).written).toBe(true);
    expect(cellFor(planner, 10, A1).plan.week_monday).toBe(LATER_MONDAY);
  });
});

describe("the matrix's rows are derived, never stored", () => {
  /**
   * The M6 equivalent of M3's own test: correcting the school year's start date
   * must **re-label** the rows and **move** nothing.
   */
  it("re-labels the weeks when the start date moves, and moves no plan", () => {
    const planner = planningPlanner();
    // Week 8 holds A1's plan while the year starts 14.09.
    expect(cellFor(planner, 8, A1).written).toBe(true);

    const moved = planningPlanner();
    // A week earlier: every week is now called one number higher.
    moved.school_year = { ...moved.school_year, start_date: "2026-09-07" };

    expect(cellFor(moved, 8, A1).written).toBe(false);
    expect(cellFor(moved, 9, A1).written).toBe(true);
    // And the stored row is untouched — same plan, same Monday.
    expect(cellFor(moved, 9, A1).plan).toEqual(planFor(planner, A1, PLAN_MONDAY));
    expect(moved.lesson_plans).toEqual(planner.lesson_plans);
  });

  it("carries an actual Monday on every cell, and no week index anywhere", () => {
    const planner = planningPlanner();
    const row = progressMatrix(planner, A_DAY, 8, 1).rows[0];

    expect(row.monday).toBe(PLAN_MONDAY);
    expect(row.sunday).toBe("2026-11-08");
    for (const cell of row.cells) {
      expect(cell.weekMonday).toBe(PLAN_MONDAY);
      // The stored plan knows its Monday and nothing about a week number.
      expect(Object.keys(cell.plan)).not.toContain("week");
    }
  });

  it("marks the week that contains the day it was given, and no other", () => {
    const planner = planningPlanner();
    const matrix = progressMatrix(planner, A_DAY, 6, 6);
    const current = matrix.rows.filter((r) => r.isCurrent);

    expect(current).toHaveLength(1);
    expect(current[0].week).toBe(8);
    expect(current[0].monday).toBe(PLAN_MONDAY);

    // A different day gives a different current week from the same planner —
    // the window is a function of the day, not of the clock.
    const later = progressMatrix(planner, "2026-11-18", 6, 6);
    expect(later.rows.filter((r) => r.isCurrent)[0].week).toBe(10);
  });
});

describe("the matrix's window", () => {
  it("opens on the page that holds today", () => {
    const planner = planningPlanner();
    // A_DAY is in week 8, so the ten-week page starting at week 1.
    expect(weekWindowFor(planner, A_DAY)).toBe(1);
    // A day in week 12 lands on the page starting at 11.
    expect(weekWindowFor(planner, "2026-12-02")).toBe(11);
  });

  it("opens at week 1 when no start date has been set", () => {
    const planner = planningPlanner();
    planner.school_year = { ...planner.school_year, start_date: "" };
    expect(weekWindowFor(planner, A_DAY)).toBe(1);
  });

  it("shows a page of weeks at a time", () => {
    const planner = planningPlanner();
    expect(progressMatrix(planner, A_DAY, 1).rows).toHaveLength(PROGRESS_PAGE_WEEKS);
  });

  it("counts what is written in the window it is showing", () => {
    const planner = planningPlanner();
    // Weeks 1–10 hold three plans: A1 and B2 in week 8, A1 in week 10.
    expect(writtenCount(progressMatrix(planner, A_DAY, 1))).toBe(3);
    // Weeks 1–7 hold none.
    expect(writtenCount(progressMatrix(planner, A_DAY, 1, 7))).toBe(0);
  });
});

describe("a plan's summary", () => {
  it("is the first non-empty line, so a blank first line does not blank the cell", () => {
    expect(
      planSummary({ class_id: 1, week_monday: PLAN_MONDAY, notes: "\n\nΠρώτη γραμμή\nδεύτερη", assessment: "" }),
    ).toBe("Πρώτη γραμμή");
  });

  it("is empty for a plan with nothing written in its notes", () => {
    expect(
      planSummary({ class_id: 1, week_monday: PLAN_MONDAY, notes: "   ", assessment: "Διαγώνισμα" }),
    ).toBe("");
  });
});

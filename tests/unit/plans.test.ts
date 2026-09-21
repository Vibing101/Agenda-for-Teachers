import { describe, expect, it } from "vitest";
import { emptyPlan, hasPlan, planFor, plansForWeek } from "../../src/domain/plans";
import { weekOf } from "../../src/domain/schoolYear";
import { emptyPlanner } from "../helpers/fakeBackend";

function plannerWithPlan() {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
  planner.lesson_plans = [
    {
      class_id: 1,
      week_monday: "2026-11-02",
      notes: "Κεφάλαιο 4: εξισώσεις",
      assessment: "Ολιγόλεπτο διαγώνισμα την Πέμπτη",
    },
  ];
  return planner;
}

describe("weekly lesson plans", () => {
  it("keys a plan by the Monday of its week", () => {
    expect(emptyPlan(1, "2026-11-05").week_monday).toBe("2026-11-02");
  });

  /**
   * The single most likely way to end up with two rows for one week is for each
   * caller to key by whatever day it happened to hold, so `planFor` snaps first.
   */
  it("finds the same plan from any day of that week", () => {
    const planner = plannerWithPlan();
    for (const day of [
      "2026-11-02", // Monday
      "2026-11-05", // Thursday
      "2026-11-08", // Sunday
    ]) {
      expect(planFor(planner, 1, day).notes).toBe("Κεφάλαιο 4: εξισώσεις");
    }
  });

  it("returns a blank plan for a week never written, rather than nothing", () => {
    const plan = planFor(plannerWithPlan(), 1, "2026-11-09");
    expect(plan).toEqual({
      class_id: 1,
      week_monday: "2026-11-09",
      notes: "",
      assessment: "",
    });
    expect(hasPlan(plan)).toBe(false);
  });

  it("keeps each class's week separate", () => {
    const planner = plannerWithPlan();
    planner.lesson_plans.push({
      class_id: 2,
      week_monday: "2026-11-02",
      notes: "Εργαστήριο: κυκλώματα",
      assessment: "",
    });
    expect(planFor(planner, 1, "2026-11-02").notes).toBe("Κεφάλαιο 4: εξισώσεις");
    expect(planFor(planner, 2, "2026-11-02").notes).toBe("Εργαστήριο: κυκλώματα");
    expect(plansForWeek(planner, "2026-11-04")).toHaveLength(2);
  });

  it("counts a plan as written when either half is filled in", () => {
    expect(hasPlan({ class_id: 1, week_monday: "x", notes: "a", assessment: "" })).toBe(true);
    expect(hasPlan({ class_id: 1, week_monday: "x", notes: "", assessment: "b" })).toBe(true);
    expect(hasPlan({ class_id: 1, week_monday: "x", notes: "   ", assessment: "" })).toBe(false);
  });

  /**
   * M3's first acceptance criterion, at the layer that derives week numbers.
   *
   * The plan is stored against 2 November. With the year starting 14.09.2026 that
   * is week 8; moving the start date a week earlier makes the very same row week
   * 9. Nothing about the plan changes — there is no week column for a change to
   * reach, which is the whole design.
   */
  it("survives a school-year start-date change, being keyed by date", () => {
    const planner = plannerWithPlan();
    const before = structuredClone(planner.lesson_plans);
    expect(weekOf("2026-09-14", "2026-11-02")).toEqual({ week: 8, withinYear: true });

    planner.school_year = { year_model: "sep_aug", start_date: "2026-09-07" };

    expect(weekOf("2026-09-07", "2026-11-02")).toEqual({ week: 9, withinYear: true });
    expect(planner.lesson_plans).toEqual(before);
    // And it is still found where the teacher left it.
    expect(planFor(planner, 1, "2026-11-02").notes).toBe("Κεφάλαιο 4: εξισώσεις");
    expect(planFor(planner, 1, "2026-11-02").assessment).toBe(
      "Ολιγόλεπτο διαγώνισμα την Πέμπτη",
    );
  });

  /**
   * The harder half of the same criterion: moving the start date *past* a plan
   * must not hide it either. It reads as outside the year and is still there.
   */
  it("keeps a plan that a start-date change pushed outside the school year", () => {
    const planner = plannerWithPlan();
    planner.school_year = { year_model: "sep_aug", start_date: "2027-09-06" };
    expect(weekOf("2027-09-06", "2026-11-02")?.withinYear).toBe(false);
    expect(planFor(planner, 1, "2026-11-02").notes).toBe("Κεφάλαιο 4: εξισώσεις");
  });
});

/**
 * Weekly lesson plans — one per (class, week), keyed by an actual date.
 *
 * **The key is the Monday of the week, as a real date, never a week index.**
 * That is the spec's hard-won rule and M3's first acceptance criterion: the
 * teacher may correct the school year's start date in November, which re-derives
 * what a week is *called* and moves nothing, because no row here knows a number.
 *
 * It also means a plan has no generated id: `(class_id, week_monday)` is the
 * whole key and the UI already knows both halves before it writes. There is no
 * "new plan" button to hand a fresh id to and therefore no selection to get
 * wrong — the create-then-edit defect that cost M1 a data-loss bug cannot occur
 * in this shape.
 *
 * M6's week-by-class progress matrix reads exactly these rows, which is why the
 * accessors are here rather than inside a screen.
 */
import { mondayOf } from "./dates";
import type { Planner } from "./types";

export interface LessonPlan {
  class_id: number;
  /** The Monday of the week this plan is for, `YYYY-MM-DD`. */
  week_monday: string;
  notes: string;
  /** The one optional assessment for the week. */
  assessment: string;
}

/** A blank plan, so an untouched week and a saved one are the same to edit. */
export function emptyPlan(classId: number, weekMonday: string): LessonPlan {
  return { class_id: classId, week_monday: mondayOf(weekMonday), notes: "", assessment: "" };
}

/**
 * One class's plan for the week containing `date`.
 *
 * `date` is snapped to its Monday first, so asking with any day of the week
 * finds the same plan — the single most likely way to end up with two rows for
 * one week if it were left to each caller.
 */
export function planFor(planner: Planner, classId: number, date: string): LessonPlan {
  const monday = mondayOf(date);
  return (
    planner.lesson_plans.find((p) => p.class_id === classId && p.week_monday === monday) ??
    emptyPlan(classId, monday)
  );
}

/** Whether the teacher has written anything for this week at all. */
export function hasPlan(plan: LessonPlan): boolean {
  return plan.notes.trim() !== "" || plan.assessment.trim() !== "";
}

/**
 * Every class that has a plan for the week containing `date`.
 *
 * Here for M6's matrix, and used by the Today view to show at a glance which of
 * today's classes already have something written for the week.
 */
export function plansForWeek(planner: Planner, date: string): LessonPlan[] {
  const monday = mondayOf(date);
  return planner.lesson_plans.filter((p) => p.week_monday === monday);
}

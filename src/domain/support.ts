/**
 * Support plans, their goals, and the cross-class support overview.
 *
 * Two things here are the milestone's own acceptance criteria, and both are
 * held by the shape of the data rather than by care at the call site:
 *
 * * **A plan's `status` is teacher-written and never computed.** The spec says
 *   so in as many words. Nothing in this file derives it, and in particular
 *   [`goalSummary`] below — which does count goals by their progress rating —
 *   is used for display only and is never written anywhere. A goal lives in a
 *   different table from its plan's status, so no single write can touch both.
 * * **The overview reflects a plan change made in a single class**, because it
 *   is a selector over the loaded planner rather than a stored roll-up. There
 *   is nothing to regenerate and nothing that can go stale.
 *
 * **What is the card's field and what is a plan record.** M1 shipped the source
 * product's own ΕΠΕ box on the student card: `sen_status` (one of four
 * categories), `sen_plan` (the free-text "ΠΛΑΝΟ (ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ…)")
 * and `sen_accommodations` ("ΠΡΟΣΑΡΜΟΓΕΣ ΚΑΙ ΣΤΗΡΙΞΗ"). That box is one per
 * student and stays exactly where it is. A `SupportPlan` is the *spec's*
 * addition on top of it: 0..n per student, each with its own start date,
 * monitoring frequency, goals, accommodations, collaboration notes and status.
 * Nothing copies between the two, and the overview shows both side by side.
 */
import type { GoalProgress } from "../i18n/vocabularies";
import type { Enrollment, Planner, SchoolClass, SenStatus, Student } from "./types";

/** One support plan. 0..n per student, per the spec's data model. */
export interface SupportPlan {
  id: number;
  student_id: number;
  position: number;
  start_date: string;
  monitoring_frequency: string;
  /**
   * The spec's "strengths & needs", kept as two fields. Splitting loses
   * nothing and merging would; see the M4 release note.
   */
  strengths: string;
  needs: string;
  accommodations: string;
  /** Parent and specialist collaboration notes. */
  collaboration: string;
  /** **Written by the teacher. Never computed, never touched by a goal.** */
  status: string;
  /** Shown beside the status in the cross-class overview. */
  next_review: string;
}

/** One goal inside a plan, with its own progress rating and monitoring date. */
export interface SupportGoal {
  id: number;
  plan_id: number;
  position: number;
  goal: string;
  /** A rating, or empty when the teacher has not rated it yet. */
  progress: GoalProgress | "";
  monitored_on: string;
}

export function emptyPlan(studentId: number): SupportPlan {
  return {
    id: 0,
    student_id: studentId,
    position: 0,
    start_date: "",
    monitoring_frequency: "",
    strengths: "",
    needs: "",
    accommodations: "",
    collaboration: "",
    status: "",
    next_review: "",
  };
}

export function emptyGoal(planId: number): SupportGoal {
  return { id: 0, plan_id: planId, position: 0, goal: "", progress: "", monitored_on: "" };
}

/** One student's plans, in the order she made them. */
export function plansOfStudent(planner: Planner, studentId: number): SupportPlan[] {
  return [...planner.support_plans]
    .filter((p) => p.student_id === studentId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/** One plan's goals, in the order she made them. */
export function goalsOfPlan(planner: Planner, planId: number): SupportGoal[] {
  return [...planner.support_goals]
    .filter((g) => g.plan_id === planId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/**
 * How many of a plan's goals carry each rating — **for display only**.
 *
 * Deliberately not written anywhere, and deliberately not folded into the
 * plan's `status`. The spec keeps that field teacher-written, so the closest
 * this app comes to summarising progress is showing her this count beside the
 * sentence she wrote, and letting her decide whether the two agree.
 */
export function goalSummary(planner: Planner, planId: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const goal of goalsOfPlan(planner, planId)) {
    if (goal.progress) counts[goal.progress] = (counts[goal.progress] ?? 0) + 1;
  }
  return counts;
}

// ------------------------------------------ the cross-class overview ---

/**
 * One row of the cross-class support overview.
 *
 * The spec asks for "one row per student, merging card-level support flags with
 * every plan's status and next review date". **Two things are card-level and
 * both are merged here**, because M1 shipped two different flags that mean
 * different things:
 *
 * * [`senStatus`] — `Student.sen_status`, one per student, from the ΕΠΕ box on
 *   her card. *What kind of support she has.*
 * * [`supportClasses`] — the classes whose `Enrollment.support` is ticked, with
 *   each one's short note. *Where she is flagged for support*, which can differ
 *   from class to class for the same student.
 *
 * The source page's own columns are Μαθητής / Τάξη / Είδος στήριξης /
 * Προσαρμογές–Στήριξη / Αξιολόγηση / Πλάνο, which is the same merge: a
 * per-class column, a card-level category, the card's accommodations text, and
 * the plans.
 */
export interface SupportOverviewRow {
  student: Student;
  /** Every class she is enrolled in, for the `Τάξη` column. */
  classes: SchoolClass[];
  /** The card-level category from her ΕΠΕ box. */
  senStatus: SenStatus;
  /** The card's free-text accommodations, shown as the source page does. */
  accommodations: string;
  /** The classes that tick her support box, each with that class's own note. */
  supportClasses: { schoolClass: SchoolClass; note: string }[];
  /** Every plan she holds, with the status and next review the spec names. */
  plans: SupportPlan[];
}

/**
 * The cross-class support overview, one row per student who needs one.
 *
 * **Computed live from the loaded planner**, never stored — which is why a plan
 * edited from inside a single class shows up here immediately, with nothing to
 * regenerate. That is M4's third acceptance criterion, held by construction.
 *
 * A student appears when *any* of the three signals says she should: her card
 * names a support category, some class ticks her support box, or she holds at
 * least one plan. Requiring all three would hide a student the teacher has just
 * started a plan for; requiring only one keeps the page the source's "μαθητές
 * με προσαρμογές ή δικό τους πλάνο".
 */
export function supportOverview(planner: Planner): SupportOverviewRow[] {
  const rows: SupportOverviewRow[] = [];

  for (const student of planner.students) {
    const enrollments = planner.enrollments.filter((e) => e.student_id === student.id);
    const classesOf = (list: Enrollment[]) =>
      list.flatMap((e) => planner.classes.filter((c) => c.id === e.class_id));

    const plans = plansOfStudent(planner, student.id);
    const flagged = enrollments.filter((e) => e.support);
    const hasCardFlag = student.sen_status !== "none";

    if (!hasCardFlag && flagged.length === 0 && plans.length === 0) continue;

    rows.push({
      student,
      classes: classesOf(enrollments),
      senStatus: student.sen_status,
      accommodations: student.sen_accommodations,
      supportClasses: flagged.flatMap((e) => {
        const schoolClass = planner.classes.find((c) => c.id === e.class_id);
        return schoolClass ? [{ schoolClass, note: e.note }] : [];
      }),
      plans,
    });
  }

  return rows.sort((a, b) => a.student.full_name.localeCompare(b.student.full_name, "el"));
}

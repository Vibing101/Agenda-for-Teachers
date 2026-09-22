/**
 * The support-plan and incident selectors, and the cross-class overview.
 *
 * The two claims being pinned here are M4's second and third acceptance
 * criteria: a plan's status is nobody's business but the teacher's, and the
 * overview is a live selector rather than a stored roll-up, so a change made
 * inside one class shows up in it at once.
 */
import { describe, expect, it } from "vitest";
import {
  allIncidents,
  classOf,
  emptyIncident,
  incidentsOfClass,
  incidentsOfStudent,
  studentOf,
} from "../../src/domain/behaviour";
import {
  emptyGoal,
  goalSummary,
  goalsOfPlan,
  plansOfStudent,
  supportOverview,
} from "../../src/domain/support";
import {
  A1,
  B2,
  ELENI,
  GOAL_ONE,
  GOAL_TWO,
  KOSTAS,
  MARIA,
  NIKOS,
  NIKOS_PLAN,
  PLAN_ONE,
  PLAN_TWO,
  supportPlanner,
} from "../helpers/supportFixture";

describe("the incident log", () => {
  it("is newest first, as a register kept for documentation is read", () => {
    expect(allIncidents(supportPlanner()).map((i) => i.date)).toEqual([
      "2026-11-06",
      "2026-11-02",
      "2026-09-30",
    ]);
  });

  it("follows the student across every class she is in", () => {
    const planner = supportPlanner();
    // Ελένη is in Α1 and Β2. Her two incidents — one recorded against Α1, one
    // against no class at all — are hers in both.
    expect(incidentsOfStudent(planner, ELENI).map((i) => i.id)).toEqual([71, 72]);
    expect(incidentsOfClass(planner, A1).map((i) => i.id)).toEqual([71, 72]);
    // Seen from Β2, both of Ελένη's entries are still hers — including 71,
    // which was recorded against Α1, and 72, which names no class at all —
    // alongside Μαρία's. That is what "follows the student" costs and buys.
    expect(incidentsOfClass(planner, B2).map((i) => i.id)).toEqual([71, 73, 72]);
  });

  it("keeps the class an entry was recorded against optional", () => {
    const planner = supportPlanner();
    const [recent, older] = incidentsOfStudent(planner, ELENI);
    expect(classOf(planner, recent)!.name).toBe("Α1");
    expect(classOf(planner, older)).toBeNull();
    expect(studentOf(planner, recent)!.full_name).toBe("Ελένη Παπαδοπούλου");
  });

  it("carries the source register's own four fields", () => {
    const entry = allIncidents(supportPlanner())[0];
    expect(entry.what_happened).toBe("Διαφωνία στο διάλειμμα");
    expect(entry.action_taken).toBe("Συζήτηση με τους δύο μαθητές");
    expect(entry.parents_informed).toBe(true);
    expect(entry.date).toBe("2026-11-06");
  });

  it("sorts a new, undated entry to the front where it can be filled in", () => {
    const planner = supportPlanner();
    planner.incidents = [...planner.incidents, { ...emptyIncident(ELENI), id: 99 }];
    expect(allIncidents(planner)[0].id).toBe(99);
  });
});

describe("support plans", () => {
  it("are several per student, in the order she made them", () => {
    const planner = supportPlanner();
    expect(plansOfStudent(planner, ELENI).map((p) => p.id)).toEqual([PLAN_ONE, PLAN_TWO]);
    expect(plansOfStudent(planner, NIKOS).map((p) => p.id)).toEqual([NIKOS_PLAN]);
    expect(plansOfStudent(planner, KOSTAS)).toEqual([]);
  });

  it("hold their goals, each with its own rating and monitoring date", () => {
    const goals = goalsOfPlan(supportPlanner(), PLAN_ONE);
    expect(goals.map((g) => g.id)).toEqual([GOAL_ONE, GOAL_TWO]);
    expect(goals[0].progress).toBe("in_progress");
    expect(goals[0].monitored_on).toBe("2026-11-20");
    expect(goals[1].progress).toBe("met");
    // The second plan has none, which is a normal state, not an error.
    expect(goalsOfPlan(supportPlanner(), PLAN_TWO)).toEqual([]);
  });

  /**
   * **M4's second acceptance criterion, at the selector layer.**
   *
   * There is no selector that computes a status, and the one thing that does
   * look at ratings — `goalSummary` — is for display and returns a count, not
   * a status. Changing every goal to `met` leaves both statuses as typed.
   */
  it("never let a goal decide a status", () => {
    const planner = supportPlanner();
    const before = plansOfStudent(planner, ELENI).map((p) => p.status);
    expect(before).toEqual(["Σε εφαρμογή", "Ολοκληρώθηκε"]);

    planner.support_goals = planner.support_goals.map((g) => ({ ...g, progress: "met" as const }));
    expect(plansOfStudent(planner, ELENI).map((p) => p.status)).toEqual(before);

    // And with every goal removed, still as typed.
    planner.support_goals = [];
    expect(plansOfStudent(planner, ELENI).map((p) => p.status)).toEqual(before);
    expect(goalSummary(planner, PLAN_ONE)).toEqual({});
  });

  it("summarise their goals as a count, for display beside the status", () => {
    const planner = supportPlanner();
    expect(goalSummary(planner, PLAN_ONE)).toEqual({ in_progress: 1, met: 1 });
    // An unrated goal is counted under no rating rather than under a default.
    planner.support_goals = [...planner.support_goals, { ...emptyGoal(PLAN_ONE), id: 99 }];
    expect(goalSummary(planner, PLAN_ONE)).toEqual({ in_progress: 1, met: 1 });
  });
});

describe("the cross-class support overview", () => {
  it("has one row per student and merges both card-level flags", () => {
    const rows = supportOverview(supportPlanner());
    // Ελένη, Μαρία, Νίκος — alphabetical in Greek. Κώστας is absent: he has
    // no ΕΠΕ category, no class ticks him, and he holds no plan.
    expect(rows.map((r) => r.student.id)).toEqual([ELENI, MARIA, NIKOS]);
    expect(rows.some((r) => r.student.id === KOSTAS)).toBe(false);

    const eleni = rows.find((r) => r.student.id === ELENI)!;
    // The card-level category, from her ΕΠΕ box.
    expect(eleni.senStatus).toBe("accommodations");
    expect(eleni.accommodations).toBe("Επιπλέον χρόνος στις γραπτές εργασίες");
    // The per-class flag, which is on Α1 only although she is in both.
    expect(eleni.classes.map((c) => c.name)).toEqual(["Α1", "Β2"]);
    expect(eleni.supportClasses.map((s) => s.schoolClass.name)).toEqual(["Α1"]);
    expect(eleni.supportClasses[0].note).toBe("Κάθεται μπροστά");
  });

  it("includes a student on any one of the three signals alone", () => {
    const rows = supportOverview(supportPlanner());

    // Μαρία: no ΕΠΕ category, no plan — only Β2's support tick.
    const maria = rows.find((r) => r.student.id === MARIA)!;
    expect(maria.senStatus).toBe("none");
    expect(maria.plans).toEqual([]);
    expect(maria.supportClasses.map((s) => s.schoolClass.name)).toEqual(["Β2"]);

    // Νίκος: no ΕΠΕ category, no class ticks him — only a plan.
    const nikos = rows.find((r) => r.student.id === NIKOS)!;
    expect(nikos.senStatus).toBe("none");
    expect(nikos.supportClasses).toEqual([]);
    expect(nikos.plans.map((p) => p.id)).toEqual([NIKOS_PLAN]);
  });

  it("shows every plan's status and next review date", () => {
    const eleni = supportOverview(supportPlanner()).find((r) => r.student.id === ELENI)!;
    expect(eleni.plans.map((p) => p.status)).toEqual(["Σε εφαρμογή", "Ολοκληρώθηκε"]);
    expect(eleni.plans.map((p) => p.next_review)).toEqual(["2027-01-15", ""]);
  });

  /**
   * **M4's third acceptance criterion, at the selector layer.**
   *
   * The overview is computed, not stored. So a plan changed anywhere — here,
   * from the class the teacher happened to be looking at — is reflected the
   * next time it is read, with nothing to regenerate.
   */
  it("reflects a plan change made in a single class, with nothing to regenerate", () => {
    const planner = supportPlanner();
    expect(
      supportOverview(planner).find((r) => r.student.id === ELENI)!.plans[0].status,
    ).toBe("Σε εφαρμογή");

    // The teacher, inside Α1, rewrites the status and moves the review date.
    planner.support_plans = planner.support_plans.map((p) =>
      p.id === PLAN_ONE
        ? { ...p, status: "Αναθεωρήθηκε τον Δεκέμβριο", next_review: "2027-03-01" }
        : p,
    );

    const after = supportOverview(planner).find((r) => r.student.id === ELENI)!;
    expect(after.plans[0].status).toBe("Αναθεωρήθηκε τον Δεκέμβριο");
    expect(after.plans[0].next_review).toBe("2027-03-01");
    // Her other plan is untouched by that edit.
    expect(after.plans[1].status).toBe("Ολοκληρώθηκε");
  });

  it("brings a student in as soon as her first plan exists, and drops her when the last goes", () => {
    const planner = supportPlanner();
    expect(supportOverview(planner).some((r) => r.student.id === KOSTAS)).toBe(false);

    planner.support_plans = [
      ...planner.support_plans,
      {
        id: 44,
        student_id: KOSTAS,
        position: 0,
        start_date: "",
        monitoring_frequency: "",
        strengths: "",
        needs: "",
        accommodations: "",
        collaboration: "",
        status: "Νέο πλάνο",
        next_review: "",
      },
    ];
    const withKostas = supportOverview(planner).find((r) => r.student.id === KOSTAS);
    expect(withKostas!.plans[0].status).toBe("Νέο πλάνο");

    planner.support_plans = planner.support_plans.filter((p) => p.student_id !== KOSTAS);
    expect(supportOverview(planner).some((r) => r.student.id === KOSTAS)).toBe(false);
  });

  it("does not read the card's ΕΠΕ box and a plan as the same thing", () => {
    const planner = supportPlanner();
    const row = supportOverview(planner).find((r) => r.student.id === ELENI)!;
    // The card's own text is one field; the plans are separate records. Editing
    // a plan leaves the card's text alone and vice versa.
    expect(row.accommodations).toBe("Επιπλέον χρόνος στις γραπτές εργασίες");
    expect(row.plans[0].accommodations).toBe("Επιπλέον χρόνος");
    expect(row.accommodations).not.toBe(row.plans[0].accommodations);
  });
});

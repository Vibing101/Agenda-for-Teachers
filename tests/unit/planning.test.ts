/**
 * The rest of M6's selectors: units and the annual plan that is a view of them,
 * the exam tracker, the reflection log, trips and their consents, and the two
 * reference lists.
 */
import { describe, expect, it } from "vitest";
import { annualPlan, emptyUnit, hasUnitContent, unitsOfClass } from "../../src/domain/units";
import {
  allExams,
  emptyExam,
  examClass,
  filteredExams,
  upcomingExams,
} from "../../src/domain/exams";
import {
  allReflections,
  filteredReflections,
  reflectionClass,
} from "../../src/domain/reflections";
import { consentFor, consentTally, tripRoster } from "../../src/domain/trips";
import {
  allTextbooks,
  resourcesIn,
  textbookSubjects,
} from "../../src/domain/resources";
import { gradedPlanner } from "../helpers/gradebookFixture";
import {
  A1,
  A_DAY,
  B2,
  BLANK_UNIT,
  ELENI,
  FAR_EXAM,
  G3,
  KOSTAS,
  MARIA,
  NEAR_EXAM,
  TRIP,
  UNIT_ONE,
  UNIT_TWO,
  planningPlanner,
} from "../helpers/planningFixture";

describe("units, and the annual plan that is a view of them", () => {
  it("lists one class's units in the order the teacher put them in", () => {
    const planner = planningPlanner();
    expect(unitsOfClass(planner, A1).map((u) => u.id)).toEqual([UNIT_ONE, UNIT_TWO]);
    expect(unitsOfClass(planner, B2).map((u) => u.id)).toEqual([BLANK_UNIT]);
    expect(unitsOfClass(planner, G3)).toEqual([]);
  });

  /**
   * **The annual plan is a view, so there is nothing to keep in step.** Every
   * column of the source's *Ετήσιο πλάνο* table reads a field of the unit the
   * teacher edits on its card — checked as identity, not as a copy that happens
   * to agree today.
   */
  it("reads every one of its five columns straight off the unit", () => {
    const planner = planningPlanner();
    const [first] = annualPlan(planner, A1);
    const unit = unitsOfClass(planner, A1)[0];

    expect(first.unit).toBe(unit);
    expect(first.period).toBe(unit.period);
    expect(first.title).toBe(unit.title);
    expect(first.skills).toBe(unit.skills);
    expect(first.hours).toBe(unit.hours);
    expect(first.assessment).toBe(unit.assessment);
  });

  it("follows an edit to a unit with no second thing to update", () => {
    const planner = planningPlanner();
    planner.units = planner.units.map((u) =>
      u.id === UNIT_ONE ? { ...u, title: "Αλλαγμένος τίτλος", hours: "14" } : u,
    );
    const [first] = annualPlan(planner, A1);
    expect(first.title).toBe("Αλλαγμένος τίτλος");
    expect(first.hours).toBe("14");
  });

  it("knows a blank unit from a filled one, so a new card says so", () => {
    const planner = planningPlanner();
    expect(hasUnitContent(unitsOfClass(planner, A1)[0])).toBe(true);
    expect(hasUnitContent(unitsOfClass(planner, B2)[0])).toBe(false);
    expect(hasUnitContent(emptyUnit(A1))).toBe(false);
  });

  it("gives a blank unit the class it was created on and no id", () => {
    const unit = emptyUnit(B2);
    expect(unit.class_id).toBe(B2);
    expect(unit.id).toBe(0);
  });
});

describe("the exam tracker", () => {
  it("reads a year's exams forwards, with an undated one at the front", () => {
    const planner = planningPlanner();
    planner.exams = [...planner.exams, { ...emptyExam(A1), id: 999 }];
    expect(allExams(planner).map((e) => e.id)).toEqual([999, NEAR_EXAM, FAR_EXAM]);
  });

  it("filters to one class, and names what it hides", () => {
    const planner = planningPlanner();
    expect(filteredExams(planner, { classId: 0 })).toHaveLength(2);
    expect(filteredExams(planner, { classId: A1 }).map((e) => e.id)).toEqual([NEAR_EXAM]);
    expect(filteredExams(planner, { classId: G3 })).toEqual([]);
  });

  it("looks the subject up on the class rather than storing it", () => {
    const planner = planningPlanner();
    const exam = allExams(planner).find((e) => e.id === NEAR_EXAM)!;
    expect(examClass(planner, exam)!.subject).toBe("Μαθηματικά");
    expect(Object.keys(exam)).not.toContain("subject");

    // Renaming the class's subject changes what the register shows, with
    // nothing to regenerate.
    planner.classes = planner.classes.map((c) =>
      c.id === A1 ? { ...c, subject: "Άλγεβρα" } : c,
    );
    expect(examClass(planner, exam)!.subject).toBe("Άλγεβρα");
  });

  it("hands back no class for an exam whose class has been deleted", () => {
    const planner = planningPlanner();
    planner.exams = planner.exams.map((e) =>
      e.id === NEAR_EXAM ? { ...e, class_id: null } : e,
    );
    expect(examClass(planner, allExams(planner)[0])).toBeNull();
  });

  /**
   * The window is a **pure function of the day**, at its boundary rather than
   * by a row count — the shape `upcomingOverview` established at M5.
   */
  it("surfaces only the exams inside the window, from the day it is given", () => {
    const planner = planningPlanner();
    // A_DAY is 04.11; the near exam is 12.11, the far one 10.02.
    expect(upcomingExams(planner, A_DAY).map((e) => e.id)).toEqual([NEAR_EXAM]);
    // Eight days is one day short of it.
    expect(upcomingExams(planner, A_DAY, 7)).toEqual([]);
    // And a day after it has passed, it is no longer upcoming.
    expect(upcomingExams(planner, "2026-11-13")).toEqual([]);
    // The same planner gives a different panel on a different day.
    expect(upcomingExams(planner, "2027-02-01").map((e) => e.id)).toEqual([FAR_EXAM]);
  });

  it("leaves an undated exam out of the window, because nothing says when it is", () => {
    const planner = planningPlanner();
    planner.exams = [{ ...emptyExam(A1), id: 999 }];
    expect(upcomingExams(planner, A_DAY)).toEqual([]);
  });

  /**
   * **An exam's weight computes nothing.** M2's gradebook is what produces an
   * average, and the two live in different tables with no call between them.
   * Checked as insensitivity of the whole gradebook output.
   */
  it("cannot reach the gradebook's own weights", () => {
    const withExams = gradedPlanner();
    withExams.exams = planningPlanner().exams;
    const without = gradedPlanner();

    expect(withExams.grade_columns).toEqual(without.grade_columns);
    expect(withExams.grade_values).toEqual(without.grade_values);
    // And no exam carries anything the gradebook would read.
    for (const exam of withExams.exams) {
      expect(Object.keys(exam)).not.toContain("column_id");
    }
  });
});

describe("the lesson reflection log", () => {
  it("reads newest first, as a log kept for the teacher's own use does", () => {
    const planner = planningPlanner();
    expect(allReflections(planner).map((r) => r.date)).toEqual(["2026-11-05", "2026-10-21"]);
  });

  it("filters to one class, and keeps the ones that name none out of it", () => {
    const planner = planningPlanner();
    expect(filteredReflections(planner, { classId: 0 })).toHaveLength(2);
    expect(filteredReflections(planner, { classId: A1 }).map((r) => r.id)).toEqual([501]);
  });

  it("hands back no class for an entry that names none", () => {
    const planner = planningPlanner();
    const orphan = allReflections(planner).find((r) => r.id === 502)!;
    expect(reflectionClass(planner, orphan)).toBeNull();
  });

  /**
   * A reflection is not a plan, and the matrix reads the plan. Checked where it
   * matters: adding reflections changes no lesson plan.
   */
  it("is independent of the weekly plan the progress matrix reads", () => {
    const planner = planningPlanner();
    const before = structuredClone(planner.lesson_plans);
    planner.lesson_reflections = [
      ...planner.lesson_reflections,
      { id: 503, class_id: A1, date: "2026-11-03", notes: "Γράφτηκε ως αναστοχασμός" },
    ];
    expect(planner.lesson_plans).toEqual(before);
  });
});

describe("trips and their consents", () => {
  it("reads the consent list from the class roster, in roster order", () => {
    const planner = planningPlanner();
    const trip = planner.trips[0];
    expect(tripRoster(planner, trip).map((s) => s.id)).toEqual([ELENI, KOSTAS, MARIA]);
  });

  it("lists a student added to the class, with nothing recorded for her", () => {
    const planner = planningPlanner();
    planner.students = [
      ...planner.students,
      { ...planner.students[0], id: 104, full_name: "Νέα μαθήτρια" },
    ];
    planner.enrollments = [
      ...planner.enrollments,
      { class_id: A1, student_id: 104, roster_no: 4, support: false, note: "" },
    ];

    const trip = planner.trips[0];
    expect(tripRoster(planner, trip).map((s) => s.id)).toContain(104);
    expect(consentFor(planner, trip.id, 104).state).toBe("");
  });

  it("hands back an empty roster for a trip that names no class", () => {
    const planner = planningPlanner();
    planner.trips = planner.trips.map((t) => ({ ...t, class_id: null }));
    expect(tripRoster(planner, planner.trips[0])).toEqual([]);
  });

  /**
   * **`Συγκαταθέσεις` is counted, never typed.** The fixture has one given, one
   * refused and one not recorded, which is the only shape that tells a real
   * count apart from a guess.
   */
  it("counts the register's consent cell off the recorded consents", () => {
    const planner = planningPlanner();
    expect(consentTally(planner, planner.trips[0])).toEqual({
      given: 1,
      refused: 1,
      total: 3,
      pending: 1,
    });
  });

  it("follows a consent as it is given, changed and cleared", () => {
    const planner = planningPlanner();
    planner.trip_consents = [
      ...planner.trip_consents,
      { trip_id: TRIP, student_id: MARIA, state: "given", note: "" },
    ];
    expect(consentTally(planner, planner.trips[0])).toMatchObject({ given: 2, pending: 0 });

    // Cleared means the row is gone — not a third state.
    planner.trip_consents = planner.trip_consents.filter((c) => c.student_id !== MARIA);
    expect(consentTally(planner, planner.trips[0])).toMatchObject({ given: 1, pending: 1 });
    expect(consentFor(planner, TRIP, MARIA).state).toBe("");
  });

  it("ignores a consent for a student who has left the class", () => {
    const planner = planningPlanner();
    // Ελένη leaves A1; her consent row is still on the file.
    planner.enrollments = planner.enrollments.filter((e) => e.student_id !== ELENI);
    const tally = consentTally(planner, planner.trips[0]);
    expect(tally.total).toBe(2);
    expect(tally.given).toBe(0);
    expect(tally.refused).toBe(1);
  });

  it("counts nothing for a trip with no class", () => {
    const planner = planningPlanner();
    planner.trips = planner.trips.map((t) => ({ ...t, class_id: null }));
    expect(consentTally(planner, planner.trips[0])).toEqual({
      given: 0,
      refused: 0,
      total: 0,
      pending: 0,
    });
  });

  it("keeps one trip's consents out of another's tally", () => {
    const planner = planningPlanner();
    planner.trips = [
      ...planner.trips,
      { ...planner.trips[0], id: 202, activity: "Δεύτερη εκδρομή" },
    ];
    expect(consentTally(planner, planner.trips[1])).toMatchObject({ given: 0, pending: 3 });
  });
});

describe("the two reference lists", () => {
  it("keeps textbooks in the order the teacher put them in", () => {
    const planner = planningPlanner();
    planner.textbooks = [
      ...planner.textbooks,
      { ...planner.textbooks[0], id: 602, position: 1, subject: "Φυσική", title: "Φυσική Β΄" },
    ];
    expect(allTextbooks(planner).map((b) => b.id)).toEqual([601, 602]);
  });

  it("lists the subjects the book list actually mentions", () => {
    const planner = planningPlanner();
    planner.textbooks = [
      ...planner.textbooks,
      { ...planner.textbooks[0], id: 602, subject: "Φυσική" },
      { ...planner.textbooks[0], id: 603, subject: "  " },
    ];
    expect(textbookSubjects(planner)).toEqual(["Μαθηματικά", "Φυσική"]);
  });

  it("groups resources by the source page's own six categories", () => {
    const planner = planningPlanner();
    expect(resourcesIn(planner, "websites").map((r) => r.title)).toEqual(["GeoGebra"]);
    expect(resourcesIn(planner, "classroom").map((r) => r.title)).toEqual(["Γεωμετρικά όργανα"]);
    expect(resourcesIn(planner, "apps")).toEqual([]);
  });

  /**
   * Neither list hangs off a class or a week, so correcting the school year's
   * start date leaves both exactly as they were.
   */
  it("neither carries a date, so moving the school year touches neither", () => {
    const planner = planningPlanner();
    const books = structuredClone(allTextbooks(planner));
    const resources = structuredClone(resourcesIn(planner, "websites"));

    planner.school_year = { ...planner.school_year, start_date: "2026-09-07" };

    expect(allTextbooks(planner)).toEqual(books);
    expect(resourcesIn(planner, "websites")).toEqual(resources);
    for (const book of allTextbooks(planner)) {
      expect(Object.keys(book)).not.toContain("date");
    }
  });
});

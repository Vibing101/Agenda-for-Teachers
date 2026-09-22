/**
 * A planner shaped like a real one, for the M4 surfaces.
 *
 * Deliberately asymmetric, so every case M4 has to get right is in it and the
 * expectations below can be worked out by hand:
 *
 * * **Ελένη is marked `present` in the grid on 05.11 and carries a logged late
 *   arrival on the same date.** That one pair is M4's first acceptance
 *   criterion: the two registers hold different, non-derived data for the same
 *   student and day, and neither may move the other.
 * * **Four students, chosen so each of the overview's three inclusion signals
 *   is exercised alone**: Ελένη has a card-level ΕΠΕ category *and* a per-class
 *   support tick *and* plans; Νίκος has nothing but a plan; Μαρία has nothing
 *   but a class's support tick; **Κώστας has none of the three and must not
 *   appear at all**.
 * * **Ελένη is enrolled in two classes and her support tick is on Α1 only**,
 *   which is what makes "card-level" and "per-class" distinguishable.
 * * **Two plans for one student, with different statuses**, so the "a goal
 *   never writes a status" test has a sibling to check went untouched.
 * * **Marks and events outside November**, so a month view that leaked into its
 *   neighbours would be caught.
 *
 * November 2026 is the month on show: 30 days, and no leap-year edge.
 */
import type {
  AbsenceEvent,
  AttendanceMark,
  Enrollment,
  Incident,
  Planner,
  SchoolClass,
  Student,
  SupportGoal,
  SupportPlan,
} from "../../src/domain/types";
import { emptyPlanner } from "./fakeBackend";

export const A1 = 1;
export const B2 = 2;

export const ELENI = 21;
export const NIKOS = 22;
export const MARIA = 23;
export const KOSTAS = 24;

export const PLAN_ONE = 41;
export const PLAN_TWO = 42;
export const NIKOS_PLAN = 43;

export const GOAL_ONE = 51;
export const GOAL_TWO = 52;

/** A day in the month every M4 test looks at. */
export const IN_NOVEMBER = "2026-11-16";
/** The date the grid and the log deliberately disagree about. */
export const CONTESTED_DAY = "2026-11-05";

function schoolClass(id: number, name: string, subject: string): SchoolClass {
  return {
    id,
    name,
    subject,
    room: "203",
    responsible: "",
    notes: "",
    position: id,
    seating_rows: 5,
    seating_cols: 6,
    seating_notes: "",
  };
}

function student(id: number, fullName: string, patch: Partial<Student> = {}): Student {
  return {
    id,
    full_name: fullName,
    register_number: String(id),
    birth_date: "",
    home_language: "",
    address: "",
    midyear_enrollment: false,
    guardian1_name: "",
    guardian1_phone: "",
    guardian1_email: "",
    guardian2_name: "",
    guardian2_phone: "",
    guardian2_email: "",
    allergies: "",
    conditions: "",
    medication: "",
    emergency_phone: "",
    sen_status: "none",
    sen_plan: "",
    sen_accommodations: "",
    notes: "",
    meeting_notes: "",
    ...patch,
  };
}

function enrollment(
  classId: number,
  studentId: number,
  rosterNo: number,
  support = false,
  note = "",
): Enrollment {
  return { class_id: classId, student_id: studentId, roster_no: rosterNo, support, note };
}

function mark(studentId: number, date: string, state: AttendanceMark["state"]): AttendanceMark {
  return { class_id: A1, student_id: studentId, date, state };
}

function event(patch: Partial<AbsenceEvent> & { id: number; student_id: number }): AbsenceEvent {
  return {
    class_id: A1,
    date: "",
    kind: "absence",
    clock_time: "",
    teaching_hour: "",
    reason: "",
    justified: false,
    follow_up: "",
    frequent_note: "",
    ...patch,
  };
}

function incident(patch: Partial<Incident> & { id: number; student_id: number }): Incident {
  return {
    class_id: null,
    date: "",
    what_happened: "",
    action_taken: "",
    parents_informed: false,
    ...patch,
  };
}

function plan(patch: Partial<SupportPlan> & { id: number; student_id: number }): SupportPlan {
  return {
    position: 0,
    start_date: "",
    monitoring_frequency: "",
    strengths: "",
    needs: "",
    accommodations: "",
    collaboration: "",
    status: "",
    next_review: "",
    ...patch,
  };
}

function goal(patch: Partial<SupportGoal> & { id: number; plan_id: number }): SupportGoal {
  return { position: 0, goal: "", progress: "", monitored_on: "", ...patch };
}

export function supportPlanner(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
  planner.classes = [schoolClass(A1, "Α1", "Μαθηματικά"), schoolClass(B2, "Β2", "Φυσική")];

  planner.students = [
    student(ELENI, "Ελένη Παπαδοπούλου", {
      sen_status: "accommodations",
      sen_plan: "ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ 04/2026",
      sen_accommodations: "Επιπλέον χρόνος στις γραπτές εργασίες",
    }),
    student(NIKOS, "Νίκος Γεωργίου"),
    student(MARIA, "Μαρία Ιωάννου"),
    student(KOSTAS, "Κώστας Δημητρίου"),
  ];

  planner.enrollments = [
    // Ελένη is in both classes, but only Α1 ticks her support box.
    enrollment(A1, ELENI, 1, true, "Κάθεται μπροστά"),
    enrollment(B2, ELENI, 1, false),
    enrollment(A1, NIKOS, 2),
    enrollment(A1, KOSTAS, 3),
    // Μαρία's only signal is this tick.
    enrollment(B2, MARIA, 2, true, "Ενισχυτική στα μαθηματικά"),
  ];

  planner.attendance_marks = [
    // November, in Α1. Hand-counted below by the unit tests.
    mark(ELENI, CONTESTED_DAY, "present"),
    mark(ELENI, "2026-11-06", "absent"),
    mark(ELENI, "2026-11-09", "absent"),
    mark(ELENI, "2026-11-10", "late"),
    mark(ELENI, "2026-11-12", "excused"),
    mark(NIKOS, "2026-11-09", "absent"),
    // October, so a month view that leaked would be caught.
    mark(ELENI, "2026-10-15", "absent"),
  ];

  planner.absence_events = [
    // The same student, the same date as the `present` mark above.
    event({
      id: 61,
      student_id: ELENI,
      date: CONTESTED_DAY,
      kind: "late",
      clock_time: "08:35",
      teaching_hour: "1η",
      reason: "Καθυστέρηση λεωφορείου",
      justified: true,
      follow_up: "informed",
      frequent_note: "Τρίτη φορά αυτόν τον μήνα",
    }),
    event({
      id: 62,
      student_id: NIKOS,
      date: "2026-11-09",
      kind: "absence",
      reason: "Ιατρικό ραντεβού",
      follow_up: "pending",
    }),
    // October, so the register is visibly not month-scoped.
    event({ id: 63, student_id: ELENI, date: "2026-10-20", kind: "absence" }),
  ];

  planner.incidents = [
    incident({
      id: 71,
      student_id: ELENI,
      class_id: A1,
      date: "2026-11-06",
      what_happened: "Διαφωνία στο διάλειμμα",
      action_taken: "Συζήτηση με τους δύο μαθητές",
      parents_informed: true,
    }),
    // No class at all — the source's Τάξη column is optional.
    incident({
      id: 72,
      student_id: ELENI,
      date: "2026-09-30",
      what_happened: "Καθυστερημένη εργασία",
      action_taken: "Νέα προθεσμία",
    }),
    incident({
      id: 73,
      student_id: MARIA,
      class_id: B2,
      date: "2026-11-02",
      what_happened: "Βοήθησε συμμαθήτρια",
      action_taken: "Έπαινος",
    }),
  ];

  planner.support_plans = [
    plan({
      id: PLAN_ONE,
      student_id: ELENI,
      position: 0,
      start_date: "2026-10-01",
      monitoring_frequency: "Κάθε δεύτερη εβδομάδα",
      strengths: "Ισχυρή προφορική έκφραση",
      needs: "Δυσκολία στην αποκωδικοποίηση",
      accommodations: "Επιπλέον χρόνος",
      collaboration: "Συνεργασία με τη λογοθεραπεύτρια",
      status: "Σε εφαρμογή",
      next_review: "2027-01-15",
    }),
    plan({
      id: PLAN_TWO,
      student_id: ELENI,
      position: 1,
      start_date: "2026-09-01",
      status: "Ολοκληρώθηκε",
    }),
    plan({
      id: NIKOS_PLAN,
      student_id: NIKOS,
      position: 0,
      status: "Υπό κατάρτιση",
      next_review: "2026-12-01",
    }),
  ];

  planner.support_goals = [
    goal({
      id: GOAL_ONE,
      plan_id: PLAN_ONE,
      position: 0,
      goal: "Ανάγνωση κειμένου 80 λέξεων χωρίς βοήθεια",
      progress: "in_progress",
      monitored_on: "2026-11-20",
    }),
    goal({
      id: GOAL_TWO,
      plan_id: PLAN_ONE,
      position: 1,
      goal: "Ολοκλήρωση γραπτής εργασίας στον χρόνο",
      progress: "met",
      monitored_on: "2026-11-20",
    }),
  ];

  return planner;
}

/**
 * A teacher's classes and her saved forms, for M7's selector, sheet and screen
 * tests.
 *
 * Built the way `supportFixture`, `parentsFixture` and `planningFixture` are:
 * **deliberately asymmetric, with the awkward cases in it on purpose.** What is
 * in it and why:
 *
 * * **A student seated in two classes, at different desks** (Κώστας: Α1 front
 *   row, Β2 third row). A folder that read the wrong class's seats, or every
 *   class's, puts him in the wrong place — and a fixture where each student
 *   sits in one class cannot tell.
 * * **A third class with nothing in it** — no roster, no seats, no hours, no
 *   plan — which the folder must still print as six pages of blanks.
 * * **Plans in two adjacent weeks for Α1**, so a folder that showed last week's
 *   plan, or the first one it found, fails. The pinned day is a Wednesday; a
 *   second pinned day is a Saturday, whose "current week" is the coming one.
 * * **An hour with a room override** (Α1 meets in the lab on Wednesdays), a
 *   duty with no class, and an hour of Β2's — so the folder's week shows only
 *   Α1's lessons, in the right rooms.
 * * **All three states a folder text can be in, side by side**: Α1's rules
 *   edited, Α1's materials cleared to nothing, Β2 untouched. The same three on
 *   the school-wide procedures. "Cleared" and "untouched" are the pair a naive
 *   store would conflate.
 * * **Every signal that puts a student in the attention box**, one each: a
 *   card category, a class's support tick with a note, an allergy, a
 *   medication — plus a student with none, who must not be listed.
 * * **Three saved forms of two kinds**, one of them a *room plan* — so a test
 *   can prove the blank room-plan form never picks up the real seats around
 *   it, and so every "new form" test starts from a planner that already holds
 *   one (the rule M1's `Νέο τμήμα` bug bought).
 * * **A 17-character Greek surname** (`Χατζηκωνσταντίνου`), the name that found
 *   a real layout defect at M5.
 */
import type { PrintForm } from "../../src/domain/printForms";
import type { Planner, SchoolClass, Student } from "../../src/domain/types";
import { emptyPlanner } from "./fakeBackend";

export const A1 = 1;
export const B2 = 2;
/** The class with nothing in it at all. */
export const G3 = 3;

export const ELENI = 101;
export const KOSTAS = 102;
export const MARIA = 103;
export const NIKOS = 104;

export const ROOM_FORM = 501;
export const NOTE_FORM = 502;
export const GOALS_FORM = 503;

/** A Wednesday. Its folder week is the week of 02.11.2026. */
export const A_WEDNESDAY = "2026-11-04";
export const THIS_MONDAY = "2026-11-02";
export const LAST_MONDAY = "2026-10-26";
/** A Saturday. Its folder week is the *coming* one, 09.11.2026. */
export const A_SATURDAY = "2026-11-07";
export const NEXT_MONDAY = "2026-11-09";

function schoolClass(
  id: number,
  name: string,
  subject: string,
  room: string,
  responsible: string,
  seatingNotes = "",
): SchoolClass {
  return {
    id,
    name,
    subject,
    room,
    responsible,
    notes: "",
    position: id,
    seating_rows: 5,
    seating_cols: 6,
    seating_notes: seatingNotes,
  };
}

function student(id: number, full_name: string, extra: Partial<Student> = {}): Student {
  return {
    id,
    full_name,
    register_number: "",
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
    ...extra,
  };
}

export function formsPlanner(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
  planner.classes = [
    schoolClass(A1, "Α1", "Μαθηματικά", "Αίθουσα 12", "Κ. Γεωργίου", "Η Ελένη μπροστά, κοντά στον πίνακα."),
    schoolClass(B2, "Β2", "Φυσική", "Εργαστήριο", "Μ. Ιωάννου"),
    schoolClass(G3, "Γ3", "Ιστορία", "", ""),
  ];
  planner.students = [
    student(ELENI, "Ελένη Παπαδοπούλου", { allergies: "Φιστίκια", sen_status: "accommodations" }),
    student(KOSTAS, "Κώστας Χατζηκωνσταντίνου"),
    student(MARIA, "Μαρία Ιωάννου", { medication: "Εισπνοές πριν τη γυμναστική" }),
    // In Α1, with nothing on the card that a substitute needs to know.
    student(NIKOS, "Νίκος Αντωνίου"),
  ];
  planner.enrollments = [
    { class_id: A1, student_id: ELENI, roster_no: 1, support: true, note: "Κάθεται μπροστά" },
    { class_id: A1, student_id: KOSTAS, roster_no: 2, support: false, note: "" },
    { class_id: A1, student_id: MARIA, roster_no: 3, support: false, note: "" },
    { class_id: A1, student_id: NIKOS, roster_no: 4, support: false, note: "" },
    { class_id: B2, student_id: KOSTAS, roster_no: 1, support: false, note: "" },
    { class_id: B2, student_id: ELENI, roster_no: 2, support: false, note: "" },
  ];
  planner.seats = [
    { class_id: A1, row: 0, col: 0, student_id: ELENI },
    { class_id: A1, row: 0, col: 1, student_id: KOSTAS },
    { class_id: A1, row: 1, col: 3, student_id: MARIA },
    // The same student, a different class, a different desk.
    { class_id: B2, row: 2, col: 3, student_id: KOSTAS },
  ];
  planner.timetable_periods = [
    { id: 11, position: 0, name: "1η", start_time: "07:45", end_time: "08:25" },
    { id: 12, position: 1, name: "2η", start_time: "08:25", end_time: "09:05" },
    { id: 13, position: 2, name: "3η", start_time: "09:25", end_time: "10:05" },
  ];
  const cell = (period_id: number, weekday: number, class_id: number | null, extra = {}) => ({
    period_id,
    weekday,
    class_id,
    subject: "",
    room: "",
    duty: "",
    notes: "",
    ...extra,
  });
  planner.timetable_cells = [
    cell(11, 1, A1),
    cell(12, 3, A1, { room: "Εργαστήριο Η/Υ", notes: "Φέρνουν φορητούς" }),
    cell(11, 2, B2),
    cell(13, 4, null, { duty: "Εφημερία προαυλίου" }),
  ];
  planner.lesson_plans = [
    {
      class_id: A1,
      week_monday: LAST_MONDAY,
      notes: "Κεφάλαιο 3 — επανάληψη",
      assessment: "",
    },
    {
      class_id: A1,
      week_monday: THIS_MONDAY,
      notes: "Κεφάλαιο 4 — εξισώσεις\nΑσκήσεις 1–6 σελ. 45",
      assessment: "Ολιγόλεπτο την Τετάρτη",
    },
    { class_id: B2, week_monday: THIS_MONDAY, notes: "Ταλαντώσεις", assessment: "" },
  ];
  planner.substitute_texts = [
    { class_id: A1, field: "rules", value: "Μπαίνουμε με τη σειρά του καταλόγου." },
    // Cleared on purpose: this must stay empty, not fall back to the suggestion.
    { class_id: A1, field: "materials", value: "" },
    { class_id: A1, field: "day.goal", value: "Επανάληψη χωρίς νέα ύλη" },
    { class_id: A1, field: "day.1.time", value: "08:00" },
    { class_id: A1, field: "day.1.activity", value: "Ασκήσεις σελ. 45" },
    { class_id: A1, field: "attention", value: "Ο Νίκος χρειάζεται χρόνο για να ξεκινήσει." },
  ];
  planner.substitute_school_texts = [
    { field: "contact.principal", value: "Α. Νικολάου · 22 123456" },
    { field: "proc.toilet", value: "Μόνο στο διάλειμμα." },
    { field: "proc.devices", value: "" },
  ];
  const form = (
    id: number,
    kind: PrintForm["kind"],
    name: string,
    values: Record<string, string>,
    updated: string,
  ): PrintForm => ({ id, kind, name, created: "2026-10-01", updated, values });
  planner.print_forms = [
    form(ROOM_FORM, "roomPlan", "Αίθουσα 12 — πρόχειρο", { "desk.1.1": "Νίκος", class: "Α1" }, "2026-10-20"),
    form(
      NOTE_FORM,
      "parentNote",
      "Εκδρομή Νοεμβρίου",
      { "note.1.student": "Ελένη Παπαδοπούλου", "note.1.body": "Παρακαλώ υπογράψτε." },
      "2026-10-22",
    ),
    form(GOALS_FORM, "goals", "Στόχοι 2026–27", { "goal.1.goal": "Περισσότερη διαφοροποίηση" }, "2026-10-02"),
  ];
  return planner;
}

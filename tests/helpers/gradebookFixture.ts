/**
 * A planner with a gradebook already in it.
 *
 * Shared by the print tests and the screen tests so both describe the same
 * dataset, and so the numbers asserted in each can be checked by hand once:
 *
 * **Α1 — Μαθηματικά**, threshold 10, columns 60% / 40% numeric, then a comment
 * column and a pass/fail column, neither of which counts:
 *
 * | # | student              | 60% | 40% | average               | suggestion |
 * |---|----------------------|-----|-----|-----------------------|------------|
 * | 1 | Ελένη Παπαδοπούλου   | 18  | 16  | (1080+640)/100 = 17.2 | 17 (pass)  |
 * | 2 | Γιώργος Χαραλάμπους  |  8  | 11  | (480+440)/100 = 9.2   | 9 (at risk)|
 * | 3 | Μαρία Ιωάννου        |  —  |  —  | none                  | none       |
 *
 * So Α1: average (17.2+9.2)/2 = 13.2, one at or above, one below, roster 3.
 *
 * **Β2 — Φυσική**, one column at 100%, Γιώργος on 20 → average 20.
 *
 * Year-wide, averaging the class averages: (13.2 + 20)/2 = 16.6.
 */
import type { Planner } from "../../src/domain/types";
import { emptyPlanner } from "./fakeBackend";

export const CLASS_ID = 1;
export const OTHER_CLASS_ID = 2;
export const ELENI = 11;
export const GIORGOS = 12;
export const MARIA = 13;

/** Column ids, so a test can name the one it means. */
export const FIRST_MARK = 101;
export const SECOND_MARK = 102;
export const COMMENT_COLUMN = 103;
export const PASS_FAIL_COLUMN = 104;
export const OTHER_CLASS_COLUMN = 105;

export function gradedPlanner(): Planner {
  const planner = emptyPlanner();

  planner.classes = [
    {
      id: CLASS_ID,
      name: "Α1",
      subject: "Μαθηματικά",
      room: "203",
      responsible: "Μ. Νικολάου",
      notes: "",
      position: 0,
      seating_rows: 5,
      seating_cols: 6,
      seating_notes: "",
      slots: [],
    },
    {
      id: OTHER_CLASS_ID,
      name: "Β2",
      subject: "Φυσική",
      room: "105",
      responsible: "Μ. Νικολάου",
      notes: "",
      position: 1,
      seating_rows: 5,
      seating_cols: 6,
      seating_notes: "",
      slots: [],
    },
  ];

  planner.students = [
    student(ELENI, "Ελένη Παπαδοπούλου"),
    student(GIORGOS, "Γιώργος Χαραλάμπους"),
    student(MARIA, "Μαρία Ιωάννου"),
  ];

  planner.enrollments = [
    enrol(CLASS_ID, ELENI, 1),
    enrol(CLASS_ID, GIORGOS, 2),
    enrol(CLASS_ID, MARIA, 3),
    enrol(OTHER_CLASS_ID, GIORGOS, 1),
  ];

  planner.class_gradings = [
    { class_id: CLASS_ID, pass_threshold: 10, scale_max: 20, period: "Α΄ τρίμηνο" },
    { class_id: OTHER_CLASS_ID, pass_threshold: 10, scale_max: 20, period: "" },
  ];

  planner.grade_columns = [
    { id: FIRST_MARK, class_id: CLASS_ID, position: 0, label: "Διαγώνισμα", kind: "numeric", weight: 60 },
    { id: SECOND_MARK, class_id: CLASS_ID, position: 1, label: "Εργασία", kind: "numeric", weight: 40 },
    {
      id: COMMENT_COLUMN,
      class_id: CLASS_ID,
      position: 2,
      label: "Σχόλιο",
      kind: "comment",
      weight: null,
    },
    {
      id: PASS_FAIL_COLUMN,
      class_id: CLASS_ID,
      position: 3,
      label: "Προφορικά",
      kind: "pass_fail",
      weight: null,
    },
    {
      id: OTHER_CLASS_COLUMN,
      class_id: OTHER_CLASS_ID,
      position: 0,
      label: "Τεστ",
      kind: "numeric",
      weight: 100,
    },
  ];

  planner.grade_values = [
    mark(CLASS_ID, FIRST_MARK, ELENI, "18"),
    mark(CLASS_ID, SECOND_MARK, ELENI, "16"),
    mark(CLASS_ID, COMMENT_COLUMN, ELENI, "Δούλεψε πολύ καλά στο δεύτερο τρίμηνο"),
    mark(CLASS_ID, PASS_FAIL_COLUMN, ELENI, "pass"),
    mark(CLASS_ID, FIRST_MARK, GIORGOS, "8"),
    mark(CLASS_ID, SECOND_MARK, GIORGOS, "11"),
    mark(OTHER_CLASS_ID, OTHER_CLASS_COLUMN, GIORGOS, "20"),
  ];

  planner.grade_rows = [
    {
      class_id: CLASS_ID,
      student_id: ELENI,
      conduct: "exemplary",
      observations: "Βοηθά τους συμμαθητές της",
      overall_result: "Άριστη πρόοδος",
    },
    {
      class_id: CLASS_ID,
      student_id: GIORGOS,
      conduct: "needs_support",
      observations: "",
      overall_result: "",
    },
  ];

  return planner;
}

function student(id: number, full_name: string) {
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
    sen_status: "none" as const,
    sen_plan: "",
    sen_accommodations: "",
    notes: "",
    meeting_notes: "",
  };
}

function enrol(class_id: number, student_id: number, roster_no: number) {
  return { class_id, student_id, roster_no, support: false, note: "" };
}

function mark(class_id: number, column_id: number, student_id: number, value: string) {
  return { class_id, column_id, student_id, value };
}

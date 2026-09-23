/**
 * A teacher's teaching year, for the M6 screen and selector tests.
 *
 * Built the way `supportFixture` and `parentsFixture` are: **deliberately
 * asymmetric, with the awkward case in it on purpose.** What is in it and why:
 *
 * * **Three classes, and one of them has no weekly plan at all.** The progress
 *   matrix has to show a column of blanks without falling over, and a test that
 *   only ever sees filled cells would not catch a matrix that quietly dropped
 *   an empty class.
 * * **Plans in two different weeks, one of them not adjacent**, so a windowed
 *   grid that silently showed every plan on every row would fail.
 * * **A plan whose notes are several lines**, because the matrix's cell shows
 *   the first line and a test of a one-line plan cannot tell the difference.
 * * **A plan with an assessment and one without**, which is the source page's
 *   own emphasis and the matrix's one derived flag.
 * * **Two units on one class and none on another**, plus a blank unit — the
 *   create-then-edit case, which M1 paid for.
 * * **Two exams, one of them within a fortnight of the pinned day and one far
 *   off**, so the upcoming panel is tested at its boundary rather than by
 *   counting rows.
 * * **A trip with a roster of three, one consent given, one refused and one not
 *   recorded**, which is the only shape that distinguishes a tally that counts
 *   from one that guesses.
 * * **A 17-character Greek surname** (`Χατζηκωνσταντίνου`), the name that found
 *   a real layout defect at M5.
 *
 * The school year starts Monday 14.09.2026, so the week of 02.11.2026 is week 8
 * and the week of 16.11.2026 is week 10. `A_DAY` is inside week 8.
 */
import type { Planner, SchoolClass, Student } from "../../src/domain/types";
import { emptyPlanner } from "./fakeBackend";

export const A1 = 1;
export const B2 = 2;
/** The third class, which deliberately has no plan and no unit. */
export const G3 = 3;

export const ELENI = 101;
export const KOSTAS = 102;
export const MARIA = 103;

export const TRIP = 201;
export const UNIT_ONE = 301;
export const UNIT_TWO = 302;
export const BLANK_UNIT = 303;
export const NEAR_EXAM = 401;
export const FAR_EXAM = 402;

/** Monday 14.09.2026 — week 1. */
export const YEAR_START = "2026-09-14";
/** The Monday of week 8, the week the main plans are filed against. */
export const PLAN_MONDAY = "2026-11-02";
/** The Monday of week 10 — deliberately not adjacent to week 8. */
export const LATER_MONDAY = "2026-11-16";
/** A Wednesday inside week 8. The day the screen tests pin. */
export const A_DAY = "2026-11-04";

function schoolClass(id: number, name: string, subject: string): SchoolClass {
  return {
    id,
    name,
    subject,
    room: "",
    responsible: "",
    notes: "",
    position: id,
    seating_rows: 5,
    seating_cols: 6,
    seating_notes: "",
  };
}

function student(id: number, fullName: string): Student {
  return {
    id,
    full_name: fullName,
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
  };
}

/** The first line of A1's week-8 plan — what the matrix's cell must show. */
export const A1_WEEK8_FIRST_LINE = "Κεφάλαιο 4: εξισώσεις πρώτου βαθμού";

export function planningPlanner(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: YEAR_START };
  planner.classes = [
    schoolClass(A1, "Α1", "Μαθηματικά"),
    schoolClass(B2, "Β2", "Φυσική"),
    schoolClass(G3, "Γ3", "Χημεία"),
  ];
  planner.students = [
    student(ELENI, "Ελένη Παπαδοπούλου"),
    student(KOSTAS, "Κώστας Χατζηκωνσταντίνου"),
    student(MARIA, "Μαρία Γεωργίου"),
  ];
  planner.enrollments = [
    { class_id: A1, student_id: ELENI, roster_no: 1, support: false, note: "" },
    { class_id: A1, student_id: KOSTAS, roster_no: 2, support: false, note: "" },
    { class_id: A1, student_id: MARIA, roster_no: 3, support: false, note: "" },
  ];

  // Γ3 deliberately has none: the matrix must show a column of blanks.
  planner.lesson_plans = [
    {
      class_id: A1,
      week_monday: PLAN_MONDAY,
      // Several lines, so the matrix's "first line" is a real reduction.
      notes: `${A1_WEEK8_FIRST_LINE}\nΦύλλο εργασίας 3\nΕπανάληψη στο τέλος`,
      assessment: "Ολιγόλεπτο διαγώνισμα την Πέμπτη",
    },
    {
      class_id: B2,
      week_monday: PLAN_MONDAY,
      notes: "Εργαστήριο: μετρήσεις",
      // No assessment: the matrix's one derived flag needs both cases.
      assessment: "",
    },
    {
      class_id: A1,
      week_monday: LATER_MONDAY,
      notes: "Γεωμετρία: τρίγωνα",
      assessment: "",
    },
  ];

  planner.units = [
    {
      id: UNIT_ONE,
      class_id: A1,
      position: 0,
      title: "Εξισώσεις πρώτου βαθμού",
      period: "Α΄ τρίμηνο",
      hours: "12",
      deadlines: "Παράδοση εργασιών 20.11.2026",
      objectives: "Να λύνουν εξίσωση με έναν άγνωστο",
      skills: "Αλγεβρικός χειρισμός · έλεγχος λύσης",
      methods: "Ομαδοσυνεργατική · φύλλα εργασίας",
      assessment: "Ολιγόλεπτο διαγώνισμα και εργασία",
      content: "Κεφάλαιο 4, ενότητες 4.1–4.4",
      materials: "Διαδραστικός πίνακας, φυλλάδια",
      differentiation: "Επιπλέον χρόνος · φύλλο με βήματα",
      review: "Πήγε καλά· χρειάζεται μία ώρα παραπάνω",
    },
    {
      id: UNIT_TWO,
      class_id: A1,
      position: 1,
      title: "Γεωμετρία: τρίγωνα",
      period: "Β΄ τρίμηνο",
      hours: "10",
      deadlines: "",
      objectives: "Να αναγνωρίζουν είδη τριγώνων",
      skills: "Κατασκευή με διαβήτη",
      methods: "Πρακτική άσκηση",
      assessment: "Εργασία",
      content: "Κεφάλαιο 6",
      materials: "Γεωμετρικά όργανα",
      differentiation: "",
      review: "",
    },
    // A blank one, on a different class: the create-then-edit case.
    {
      id: BLANK_UNIT,
      class_id: B2,
      position: 0,
      title: "",
      period: "",
      hours: "",
      deadlines: "",
      objectives: "",
      skills: "",
      methods: "",
      assessment: "",
      content: "",
      materials: "",
      differentiation: "",
      review: "",
    },
  ];

  planner.exams = [
    {
      id: NEAR_EXAM,
      class_id: A1,
      // Within a fortnight of A_DAY (04.11) — the upcoming panel's inside case.
      date: "2026-11-12",
      kind: "Ολιγόλεπτο διαγώνισμα",
      scope: "Κεφάλαιο 4, ενότητες 4.1–4.3",
      weight: "20%",
      collaboration: "Κοινό θέμα με τη Μ. Νικολάου",
    },
    {
      id: FAR_EXAM,
      class_id: B2,
      // Well outside it — the panel's boundary is tested, not its row count.
      date: "2027-02-10",
      kind: "Γραπτή εξέταση",
      scope: "Όλη η ύλη του Α΄ τριμήνου",
      weight: "40%",
      collaboration: "",
    },
  ];

  planner.lesson_reflections = [
    {
      id: 501,
      class_id: A1,
      date: "2026-11-05",
      notes: "Το παιχνίδι ρόλων δούλεψε· λιγότερη θεωρία στην αρχή",
    },
    { id: 502, class_id: null, date: "2026-10-21", notes: "Να δοκιμάσω σύντομες ομάδες" },
  ];

  planner.trips = [
    {
      id: TRIP,
      position: 0,
      date: "2026-12-04",
      activity: "Επίσκεψη στο Αρχαιολογικό Μουσείο",
      class_id: A1,
      responsible: "Μ. Νικολάου",
      transport: "Λεωφορείο του σχολείου",
      cost: "5 ευρώ ανά μαθητή",
      checklist: "Συγκαταθέσεις · φαγητό · φαρμακείο",
      evaluation: "",
    },
  ];
  // One given, one refused, one not recorded at all — the only shape that
  // distinguishes a counted tally from a guessed one.
  planner.trip_consents = [
    { trip_id: TRIP, student_id: ELENI, state: "given", note: "Παραδόθηκε 28.11" },
    { trip_id: TRIP, student_id: KOSTAS, state: "refused", note: "Ταξιδεύει" },
  ];

  planner.textbooks = [
    {
      id: 601,
      position: 0,
      subject: "Μαθηματικά",
      title: "Μαθηματικά Β΄ Γυμνασίου",
      publisher: "ΥΑΠ",
      isbn: "978-9963-0-0000-1",
      level: "Β΄ Γυμνασίου",
      price: "δωρεάν",
      status: "Σε χρήση",
      remarks: "Δύο αντίτυπα λείπουν",
    },
  ];

  planner.resources = [
    {
      id: 701,
      category: "websites",
      position: 0,
      title: "GeoGebra",
      detail: "https://www.geogebra.org",
      notes: "Για τη γεωμετρία",
    },
    {
      id: 702,
      category: "classroom",
      position: 0,
      title: "Γεωμετρικά όργανα",
      detail: "Ντουλάπι 2",
      notes: "",
    },
  ];

  return planner;
}

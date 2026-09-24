/**
 * A teacher's year for M8's selector and screen tests — the staff directory,
 * the covers and leave registers, development and wellbeing.
 *
 * Built the way `supportFixture`, `parentsFixture`, `planningFixture` and
 * `formsFixture` are: **deliberately asymmetric, with the awkward case in it on
 * purpose.** What is in it and why:
 *
 * * **A cover and a leave on the same date** (12.11.2026) — M8's second
 *   acceptance criterion is about exactly that collision — plus one more of
 *   each on different dates, so a register that merged the two would show.
 * * **A staff contact with the same name as a guardian** (Άννα Παπαδοπούλου is
 *   the deputy head *and* Ελένη's mother). The directory search must find the
 *   colleague once and never reach into the student cards.
 * * **Training costs that are blank, comma-typed, zero, and outside the
 *   year** — the four cases the budget roll-up has to get right. The comma
 *   one is stored as the number it parses to (12.5); the screen test types
 *   `12,50` itself.
 * * **All six annual goals filled, including `development`**, and a saved M7
 *   *Στόχοι* form — the two other goal surfaces M8's first criterion says the
 *   development goals are never generated from.
 * * **A timetable duty cell that says "Αναπλήρωση"** and a substitute folder
 *   contact: the planned week and the folder are not the covers register.
 *
 * The school year starts Monday 14.09.2026, so its window runs to Sunday
 * 19.09.2027, and Friday 13.11.2026 is in week 9.
 *
 * **Hand-computed budget summary for this fixture** (used by the unit tests):
 *
 * | Line | Date | Cost | Hours | Counted? |
 * |---|---|---|---|---|
 * | Διαφοροποίηση | 17.10.2026 | 12.50 | 3 | yes |
 * | Ψηφιακά εργαλεία | 20.11.2026 | — (blank) | 1.5 | yes, cost not entered |
 * | Εργαστήριο θεάτρου | 15.01.2027 | 0 | 2 | yes, free |
 * | Θερινό σχολείο | 10.06.2026 | 40 | 5 | **no — before the year** |
 *
 * So: 3 counted, spent 12.50 over 2 costed lines, 1 uncosted, 6.5 hours,
 * 1 outside, 0 undated; budget 100 → remaining 87.50. **If the blank were
 * read as 0, `costed` would be 3; if the June line were counted, spent would
 * be 52.50.** Both are the defects the roll-up tests are aimed at.
 */
import type { Planner, SchoolClass, Student } from "../../src/domain/types";
import { GOAL_AREAS } from "../../src/i18n/vocabularies";
import { emptyPlanner } from "./fakeBackend";

export const YEAR_START = "2026-09-14";
/** The day the screen tests pin: Friday of week 9. */
export const TODAY = "2026-11-13";
/** The date a cover and a leave share. */
export const SAME_DAY = "2026-11-12";

export const A1 = 1;
export const ELENI = 101;

export const ANNA_STAFF = 501;
export const OFFICE = 502;
export const GEORGIOU = 503;

export const COVER_SAME_DAY = 601;
export const COVER_LATER = 602;
export const LEAVE_SAME_DAY = 701;
export const LEAVE_LATER = 702;

export const GOAL_ONE = 801;
export const GOAL_TWO = 802;

export const TRAINING_COMMA = 901;
export const TRAINING_BLANK = 902;
export const TRAINING_ZERO = 903;
export const TRAINING_OUTSIDE = 904;

export const WELLBEING_WEEK9 = 951;
export const WELLBEING_WEEK8 = 952;

/** The name a guardian and a colleague share. */
export const SHARED_NAME = "Άννα Παπαδοπούλου";

function schoolClass(): SchoolClass {
  return {
    id: A1,
    name: "Α1",
    subject: "Μαθηματικά",
    room: "",
    responsible: "",
    notes: "",
    position: 0,
    seating_rows: 5,
    seating_cols: 6,
    seating_notes: "",
  };
}

function eleni(): Student {
  return {
    id: ELENI,
    full_name: "Ελένη Παπαδοπούλου",
    register_number: "",
    birth_date: "",
    home_language: "",
    address: "",
    midyear_enrollment: false,
    guardian1_name: SHARED_NAME,
    guardian1_phone: "99 111111",
    guardian1_email: "anna.home@example.com",
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

export function growthPlanner(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: YEAR_START };
  planner.classes = [schoolClass()];
  planner.students = [eleni()];
  planner.enrollments = [{ class_id: A1, student_id: ELENI, roster_no: 1, support: false, note: "" }];

  // All six filled, `development` included — the area whose name invites a copy.
  planner.annual_goals = GOAL_AREAS.map((area) => ({
    area,
    goal: `Ετήσιος στόχος: ${area}`,
    actions: "Ενέργειες",
    success_indicators: "Δείκτες",
    deadline: "2027-06-15",
    status: "Ξεκίνησε",
    review: "",
  }));

  // The master timetable's planned cover — not a record of one taught.
  planner.timetable_periods = [
    { id: 1, position: 0, name: "3η", start_time: "10:15", end_time: "11:00" },
  ];
  planner.timetable_cells = [
    {
      period_id: 1,
      weekday: 4,
      class_id: null,
      subject: "",
      room: "",
      duty: "Αναπλήρωση Γ2",
      notes: "",
    },
  ];
  planner.substitute_school_texts = [
    { field: "contact.principal", value: "Κ. Ιωάννου · 22 999999" },
  ];

  // M7's standalone goals form: a third goal surface, linked to nothing.
  planner.print_forms = [
    {
      id: 1,
      kind: "goals",
      name: "Στόχοι 2026-27",
      created: "2026-10-01",
      updated: "2026-10-02",
      values: { "goal.1.goal": "Μεταπτυχιακό στην εκπαίδευση" },
    },
  ];

  planner.staff_contacts = [
    {
      id: ANNA_STAFF,
      position: 0,
      full_name: SHARED_NAME,
      role: "Υποδιευθύντρια / Φιλόλογος",
      phone: "22 123456",
      email: "anna.p@school.example",
    },
    {
      id: OFFICE,
      position: 1,
      full_name: "Μαρία Κωνσταντίνου",
      role: "Γραμματεία",
      phone: "22 123400",
      email: "office@school.example",
    },
    {
      id: GEORGIOU,
      position: 2,
      full_name: "Κωνσταντίνος Γεωργίου",
      role: "Μαθηματικός",
      phone: "99 555555",
      email: "",
    },
  ];

  planner.cover_records = [
    {
      id: COVER_SAME_DAY,
      date: SAME_DAY,
      class_name: "Γ2",
      covered: "Ιστορία — κεφ. 3",
      teacher: "Κωνσταντίνος Γεωργίου",
      notes: "Υπέγραψε ο υποδιευθυντής",
    },
    {
      id: COVER_LATER,
      date: "2026-11-20",
      class_name: "Β4",
      covered: "Φυσική, ασκήσεις",
      teacher: "Ε. Χατζηκωνσταντίνου",
      notes: "",
    },
  ];
  planner.leave_records = [
    {
      id: LEAVE_SAME_DAY,
      date: SAME_DAY,
      reason: "Άδεια ασθενείας, 1 ημέρα",
      documents: "Ιατρικό πιστοποιητικό",
    },
    {
      id: LEAVE_LATER,
      date: "2026-12-03",
      reason: "Επιμόρφωση",
      documents: "",
    },
  ];

  planner.development_goals = [
    {
      id: GOAL_ONE,
      position: 0,
      goal: "Πιστοποίηση ΤΠΕ Β",
      status: "Σε εξέλιξη",
      progress: "2 από 4 ενότητες",
      notes: "Εξετάσεις τον Μάρτιο",
    },
    {
      id: GOAL_TWO,
      position: 1,
      goal: "Να παρακολουθήσω δύο μαθήματα συναδέλφων",
      status: "",
      progress: "",
      notes: "",
    },
  ];

  planner.training_entries = [
    {
      id: TRAINING_COMMA,
      date: "2026-10-17",
      activity: "Διαφοροποίηση",
      organiser: "Παιδαγωγικό Ινστιτούτο",
      hours: 3,
      format: "Διαδικτυακό",
      cost: 12.5,
      certificate: "Ναι",
    },
    {
      id: TRAINING_BLANK,
      date: "2026-11-20",
      activity: "Ψηφιακά εργαλεία",
      organiser: "Σύλλογος",
      hours: 1.5,
      format: "Δια ζώσης",
      cost: null,
      certificate: "Αναμένεται",
    },
    {
      id: TRAINING_ZERO,
      date: "2027-01-15",
      activity: "Εργαστήριο θεάτρου",
      organiser: "Δήμος",
      hours: 2,
      format: "Εργαστήριο",
      cost: 0,
      certificate: "",
    },
    {
      id: TRAINING_OUTSIDE,
      date: "2026-06-10",
      activity: "Θερινό σχολείο",
      organiser: "Πανεπιστήμιο",
      hours: 5,
      format: "Δια ζώσης",
      cost: 40,
      certificate: "Αρ. 2026/118",
    },
  ];
  planner.development_budget = { amount: 100, notes: "Καλύπτει το σχολείο το μισό" };

  planner.wellbeing_entries = [
    { id: WELLBEING_WEEK8, date: "2026-11-06", notes: "Κουραστική εβδομάδα.\nΝα κοιμάμαι νωρίτερα." },
    { id: WELLBEING_WEEK9, date: TODAY, notes: "Βοήθησε το περπάτημα." },
  ];
  planner.wellbeing_note = {
    sustains: "Κολύμπι την Τετάρτη",
    boundaries: "Όχι email μετά τις 8",
  };
  return planner;
}

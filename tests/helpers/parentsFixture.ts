/**
 * A planner shaped like a real one, for the M5 surfaces.
 *
 * Deliberately asymmetric, built the way M4's `supportFixture` was, so every
 * case M5 has to get right is in it and the expectations can be worked out by
 * hand:
 *
 * * **The contested pair.** Άννα Παπαδοπούλου has a *booking* at 13:30 on
 *   05.11 and a logged *contact* on 05.11 — same guardian, same date, two
 *   independent records. That is M5's second acceptance criterion, and every
 *   independence test starts from it.
 * * **Appointments across the week and outside it**, so a week view that leaked
 *   into its neighbours would be caught: three inside the Mon 02.11 week and
 *   two outside it, one before and one after.
 * * **Every appointment status is present**, including a `cancelled` one inside
 *   the seven-day window — which the upcoming panel must leave out — and a
 *   `done` one, which it must not.
 * * **A meeting on each side of "today"**: one three days back (recent) and two
 *   ahead, one of them just inside the seven-day horizon and one just outside
 *   it. The boundary cases are the point.
 * * **A contact with remarks and one without**, so the printed page's
 *   `ΠΑΡΑΤΗΡΗΣΕΙΣ` box has something to list and something to skip.
 * * **A second student with nothing at all** (Κώστας), so a filter that
 *   accidentally matched everyone would be caught.
 *
 * `TODAY` is Monday 09.11.2026, and the week on show is the one starting Monday
 * 02.11.2026 — the same November M4's fixture uses, so the two can share a
 * planner without either month straying into the other.
 */
import type {
  Enrollment,
  MeetingAgreement,
  ParentAppointment,
  ParentContact,
  Planner,
  SchoolClass,
  StaffMeeting,
  Student,
} from "../../src/domain/types";
import { emptyPlanner } from "./fakeBackend";

export const A1 = 1;
export const B2 = 2;

export const ELENI = 21;
export const NIKOS = 22;
export const KOSTAS = 24;

/** Monday. Every "next 7 days" expectation below is measured from here. */
export const TODAY = "2026-11-09";
/** The Monday of the week the grid is asked for. */
export const WEEK_MONDAY = "2026-11-02";
/** The day the booking and the log deliberately both speak about. */
export const CONTESTED_DAY = "2026-11-05";
/** The guardian who appears on both sides of the contested pair. */
export const ANNA = "Άννα Παπαδοπούλου";

export const MEETING_RECENT = 61;
export const MEETING_SOON = 62;
export const MEETING_FAR = 63;

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
  };
}

function enrolment(classId: number, studentId: number, rosterNo: number): Enrollment {
  return { class_id: classId, student_id: studentId, roster_no: rosterNo, support: false, note: "" };
}

function contact(over: Partial<ParentContact> & { id: number; student_id: number }): ParentContact {
  return {
    date: "",
    guardian: "",
    format: "meeting",
    reason: "",
    agreements: "",
    outcome: "",
    next_step: "",
    remarks: "",
    ...over,
  };
}

function appointment(
  over: Partial<ParentAppointment> & { id: number; date: string; clock_time: string },
): ParentAppointment {
  return {
    student_id: null,
    guardian: "",
    mode: "in_person",
    place: "",
    status: "proposed",
    topic: "",
    outcome: "",
    ...over,
  };
}

function meeting(over: Partial<StaffMeeting> & { id: number; date: string }): StaffMeeting {
  return {
    position: 0,
    kind: "staff",
    clock_time: "",
    duration: "",
    attendees: "",
    agenda: "",
    class_id: null,
    notes: "",
    ...over,
  };
}

export function parentsFixture(): Planner {
  const planner = emptyPlanner();
  planner.classes = [schoolClass(A1, "Α1", "Μαθηματικά"), schoolClass(B2, "Β2", "Φυσική")];
  planner.students = [
    student(ELENI, "Ελένη Παπαδοπούλου"),
    student(NIKOS, "Νίκος Γεωργίου"),
    student(KOSTAS, "Κώστας Ιωάννου"),
  ];
  planner.enrollments = [
    enrolment(A1, ELENI, 1),
    enrolment(A1, NIKOS, 2),
    // Κώστας sits in the other class, so a filter on Α1 must not reach him.
    enrolment(B2, KOSTAS, 1),
  ];

  planner.parent_contacts = [
    // Half of the contested pair.
    contact({
      id: 101,
      student_id: ELENI,
      date: CONTESTED_DAY,
      guardian: ANNA,
      format: "phone",
      reason: "Συχνές καθυστερήσεις το πρωί",
      agreements: "Θα φεύγουν δέκα λεπτά νωρίτερα",
      outcome: "Συνεννοηθήκαμε ήρεμα",
      next_step: "Επανεξέταση σε δύο εβδομάδες",
      remarks: "Η μητέρα δουλεύει βάρδιες",
    }),
    // No remarks: the printed box must skip this one rather than list a blank.
    contact({
      id: 102,
      student_id: NIKOS,
      date: "2026-11-03",
      guardian: "Γιώργος Γεωργίου",
      format: "email",
      reason: "Εργασία που δεν παραδόθηκε",
      agreements: "Παράδοση ως την Παρασκευή",
    }),
  ];

  planner.parent_appointments = [
    // The other half of the contested pair: same guardian, same day, a booking.
    appointment({
      id: 201,
      date: CONTESTED_DAY,
      clock_time: "13:30",
      student_id: ELENI,
      guardian: ANNA,
      mode: "in_person",
      place: "Αίθουσα 203",
      status: "confirmed",
      topic: "Πρόοδος στα Μαθηματικά",
    }),
    // Same week, earlier day and an earlier time, so row order is testable.
    appointment({
      id: 202,
      date: "2026-11-03",
      clock_time: "09:15",
      student_id: NIKOS,
      guardian: "Γιώργος Γεωργίου",
      mode: "phone",
      status: "proposed",
      topic: "Εργασίες",
    }),
    // Same week, same time as the first but a different day — the grid must
    // put these in one row and two columns.
    appointment({
      id: 203,
      date: "2026-11-06",
      clock_time: "13:30",
      guardian: "Μαρία Ιωάννου",
      mode: "online",
      status: "done",
      topic: "Γενική ενημέρωση",
      outcome: "Έγινε, όλα καλά",
    }),
    // Inside the next seven days from TODAY, but cancelled: the upcoming panel
    // must leave it out.
    appointment({
      id: 204,
      date: "2026-11-11",
      clock_time: "10:00",
      guardian: "Ακυρωμένος γονέας",
      status: "cancelled",
      topic: "Ακυρώθηκε",
    }),
    // Inside the window and live: the panel must show it.
    appointment({
      id: 205,
      date: "2026-11-12",
      clock_time: "11:00",
      student_id: ELENI,
      guardian: ANNA,
      status: "confirmed",
      topic: "Συνέχεια",
    }),
    // Outside the window by one day — the boundary on the far side.
    appointment({
      id: 206,
      date: "2026-11-17",
      clock_time: "11:00",
      guardian: "Πολύ αργά",
      status: "proposed",
      topic: "Εκτός παραθύρου",
    }),
  ];

  planner.staff_meetings = [
    // Three days back: "recent", which the panel shows and marks as past.
    meeting({
      id: MEETING_RECENT,
      date: "2026-11-06",
      clock_time: "14:00",
      kind: "staff",
      agenda: "Προηγούμενος σύλλογος",
      duration: "60 λεπτά",
    }),
    // Six days ahead: inside the seven-day horizon.
    meeting({
      id: MEETING_SOON,
      date: "2026-11-15",
      clock_time: "13:00",
      kind: "council",
      class_id: A1,
      agenda: "Πρόοδος τμήματος · δύο περιστατικά",
      attendees: "Όλοι οι διδάσκοντες του τμήματος",
      duration: "90 λεπτά",
    }),
    // Eleven days ahead: outside it.
    meeting({
      id: MEETING_FAR,
      date: "2026-11-20",
      clock_time: "13:00",
      kind: "class",
      agenda: "Πολύ μακριά",
    }),
  ];

  planner.meeting_agreements = [
    {
      id: 301,
      meeting_id: MEETING_SOON,
      position: 0,
      who: "Μ. Νικολάου",
      what: "Επικοινωνία με τους γονείς δύο μαθητών",
      deadline: "2026-11-16",
    },
    {
      id: 302,
      meeting_id: MEETING_SOON,
      position: 1,
      who: "Α. Δημητρίου",
      what: "Ετοιμασία υλικού στήριξης",
      deadline: "2026-11-18",
    },
  ] satisfies MeetingAgreement[];

  return planner;
}

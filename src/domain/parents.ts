/**
 * Parent communication and parent appointments — the two halves the spec
 * deliberately keeps apart.
 *
 * **A booking and a record of what happened are independent, and nothing here
 * derives one from the other.** The spec says it in as many words — the
 * appointment grid is "independent of the log above (a booking vs. a record of
 * what happened)" — and it is M5's second acceptance criterion. So the two
 * halves below read different arrays and never meet: no selector in this file
 * reads `parent_appointments` to produce a contact, or `parent_contacts` to
 * produce an appointment. This is the same construction M4 used to keep the
 * attendance grid apart from the absence register, and it is held the same way:
 * two tables, two commands, and a test that pushes rows into one and asserts
 * the other's output compares *equal*.
 *
 * **An appointment is keyed by an actual date**, not by a weekday index. The
 * Monday–Friday grid is a *view*, built by [`appointmentWeek`] from whichever
 * Monday it is asked for — the rule this project has followed since M1, and
 * what lets a booking survive a correction to the school year's start date.
 */
import { addDays, mondayOf } from "./dates";
import type { Planner, Student } from "./types";
import type { AppointmentMode, AppointmentStatus, ContactFormat } from "../i18n/vocabularies";

// ------------------------------------------------- the communication log ---

/**
 * One line of the register — the source's "Επικοινωνία με τους γονείς · Μητρώο
 * επικοινωνιών · κατάλληλο για επίσημη τεκμηρίωση", whose columns are
 * `Ημερομηνία | Μαθητής | Ποιος | Μορφή | Αιτία | Συμφωνίες | Επόμενα`.
 *
 * `reason` and `agreements` are two fields rather than one because the spec
 * asks for exactly that split, and `remarks` is separate again: it is the
 * source page's own foot-of-page `ΠΑΡΑΤΗΡΗΣΕΙΣ` box, which the spec calls
 * "overall remarks" and which M4.5 settled is stored per record and printed
 * attributed.
 */
export interface ParentContact {
  id: number;
  student_id: number;
  date: string;
  /** The source column "Ποιος" — free text, because it may be a grandparent. */
  guardian: string;
  format: ContactFormat;
  reason: string;
  agreements: string;
  outcome: string;
  next_step: string;
  remarks: string;
}

/** A blank line, so a new one and a stored one are the same shape to edit. */
export function emptyContact(studentId: number): ParentContact {
  return {
    id: 0,
    student_id: studentId,
    date: "",
    guardian: "",
    format: "meeting",
    reason: "",
    agreements: "",
    outcome: "",
    next_step: "",
    remarks: "",
  };
}

/**
 * Every contact, newest first — a register kept for documentation is read from
 * the top, as the incident log is.
 *
 * An entry with no date yet sorts to the front, where a line the teacher has
 * just created belongs while she is filling it in.
 */
export function allContacts(planner: Planner): ParentContact[] {
  return [...planner.parent_contacts].sort((a, b) => {
    if (!a.date && !b.date) return b.id - a.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return b.date.localeCompare(a.date) || b.id - a.id;
  });
}

/** What the log is narrowed to. `0` means "all", so a filter names what it hides. */
export interface ContactFilter {
  studentId: number;
  classId: number;
}

export const NO_CONTACT_FILTER: ContactFilter = { studentId: 0, classId: 0 };

/**
 * The lines a filtered log shows.
 *
 * **One definition of "what is on screen", which the printed sheet reads too** —
 * the rule M4.5 resolved after finding that two functions which agree today are
 * not the same thing as one function.
 *
 * Filtering by class matches the class's *roster* rather than anything stored
 * on the contact, because a contact is about a student and a student may sit in
 * two classes.
 */
export function filteredContacts(planner: Planner, filter: ContactFilter): ParentContact[] {
  const roster = new Set(
    planner.enrollments.filter((e) => e.class_id === filter.classId).map((e) => e.student_id),
  );
  return allContacts(planner).filter((c) => {
    if (filter.studentId && c.student_id !== filter.studentId) return false;
    if (filter.classId && !roster.has(c.student_id)) return false;
    return true;
  });
}

/** The student a line is about, or `null` if her card has since been deleted. */
export function contactStudent(planner: Planner, contact: ParentContact): Student | null {
  return planner.students.find((s) => s.id === contact.student_id) ?? null;
}

// --------------------------------------------------- the appointment grid ---

/**
 * One booking in the weekly grid — the source's "Συναντήσεις με γονείς · Οι
 * εβδομαδιαίες συναντήσεις", an `Ώρα × Δευτέρα–Παρασκευή` sheet.
 *
 * `student_id` is optional: a slot may be booked with a guardian before it is
 * settled which child it is about, and the source's own cell is free text.
 */
export interface ParentAppointment {
  id: number;
  /** `YYYY-MM-DD`. Never a weekday index — see this module's own doc comment. */
  date: string;
  /** `HH:MM`, the grid's row. */
  clock_time: string;
  student_id: number | null;
  guardian: string;
  mode: AppointmentMode;
  place: string;
  status: AppointmentStatus;
  topic: string;
  outcome: string;
}

export function emptyAppointment(date: string, clockTime: string): ParentAppointment {
  return {
    id: 0,
    date,
    clock_time: clockTime,
    student_id: null,
    guardian: "",
    mode: "in_person",
    place: "",
    status: "proposed",
    topic: "",
    outcome: "",
  };
}

/** Monday to Friday of the week a date falls in — the source grid's five columns. */
export function weekDays(anyDayInWeek: string): string[] {
  const monday = mondayOf(anyDayInWeek);
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
}

/**
 * The appointments of one week, as the grid draws it.
 *
 * A *view*: the rows are whichever clock times that week's bookings actually
 * use, in order, so the grid is as tall as the teacher's week rather than a
 * fixed ladder of hours she has to scroll past. The days are always the five.
 *
 * **Reads `parent_appointments` and nothing else.**
 */
export interface AppointmentWeek {
  days: string[];
  /** The `HH:MM` rows in clock order. */
  times: string[];
  /** The booking in one cell, or `null`. Keyed `<date> <time>`. */
  cells: Map<string, ParentAppointment>;
  /** Every booking in the week, in date and time order. */
  appointments: ParentAppointment[];
}

export function cellKey(date: string, clockTime: string): string {
  return `${date} ${clockTime}`;
}

export function appointmentWeek(planner: Planner, anyDayInWeek: string): AppointmentWeek {
  const days = weekDays(anyDayInWeek);
  const inWeek = planner.parent_appointments
    .filter((a) => days.includes(a.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.clock_time.localeCompare(b.clock_time));

  const times = [...new Set(inWeek.map((a) => a.clock_time))].sort((a, b) => a.localeCompare(b));
  const cells = new Map<string, ParentAppointment>();
  for (const appointment of inWeek) {
    // First one wins if a teacher somehow books a slot twice; the second is
    // still stored and still listed in `appointments`, so nothing is hidden.
    const key = cellKey(appointment.date, appointment.clock_time);
    if (!cells.has(key)) cells.set(key, appointment);
  }
  return { days, times, cells, appointments: inWeek };
}

/** The student a booking names, if it names one and her card still exists. */
export function appointmentStudent(
  planner: Planner,
  appointment: ParentAppointment,
): Student | null {
  if (appointment.student_id === null) return null;
  return planner.students.find((s) => s.id === appointment.student_id) ?? null;
}

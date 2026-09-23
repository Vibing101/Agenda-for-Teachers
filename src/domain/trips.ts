/**
 * Εκδρομές και επισκέψεις — trips and events, with per-student consent.
 *
 * The source's register has columns `Ημερομηνία | Στόχος / Δραστηριότητα |
 * Τάξη | Υπεύθυνος | Μεταφορά | Έξοδο | Συγκαταθέσεις`, over `ΛΙΣΤΑ ΕΛΕΓΧΟΥ`
 * and `ΣΗΜΕΙΩΣΕΙΣ ΚΑΙ ΑΞΙΟΛΟΓΗΣΗ`.
 *
 * **`Συγκαταθέσεις` is a derived column.** The spec asks for per-student consent
 * tracking, so the consents are rows keyed by `(trip, student)` and the
 * register's cell is *counted* from them by [`consentTally`]. A number the
 * teacher typed could disagree with the list she ticked; a counted one cannot.
 * Same construction as every other grid in this app.
 *
 * **No row means "not recorded yet."** There are two states, `given` and
 * `refused`, and an absent row is the blank the paper form has — M4's rule for
 * an unmarked attendance cell, restated. That is why the roster is the source
 * of who appears, not the consent table.
 *
 * **This module builds no consent letter.** M5 already ships *Συγκατάθεση για
 * επίσκεψη / εκδρομή* as one of the seven parent letters, filled in the UI and
 * exported as a portrait PDF, and M5 deliberately stores nothing for a filled
 * letter. Wiring a trip into it would change that decision, so it is raised
 * rather than taken — see the release note.
 */
import type { ConsentState } from "../i18n/vocabularies";
import type { Planner, SchoolClass, Student } from "./types";

export interface Trip {
  id: number;
  position: number;
  date: string;
  /** `Στόχος / Δραστηριότητα`. */
  activity: string;
  /** Optional: the visit happened, whatever became of the class since. */
  class_id: number | null;
  /** `Υπεύθυνος` — free text; the staff directory is M8's. */
  responsible: string;
  transport: string;
  /** `Έξοδο`, as the teacher writes it. */
  cost: string;
  /** `ΛΙΣΤΑ ΕΛΕΓΧΟΥ`, per trip rather than per page. */
  checklist: string;
  /** `ΣΗΜΕΙΩΣΕΙΣ ΚΑΙ ΑΞΙΟΛΟΓΗΣΗ` — the spec's post-trip evaluation. */
  evaluation: string;
}

/**
 * One student's consent for one trip.
 *
 * Keyed by the pair with no generated id — the same shape as an enrollment and
 * an attendance mark, and for the same reason: the screen knows both halves
 * before it writes, so there is no new-record id to select and no room for the
 * create-then-edit defect.
 */
export interface TripConsent {
  trip_id: number;
  student_id: number;
  /** `given` | `refused`. Empty clears it, which removes the row. */
  state: ConsentState | "";
  note: string;
}

export function emptyTrip(classId: number | null): Trip {
  return {
    id: 0,
    position: 0,
    date: "",
    activity: "",
    class_id: classId,
    responsible: "",
    transport: "",
    cost: "",
    checklist: "",
    evaluation: "",
  };
}

/** Every trip in date order — a year of visits read forwards. */
export function allTrips(planner: Planner): Trip[] {
  return [...planner.trips].sort((a, b) => {
    if (!a.date && !b.date) return a.position - b.position || a.id - b.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.localeCompare(b.date) || a.id - b.id;
  });
}

/** The class a trip names, if it names one and that class still exists. */
export function tripClass(planner: Planner, trip: Trip): SchoolClass | null {
  if (trip.class_id === null) return null;
  return planner.classes.find((c) => c.id === trip.class_id) ?? null;
}

/**
 * The students a trip's consent list covers: the roster of its class, in roster
 * order, or nobody if it names no class.
 *
 * **Read from `enrollment`**, so adding a student to the class adds her to the
 * list with no consent recorded — rather than from the consents themselves,
 * which would only ever list the students already ticked.
 */
export function tripRoster(planner: Planner, trip: Trip): Student[] {
  if (trip.class_id === null) return [];
  const roster = planner.enrollments
    .filter((e) => e.class_id === trip.class_id)
    .sort((a, b) => a.roster_no - b.roster_no || a.student_id - b.student_id);
  return roster
    .map((e) => planner.students.find((s) => s.id === e.student_id))
    .filter((s): s is Student => s !== undefined);
}

/** One student's recorded consent for one trip, or a blank one. */
export function consentFor(planner: Planner, tripId: number, studentId: number): TripConsent {
  return (
    planner.trip_consents.find((c) => c.trip_id === tripId && c.student_id === studentId) ?? {
      trip_id: tripId,
      student_id: studentId,
      state: "",
      note: "",
    }
  );
}

/**
 * The register's `Συγκαταθέσεις` cell, counted rather than typed.
 *
 * `given` out of the roster's size, with refusals counted separately because
 * "twelve of twenty-four have answered, and two of those said no" is the thing
 * the teacher actually needs to know the week before a trip.
 */
export interface ConsentTally {
  given: number;
  refused: number;
  /** Roster size — the denominator, and zero for a trip with no class. */
  total: number;
  /** Roster members with no consent row at all. */
  pending: number;
}

export function consentTally(planner: Planner, trip: Trip): ConsentTally {
  const roster = tripRoster(planner, trip);
  const ids = new Set(roster.map((s) => s.id));
  const consents = planner.trip_consents.filter(
    (c) => c.trip_id === trip.id && ids.has(c.student_id),
  );
  const given = consents.filter((c) => c.state === "given").length;
  const refused = consents.filter((c) => c.state === "refused").length;
  return { given, refused, total: roster.length, pending: roster.length - given - refused };
}

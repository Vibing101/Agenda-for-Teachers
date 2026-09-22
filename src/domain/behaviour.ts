/**
 * The behaviour/incident log.
 *
 * The source page is "Διαγωγή και περιστατικά — Σημαντικά περιστατικά και
 * σημειώσεις · κατάλληλο για επίσημη τεκμηρίωση", a flat register with columns
 * for the date, the student, the class, what happened, the action taken and
 * whether the parents were informed.
 *
 * **An entry belongs to the student, not to a class.** That is what the spec
 * means by "cross-class (follows the student)": the same entry is visible from
 * every class she is enrolled in, and stays with her when a class is deleted.
 * `class_id` is an optional note of *where* it happened — the source's `Τάξη`
 * column — and the schema empties it rather than deleting the entry when a
 * class goes, because something did still happen.
 *
 * The spec files this under module 2 (Τάξεις & Μαθητές) but delivers it in M4;
 * it lives beside the student, which is why the accessors below are keyed that
 * way rather than by class.
 */
import type { Planner, SchoolClass, Student } from "./types";

export interface Incident {
  id: number;
  student_id: number;
  /** Where it happened. `null` when it belonged to no class in particular. */
  class_id: number | null;
  date: string;
  /** The source register's "Τι συνέβη". */
  what_happened: string;
  /** The source register's "Ενέργεια που έγινε". */
  action_taken: string;
  /** The source register's "Γονείς ενημερώθηκαν". */
  parents_informed: boolean;
}

/** A blank entry, so a new one and a stored one are the same shape to edit. */
export function emptyIncident(studentId: number): Incident {
  return {
    id: 0,
    student_id: studentId,
    class_id: null,
    date: "",
    what_happened: "",
    action_taken: "",
    parents_informed: false,
  };
}

/**
 * Every incident, newest first, because a register kept for documentation is
 * read from the top.
 *
 * An entry with no date yet sorts to the front, where a line the teacher has
 * just created belongs while she is filling it in.
 */
export function allIncidents(planner: Planner): Incident[] {
  return [...planner.incidents].sort((a, b) => {
    if (!a.date && !b.date) return b.id - a.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return b.date.localeCompare(a.date) || b.id - a.id;
  });
}

/**
 * One student's incidents, across every class — the "follows the student" half.
 *
 * Note what this does *not* filter on: the entry's `class_id`. A student
 * enrolled in two classes shows the same log in both, which is the point.
 */
export function incidentsOfStudent(planner: Planner, studentId: number): Incident[] {
  return allIncidents(planner).filter((i) => i.student_id === studentId);
}

/**
 * The incidents a class's teacher would want in front of her: every entry for
 * a student on that class's roster, whichever class it was recorded against.
 *
 * This is the other half of "cross-class": an incident logged in Α1 is still
 * this student's incident when she is looked at from Β2.
 */
export function incidentsOfClass(planner: Planner, classId: number): Incident[] {
  const roster = new Set(
    planner.enrollments.filter((e) => e.class_id === classId).map((e) => e.student_id),
  );
  return allIncidents(planner).filter((i) => roster.has(i.student_id));
}

/** The student an entry is about, or `null` if she has since been deleted. */
export function studentOf(planner: Planner, incident: Incident): Student | null {
  return planner.students.find((s) => s.id === incident.student_id) ?? null;
}

/** The class an entry was recorded against, if it named one and it still exists. */
export function classOf(planner: Planner, incident: Incident): SchoolClass | null {
  if (incident.class_id === null) return null;
  return planner.classes.find((c) => c.id === incident.class_id) ?? null;
}

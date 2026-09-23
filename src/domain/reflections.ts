/**
 * Αναστοχασμός μαθημάτων — the lesson reflection log.
 *
 * The source's page is a set of cards, each carrying `ΗΜΕΡΟΜΗΝΙΑ` and `ΜΑΘΗΜΑ /
 * ΤΑΞΗ` over one box captioned `ΤΙ ΛΕΙΤΟΥΡΓΗΣΕ · ΤΙ ΘΑ ΑΛΛΑΞΩ`. So a reflection
 * is one dated free-text entry against a class, which is also exactly what the
 * spec asks for.
 *
 * **One text field, not two.** The caption names two things, but the source
 * gives them one box: it is a prompt to the teacher, not two stored values.
 * Splitting it would be the app inventing a structure the source does not have.
 *
 * **A reflection is not a lesson plan, and the progress matrix never reads
 * one.** The plan is what she meant to do that week; this is what she thought
 * afterwards about one lesson. Folding them together would make the matrix show
 * text she never put in a plan — and the criterion the matrix is judged on is
 * precisely that it shows what the plan holds.
 */
import type { Planner, SchoolClass } from "./types";

export interface LessonReflection {
  id: number;
  /** Optional: the lesson happened, whatever became of the class since. */
  class_id: number | null;
  date: string;
  /** `ΤΙ ΛΕΙΤΟΥΡΓΗΣΕ · ΤΙ ΘΑ ΑΛΛΑΞΩ`. */
  notes: string;
}

export function emptyReflection(classId: number | null): LessonReflection {
  return { id: 0, class_id: classId, date: "", notes: "" };
}

/**
 * Every reflection, newest first — a log the teacher reads from the top, as the
 * incident log and the communication log are.
 */
export function allReflections(planner: Planner): LessonReflection[] {
  return [...planner.lesson_reflections].sort((a, b) => {
    if (!a.date && !b.date) return b.id - a.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return b.date.localeCompare(a.date) || b.id - a.id;
  });
}

export interface ReflectionFilter {
  classId: number;
}

export const NO_REFLECTION_FILTER: ReflectionFilter = { classId: 0 };

/** The entries a filtered log shows — one definition, as M4.5 settled. */
export function filteredReflections(
  planner: Planner,
  filter: ReflectionFilter,
): LessonReflection[] {
  return allReflections(planner).filter((r) => !filter.classId || r.class_id === filter.classId);
}

/** The class an entry names, if it names one and that class still exists. */
export function reflectionClass(
  planner: Planner,
  reflection: LessonReflection,
): SchoolClass | null {
  if (reflection.class_id === null) return null;
  return planner.classes.find((c) => c.id === reflection.class_id) ?? null;
}

/**
 * Προγραμματισμένες εξετάσεις — the exam tracker, and the lesson reflection log
 * that sits beside it in the same module.
 *
 * The source's exam page is a register whose columns are `Ημερομηνία | Τάξη |
 * Μάθημα | Είδος εξέτασης | Τι εξετάζεται | Βαρύτητα`, over a page-level
 * `ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ` box.
 *
 * **An exam here is a plan, not a mark.** Its `weight` is what the teacher
 * means it to count towards the term, written while she spreads the year's
 * assessments out. It is deliberately *not* wired to M2's percentage-weighted
 * gradebook, whose weights live on `grade_column` and are what actually compute
 * an average — nothing in this module reads or writes a grade. Two surfaces
 * that both say "βαρύτητα" are exactly where a silent coupling would hide, so
 * it is stated here and tested as insensitivity.
 *
 * **`Μάθημα` is not stored.** It is the linked class's own subject, looked up
 * at display time the way a timetable cell looks up its class's room — so
 * renaming a class's subject updates every exam it carries, with nothing to
 * regenerate.
 *
 * Every record is keyed by an **actual date**. There is no week index and no
 * term index, so correcting the school year's start date moves nothing.
 */
import { daysBetween } from "./dates";
import type { Planner, SchoolClass } from "./types";

export interface Exam {
  id: number;
  /** Optional: a class may since have been deleted, and the plan still stands. */
  class_id: number | null;
  date: string;
  /** `Είδος εξέτασης`. Free text — the source page enumerates nothing. */
  kind: string;
  /** `Τι εξετάζεται`. */
  scope: string;
  /** `Βαρύτητα`, as the teacher writes it. See this module's own note. */
  weight: string;
  /** The page's `ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ` box, stored per record. */
  collaboration: string;
}

export function emptyExam(classId: number | null): Exam {
  return {
    id: 0,
    class_id: classId,
    date: "",
    kind: "",
    scope: "",
    weight: "",
    collaboration: "",
  };
}

/**
 * Every exam in date order — a year's assessments read forwards, because the
 * page's own subtitle is "κατανεμημένες σε όλη τη χρονιά" and what the teacher
 * is looking at is how they are spread out.
 *
 * An undated one sorts to the front, where a line she has just created belongs.
 */
export function allExams(planner: Planner): Exam[] {
  return [...planner.exams].sort((a, b) => {
    if (!a.date && !b.date) return a.id - b.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.localeCompare(b.date) || a.id - b.id;
  });
}

/** What the register is narrowed to. `0` means "all", so a filter names what it hides. */
export interface ExamFilter {
  classId: number;
}

export const NO_EXAM_FILTER: ExamFilter = { classId: 0 };

/**
 * The lines a filtered register shows.
 *
 * **One definition of "what is on screen"** — the rule M4.5 resolved, so that
 * anything printed from this register later cannot disagree with it.
 */
export function filteredExams(planner: Planner, filter: ExamFilter): Exam[] {
  return allExams(planner).filter((e) => !filter.classId || e.class_id === filter.classId);
}

/** The class an exam names, if it names one and that class still exists. */
export function examClass(planner: Planner, exam: Exam): SchoolClass | null {
  if (exam.class_id === null) return null;
  return planner.classes.find((c) => c.id === exam.class_id) ?? null;
}

/**
 * The exams falling in the next `days` days — what the tracker puts at the top,
 * because a year's register read forwards is not the same question as "what is
 * coming".
 *
 * **A pure function of the day**, like `upcomingOverview` in `meetings.ts`:
 * `today` is the day the shell read, never the clock. An undated exam is not
 * upcoming, because nothing says when it is.
 */
export function upcomingExams(planner: Planner, today: string, days = 14): Exam[] {
  return allExams(planner).filter((e) => {
    if (!e.date) return false;
    const away = daysBetween(today, e.date);
    return away >= 0 && away <= days;
  });
}

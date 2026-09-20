/**
 * Reading one class's gradebook out of the loaded planner.
 *
 * `grades.ts` is the arithmetic and knows nothing about a planner; this is the
 * layer that feeds it. Keeping them apart is what lets every branch of the
 * formula be tested against plain values, while the screen, the class summary
 * and the printed sheet all read the same rows through the same functions —
 * so a number on the PDF cannot drift from the number on screen.
 */
import {
  classResults,
  classSummary,
  defaultGrading,
  weightedAverage,
  yearSummary,
  type Cell,
  type ClassGrading,
  type ClassSummary,
  type GradeColumn,
  type GradeRow,
  type StudentResult,
  type YearSummary,
} from "./grades";
import type { Enrollment, Planner, Student } from "./types";

/** One student on a class's roster, in the order the roster lists her. */
export interface RosterEntry {
  enrollment: Enrollment;
  student: Student;
}

export function classRoster(planner: Planner, classId: number): RosterEntry[] {
  return planner.enrollments
    .filter((e) => e.class_id === classId)
    .map((enrollment) => ({
      enrollment,
      student: planner.students.find((s) => s.id === enrollment.student_id),
    }))
    .filter((row): row is RosterEntry => row.student !== undefined)
    .sort((a, b) => a.enrollment.roster_no - b.enrollment.roster_no);
}

export function columnsFor(planner: Planner, classId: number): GradeColumn[] {
  return planner.grade_columns
    .filter((c) => c.class_id === classId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/** One cell's raw text. A cell that was never filled in has no row at all. */
export function valueOf(planner: Planner, columnId: number, studentId: number): string {
  return (
    planner.grade_values.find((v) => v.column_id === columnId && v.student_id === studentId)
      ?.value ?? ""
  );
}

export function cellsFor(planner: Planner, classId: number, studentId: number): Cell[] {
  return columnsFor(planner, classId).map((column) => ({
    column,
    value: valueOf(planner, column.id, studentId),
  }));
}

/**
 * A class's grading settings. The backend supplies a defaulted row for every
 * class, but a planner assembled in a test may not have one, so the default is
 * applied here too rather than letting a threshold read as `undefined`.
 */
export function gradingFor(planner: Planner, classId: number): ClassGrading {
  return planner.class_gradings.find((g) => g.class_id === classId) ?? defaultGrading(classId);
}

/** A student's conduct record, blank rather than missing if never saved. */
export function rowFor(planner: Planner, classId: number, studentId: number): GradeRow {
  return (
    planner.grade_rows.find((r) => r.class_id === classId && r.student_id === studentId) ?? {
      class_id: classId,
      student_id: studentId,
      conduct: "",
      observations: "",
      overall_result: "",
    }
  );
}

export function averageFor(planner: Planner, classId: number, studentId: number): number | null {
  return weightedAverage(cellsFor(planner, classId, studentId));
}

export function resultsFor(planner: Planner, classId: number): StudentResult[] {
  const roster = classRoster(planner, classId);
  return classResults(
    roster.map((r) => r.student.id),
    (studentId) => cellsFor(planner, classId, studentId),
    gradingFor(planner, classId),
  );
}

export function summaryFor(planner: Planner, classId: number): ClassSummary {
  return classSummary(
    classId,
    resultsFor(planner, classId),
    planner.grade_rows.filter((r) => r.class_id === classId),
  );
}

/** Every class's roll-up plus the year-wide figure, in class order. */
export function yearSummaryOf(planner: Planner): YearSummary {
  return yearSummary(planner.classes.map((c) => summaryFor(planner, c.id)));
}

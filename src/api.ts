import { invoke } from "@tauri-apps/api/core";
import type {
  AnnualGoal,
  Enrollment,
  GradingPeriod,
  Holiday,
  ImportantDate,
  Planner,
  SchoolClass,
  SchoolYear,
  Seat,
  Student,
} from "./domain/types";

export interface Status {
  app_folder: string;
  db_path: string;
  db_exists: boolean;
  schema_version: number;
  backup_count: number;
  last_backup: string | null;
  disk_changed: boolean;
}

/** Shape of the errors the Rust side returns. `code` is what we branch on. */
export interface AppError {
  code: "disk_changed" | "db" | "io";
  message: string;
}

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as AppError).code === "string" &&
    typeof (e as AppError).message === "string"
  );
}

/**
 * Every mutation returns the whole planner, read back from the file it just
 * wrote. The UI therefore replaces its state with what is actually on disk
 * rather than patching its own copy — the same reason the Rust side opens a
 * connection per operation.
 */
export const api = {
  status: () => invoke<Status>("status"),
  load: () => invoke<Planner>("load"),
  reload: () => invoke<Planner>("reload"),
  makeBackup: () => invoke<string | null>("make_backup"),

  saveSchoolYear: (year: SchoolYear) => invoke<Planner>("save_school_year", { year }),
  saveGradingPeriods: (periods: GradingPeriod[]) =>
    invoke<Planner>("save_grading_periods", { periods }),

  saveHoliday: (holiday: Holiday) => invoke<Planner>("save_holiday", { holiday }),
  deleteHoliday: (id: number) => invoke<Planner>("delete_holiday", { id }),

  saveImportantDate: (date: ImportantDate) => invoke<Planner>("save_important_date", { date }),
  deleteImportantDate: (id: number) => invoke<Planner>("delete_important_date", { id }),

  saveAnnualGoal: (goal: AnnualGoal) => invoke<Planner>("save_annual_goal", { goal }),

  saveClass: (schoolClass: SchoolClass) => invoke<Planner>("save_class", { class: schoolClass }),
  deleteClass: (id: number) => invoke<Planner>("delete_class", { id }),

  saveStudent: (student: Student) => invoke<Planner>("save_student", { student }),
  deleteStudent: (id: number) => invoke<Planner>("delete_student", { id }),

  setEnrollment: (enrollment: Enrollment) => invoke<Planner>("set_enrollment", { enrollment }),
  removeEnrollment: (classId: number, studentId: number) =>
    invoke<Planner>("remove_enrollment", { classId, studentId }),

  saveSeating: (classId: number, rows: number, cols: number, notes: string, seats: Seat[]) =>
    invoke<Planner>("save_seating", { classId, rows, cols, notes, seats }),
};

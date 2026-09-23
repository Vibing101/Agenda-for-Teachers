import { invoke } from "@tauri-apps/api/core";
import type {
  AbsenceEvent,
  AgendaNote,
  AnnualGoal,
  AttendanceMark,
  ClassGrading,
  Enrollment,
  GradeColumn,
  GradeRow,
  GradeValue,
  GradingPeriod,
  Holiday,
  ImportantDate,
  Incident,
  LessonPlan,
  MeetingAgreement,
  ParentAppointment,
  ParentContact,
  Planner,
  SchoolClass,
  SchoolYear,
  Seat,
  StaffMeeting,
  Student,
  SupportGoal,
  SupportPlan,
  TimetableCell,
  TimetablePeriod,
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
  code: "disk_changed" | "db" | "io" | "pdf";
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

  saveClassGrading: (grading: ClassGrading) => invoke<Planner>("save_class_grading", { grading }),
  saveGradeColumn: (column: GradeColumn) => invoke<Planner>("save_grade_column", { column }),
  deleteGradeColumn: (id: number) => invoke<Planner>("delete_grade_column", { id }),
  setGradeValue: (value: GradeValue) => invoke<Planner>("set_grade_value", { value }),
  saveGradeRow: (row: GradeRow) => invoke<Planner>("save_grade_row", { row }),

  saveTimetablePeriod: (period: TimetablePeriod) =>
    invoke<Planner>("save_timetable_period", { period }),
  deleteTimetablePeriod: (id: number) => invoke<Planner>("delete_timetable_period", { id }),
  /** An emptied cell is deleted rather than stored blank, backend-side. */
  saveTimetableCell: (cell: TimetableCell) => invoke<Planner>("save_timetable_cell", { cell }),

  /** Keyed by `(class, Monday)`, so this is an upsert with no id to hand back. */
  saveLessonPlan: (plan: LessonPlan) => invoke<Planner>("save_lesson_plan", { plan }),
  saveAgendaNote: (note: AgendaNote) => invoke<Planner>("save_agenda_note", { note }),

  /**
   * One cell of the monthly attendance grid, keyed by an actual date. An
   * emptied cell is deleted rather than stored blank, backend-side.
   *
   * **This reaches the grid and nothing else.** The absence-event log below is
   * independent of it by the spec's own repeated decision, so there is
   * deliberately no call here that writes both.
   */
  saveAttendanceMark: (mark: AttendanceMark) => invoke<Planner>("save_attendance_mark", { mark }),

  /** One line of the detailed register. Independent of the grid above. */
  saveAbsenceEvent: (event: AbsenceEvent) => invoke<Planner>("save_absence_event", { event }),
  deleteAbsenceEvent: (id: number) => invoke<Planner>("delete_absence_event", { id }),

  saveIncident: (incident: Incident) => invoke<Planner>("save_incident", { incident }),
  deleteIncident: (id: number) => invoke<Planner>("delete_incident", { id }),

  saveSupportPlan: (plan: SupportPlan) => invoke<Planner>("save_support_plan", { plan }),
  deleteSupportPlan: (id: number) => invoke<Planner>("delete_support_plan", { id }),

  /**
   * One goal inside a plan. Note that there is no path from here to the plan's
   * teacher-written status — different command, different table.
   */
  saveSupportGoal: (goal: SupportGoal) => invoke<Planner>("save_support_goal", { goal }),
  deleteSupportGoal: (id: number) => invoke<Planner>("delete_support_goal", { id }),

  /**
   * One line of the parent communication log — a record of what happened.
   *
   * **This reaches the log and nothing else.** The appointment grid below is
   * independent of it by the spec's own decision, so — exactly as with M4's
   * attendance pair — there is deliberately no call here that writes both.
   */
  saveParentContact: (contact: ParentContact) => invoke<Planner>("save_parent_contact", { contact }),
  deleteParentContact: (id: number) => invoke<Planner>("delete_parent_contact", { id }),

  /** One booking in the weekly grid. Independent of the log above. */
  saveParentAppointment: (appointment: ParentAppointment) =>
    invoke<Planner>("save_parent_appointment", { appointment }),
  deleteParentAppointment: (id: number) => invoke<Planner>("delete_parent_appointment", { id }),

  saveStaffMeeting: (meeting: StaffMeeting) => invoke<Planner>("save_staff_meeting", { meeting }),
  deleteStaffMeeting: (id: number) => invoke<Planner>("delete_staff_meeting", { id }),

  saveMeetingAgreement: (agreement: MeetingAgreement) =>
    invoke<Planner>("save_meeting_agreement", { agreement }),
  deleteMeetingAgreement: (id: number) => invoke<Planner>("delete_meeting_agreement", { id }),

  /**
   * Writes one document into `exports/` as a real PDF and resolves with its
   * path. The document is built here, in the frontend, because that is where
   * every user-facing string lives; Rust owns the page and the file.
   */
  exportPdf: (fileName: string, html: string, landscape: boolean) =>
    invoke<string>("export_pdf", { fileName, html, landscape }),

  /** Asked for, and answered, only by the hidden print window. */
  printJob: () => invoke<string>("print_job"),
  printReady: (pages: number) => invoke<void>("print_ready", { pages }),
};

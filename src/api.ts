import { invoke } from "@tauri-apps/api/core";
import type { Locale, Translate } from "./i18n";
import type {
  AbsenceEvent,
  AgendaNote,
  AnnualGoal,
  AttendanceMark,
  CoverRecord,
  DevelopmentBudget,
  DevelopmentGoal,
  ClassGrading,
  Enrollment,
  Exam,
  GradeColumn,
  GradeRow,
  GradeValue,
  GradingPeriod,
  Holiday,
  ImportantDate,
  Incident,
  LeaveRecord,
  LessonPlan,
  LessonReflection,
  MeetingAgreement,
  ParentAppointment,
  ParentContact,
  Planner,
  PrintForm,
  Resource,
  SchoolClass,
  SchoolYear,
  Seat,
  StaffContact,
  StaffMeeting,
  Student,
  SupportGoal,
  SupportPlan,
  Textbook,
  TimetableCell,
  TimetablePeriod,
  TrainingEntry,
  Trip,
  TripConsent,
  Unit,
  WellbeingEntry,
  WellbeingNote,
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
 * What the teacher reads when the Rust side reports a failure (M9).
 *
 * The Rust side's messages are English, because no user-facing string lives
 * there; before M9 they were shown on their own, so a Greek interface showed an
 * English sentence. Now the sentence is the bundle's, in the interface
 * language, and the system's own message follows the colon as its detail.
 * `disk_changed` never reaches here — the shell turns it into the block.
 */
export function describeError(t: Translate, e: unknown): string {
  if (!isAppError(e)) return t("error.other", { detail: String(e) });
  const id =
    e.code === "db" ? "error.db" : e.code === "io" ? "error.io" : e.code === "pdf" ? "error.pdf" : "error.other";
  return t(id, { detail: e.message });
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
   * One unit — which is one row of the annual plan **and** one unit card,
   * because the source's two pages are two views of one record.
   *
   * Note what is missing beside it: there is no `saveProgressCell`. The
   * week-by-class matrix is a view over `saveLessonPlan` above, so there is
   * deliberately no second place to write a week's work — M6's first
   * acceptance criterion, held by there being no command for it.
   */
  saveUnit: (unit: Unit) => invoke<Planner>("save_unit", { unit }),
  deleteUnit: (id: number) => invoke<Planner>("delete_unit", { id }),

  /**
   * One planned assessment.
   *
   * **This reaches the exam tracker and nothing else.** An exam's `weight` is
   * the teacher's plan; M2's percentage weights live on a grade column and are
   * what compute an average. No call here writes one.
   */
  saveExam: (exam: Exam) => invoke<Planner>("save_exam", { exam }),
  deleteExam: (id: number) => invoke<Planner>("delete_exam", { id }),

  /** One dated reflection. Independent of the weekly plan the matrix reads. */
  saveLessonReflection: (reflection: LessonReflection) =>
    invoke<Planner>("save_lesson_reflection", { reflection }),
  deleteLessonReflection: (id: number) => invoke<Planner>("delete_lesson_reflection", { id }),

  saveTrip: (trip: Trip) => invoke<Planner>("save_trip", { trip }),
  deleteTrip: (id: number) => invoke<Planner>("delete_trip", { id }),

  /**
   * One student's consent for one trip, keyed by the pair. A cleared one is
   * removed rather than stored blank, backend-side — so the register's derived
   * count never includes a cell the teacher emptied.
   */
  setTripConsent: (consent: TripConsent) => invoke<Planner>("set_trip_consent", { consent }),

  saveTextbook: (textbook: Textbook) => invoke<Planner>("save_textbook", { textbook }),
  deleteTextbook: (id: number) => invoke<Planner>("delete_textbook", { id }),

  saveResource: (resource: Resource) => invoke<Planner>("save_resource", { resource }),
  deleteResource: (id: number) => invoke<Planner>("delete_resource", { id }),

  /**
   * A print form's head — its kind, its name and its two dates. **Never its
   * values**: those are written one at a time by `setPrintFormValue`, so a
   * rename sent while a field is still being saved cannot write back a stale
   * copy of the form over it. A form with `id` 0 is created, empty.
   */
  savePrintForm: (form: PrintForm) => invoke<Planner>("save_print_form", { form }),
  /** One field of a saved form. An empty value removes the field. */
  setPrintFormValue: (formId: number, field: string, value: string, today: string) =>
    invoke<Planner>("set_print_form_value", { formId, field, value, today }),
  deletePrintForm: (id: number) => invoke<Planner>("delete_print_form", { id }),

  /**
   * One of the substitute folder's own texts. `classId` is `null` for the
   * texts every class's folder shares (the contacts and procedures).
   *
   * **An empty value is stored**, not removed: it is how "she cleared this box"
   * is told apart from "she has not touched it", which shows the suggested
   * text. `resetSubstituteText` is the only way back to the suggestion.
   *
   * Note what is missing: there is no call that saves a seat, a roster or a
   * week into the folder. The folder reads those live.
   */
  setSubstituteText: (classId: number | null, field: string, value: string) =>
    invoke<Planner>("set_substitute_text", { classId, field, value }),
  resetSubstituteText: (classId: number | null, field: string) =>
    invoke<Planner>("reset_substitute_text", { classId, field }),

  /** One person in the school directory. */
  saveStaffContact: (contact: StaffContact) => invoke<Planner>("save_staff_contact", { contact }),
  deleteStaffContact: (id: number) => invoke<Planner>("delete_staff_contact", { id }),

  /**
   * One cover the teacher taught for a colleague — a record of what happened.
   *
   * **This reaches the covers register and nothing else.** Her own leave below
   * is a separate register by the spec's own words, so — as with M4's two
   * attendance registers and M5's booking and log — there is deliberately no
   * call here that writes both. Nor does it reach the timetable's duty cells,
   * which are her planned week.
   */
  saveCoverRecord: (record: CoverRecord) => invoke<Planner>("save_cover_record", { record }),
  deleteCoverRecord: (id: number) => invoke<Planner>("delete_cover_record", { id }),

  /** One of her own leaves. Independent of the covers above and of the folder. */
  saveLeaveRecord: (record: LeaveRecord) => invoke<Planner>("save_leave_record", { record }),
  deleteLeaveRecord: (id: number) => invoke<Planner>("delete_leave_record", { id }),

  /**
   * One open-ended development goal. **Not** one of M1's six annual goals —
   * `saveAnnualGoal` above writes those, and neither call reaches the other.
   */
  saveDevelopmentGoal: (goal: DevelopmentGoal) =>
    invoke<Planner>("save_development_goal", { goal }),
  deleteDevelopmentGoal: (id: number) => invoke<Planner>("delete_development_goal", { id }),

  /** One line of the training log. A `null` cost or hours is "not entered". */
  saveTrainingEntry: (entry: TrainingEntry) => invoke<Planner>("save_training_entry", { entry }),
  deleteTrainingEntry: (id: number) => invoke<Planner>("delete_training_entry", { id }),
  saveDevelopmentBudget: (budget: DevelopmentBudget) =>
    invoke<Planner>("save_development_budget", { budget }),

  /** One dated wellbeing reflection — free text, with no rating of any kind. */
  saveWellbeingEntry: (entry: WellbeingEntry) =>
    invoke<Planner>("save_wellbeing_entry", { entry }),
  deleteWellbeingEntry: (id: number) => invoke<Planner>("delete_wellbeing_entry", { id }),
  /** The wellbeing page's two standing boxes. */
  saveWellbeingNote: (note: WellbeingNote) => invoke<Planner>("save_wellbeing_note", { note }),

  /**
   * Switches the interface language (M9). A write like any other: it goes
   * through the fingerprint check, so it is refused while the file is blocked.
   */
  saveLocale: (locale: Locale) => invoke<Planner>("save_locale", { locale }),

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

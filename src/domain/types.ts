/**
 * The planner as the Rust side serialises it. Field names are snake_case
 * because they are the wire format, not a style choice — see `src-tauri/src/model.rs`,
 * which is the definition these mirror.
 */
import type { AbsenceEvent, AttendanceMark } from "./attendance";
import type { Incident } from "./behaviour";
import type { MeetingAgreement, StaffMeeting } from "./meetings";
import type { ParentAppointment, ParentContact } from "./parents";
import type { Exam } from "./exams";
import type { LessonReflection } from "./reflections";
import type { Resource, Textbook } from "./resources";
import type { Trip, TripConsent } from "./trips";
import type { Unit } from "./units";
import type { PrintForm } from "./printForms";
import type { SubstituteSchoolText, SubstituteText } from "./substitute";
import type { SupportGoal, SupportPlan } from "./support";
import type { ClassGrading, GradeColumn, GradeRow, GradeValue } from "./grades";
import type { AgendaNote } from "./agenda";
import type { LessonPlan } from "./plans";
import type { TimetableCell, TimetablePeriod } from "./timetable";
import type {
  GoalArea,
  HolidaySource,
  ImportantDateKind,
  SenStatus,
  YearModel,
} from "../i18n/vocabularies";

export interface SchoolYear {
  year_model: YearModel;
  /** `YYYY-MM-DD`, or empty until the teacher sets it. */
  start_date: string;
}

export interface GradingPeriod {
  ordinal: number;
  name: string;
  start_date: string;
  end_date: string;
  notes: string;
}

export interface Holiday {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  source: HolidaySource;
  notes: string;
}

export interface ImportantDate {
  id: number;
  name: string;
  date: string;
  kind: ImportantDateKind;
  notes: string;
}

export interface AnnualGoal {
  area: GoalArea;
  goal: string;
  actions: string;
  success_indicators: string;
  deadline: string;
  status: string;
  review: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  subject: string;
  room: string;
  responsible: string;
  notes: string;
  position: number;
  seating_rows: number;
  seating_cols: number;
  seating_notes: string;
}

export interface Student {
  id: number;
  full_name: string;
  register_number: string;
  birth_date: string;
  home_language: string;
  address: string;
  midyear_enrollment: boolean;
  guardian1_name: string;
  guardian1_phone: string;
  guardian1_email: string;
  guardian2_name: string;
  guardian2_phone: string;
  guardian2_email: string;
  allergies: string;
  conditions: string;
  medication: string;
  emergency_phone: string;
  sen_status: SenStatus;
  sen_plan: string;
  sen_accommodations: string;
  notes: string;
  meeting_notes: string;
}

export interface Enrollment {
  class_id: number;
  student_id: number;
  roster_no: number;
  support: boolean;
  note: string;
}

export interface Seat {
  class_id: number;
  row: number;
  col: number;
  student_id: number;
}

/**
 * The M2 records are declared next to the arithmetic that reads them, in
 * `grades.ts`, rather than here — the calculation is the reason they have the
 * shape they do, and a `weight` of `null` only makes sense beside the rule that
 * treats it as undecided. They are re-exported so a screen still has one place
 * to import a planner's parts from.
 */
export type { ClassGrading, GradeColumn, GradeRow, GradeValue };

export interface Planner {
  school_year: SchoolYear;
  grading_periods: GradingPeriod[];
  holidays: Holiday[];
  important_dates: ImportantDate[];
  annual_goals: AnnualGoal[];
  classes: SchoolClass[];
  students: Student[];
  enrollments: Enrollment[];
  seats: Seat[];
  class_gradings: ClassGrading[];
  grade_columns: GradeColumn[];
  grade_values: GradeValue[];
  grade_rows: GradeRow[];
  timetable_periods: TimetablePeriod[];
  timetable_cells: TimetableCell[];
  lesson_plans: LessonPlan[];
  agenda_notes: AgendaNote[];
  attendance_marks: AttendanceMark[];
  absence_events: AbsenceEvent[];
  incidents: Incident[];
  support_plans: SupportPlan[];
  support_goals: SupportGoal[];
  parent_contacts: ParentContact[];
  parent_appointments: ParentAppointment[];
  staff_meetings: StaffMeeting[];
  meeting_agreements: MeetingAgreement[];
  units: Unit[];
  exams: Exam[];
  lesson_reflections: LessonReflection[];
  trips: Trip[];
  trip_consents: TripConsent[];
  textbooks: Textbook[];
  resources: Resource[];
  print_forms: PrintForm[];
  substitute_texts: SubstituteText[];
  substitute_school_texts: SubstituteSchoolText[];
}

/** A blank card, so "new student" and "loaded student" are the same shape. */
export function emptyStudent(): Student {
  return {
    id: 0,
    full_name: "",
    register_number: "",
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

/**
 * The M3 records live beside the selectors that read them, in `timetable.ts`,
 * `plans.ts` and `agenda.ts` — for the same reason M2's live in `grades.ts`:
 * a `class_id` of `null` only makes sense next to the rule that reads it as a
 * duty rather than as a lesson. Re-exported so a screen still has one place to
 * import a planner's parts from.
 */
export type { TimetableCell, TimetablePeriod } from "./timetable";
export type { LessonPlan } from "./plans";
export type { AgendaNote } from "./agenda";

/**
 * M4's records live beside their own selectors too — the attendance mark next
 * to the rule that builds a month grid out of actual dates, the incident next
 * to the rule that makes it follow the student rather than a class, and the
 * support plan next to the overview that merges it with the card's own flags.
 * Re-exported for the same reason as the others.
 */
export type { AbsenceEvent, AttendanceMark } from "./attendance";
export type { Incident } from "./behaviour";
export type { SupportGoal, SupportPlan } from "./support";
export type { SenStatus } from "../i18n/vocabularies";

/**
 * M5's records live beside their own selectors too — the contact next to the
 * rule that makes it a *record of what happened*, the appointment next to the
 * rule that keys it by an actual date and builds the week grid as a view over
 * one, and the meeting next to the upcoming panel that reads both. Re-exported
 * for the same reason as the others.
 */
export type { ParentAppointment, ParentContact } from "./parents";
export type { MeetingAgreement, StaffMeeting } from "./meetings";

/**
 * M6's records live beside their own selectors too — the unit next to the rule
 * that makes it the annual plan's row as well as its own card, the exam next to
 * the rule that keeps it out of the gradebook's arithmetic, and the trip next
 * to the rule that counts its consents rather than storing a number.
 *
 * **There is no progress-matrix record here, and that is the point.** The
 * week-by-class matrix is a view over `lesson_plans` above — see
 * `domain/progress.ts`.
 */
export type { Unit } from "./units";
export type { Exam } from "./exams";
export type { LessonReflection } from "./reflections";
export type { Trip, TripConsent } from "./trips";
export type { Resource, Textbook } from "./resources";

/**
 * M7's records live beside their own rules too — a saved print form next to
 * the definition of the eleven forms and the keys their values are stored
 * under, and the substitute folder's texts next to the rule that tells an
 * untouched box from a cleared one.
 *
 * **There is no stored copy of anything the folder shows from elsewhere** — no
 * seats, no roster, no week. `domain/substitute.ts` reads those live.
 */
export type { PrintForm, PrintFormValue } from "./printForms";
export type { SubstituteSchoolText, SubstituteText } from "./substitute";

export function emptyClass(): SchoolClass {
  return {
    id: 0,
    name: "",
    subject: "",
    room: "",
    responsible: "",
    notes: "",
    position: 0,
    // The source product's room plan is six across and five deep.
    seating_rows: 5,
    seating_cols: 6,
    seating_notes: "",
  };
}

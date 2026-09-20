/**
 * The planner as the Rust side serialises it. Field names are snake_case
 * because they are the wire format, not a style choice — see `src-tauri/src/model.rs`,
 * which is the definition these mirror.
 */
import type { ClassGrading, GradeColumn, GradeRow, GradeValue } from "./grades";
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

export interface ClassSlot {
  id: number;
  class_id: number;
  /** 1 = Monday … 6 = Saturday. */
  weekday: number;
  period_label: string;
  start_time: string;
  end_time: string;
  room: string;
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
  slots: ClassSlot[];
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
    slots: [],
  };
}

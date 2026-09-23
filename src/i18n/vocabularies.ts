/**
 * The fixed reference vocabularies: year models, holiday sources,
 * important-date types, SEN categories, goal areas, weekdays, months.
 *
 * The spec's Language section asks for these to live in a translation table
 * rather than being hardcoded per language, because several modules reuse the
 * same vocabulary. So a vocabulary here is a list of **stable codes** — those
 * are what the database stores — and the label for a code is looked up as the
 * string id `vocab.<kind>.<code>`. Translating a vocabulary is then the same
 * act as translating any other string: one more block in the language file.
 *
 * Storing the code and never the label is also what keeps a teacher's data
 * readable after a language switch: a student's SEN status is `accommodations`
 * on disk, and reads as "Προσαρμογές" or "Accommodations" depending on the UI.
 */
import type { StringId } from "./index";

export const YEAR_MODELS = ["sep_aug", "jan_dec", "feb_dec"] as const;
export const HOLIDAY_SOURCES = ["ministry", "school"] as const;
export const IMPORTANT_DATE_KINDS = [
  "deadline",
  "meeting",
  "exam_window",
  "event",
  "other",
] as const;
export const SEN_STATUSES = ["none", "reinforcement", "accommodations", "gifted"] as const;
/** The six fixed areas, in the order the source product prints them. */
export const GOAL_AREAS = [
  "teaching",
  "development",
  "students",
  "colleagues",
  "parents",
  "wellbeing",
] as const;
/**
 * The four grade types one column can hold. Only `numeric` takes part in the
 * weighted average — the other three are recorded, shown and printed, and take
 * no part in it, nor does their weight (resolved by the product owner before
 * M2, so the app never invents a number the teacher did not type).
 */
export const GRADE_COLUMN_KINDS = ["numeric", "descriptive", "pass_fail", "comment"] as const;
/** The descriptive scale's four steps, Α–Δ. Codes, never the letters. */
export const DESCRIPTIVE_GRADES = ["a", "b", "c", "d"] as const;
export const PASS_FAIL_GRADES = ["pass", "fail"] as const;
/** The six conduct levels, in the order the source registry lists them. */
export const CONDUCT_LEVELS = [
  "exemplary",
  "very_good",
  "good",
  "satisfactory",
  "needs_support",
  "needs_intervention",
] as const;

/**
 * The four states one cell of the monthly attendance grid can hold.
 *
 * These are the source print template's own four symbols — `·` παρών,
 * `α` απουσία, `κ` καθυστέρηση, `u` δικαιολογημένη — as stable codes, and they
 * line up one-for-one with the four states the spec names. A cell holds exactly
 * one of them, as the printed card does; "excused" is therefore an excused
 * *absence*, not a flag on top of one. The flag reading lives where the spec
 * actually puts it: `AbsenceEvent.justified`, on the detailed register.
 *
 * An unmarked day is **not** a fifth code — it is the absence of a row.
 */
export const ATTENDANCE_STATES = ["present", "absent", "late", "excused"] as const;
/**
 * The two kinds of line the source's absence register has columns for —
 * `Απ.` and `Καθ.`. Nothing else is invented; see the release note.
 */
export const ABSENCE_KINDS = ["absence", "late"] as const;
/**
 * How far the parent follow-up on an absence has got. The empty string is a
 * fourth state meaning "she has not said", and is what a new event starts at.
 */
export const FOLLOW_UP_STATUSES = ["pending", "informed", "resolved"] as const;
/**
 * A support goal's progress rating.
 *
 * A **fixed vocabulary**, unlike the plan's `status`, which the spec calls out
 * as "written by the teacher, never computed". The spec uses both words in one
 * sentence, and a *rating* reads as a scale where a *status* reads as a
 * sentence — so the two are modelled differently on purpose. Empty means not
 * yet rated, as an unrated conduct level does.
 */
export const GOAL_PROGRESS = [
  "not_started",
  "in_progress",
  "partly_met",
  "met",
  "needs_review",
] as const;

/**
 * How a parent contact happened — the source log's "Μορφή" column (M5).
 *
 * Five codes rather than free text, because the column is a fixed vocabulary
 * everywhere else in this app and because a printed register reads better with
 * one word per line than with whatever the teacher typed that day. `note` is
 * the case the source's own register keeps room for: something she recorded
 * without a conversation having taken place.
 */
export const CONTACT_FORMATS = ["meeting", "phone", "email", "message", "note"] as const;
/** How a parent appointment is to be held (M5). */
export const APPOINTMENT_MODES = ["in_person", "phone", "online"] as const;
/**
 * Where a booking stands (M5).
 *
 * `proposed` is what a new slot starts at — the teacher has offered it and the
 * guardian has not answered — and it is deliberately distinct from
 * `confirmed`, because the upcoming panel shows both and the difference is what
 * the teacher is looking for.
 */
export const APPOINTMENT_STATUSES = ["proposed", "confirmed", "done", "cancelled"] as const;
/**
 * The three kinds of meeting the spec names: "Staff/council/class meetings"
 * (M5). The source product's own index offers Συνεδριάσεις συλλόγου and
 * Συμβούλια τμημάτων, and a class's own meeting is the third the spec adds.
 */
export const MEETING_KINDS = ["staff", "council", "class"] as const;

/**
 * Whether a student's guardian has consented to a trip (M6).
 *
 * **Two codes, and no row means "not recorded yet."** The source register's
 * `Συγκαταθέσεις` column is a blank cell the teacher fills as the slips come
 * back, so "I have not asked" and "she has not answered" are the same absence —
 * exactly as an unmarked day in the attendance grid is the absence of a row
 * rather than a fifth state.
 */
export const CONSENT_STATES = ["given", "refused"] as const;

/**
 * What a teaching resource is (M6).
 *
 * **These are the source page's own six captioned boxes** on *Υλικά και πηγές*.
 * The rebuild spec names a different six — own / school / shared / borrowed /
 * digital / other — and calls them "the six source categories", which the page
 * itself contradicts. See `domain/resources.ts`; raised for the product owner.
 */
export const RESOURCE_CATEGORIES = [
  "websites",
  "apps",
  "books",
  "video",
  "classroom",
  "other",
] as const;

/** Monday–Saturday, matching the source timetable grid. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;
/**
 * The three scopes an agenda note can be written at. The code is what the
 * database stores, and each scope keeps its own note for the same date.
 */
export const AGENDA_SCOPES = ["day", "week", "month"] as const;
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type YearModel = (typeof YEAR_MODELS)[number];
export type HolidaySource = (typeof HOLIDAY_SOURCES)[number];
export type ImportantDateKind = (typeof IMPORTANT_DATE_KINDS)[number];
export type SenStatus = (typeof SEN_STATUSES)[number];
export type GradeColumnKind = (typeof GRADE_COLUMN_KINDS)[number];
export type DescriptiveGrade = (typeof DESCRIPTIVE_GRADES)[number];
export type PassFailGrade = (typeof PASS_FAIL_GRADES)[number];
export type ConductLevel = (typeof CONDUCT_LEVELS)[number];
export type AttendanceState = (typeof ATTENDANCE_STATES)[number];
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
export type GoalProgress = (typeof GOAL_PROGRESS)[number];
export type GoalArea = (typeof GOAL_AREAS)[number];
export type ContactFormat = (typeof CONTACT_FORMATS)[number];
export type AppointmentMode = (typeof APPOINTMENT_MODES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type MeetingKind = (typeof MEETING_KINDS)[number];
export type ConsentState = (typeof CONSENT_STATES)[number];
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type AgendaScope = (typeof AGENDA_SCOPES)[number];
export type Month = (typeof MONTHS)[number];

/** The string id that labels one code of one vocabulary. */
export function vocabLabelId(kind: string, code: string | number): StringId {
  return `vocab.${kind}.${code}` as StringId;
}

export const yearModelLabel = (code: string) => vocabLabelId("yearModel", code);
export const holidaySourceLabel = (code: string) => vocabLabelId("holidaySource", code);
export const importantDateKindLabel = (code: string) => vocabLabelId("importantDateKind", code);
export const senStatusLabel = (code: string) => vocabLabelId("senStatus", code);
export const gradeColumnKindLabel = (code: string) => vocabLabelId("gradeColumnKind", code);
export const descriptiveGradeLabel = (code: string) => vocabLabelId("descriptiveGrade", code);
export const passFailGradeLabel = (code: string) => vocabLabelId("passFailGrade", code);
export const conductLabel = (code: string) => vocabLabelId("conduct", code);
export const goalAreaLabel = (code: string) => vocabLabelId("goalArea", code);
export const weekdayLabel = (day: number) => vocabLabelId("weekday", day);
export const agendaScopeLabel = (code: string) => vocabLabelId("agendaScope", code);
export const monthLabel = (month: number) => vocabLabelId("month", month);
export const attendanceStateLabel = (code: string) => vocabLabelId("attendanceState", code);
/** The one-character symbol the source's printed card uses for a state. */
export const attendanceSymbolLabel = (code: string) => vocabLabelId("attendanceSymbol", code);
export const absenceKindLabel = (code: string) => vocabLabelId("absenceKind", code);
/** The abbreviation the source register heads its two tick columns with. */
export const absenceKindShortLabel = (code: string) => vocabLabelId("absenceKindShort", code);
export const followUpLabel = (code: string) => vocabLabelId("followUp", code);
export const goalProgressLabel = (code: string) => vocabLabelId("goalProgress", code);
export const contactFormatLabel = (code: string) => vocabLabelId("contactFormat", code);
export const appointmentModeLabel = (code: string) => vocabLabelId("appointmentMode", code);
export const appointmentStatusLabel = (code: string) => vocabLabelId("appointmentStatus", code);
export const meetingKindLabel = (code: string) => vocabLabelId("meetingKind", code);
export const consentStateLabel = (code: string) => vocabLabelId("consentState", code);
export const resourceCategoryLabel = (code: string) => vocabLabelId("resourceCategory", code);

/**
 * The substitute folder — *Φάκελος αναπλήρωσης* — for one class.
 *
 * **This is the opposite of the eleven print forms, on purpose.** A print form
 * (`domain/printForms.ts`) is a loose page with nothing behind it. The folder is
 * "generated per class **from live data** (not a separate data-entry chore)",
 * and its seating plan is "shared live, not copied, so it's never stale". So
 * nothing here is a snapshot: [`substituteFolder`] reads the class, its roster,
 * its seats, the master timetable and the week's lesson plan out of the planner
 * every time it is asked, and there is no table anywhere holding a copy of any
 * of them. Move a student in Τάξεις and the folder — on screen and on paper —
 * has already moved her, with no "regenerate" to press. That is M7's second
 * acceptance criterion, held by there being nothing to regenerate.
 *
 * **The folder's own words are stored, and only those.** Three kinds of text
 * appear on its pages:
 *
 * 1. **Live data**, looked up — the class's name, subject, room and person in
 *    charge, the roster count, who needs attention, the week, the seats.
 * 2. **Boilerplate the app supplies** — the class rules, where things are, what
 *    to do if something goes wrong, the six quick procedures, the message to
 *    the substitute. "Prefilled once and stays independently editable after
 *    that."
 * 3. **What only the teacher can write** — the one-day fallback plan, the
 *    school's contacts.
 *
 * **How "prefilled once" is stored — and how "she cleared it" differs from "she
 * has not touched it".** A field's text lives in a row keyed by
 * `(class, field)`, and:
 *
 * - **no row** means *untouched*: the default from the language bundle shows,
 *   and prints;
 * - **a row** means *hers*, and it is shown exactly as stored — **including an
 *   empty one**, which is how a cleared box stays cleared instead of the
 *   default reappearing on the next launch;
 * - *Επαναφορά* deletes the row, which is the only way the default comes back.
 *
 * The default is therefore never *copied* into the file. That is deliberate,
 * and it is the same outcome as prefilling from the teacher's point of view —
 * the box is full the first time she opens it, and nothing she writes is ever
 * overwritten — with one advantage a copy would not have: an untouched box
 * follows the interface language when M9 adds English, while everything she
 * typed stays exactly as typed, as the spec requires of teacher text. It is the
 * rule M4 set for an unmarked attendance day, applied to a sentence: the
 * absence of a row is "not recorded yet", not an empty value.
 *
 * **"Today" is an argument.** The folder shows "the current week's plan", and
 * which week that is depends on the day — which only the shell reads.
 */
import { addDays, mondayOf, weekdayOf } from "./dates";
import { planFor } from "./plans";
import { cellAt, periodsOf, resolveHour, type ScheduledHour, type TimetablePeriod } from "./timetable";
import type { LessonPlan, Planner, SchoolClass } from "./types";
import type { StringId, Translate } from "../i18n";
import type { SenStatus } from "../i18n/vocabularies";

/** One of the folder's texts for one class, as the teacher left it. */
export interface SubstituteText {
  class_id: number;
  field: string;
  value: string;
}

/** One of the folder's texts that is the same for every class. */
export interface SubstituteSchoolText {
  field: string;
  value: string;
}

/**
 * The per-class texts that have a default, and the bundle string it is.
 *
 * The wording of every default is the app's own, in `src/i18n/formsEl.ts` —
 * the source's boxes are blank, so there is nothing to transcribe.
 */
export const CLASS_DEFAULTS: Record<string, StringId> = {
  rules: "folder.default.rules",
  materials: "folder.default.materials",
  problem: "folder.default.problem",
  message: "folder.default.message",
};

/**
 * The six people the source's contacts page names, in its order.
 *
 * `responsible` is *not* stored: it is the class's own `Υπεύθυνος`, from M1's
 * class card, and so is looked up — the one contact that differs by class.
 * The other five are the school's and the same for every class, so they are
 * typed once rather than once per class.
 */
export const CONTACT_ROLES = [
  "principal",
  "deputy",
  "office",
  "responsible",
  "counsellor",
  "firstAid",
] as const;

/** The six quick procedures, in the source's order. The same for every class. */
export const PROCEDURES = ["toilet", "evacuation", "devices", "breaks", "lateness", "end"] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number];
export type Procedure = (typeof PROCEDURES)[number];

export const contactField = (role: ContactRole) => `contact.${role}`;
export const procedureField = (procedure: Procedure) => `proc.${procedure}`;

/** The school-wide texts that have a default: the six procedures. */
export const SCHOOL_DEFAULTS: Record<string, StringId> = Object.fromEntries(
  PROCEDURES.map((p) => [procedureField(p), `folder.default.proc.${p}` as StringId]),
);

/** The one-day plan's rows. Seven, as the source page prints; she may add more. */
export const DAY_ROWS = 7;
export const DAY_ROWS_KEY = "day.rows";
export const dayKey = (row: number, column: "time" | "activity" | "notes") =>
  `day.${row}.${column}`;

export type TextState = "default" | "edited" | "cleared";

export interface ResolvedText {
  value: string;
  state: TextState;
}

/**
 * What a folder text reads as, and why.
 *
 * `classId` is `null` for the school-wide texts. A field with no default and
 * no row reads as empty and counts as `cleared` — there is nothing to restore.
 */
export function folderText(
  planner: Planner,
  classId: number | null,
  field: string,
  t: Translate,
): ResolvedText {
  const stored =
    classId === null
      ? planner.substitute_school_texts.find((s) => s.field === field)
      : planner.substitute_texts.find((s) => s.class_id === classId && s.field === field);
  if (stored) {
    return { value: stored.value, state: stored.value === "" ? "cleared" : "edited" };
  }
  const defaultId = (classId === null ? SCHOOL_DEFAULTS : CLASS_DEFAULTS)[field];
  return defaultId ? { value: t(defaultId), state: "default" } : { value: "", state: "cleared" };
}

/** Whether a field has a default to go back to. */
export function hasDefault(classId: number | null, field: string): boolean {
  return field in (classId === null ? SCHOOL_DEFAULTS : CLASS_DEFAULTS);
}

// ------------------------------------------------------------ live data ---

/**
 * The Monday of "the current week", for a folder read on `today`.
 *
 * On a school day it is this week. **On a Saturday or a Sunday it is the week
 * coming**: the folder is for the morning the teacher does not come in, and on
 * a weekend the next morning anyone will open it is Monday's. Printed on a
 * Sunday evening, last week's plan would be the wrong thing to leave.
 */
export function folderWeekMonday(today: string): string {
  return weekdayOf(today) >= 6 ? addDays(mondayOf(today), 7) : mondayOf(today);
}

/** Something about one student that a substitute should know, verbatim. */
export type AttentionNote =
  | { kind: "sen"; code: SenStatus }
  | { kind: "support"; text: string }
  | { kind: "allergies" | "conditions" | "medication"; text: string };

export interface AttentionEntry {
  studentId: number;
  name: string;
  notes: AttentionNote[];
}

export interface FolderWeek {
  monday: string;
  /** The weekdays shown: Monday–Friday, and Saturday only if the class meets then. */
  weekdays: number[];
  rows: { period: TimetablePeriod; cells: (ScheduledHour | null)[] }[];
  /** This class's plan for the week — the same row M3's weekly plan edits. */
  plan: LessonPlan;
}

export interface FolderSeating {
  /** Row by row from the front; an empty string is an empty desk. */
  names: string[][];
  notes: string;
}

export interface SubstituteFolder {
  schoolClass: SchoolClass;
  rosterSize: number;
  attention: AttentionEntry[];
  week: FolderWeek;
  seating: FolderSeating;
}

/**
 * Everything live on one class's folder, read from the planner as it is now.
 *
 * Pure, and a function of `(planner, classId, today)` only — so the screen, the
 * printed file and a test all see the same folder, and none of them can see a
 * stale one. Returns `null` for a class that does not exist.
 */
export function substituteFolder(
  planner: Planner,
  classId: number,
  today: string,
): SubstituteFolder | null {
  const schoolClass = planner.classes.find((c) => c.id === classId);
  if (!schoolClass) return null;

  const enrolled = planner.enrollments
    .filter((e) => e.class_id === classId)
    .sort((a, b) => a.roster_no - b.roster_no);

  const attention: AttentionEntry[] = [];
  for (const enrollment of enrolled) {
    const student = planner.students.find((s) => s.id === enrollment.student_id);
    if (!student) continue;
    // The same three signals M4's support overview merges, plus the card's
    // health fields — each copied verbatim, never summarised. A student is
    // listed if any of them says something.
    const notes: AttentionNote[] = [];
    if (student.sen_status !== "none") notes.push({ kind: "sen", code: student.sen_status });
    if (enrollment.support) notes.push({ kind: "support", text: enrollment.note.trim() });
    for (const kind of ["allergies", "conditions", "medication"] as const) {
      const text = student[kind].trim();
      if (text) notes.push({ kind, text });
    }
    if (notes.length > 0) {
      attention.push({ studentId: student.id, name: student.full_name.trim(), notes });
    }
  }

  return {
    schoolClass,
    rosterSize: enrolled.length,
    attention,
    week: folderWeek(planner, classId, today),
    seating: folderSeating(planner, schoolClass),
  };
}

function folderWeek(planner: Planner, classId: number, today: string): FolderWeek {
  const monday = folderWeekMonday(today);
  const meetsSaturday = planner.timetable_cells.some(
    (c) => c.class_id === classId && c.weekday === 6,
  );
  const weekdays = meetsSaturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const rows = periodsOf(planner).map((period) => ({
    period,
    cells: weekdays.map((weekday) => {
      const cell = cellAt(planner, period.id, weekday);
      // Only this class's hours: the folder is the class's, and a substitute
      // covering it needs to know when it meets, not where the teacher is the
      // rest of the week.
      return cell && cell.class_id === classId ? resolveHour(planner, period, cell) : null;
    }),
  }));
  return { monday, weekdays, rows, plan: planFor(planner, classId, monday) };
}

/**
 * The room plan, read from M1's seating **as it is at this moment**.
 *
 * This is the function M7's second acceptance criterion rests on. It reads
 * `planner.seats` and `planner.classes` and nothing else, and it keeps no
 * copy: a seat changed on the Τάξεις screen is in the next call's result
 * because the planner that call is given is the one that change produced.
 */
export function folderSeating(planner: Planner, schoolClass: SchoolClass): FolderSeating {
  const name = (row: number, col: number) => {
    const seat = planner.seats.find(
      (s) => s.class_id === schoolClass.id && s.row === row && s.col === col,
    );
    const student = seat && planner.students.find((s) => s.id === seat.student_id);
    return student ? student.full_name.trim() : "";
  };
  return {
    names: Array.from({ length: schoolClass.seating_rows }, (_, row) =>
      Array.from({ length: schoolClass.seating_cols }, (__, col) => name(row, col)),
    ),
    notes: schoolClass.seating_notes,
  };
}

/** How many rows the one-day plan has: seven, or more if she added some. */
export function dayRows(planner: Planner, classId: number): number {
  const stored = planner.substitute_texts.find(
    (s) => s.class_id === classId && s.field === DAY_ROWS_KEY,
  );
  const n = Number(stored?.value);
  return Number.isInteger(n) && n > DAY_ROWS ? n : DAY_ROWS;
}

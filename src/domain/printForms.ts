/**
 * The eleven standalone print forms: what each one is made of, and how a
 * filled-in value is keyed.
 *
 * **A print form is a loose page.** It has no class, no roster and no live
 * record behind it — the source calls them `Πρότυπα για εκτύπωση` and tells the
 * teacher to "fill them in on screen or print them and keep them to hand", one
 * form per A4 sheet. So nothing in this module, and nothing in
 * `print/formSheets.ts` that prints one, is given the planner. That is
 * deliberate and it is the whole difference between these and the pages beside
 * them in the app that *look* the same:
 *
 * - *Απουσίες του μήνα* here is a blank card with no class behind it; M4.5's
 *   printed month card is a view over a real class's marks.
 * - *Επικοινωνία με γονείς* here is a blank log; M5's is the stored register.
 * - *Πλάνο αίθουσας* here is a blank room with desks to write names on; the
 *   substitute folder's room plan (`domain/substitute.ts`) is a **live** view of
 *   M1's seating, and must be.
 * - *Στόχοι και επαγγελματική ανάπτυξη* is neither M1's six annual-goal areas
 *   nor M8's development goals.
 *
 * **The words are not here.** Every caption is a string id, transcribed from
 * the source page it names into `src/i18n/el.ts`; the period checklist's
 * sixteen fixed items are content rather than labels and live in
 * `src/i18n/formsEl.ts`. This module carries no Greek, so M9 adds a language
 * file and changes nothing here.
 *
 * **How a value is stored.** A saved form is a name plus a flat map of
 * `field → value` (`print_form_value` on disk). Every input on every form has a
 * stable key built by the helpers below — `reg.3.date` for row 3's date,
 * `desk.2.5` for the fifth desk in the second row, `start.backup` for a tick —
 * and a field with nothing in it is simply absent from the map. That shape was
 * chosen so that **a filled parent letter could be stored in the same table**
 * later without a migration: a letter's values are already a `key → value` map
 * (`LetterValues`), and it would be one more `kind`. Whether letters should
 * join is the product owner's open question, not this module's.
 */
import type { StringId } from "../i18n";
import type { PrintFormKind } from "../i18n/vocabularies";

/** A saved, named, filled-in copy of one of the eleven forms. */
export interface PrintForm {
  id: number;
  kind: PrintFormKind;
  /** The teacher's own name for it. Empty until she gives it one. */
  name: string;
  /** `YYYY-MM-DD`, the day it was made — passed down from the shell. */
  created: string;
  /** `YYYY-MM-DD`, the last day anything in it was changed. */
  updated: string;
  /** Every filled field, by its key. An empty field has no entry. */
  values: Record<string, string>;
}

/** One stored value, as the command that writes it takes it. */
export interface PrintFormValue {
  form_id: number;
  field: string;
  value: string;
}

/** A small captioned input across the head of a form. */
export interface FormField {
  key: string;
  captionId: StringId;
  kind?: "text" | "date" | "time";
  /** Relative width within the row, as the source page proportions it. */
  grow?: number;
  /**
   * Fixed text in place of an input — the attendance card's `ΣΥΜΒΟΛΑ` key,
   * which is part of the form rather than something the teacher fills in.
   */
  legendId?: StringId;
}

/** A captioned box the teacher writes into. */
export interface FormArea {
  key: string;
  captionId: StringId;
  /**
   * Its height, in lines, on paper and on screen. Budgeted against the page
   * the print window actually lays out: A4 in CSS pixels one-to-one with PDF
   * points, which leaves about 207 CSS millimetres of height on a portrait
   * sheet — not 277 — because a CSS millimetre prints at about 1.33mm.
   */
  rows: number;
}

/** A column of a ruled table. */
export interface FormColumn {
  key: string;
  /** A caption from the bundle — or, for a day of the month, just the number. */
  captionId?: StringId;
  caption?: string;
  /** Its printed width, as a share of the sheet. */
  width?: string;
  kind?: "text" | "date";
}

/**
 * One piece of a form, top to bottom.
 *
 * - `fields` — a row of small captioned inputs.
 * - `areas` — one captioned box, or two side by side.
 * - `table` — a ruled register. `rows` is how many the source page prints; the
 *   teacher can add more, and the extra rows run onto a second sheet.
 * - `desks` — the room plan: a board across the front and a grid of desks.
 * - `checklist` — columns of fixed items with a tick each.
 * - `cards` — a group of fields and boxes repeated down the page: the four
 *   goals, or the two parent notes. `cut` frames each one with a dashed line.
 * - `signatures` — ruled lines with captions under them.
 */
export type FormPart =
  | { kind: "fields"; fields: FormField[] }
  | { kind: "areas"; areas: FormArea[] }
  | {
      kind: "table";
      key: string;
      columns: FormColumn[];
      rows: number;
      /** A leading `Αρ.` column numbered 01, 02, … — part of the form. */
      numbered?: boolean;
    }
  | { kind: "desks"; rows: number; cols: number }
  | { kind: "checklist"; columns: { captionId: StringId; code: string; items: string[] }[] }
  | {
      kind: "cards";
      key: string;
      count: number;
      /** How the screen names one card: "Στόχος 2", "Σημείωμα 1". */
      labelId: StringId;
      titleId?: StringId;
      cut?: boolean;
      /** Whether the teacher may add more than `count`. */
      extendable?: boolean;
      parts: CardPart[];
    }
  | { kind: "signatures"; fields: FormField[] };

/** What a card is made of — the same pieces, minus tables, desks and cards. */
export type CardPart =
  | { kind: "fields"; fields: FormField[] }
  | { kind: "areas"; areas: FormArea[] }
  | { kind: "signatures"; fields: FormField[] };

export interface FormDefinition {
  kind: PrintFormKind;
  /** The italic line under the title, transcribed from the source page. */
  subtitleId: StringId;
  parts: FormPart[];
  /**
   * Portrait, all eleven. The source's `Κάθε πρότυπο σε ξεχωριστή σελίδα A4`
   * pages are portrait A4 — even the 31-day attendance card.
   */
  landscape?: false;
  /** A hint the screen shows above the form, where one is warranted. */
  hintId?: StringId;
}

// ------------------------------------------------------------ the keys ---

/** A table cell: `reg.3.date`. Rows count from 1, as the paper does. */
export const cellKey = (table: string, row: number, column: string) =>
  `${table}.${row}.${column}`;
/** How many rows the teacher has asked a table for, when more than the page. */
export const rowCountKey = (table: string) => `${table}.rows`;
/** One desk of the room plan, row 1 at the front: `desk.1.4`. */
export const deskKey = (row: number, col: number) => `desk.${row}.${col}`;
export const DESK_ROWS_KEY = "desks.rows";
export const DESK_COLS_KEY = "desks.cols";
/** A tick on the period checklist: `start.backup`. */
export const tickKey = (column: string, item: string) => `${column}.${item}`;
/** A field inside the n-th card: `goal.2.deadline`. */
export const cardKey = (cards: string, index: number, field: string) =>
  `${cards}.${index}.${field}`;
export const cardCountKey = (cards: string) => `${cards}.count`;

/** The largest a room plan may be — the same bound as a class's seating. */
export const MAX_DESKS_SIDE = 12;

/** A table's row count: the source's, or more if the teacher has added rows. */
export function tableRows(
  part: Extract<FormPart, { kind: "table" }>,
  values: Record<string, string>,
): number {
  return Math.max(part.rows, positive(values[rowCountKey(part.key)]));
}

/** A card group's count: the source's, or more if the teacher has added some. */
export function cardCount(
  part: Extract<FormPart, { kind: "cards" }>,
  values: Record<string, string>,
): number {
  return Math.max(part.count, positive(values[cardCountKey(part.key)]));
}

/** The room plan's size: the source's six by five unless she changed it. */
export function deskGrid(
  part: Extract<FormPart, { kind: "desks" }>,
  values: Record<string, string>,
): { rows: number; cols: number } {
  const clamp = (raw: string | undefined, fallback: number) => {
    const n = positive(raw);
    return n === 0 ? fallback : Math.min(MAX_DESKS_SIDE, n);
  };
  return {
    rows: clamp(values[DESK_ROWS_KEY], part.rows),
    cols: clamp(values[DESK_COLS_KEY], part.cols),
  };
}

function positive(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// ----------------------------------------------------------- the forms ---

const days: FormColumn[] = Array.from({ length: 31 }, (_, i) => ({
  key: `d${i + 1}`,
  caption: String(i + 1),
  width: "2.53%",
}));

/**
 * The eleven, in the source's own page order (pages 2–12 of *Πρότυπα για
 * εκτύπωση*), with their parts transcribed from each page top to bottom.
 */
export const PRINT_FORMS: FormDefinition[] = [
  {
    kind: "attendance",
    subtitleId: "form.attendance.subtitle",
    parts: [
      {
        kind: "fields",
        fields: [
          { key: "class", captionId: "form.field.class" },
          { key: "month", captionId: "form.field.month" },
          {
            key: "legend",
            captionId: "form.attendance.legendCaption",
            legendId: "form.attendance.legend",
            grow: 2,
          },
        ],
      },
      {
        kind: "table",
        key: "reg",
        numbered: true,
        rows: 30,
        columns: [{ key: "name", captionId: "form.col.fullName", width: "17%" }, ...days],
      },
    ],
  },
  {
    kind: "parentLog",
    subtitleId: "form.parentLog.subtitle",
    parts: [
      {
        kind: "table",
        key: "reg",
        rows: 22,
        columns: [
          { key: "date", captionId: "form.col.date", width: "15%", kind: "date" },
          { key: "student", captionId: "form.col.student", width: "18%" },
          { key: "guardian", captionId: "form.col.guardian", width: "16%" },
          { key: "format", captionId: "form.col.format", width: "13%" },
          { key: "reason", captionId: "form.col.reasonAgreements", width: "24%" },
          { key: "next", captionId: "form.col.nextStep", width: "14%" },
        ],
      },
    ],
  },
  {
    kind: "coverLesson",
    subtitleId: "form.coverLesson.subtitle",
    parts: [
      {
        kind: "fields",
        fields: [
          { key: "class", captionId: "form.field.class" },
          { key: "date", captionId: "form.field.date", kind: "date" },
          { key: "lesson", captionId: "form.field.lessonHour" },
          { key: "room", captionId: "form.field.room" },
        ],
      },
      { kind: "areas", areas: [{ key: "work", captionId: "form.coverLesson.work", rows: 9 }] },
      {
        kind: "areas",
        areas: [
          { key: "attention", captionId: "form.area.attention", rows: 8 },
          { key: "rules", captionId: "form.area.rules", rows: 8 },
        ],
      },
      { kind: "areas", areas: [{ key: "message", captionId: "form.area.message", rows: 7 }] },
    ],
  },
  {
    kind: "minutes",
    subtitleId: "form.minutes.subtitle",
    parts: [
      {
        kind: "fields",
        fields: [
          { key: "kind", captionId: "form.minutes.kind", grow: 2 },
          { key: "date", captionId: "form.field.date", kind: "date" },
          { key: "time", captionId: "form.field.time", kind: "time" },
        ],
      },
      { kind: "areas", areas: [{ key: "present", captionId: "form.minutes.present", rows: 2 }] },
      { kind: "areas", areas: [{ key: "agenda", captionId: "form.minutes.agenda", rows: 8 }] },
      {
        kind: "areas",
        areas: [{ key: "agreements", captionId: "form.minutes.agreements", rows: 8 }],
      },
      { kind: "areas", areas: [{ key: "actions", captionId: "form.minutes.actions", rows: 6 }] },
    ],
  },
  {
    kind: "priorities",
    subtitleId: "form.priorities.subtitle",
    parts: [
      {
        kind: "fields",
        fields: [
          { key: "week", captionId: "form.priorities.week" },
          { key: "goal", captionId: "form.priorities.goal", grow: 2 },
        ],
      },
      {
        kind: "areas",
        areas: [
          { key: "priorities", captionId: "form.priorities.priorities", rows: 9 },
          { key: "teaching", captionId: "form.priorities.teaching", rows: 9 },
        ],
      },
      {
        kind: "areas",
        areas: [
          { key: "marking", captionId: "form.priorities.marking", rows: 9 },
          { key: "parents", captionId: "form.priorities.parents", rows: 9 },
        ],
      },
      { kind: "areas", areas: [{ key: "notes", captionId: "form.priorities.notes", rows: 6 }] },
    ],
  },
  {
    kind: "roomPlan",
    subtitleId: "form.roomPlan.subtitle",
    parts: [
      {
        kind: "fields",
        fields: [
          { key: "class", captionId: "form.field.class" },
          { key: "subject", captionId: "form.field.subject" },
          { key: "date", captionId: "form.field.date", kind: "date" },
        ],
      },
      // The source's room is six desks across and five deep.
      { kind: "desks", rows: 5, cols: 6 },
    ],
  },
  {
    kind: "credentials",
    subtitleId: "form.credentials.subtitle",
    hintId: "form.credentials.hint",
    parts: [
      {
        kind: "table",
        key: "reg",
        rows: 22,
        columns: [
          { key: "platform", captionId: "form.col.platform", width: "30%" },
          { key: "user", captionId: "form.col.user", width: "22%" },
          { key: "password", captionId: "form.col.password", width: "20%" },
          { key: "notes", captionId: "form.col.remarks", width: "28%" },
        ],
      },
    ],
  },
  {
    kind: "periodChecklist",
    subtitleId: "form.periodChecklist.subtitle",
    parts: [
      {
        kind: "checklist",
        columns: [
          {
            captionId: "form.periodChecklist.start",
            code: "start",
            items: [
              "rosters",
              "syllabus",
              "criteria",
              "timetable",
              "room",
              "seating",
              "reports",
              "parents",
            ],
          },
          {
            captionId: "form.periodChecklist.end",
            code: "end",
            items: ["grades", "averages", "conduct", "deadline", "risks", "resits", "records", "backup"],
          },
        ],
      },
      { kind: "areas", areas: [{ key: "notes", captionId: "form.area.notes", rows: 15 }] },
    ],
  },
  {
    kind: "parentNote",
    subtitleId: "form.parentNote.subtitle",
    parts: [
      {
        // Two to a sheet, cut apart along the dashed line — the source page
        // says so itself: "Δύο σημειώματα ανά σελίδα · κόψτε κατά μήκος της
        // γραμμής". Rendered and looked at, as M5 learned to.
        kind: "cards",
        key: "note",
        count: 2,
        labelId: "form.parentNote.cardLabel",
        titleId: "form.parentNote.cardTitle",
        cut: true,
        parts: [
          {
            kind: "fields",
            fields: [
              { key: "student", captionId: "form.field.student", grow: 3 },
              { key: "date", captionId: "form.field.date", kind: "date" },
            ],
          },
          { kind: "areas", areas: [{ key: "body", captionId: "form.parentNote.body", rows: 6 }] },
          {
            kind: "signatures",
            fields: [
              { key: "teacher", captionId: "form.parentNote.teacherSignature" },
              { key: "parent", captionId: "form.parentNote.parentSignature" },
            ],
          },
        ],
      },
    ],
  },
  {
    kind: "loans",
    subtitleId: "form.loans.subtitle",
    parts: [
      {
        kind: "table",
        key: "reg",
        rows: 22,
        columns: [
          { key: "date", captionId: "form.col.date", width: "15%", kind: "date" },
          { key: "subject", captionId: "form.col.subject", width: "16%" },
          { key: "to", captionId: "form.col.givenTo", width: "20%" },
          { key: "count", captionId: "form.col.howMany", width: "9%" },
          { key: "returned", captionId: "form.col.returned", width: "15%", kind: "date" },
          { key: "status", captionId: "form.col.status", width: "25%" },
        ],
      },
    ],
  },
  {
    kind: "goals",
    subtitleId: "form.goals.subtitle",
    parts: [
      {
        kind: "cards",
        key: "goal",
        count: 4,
        labelId: "form.goals.cardLabel",
        extendable: true,
        parts: [
          {
            kind: "fields",
            fields: [
              { key: "goal", captionId: "form.goals.goal", grow: 3 },
              { key: "deadline", captionId: "form.goals.deadline" },
            ],
          },
          {
            kind: "areas",
            areas: [
              { key: "steps", captionId: "form.goals.steps", rows: 3 },
              { key: "progress", captionId: "form.goals.progress", rows: 3 },
            ],
          },
        ],
      },
    ],
  },
];

export function formDefinition(kind: PrintFormKind): FormDefinition {
  return PRINT_FORMS.find((f) => f.kind === kind)!;
}

/** A blank saved form, so "new" and "loaded" are the same shape. */
export function emptyForm(kind: PrintFormKind, today: string): PrintForm {
  return { id: 0, kind, name: "", created: today, updated: today, values: {} };
}

/** A kind's saved forms, most recently changed first. */
export function formsOfKind(forms: PrintForm[], kind: PrintFormKind): PrintForm[] {
  return forms
    .filter((f) => f.kind === kind)
    .sort((a, b) => b.updated.localeCompare(a.updated) || b.id - a.id);
}

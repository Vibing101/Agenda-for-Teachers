/**
 * The percentage-weighted gradebook arithmetic.
 *
 * This is the one piece of real calculation logic in the whole app, which is
 * why it is a pure module with no React, no `api`, and no knowledge of how a
 * cell is edited — everything here is a function of values in and numbers out,
 * so every branch the spec names can be tested directly.
 *
 * The rules, taken from the spec's "Grade weighting" section and the two
 * decisions the product owner took before M2 started:
 *
 * * **Only numeric columns take part.** Descriptive (Α–Δ), pass/fail and
 *   comment columns are recorded, displayed and printed, but contribute
 *   neither a value nor a weight — their weight is excluded from the
 *   normalising sum too, so a 30% comment column cannot silently dilute a
 *   student's average (resolved 2026-09-20).
 * * **A blank weight is "not yet decided"**, not zero: the column is excluded
 *   from the running total and from the average until the teacher fills it in.
 * * **Normalise by the weights that actually contributed**, never by a
 *   hardcoded 100. Two columns worth 40% and 30% with marks in average over
 *   that 70%, rather than being diluted as if the missing 30% were zeros.
 * * **All weights zero falls back to a plain arithmetic average** — the source
 *   spreadsheet's "leave the whole weight row empty for a simple average",
 *   expressed at the column level.
 * * **Nothing here blocks a save.** The running total being off from 100 is a
 *   warning the teacher can ignore; only a single invalid weight is rejected,
 *   and that is a field-level check, not a gate on the sheet.
 */
import type { ConductLevel, GradeColumnKind } from "../i18n/vocabularies";
import { parseDecimal } from "./numbers";

export interface GradeColumn {
  id: number;
  class_id: number;
  position: number;
  label: string;
  kind: GradeColumnKind;
  /**
   * The column's percentage weight, or `null` for "not yet decided".
   *
   * `null` and `0` are deliberately different: a blank weight drops the column
   * out of the calculation entirely, while a zero weight keeps it in and, if
   * every contributing column is zero, triggers the plain-average fallback.
   */
  weight: number | null;
}

/** One cell: always stored as text, whatever the column's type. */
export interface GradeValue {
  class_id: number;
  column_id: number;
  student_id: number;
  value: string;
}

/**
 * The per-(student, class) record that is not a cell: conduct, the teacher's
 * observations, and the conduct sheet's written overall result.
 *
 * `overall_result` is free text on purpose. The source product's
 * "Συμπεριφορά και στάση" page has the teacher write it, and the spec says it
 * is "kept as a manually-written field, not computed" — so nothing in this
 * module ever produces a value for it.
 */
export interface GradeRow {
  class_id: number;
  student_id: number;
  /** A conduct code, or `""` when the teacher has not rated her yet. */
  conduct: ConductLevel | "";
  observations: string;
  overall_result: string;
}

/**
 * The per-class grading settings M2 introduces: the pass threshold ("Βάση"),
 * the scale's upper bound, and the free-text period label the source's sheet
 * header carries.
 */
export interface ClassGrading {
  class_id: number;
  pass_threshold: number;
  scale_max: number;
  period: string;
}

export const DEFAULT_PASS_THRESHOLD = 10;
export const DEFAULT_SCALE_MAX = 20;

export function defaultGrading(classId: number): ClassGrading {
  return {
    class_id: classId,
    pass_threshold: DEFAULT_PASS_THRESHOLD,
    scale_max: DEFAULT_SCALE_MAX,
    period: "",
  };
}

// ------------------------------------------------------------- parsing ---

/**
 * A typed mark as a number, or `null` if the cell is blank or not a number.
 *
 * A Greek keyboard produces a decimal comma as readily as a dot, and a teacher
 * typing `12,5` means twelve and a half — so both separators are accepted.
 * Anything else (a stray letter, a range, a dash) is not a mark and takes no
 * part in the average rather than being coerced to zero.
 */
export function parseNumericGrade(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * A typed weight as a percentage, or `null` for "not yet decided".
 *
 * Returns `undefined` for input that is not a valid single weight — negative,
 * non-numeric, or over 100 — which is the one thing the spec does block a save
 * on. The three-way return keeps "blank" and "invalid" apart, because they mean
 * opposite things to the teacher.
 */
export function parseWeight(value: string): number | null | undefined {
  const n = parseDecimal(value);
  if (n === null || n === undefined) return n;
  return n > 100 ? undefined : n;
}

/** Whether a column's marks are numbers, and so can be averaged at all. */
export function isNumericColumn(column: GradeColumn): boolean {
  return column.kind === "numeric";
}

// --------------------------------------------------------- the average ---

/** One cell paired with the column it sits under. */
export interface Cell {
  column: GradeColumn;
  value: string;
}

/**
 * The cells that actually feed the average: numeric column, a value that parses
 * as a number, and a weight the teacher has decided on.
 *
 * Split out from [`weightedAverage`] because it is exactly what the "why is my
 * average over 70% and not 100%?" question needs answering with, and because
 * the exclusion rules are the part most worth testing on their own.
 */
export function contributingCells(cells: Cell[]): { grade: number; weight: number }[] {
  const out: { grade: number; weight: number }[] = [];
  for (const cell of cells) {
    if (!isNumericColumn(cell.column)) continue;
    if (cell.column.weight === null) continue;
    const grade = parseNumericGrade(cell.value);
    if (grade === null) continue;
    out.push({ grade, weight: cell.column.weight });
  }
  return out;
}

/**
 * A student's weighted average across one class's columns, or `null` when
 * there is nothing to average.
 *
 * `null` — shown as blank, never as 0 — covers three cases that all mean "no
 * result yet": no marks entered, marks entered only in non-numeric columns,
 * and marks entered only under columns whose weight is still blank. The last
 * of those is the spec read literally: a blank weight is undecided, so a sheet
 * with marks but no weights has not yet said how to combine them. The running
 * total sitting at 0% is the teacher's signal that this is what happened.
 */
export function weightedAverage(cells: Cell[]): number | null {
  const contributing = contributingCells(cells);
  if (contributing.length === 0) return null;

  const weightSum = contributing.reduce((sum, c) => sum + c.weight, 0);
  if (weightSum === 0) {
    // Every contributing column is weighted 0 — the teacher zeroed them out
    // rather than leaving them blank. The source spreadsheet's documented
    // fallback: a plain arithmetic average of the marks that are in.
    return contributing.reduce((sum, c) => sum + c.grade, 0) / contributing.length;
  }
  const weighted = contributing.reduce((sum, c) => sum + c.grade * c.weight, 0);
  return weighted / weightSum;
}

/**
 * The whole-number suggestion shown beside the precise average, matching the
 * source's `ROUND(average, 0)` — standard rounding, .5 up.
 */
export function suggestedGrade(average: number | null): number | null {
  if (average === null) return null;
  return Math.round(average);
}

/** `4.5`, or an em dash when there is no average yet. */
export function formatAverage(average: number | null): string {
  if (average === null) return "—";
  // Two decimals, with trailing zeros trimmed, so 4.5 reads as "4.5" and
  // 13.666… as "13.67" — the source registry's own display.
  return String(Number(average.toFixed(2)));
}

// ---------------------------------------------------- the running total ---

export type WeightTotalStatus = "none" | "under" | "exact" | "over";

/**
 * The running total of entered weights, over the columns that can actually
 * carry one.
 *
 * Non-numeric columns are left out of this sum as well as out of the average.
 * Showing "Total: 100%" for a sheet that normalises over 70% would be the
 * opposite of the warning's purpose — the total is meant to tell the teacher
 * how much of her sheet is accounted for, and a comment column accounts for
 * none of it.
 */
export function weightTotal(columns: GradeColumn[]): number {
  return columns
    .filter(isNumericColumn)
    .reduce((sum, c) => sum + (c.weight ?? 0), 0);
}

/**
 * Whether to show the running-total warning, and which way it is off.
 *
 * `none` means no weight has been decided at all yet — a sheet the teacher has
 * only just started, where nagging about 100% would be noise. Everything else
 * is a plain comparison. This never blocks a save; it only decides what the
 * teacher is told.
 */
export function weightTotalStatus(columns: GradeColumn[]): WeightTotalStatus {
  const weighted = columns.filter((c) => isNumericColumn(c) && c.weight !== null);
  if (weighted.length === 0) return "none";
  const total = weightTotal(columns);
  if (total === 100) return "exact";
  return total < 100 ? "under" : "over";
}

// --------------------------------------------------------- the roll-ups ---

export interface StudentResult {
  student_id: number;
  average: number | null;
  suggested: number | null;
  /** `null` while there is no average to compare against the threshold. */
  passing: boolean | null;
}

/**
 * Every enrolled student's result for one class.
 *
 * `cellsFor` is passed in rather than looked up here so this stays pure: the
 * caller decides where the values come from (the loaded planner in the app, a
 * fixture in a test). Each cell carries its own column, so the columns
 * themselves do not need to be passed separately.
 */
export function classResults(
  studentIds: number[],
  cellsFor: (studentId: number) => Cell[],
  grading: ClassGrading,
): StudentResult[] {
  return studentIds.map((student_id) => {
    const average = weightedAverage(cellsFor(student_id));
    const suggested = suggestedGrade(average);
    return {
      student_id,
      average,
      suggested,
      // Against the rounded suggestion, not the precise average: that is what
      // the source registry's own pass/at-risk counts compare (its COUNTIF
      // runs down the `Πρόταση` column, not the `Μέσος όρος` one).
      passing: suggested === null ? null : suggested >= grading.pass_threshold,
    };
  });
}

export interface ClassSummary {
  class_id: number;
  /** The average of the students who have one; `null` if nobody does. */
  average: number | null;
  highest: number | null;
  lowest: number | null;
  atOrAbove: number;
  below: number;
  rosterSize: number;
  /** How many students are rated as needing intervention. */
  needingIntervention: number;
}

/**
 * One class's roll-up, in the columns the source registry's own per-class
 * block shows: class average, highest, lowest, pass and at-risk counts, roster
 * size, and the conduct count that needs attention.
 *
 * Students without an average are counted in the roster size but in neither the
 * pass nor the at-risk count — a student whose marks are not in yet is not
 * at risk, she is simply not graded. That matches the source's `COUNTIF`, which
 * skips blank cells.
 */
export function classSummary(
  classId: number,
  results: StudentResult[],
  rows: GradeRow[],
): ClassSummary {
  const averages = results
    .map((r) => r.average)
    .filter((a): a is number => a !== null);
  return {
    class_id: classId,
    average: averages.length === 0 ? null : averages.reduce((a, b) => a + b, 0) / averages.length,
    highest: averages.length === 0 ? null : Math.max(...averages),
    lowest: averages.length === 0 ? null : Math.min(...averages),
    atOrAbove: results.filter((r) => r.passing === true).length,
    below: results.filter((r) => r.passing === false).length,
    rosterSize: results.length,
    needingIntervention: rows.filter((r) => r.conduct === "needs_intervention").length,
  };
}

export interface YearSummary {
  classes: ClassSummary[];
  /** The average of the class averages, as the source's "Γενικός μέσος όρος". */
  overall: number | null;
}

/**
 * The year-wide roll-up across every class.
 *
 * The overall figure averages the *class* averages, not every student's
 * average, so a class of 30 does not outweigh a class of 8 — that is what the
 * source registry's "Γενικός μέσος όρος" computes down its summary column.
 * Classes with no graded student contribute nothing rather than a zero.
 */
export function yearSummary(classes: ClassSummary[]): YearSummary {
  const averages = classes
    .map((c) => c.average)
    .filter((a): a is number => a !== null);
  return {
    classes,
    overall: averages.length === 0 ? null : averages.reduce((a, b) => a + b, 0) / averages.length,
  };
}

/**
 * Deriving the school year's weeks and months from its start date.
 *
 * The one rule that matters here, carried over from the previous project's
 * hardest lesson and written into the spec: **week numbers are derived, never
 * stored.** Every record in the database carries an actual date. A week number
 * is a function of (start date, date), computed at the moment something is
 * displayed. Moving the start date therefore re-labels the weeks and moves
 * nothing — there is no row anywhere holding a week index that would need
 * migrating, and so no way for a record to be silently relocated or lost.
 */
import { addDays, daysBetween, isIsoDate, mondayOf, monthOf } from "./dates";
import { GOAL_AREAS, type YearModel } from "../i18n/vocabularies";
import type { AnnualGoal } from "./types";

/** The source product's fixed count, and the spec's. */
export const WEEKS_IN_YEAR = 53;

/** Which calendar months a year model covers, as (first month, count). */
const MODEL_MONTHS: Record<YearModel, { firstMonth: number; count: number }> = {
  sep_aug: { firstMonth: 9, count: 12 },
  jan_dec: { firstMonth: 1, count: 12 },
  // Literally February to December — eleven months, not twelve. See the
  // release note: the source product markets "12 μήνες", so whether this model
  // is meant to wrap into January is a question for the product owner.
  feb_dec: { firstMonth: 2, count: 11 },
};

export interface YearMonth {
  year: number;
  /** 1–12. */
  month: number;
}

/**
 * The Monday that week 1 starts on, or `null` while the teacher has not set a
 * start date yet.
 */
export function firstMonday(startDate: string): string | null {
  return isIsoDate(startDate) ? mondayOf(startDate) : null;
}

/** The Monday week `week` (1-based) starts on. */
export function weekStart(startDate: string, week: number): string | null {
  const first = firstMonday(startDate);
  if (first === null) return null;
  return addDays(first, (week - 1) * 7);
}

export interface WeekOf {
  /** 1-based. Can fall outside 1…53 for a date outside the school year. */
  week: number;
  withinYear: boolean;
}

/**
 * Which week of the school year a date falls in.
 *
 * A date before week 1 or after week 53 still gets a number — it is simply
 * flagged as outside the year. Nothing is hidden or dropped just because the
 * teacher later moved the start date past it; that is exactly the silent data
 * loss this whole approach exists to prevent.
 */
export function weekOf(startDate: string, date: string): WeekOf | null {
  const first = firstMonday(startDate);
  if (first === null || !isIsoDate(date)) return null;
  const week = Math.floor(daysBetween(first, date) / 7) + 1;
  return { week, withinYear: week >= 1 && week <= WEEKS_IN_YEAR };
}

/** The Monday of the last week, for showing the year's span at a glance. */
export function lastWeekStart(startDate: string): string | null {
  return weekStart(startDate, WEEKS_IN_YEAR);
}

/**
 * The months the year model covers, anchored on the start date's year.
 *
 * If the start date falls before the model's first month — a Sep–Aug year whose
 * start date the teacher entered as a January date — the grid anchors to the
 * previous calendar year, so the start date still sits inside it.
 */
export function monthsOfYear(model: YearModel, startDate: string): YearMonth[] {
  const spec = MODEL_MONTHS[model];
  if (!isIsoDate(startDate)) return [];
  const startYear = Number(startDate.slice(0, 4));
  const anchor = monthOf(startDate) < spec.firstMonth ? startYear - 1 : startYear;

  const months: YearMonth[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    const offset = spec.firstMonth - 1 + i;
    months.push({ year: anchor + Math.floor(offset / 12), month: (offset % 12) + 1 });
  }
  return months;
}

/**
 * The 1–12 month numbers of the year, in school-year order and de-duplicated.
 *
 * Used by the birthday calendar, which is about months of the year rather than
 * about a specific September-to-August span — but still reads better starting
 * where the teacher's year starts.
 */
export function monthOrder(model: YearModel, startDate: string): number[] {
  const derived = monthsOfYear(model, startDate).map((m) => m.month);
  const seen = new Set(derived);
  for (let m = 1; m <= 12; m += 1) if (!seen.has(m)) derived.push(m);
  return Array.from(new Set(derived));
}

/**
 * The six annual goals in the order the source lists their areas — the order
 * the *Στόχοι για τη χρονιά* cards are shown in and the printed table's rows
 * (M10). One selector for both, so the paper cannot list them differently from
 * the screen (M4.5's rule).
 */
export function annualGoalsInOrder(goals: readonly AnnualGoal[]): AnnualGoal[] {
  const rank = (g: AnnualGoal) => GOAL_AREAS.indexOf(g.area);
  return [...goals].sort((a, b) => rank(a) - rank(b));
}

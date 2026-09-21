/**
 * Day, week and month agenda notes, and the calendar arithmetic the agenda
 * screen navigates by.
 *
 * Every note is keyed by `(scope, date)` where **`date` is an actual date**, not
 * an index into anything: the day itself, the Monday of the week, or the first of
 * the month. Normalising before the write is [`agendaKey`]'s job, so however the
 * teacher navigated to a week — through ‹ ›, through "jump to today", or by
 * clicking a Thursday in the month grid — her note for that week lands on one
 * row rather than on seven.
 *
 * As with a lesson plan, there is no generated id here: the UI knows the scope
 * and the date before it writes, so there is no new-record id to select and no
 * room for M1's create-then-edit defect.
 */
import { addDays, dayOfMonth, isIsoDate, mondayOf, monthOf, weekdayOf } from "./dates";
import type { AgendaScope } from "../i18n/vocabularies";
import type { Planner } from "./types";

export interface AgendaNote {
  scope: AgendaScope;
  date: string;
  body: string;
}

/** 1 = Monday … 7 = Sunday — the agenda's own week, which includes Sunday. */
export const AGENDA_WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

/** The year of an ISO date. */
function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/**
 * The canonical date a note of this scope is stored against.
 *
 * `day` keeps the day, `week` snaps back to its Monday, `month` to the 1st.
 * Everything that reads or writes a note goes through this, which is what keeps
 * one note per period however the teacher got there.
 */
export function agendaKey(scope: AgendaScope, date: string): string {
  if (!isIsoDate(date)) return date;
  if (scope === "week") return mondayOf(date);
  if (scope === "month") return firstOfMonth(date);
  return date;
}

/** The note for one scope and date, blank rather than missing if never saved. */
export function noteFor(planner: Planner, scope: AgendaScope, date: string): AgendaNote {
  const key = agendaKey(scope, date);
  return (
    planner.agenda_notes.find((n) => n.scope === scope && n.date === key) ?? {
      scope,
      date: key,
      body: "",
    }
  );
}

/** Whether a note has been written for this scope and date. */
export function hasNote(planner: Planner, scope: AgendaScope, date: string): boolean {
  return noteFor(planner, scope, date).body.trim() !== "";
}

/**
 * The adjacent period the ‹ › buttons move to.
 *
 * A day steps by a day, a week by seven days, a month by a calendar month —
 * clamped to the target month's length, so stepping back from 31 March lands on
 * 28 February rather than on 3 March.
 */
export function step(scope: AgendaScope, date: string, by: -1 | 1): string {
  if (scope === "day") return addDays(date, by);
  if (scope === "week") return mondayOf(addDays(date, by * 7));

  const year = yearOf(date);
  const month = monthOf(date) + by;
  const targetYear = year + Math.floor((month - 1) / 12);
  const targetMonth = ((((month - 1) % 12) + 12) % 12) + 1;
  const length = daysInMonth(targetYear, targetMonth);
  const day = Math.min(dayOfMonth(date), length);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${targetYear}-${pad(targetMonth)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The seven days of the week containing `date`, Monday through Sunday. */
export function weekDays(date: string): string[] {
  const monday = mondayOf(date);
  return AGENDA_WEEK.map((_, i) => addDays(monday, i));
}

/**
 * The month containing `date` as rows of seven days, Monday through Sunday.
 *
 * Leading and trailing cells are `null` rather than the neighbouring month's
 * days: the source product's month page is that month's own grid, and a day
 * belonging to another month would offer a note filed under the wrong month.
 */
export function monthGrid(date: string): (string | null)[][] {
  const year = yearOf(date);
  const month = monthOf(date);
  const first = firstOfMonth(date);
  const lead = weekdayOf(first) - 1;
  const length = daysInMonth(year, month);

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= length; day += 1) cells.push(addDays(first, day - 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Which of the 12 months of a calendar year this is, for the "01 / 12" counter. */
export function monthOrdinal(date: string): number {
  return monthOf(date);
}

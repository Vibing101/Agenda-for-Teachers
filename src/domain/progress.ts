/**
 * Ανάπτυξη ανά τμήμα — the week-by-class progress matrix.
 *
 * **This is a view over M3's `lesson_plan`. There is no matrix table, and
 * adding one would be the milestone's central mistake.**
 *
 * M6's first acceptance criterion is that the matrix "correctly reflects
 * entries made from the per-class weekly plan (M3) **without duplicate data
 * entry**". A table with a cell per `(week, class)` would give the teacher two
 * places to write what she did that week in that class — the weekly plan screen
 * and this grid — and she would have to keep them agreeing by hand. So every
 * cell here is *read* from the plan she already wrote, and nothing on this
 * surface is stored at all.
 *
 * The source product says the same thing in its own words: the index card that
 * opens this page is headed **"Το εβδομαδιαίο πλάνο σε έναν πίνακα · Η πρόοδος
 * των τμημάτων, εβδομάδα με εβδομάδα"** — *the weekly plan in one table*. The
 * page itself is a grid of `Εβδομάδα × Τμήμα 1…6`.
 *
 * It is the third time this project has taken that call: M4 made the monthly
 * attendance grid a view over dated marks with no month column, M5 made the
 * parent-appointment week a view over dated bookings with no weekday column,
 * and this makes the progress matrix a view over dated plans with no week
 * column.
 *
 * **The rows are derived, not stored.** `Εβδομάδα` is a *label*, computed from
 * the school year's start date by `schoolYear.ts` at the moment the grid is
 * drawn. Correcting that start date re-labels every row and moves no plan,
 * which is the rule this project has held since M1.
 */
import { addDays, mondayOf } from "./dates";
import { hasPlan, planFor, type LessonPlan } from "./plans";
import { weekStart, WEEKS_IN_YEAR } from "./schoolYear";
import type { Planner, SchoolClass } from "./types";

/**
 * One cell of the grid: what one class has written for one week.
 *
 * `plan` is M3's own record, handed through untouched — the screen shows the
 * teacher's words exactly as she typed them, because that is the whole point of
 * the criterion. `summary` is the same text reduced to its first line, for the
 * grid's narrow cell; the full plan is there beside it for anything that has
 * room.
 */
export interface ProgressCell {
  classId: number;
  /** The Monday of this cell's week, an actual date. */
  weekMonday: string;
  /** M3's stored plan, or the blank one `planFor` supplies. */
  plan: LessonPlan;
  /** Whether the teacher has written anything for this class that week. */
  written: boolean;
  /** The first non-empty line of the plan's notes, for the grid's cell. */
  summary: string;
  /** Whether the week carries an assessment — the source's own emphasis. */
  hasAssessment: boolean;
}

export interface ProgressRow {
  /** 1-based, derived from the school year's start date. Never stored. */
  week: number;
  /** The Monday the week starts on. */
  monday: string;
  /** The Sunday it ends on, for the row's date span. */
  sunday: string;
  /** Whether `today` falls in this week. */
  isCurrent: boolean;
  /** One cell per class, in the order the classes are listed. */
  cells: ProgressCell[];
}

export interface ProgressMatrix {
  /** The classes across the top — the source's `Τμήμα 1…6`, uncapped. */
  classes: SchoolClass[];
  rows: ProgressRow[];
}

/** The first non-empty line of a plan's notes. */
export function planSummary(plan: LessonPlan): string {
  const line = plan.notes
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "");
  return line ?? "";
}

/**
 * How many weeks the grid shows at once. The source prints its matrix over two
 * pages; the screen pages through the year in the same sort of bite rather than
 * making the teacher scroll 53 rows to find November.
 */
export const PROGRESS_PAGE_WEEKS = 10;

/**
 * The matrix, for the weeks `fromWeek … fromWeek + count - 1`.
 *
 * **Reads `lesson_plans` and `classes` and nothing else.** In particular it
 * never reads a reflection, an exam or a unit: those are other records the
 * teacher keeps, and folding one of them in here would make the grid disagree
 * with the weekly plan screen it is supposed to be a second view of.
 *
 * @param today The day the shell read from the calendar, used only to mark the
 *   current week. Never read from the clock inside this module.
 */
export function progressMatrix(
  planner: Planner,
  today: string,
  fromWeek: number,
  count: number = PROGRESS_PAGE_WEEKS,
): ProgressMatrix {
  const classes = [...planner.classes].sort((a, b) => a.position - b.position || a.id - b.id);
  const thisMonday = mondayOf(today);
  const rows: ProgressRow[] = [];

  for (let i = 0; i < count; i += 1) {
    const week = fromWeek + i;
    const monday = weekStart(planner.school_year.start_date, week);
    if (monday === null) break;
    rows.push({
      week,
      monday,
      sunday: addDays(monday, 6),
      isCurrent: monday === thisMonday,
      cells: classes.map((c) => {
        const plan = planFor(planner, c.id, monday);
        return {
          classId: c.id,
          weekMonday: monday,
          plan,
          written: hasPlan(plan),
          summary: planSummary(plan),
          hasAssessment: plan.assessment.trim() !== "",
        };
      }),
    });
  }

  return { classes, rows };
}

/**
 * The week number `today` falls in, clamped into the year, so the grid opens
 * where the teacher is rather than at week 1 in May.
 *
 * Returns 1 while no start date has been set, which is what the year screen
 * asks her to fix first anyway.
 */
export function weekWindowFor(planner: Planner, today: string, size = PROGRESS_PAGE_WEEKS): number {
  const first = weekStart(planner.school_year.start_date, 1);
  if (first === null) return 1;
  const monday = mondayOf(today);
  // Which week `today` is in, by counting whole weeks from week 1's Monday.
  let week = 1;
  while (week < WEEKS_IN_YEAR && weekStart(planner.school_year.start_date, week + 1)! <= monday) {
    week += 1;
  }
  // Land on the start of the page that contains it.
  const page = Math.floor((week - 1) / size);
  const last = Math.floor((WEEKS_IN_YEAR - 1) / size);
  return Math.min(page, last) * size + 1;
}

/** How many entries the matrix is showing — what the screen reports under it. */
export function writtenCount(matrix: ProgressMatrix): number {
  return matrix.rows.reduce((n, row) => n + row.cells.filter((c) => c.written).length, 0);
}

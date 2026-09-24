/**
 * Ευεξία εκπαιδευτικού — "Κάθε Παρασκευή κοιτάξτε πίσω · ένα λεπτό αρκεί".
 *
 * **Free text only, and that is a departure from the source page on
 * purpose.** The page is a weekly check-in with five rating columns —
 * `Ενέργεια | Φόρτος | Διάθεση | Ύπνος | Ισορροπία` — beside one free column,
 * `Τι βοήθησε · τι να αλλάξω`. The spec's Resolved table rules the five out as
 * a product-owner decision: "Free text only; no structured mood/energy/workload
 * dropdowns". The later, specific decision wins, as it did for M5's "bilingual
 * content". So an entry is a date and the free column.
 *
 * The page's two standing boxes — `ΤΙ ΜΕ ΚΡΑΤΑΕΙ ΣΕ ΦΟΡΜΑ` and `ΟΡΙΑ ΠΟΥ ΘΕΛΩ
 * ΝΑ ΚΡΑΤΗΣΩ` — belong to the page, not to a week, so they are one stored
 * note rather than two more columns on every entry.
 *
 * **An entry is keyed by an actual date.** The source's axis is `Εβδομάδα`;
 * the week number here is derived at display time from the school year's start
 * date, as the progress matrix's is, so correcting the start date re-labels
 * the entries and moves none of them.
 */
import { weekOf } from "./schoolYear";
import type { Planner } from "./types";

export interface WellbeingEntry {
  id: number;
  date: string;
  /** `Τι βοήθησε · τι να αλλάξω`. */
  notes: string;
}

export interface WellbeingNote {
  /** `ΤΙ ΜΕ ΚΡΑΤΑΕΙ ΣΕ ΦΟΡΜΑ`. */
  sustains: string;
  /** `ΟΡΙΑ ΠΟΥ ΘΕΛΩ ΝΑ ΚΡΑΤΗΣΩ`. */
  boundaries: string;
}

/** A new reflection, dated the day the shell read — never the clock. */
export function emptyWellbeingEntry(today: string): WellbeingEntry {
  return { id: 0, date: today, notes: "" };
}

/**
 * The reflections, newest first — a journal is read from the latest week
 * back. An undated one goes to the top, where a line she has just cleared the
 * date of is easiest to find; ties go to the one written later.
 */
export function wellbeingJournal(planner: Planner): WellbeingEntry[] {
  return [...planner.wellbeing_entries].sort((a, b) => {
    if (!a.date && !b.date) return b.id - a.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return b.date.localeCompare(a.date) || b.id - a.id;
  });
}

/**
 * The school-year week an entry falls in, derived now from the start date, or
 * `null` when there is no start date or the entry is outside the year.
 */
export function wellbeingWeek(planner: Planner, entry: WellbeingEntry): number | null {
  const week = weekOf(planner.school_year.start_date, entry.date);
  return week && week.withinYear ? week.week : null;
}

/**
 * Ανάπτυξη και καριέρα — "Μητρώο επιμορφώσεων, εξόδων και επαγγελματικών
 * στόχων". One source page, three things on it, and one piece of arithmetic.
 *
 * * **The training log** — `Ημερομηνία | Επιμόρφωση / Δραστηριότητα |
 *   Διοργανωτής | Ώρες | Μορφή | Έξοδο | Βεβαίωση`.
 * * **`ΣΤΟΧΟΙ ΑΝΑΠΤΥΞΗΣ`** — open-ended development goals.
 * * **`ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΚΑΙ ΣΥΝΟΨΗ`** — the year's budget, and the roll-up the
 *   spec asks for: "a simple budget summary".
 *
 * **Development goals are not M1's annual goals.** M1 has six fixed areas, one
 * of them called `development` ("Επαγγελματική ανάπτυξη"); these are an open
 * list. The spec says neither is generated from the other, and the source keeps
 * them on different pages in different sections — the six on *Στόχοι για τη
 * χρονιά* under ΕΤΟΣ, these in a box on this page under ΑΝΑΠΤΥΞΗ. Nothing here
 * reads `annual_goals`, and nothing seeds from, prefills or copies to either
 * of them or to M7's standalone *Στόχοι και επαγγελματική ανάπτυξη* form.
 *
 * **The roll-up never invents a number the teacher did not type** — M2's rule,
 * applied to money. A blank cost is "not entered": it is left out of the sum
 * and counted, so the summary says how many lines it could not add up rather
 * than treating them as free. A cost of 0 is a free course, and counts.
 */
import { addDays, isIsoDate } from "./dates";
import { sumHundredths } from "./numbers";
import { firstMonday, WEEKS_IN_YEAR } from "./schoolYear";
import type { Planner } from "./types";

export interface DevelopmentGoal {
  id: number;
  position: number;
  goal: string;
  /** Free text, like an annual goal's: the source's box enumerates nothing. */
  status: string;
  progress: string;
  notes: string;
}

export interface TrainingEntry {
  id: number;
  date: string;
  /** `Επιμόρφωση / Δραστηριότητα`. */
  activity: string;
  /** `Διοργανωτής`. */
  organiser: string;
  /** `null` is "not entered", never zero. */
  hours: number | null;
  /** `Μορφή` — free text; the source enumerates nothing. */
  format: string;
  /** `Έξοδο`, in euro. `null` is "not entered", never zero. */
  cost: number | null;
  /** `Βεβαίωση` — free text: "ναι", "αναμένεται", a number. */
  certificate: string;
}

export interface DevelopmentBudget {
  /** The year's budget, or `null` until she enters one. */
  amount: number | null;
  /** Whatever else she writes in the page's box. */
  notes: string;
}

export function emptyDevelopmentGoal(): DevelopmentGoal {
  return { id: 0, position: 0, goal: "", status: "", progress: "", notes: "" };
}

export function emptyTrainingEntry(): TrainingEntry {
  return {
    id: 0,
    date: "",
    activity: "",
    organiser: "",
    hours: null,
    format: "",
    cost: null,
    certificate: "",
  };
}

/** Every development goal, in the order the teacher added them. */
export function allDevelopmentGoals(planner: Planner): DevelopmentGoal[] {
  return [...planner.development_goals].sort((a, b) => a.position - b.position || a.id - b.id);
}

/** The log read forwards, an undated line first — where a new one belongs. */
export function trainingLog(planner: Planner): TrainingEntry[] {
  return [...planner.training_entries].sort((a, b) => {
    if (!a.date && !b.date) return a.id - b.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.localeCompare(b.date) || a.id - b.id;
  });
}

/** The school year's own span: week 1's Monday to week 53's Sunday. */
export interface YearWindow {
  from: string;
  to: string;
}

/**
 * The window the roll-up sums over — **the school year's own dates**, from its
 * start date, never from the clock. `null` while no start date is set.
 */
export function schoolYearWindow(startDate: string): YearWindow | null {
  const from = firstMonday(startDate);
  if (from === null) return null;
  return { from, to: addDays(from, WEEKS_IN_YEAR * 7 - 1) };
}

export interface TrainingSummary {
  /** The span summed over, or `null` when there is no school year to bound it. */
  window: YearWindow | null;
  /** Lines inside the window (every line, when there is no window). */
  counted: number;
  /** The sum of the costs she entered, over the counted lines. */
  spent: number;
  /** Counted lines with a cost — including a cost of 0. */
  costed: number;
  /** Counted lines with **no** cost entered: left out of `spent`, and said so. */
  uncosted: number;
  hours: number;
  /** Counted lines with no hours entered. */
  unhoured: number;
  /** Dated lines outside the school year: not summed. */
  outside: number;
  /** Undated lines, which a window cannot place: not summed. */
  undated: number;
  /** The budget she entered, or `null`. */
  budget: number | null;
  /**
   * `budget − spent`, only when she has entered a budget. Negative when she
   * has spent more. It is exactly as complete as the costs she entered, which
   * is why `uncosted` is shown beside it.
   */
  remaining: number | null;
}

/**
 * The budget summary roll-up. **A pure function of the planner's school year,
 * log and budget** — the day on the calendar does not enter into it.
 */
export function trainingSummary(planner: Planner): TrainingSummary {
  const window = schoolYearWindow(planner.school_year.start_date);
  let outside = 0;
  let undated = 0;
  const counted: TrainingEntry[] = [];
  for (const entry of planner.training_entries) {
    if (window === null) {
      counted.push(entry);
    } else if (!isIsoDate(entry.date)) {
      undated += 1;
    } else if (entry.date < window.from || entry.date > window.to) {
      outside += 1;
    } else {
      counted.push(entry);
    }
  }
  const costs = counted.flatMap((e) => (e.cost === null ? [] : [e.cost]));
  const hours = counted.flatMap((e) => (e.hours === null ? [] : [e.hours]));
  const spent = sumHundredths(costs);
  const budget = planner.development_budget.amount;
  return {
    window,
    counted: counted.length,
    spent,
    costed: costs.length,
    uncosted: counted.length - costs.length,
    hours: sumHundredths(hours),
    unhoured: counted.length - hours.length,
    outside,
    undated,
    budget,
    remaining: budget === null ? null : sumHundredths([budget, -spent]),
  };
}

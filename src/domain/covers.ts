/**
 * Αναπλήρωση και άδειες — two registers on one source page, kept apart.
 *
 * The page's subtitle is "Αναπληρώσεις που καλύψατε και δικές σας άδειες": a
 * register of lessons she covered for colleagues (`Ημερομηνία | Τάξη | Μάθημα /
 * Ύλη που καλύφθηκε | Εκπαιδευτικός που αναπληρώθηκε | Υπογραφή /
 * Παρατηρήσεις`) and, beneath it, two boxes for her own leave — `ΟΙ ΑΔΕΙΕΣ
 * ΜΟΥ` and `ΕΓΓΡΑΦΑ ΠΟΥ ΚΑΤΑΤΕΘΗΚΑΝ`. The spec calls them "two related but
 * separate registers".
 *
 * **Separate means separate at every layer.** Two tables with no key between
 * them, two commands, and here two selectors that each read exactly one array.
 * A cover she taught and a leave she took on the same day are two unrelated
 * facts; neither register may change because the other did.
 *
 * "Αναπλήρωση" means three other things in this app already, and none of them
 * is this:
 *
 * * the master timetable's duty cell (M3) is a *planned* weekly slot;
 * * the substitute folder (M7) is what someone covering *her* needs;
 * * this register is a *dated record* of a cover she taught — what happened.
 *
 * Nothing here reads the timetable, and nothing here opens the folder.
 */
import type { Planner } from "./types";

export interface CoverRecord {
  id: number;
  date: string;
  /**
   * `Τάξη`, as she writes it — **text, not a link to one of her classes**. The
   * class she covered is usually a colleague's, and a link would make her
   * create a class she does not teach.
   */
  class_name: string;
  /** `Μάθημα / Ύλη που καλύφθηκε` — one column on the source. */
  covered: string;
  /** `Εκπαιδευτικός που αναπληρώθηκε`. */
  teacher: string;
  /** `Υπογραφή / Παρατηρήσεις`. */
  notes: string;
}

export interface LeaveRecord {
  id: number;
  date: string;
  reason: string;
  /** `ΕΓΓΡΑΦΑ ΠΟΥ ΚΑΤΑΤΕΘΗΚΑΝ`, for this leave. */
  documents: string;
}

export function emptyCoverRecord(): CoverRecord {
  return { id: 0, date: "", class_name: "", covered: "", teacher: "", notes: "" };
}

export function emptyLeaveRecord(): LeaveRecord {
  return { id: 0, date: "", reason: "", documents: "" };
}

/**
 * A register read forwards, with an undated line first — where a line she has
 * just created belongs, as M6's exam tracker does.
 */
function byDate<T extends { id: number; date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (!a.date && !b.date) return a.id - b.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.localeCompare(b.date) || a.id - b.id;
  });
}

/** The covers she taught. **Reads `cover_records` and nothing else.** */
export function coverRegister(planner: Planner): CoverRecord[] {
  return byDate(planner.cover_records);
}

/** Her own leave. **Reads `leave_records` and nothing else.** */
export function leaveRegister(planner: Planner): LeaveRecord[] {
  return byDate(planner.leave_records);
}

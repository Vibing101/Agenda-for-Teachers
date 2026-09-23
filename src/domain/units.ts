/**
 * Units, and the annual plan that is a view of them.
 *
 * **One register, two surfaces.** The source product keeps two pages — *Ετήσιο
 * πλάνο · Ετήσια επισκόπηση ανά μάθημα και τμήμα*, a table whose columns are
 * `Περίοδος | Θεματική ενότητα | Δεξιότητες / Κριτήρια | Ώρες | Αξιολόγηση`,
 * and *Ενότητες · Αναλυτικά για κάθε ενότητα*, a card per unit — and every
 * column of the first is a field of the second. Storing them apart would make
 * the teacher type a unit's title and its hours twice, which is the same defect
 * M6's first acceptance criterion forbids for the progress matrix. So the
 * annual plan is [`annualPlan`], a view over a class's units.
 *
 * It is the same call M3 took for the master timetable: where two surfaces
 * cover one thing, one of them is derived.
 *
 * **A unit carries no date and no week.** Its `period` and `deadlines` are the
 * teacher's own words, so nothing here has to move when the school year's start
 * date is corrected.
 */
import type { Planner, SchoolClass } from "./types";

export interface Unit {
  id: number;
  class_id: number;
  position: number;
  /** `ΤΙΤΛΟΣ ΕΝΟΤΗΤΑΣ`, and the annual plan's `Θεματική ενότητα`. */
  title: string;
  /** The annual plan's `Περίοδος`. Free text — a unit may straddle two. */
  period: string;
  /** `ΑΡΙΘΜΟΣ ΩΡΩΝ`, and the annual plan's `Ώρες`. */
  hours: string;
  /** `ΠΡΟΘΕΣΜΙΕΣ`. */
  deadlines: string;
  /** `ΔΙΔΑΚΤΙΚΟΙ ΣΤΟΧΟΙ`. */
  objectives: string;
  /** The annual plan's `Δεξιότητες / Κριτήρια`, kept apart from the goals. */
  skills: string;
  /** `ΜΕΘΟΔΟΙ ΚΑΙ ΜΟΡΦΕΣ ΕΡΓΑΣΙΑΣ`. */
  methods: string;
  /** `ΒΑΘΜΟΙ` on the card, `Αξιολόγηση` on the annual plan — one field. */
  assessment: string;
  /** `ΠΕΡΙΕΧΟΜΕΝΟ`. */
  content: string;
  /** `ΥΛΙΚΑ` — this unit's own, not the standing library in `resources.ts`. */
  materials: string;
  /** `ΕΞΑΤΟΜΙΚΕΥΣΗ`. */
  differentiation: string;
  /** `ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΕΝΟΤΗΤΑΣ` — the spec's "review". */
  review: string;
}

/** A blank unit, so a new one and a stored one are the same shape to edit. */
export function emptyUnit(classId: number): Unit {
  return {
    id: 0,
    class_id: classId,
    position: 0,
    title: "",
    period: "",
    hours: "",
    deadlines: "",
    objectives: "",
    skills: "",
    methods: "",
    assessment: "",
    content: "",
    materials: "",
    differentiation: "",
    review: "",
  };
}

/** One class's units, in the order the teacher put them in. */
export function unitsOfClass(planner: Planner, classId: number): Unit[] {
  return planner.units
    .filter((u) => u.class_id === classId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/** Whether the teacher has written anything into a unit at all. */
export function hasUnitContent(unit: Unit): boolean {
  return [
    unit.title,
    unit.period,
    unit.hours,
    unit.deadlines,
    unit.objectives,
    unit.skills,
    unit.methods,
    unit.assessment,
    unit.content,
    unit.materials,
    unit.differentiation,
    unit.review,
  ].some((field) => field.trim() !== "");
}

/**
 * The annual plan for one class — the source's *Ετήσιο πλάνο* table.
 *
 * **A view, not a record.** Every row is one of the class's units, and the five
 * columns are five of its fields. Nothing here is stored, so editing a unit
 * card changes the annual plan and the teacher never types a title twice.
 */
export interface AnnualPlanRow {
  unit: Unit;
  period: string;
  title: string;
  skills: string;
  hours: string;
  assessment: string;
}

export function annualPlan(planner: Planner, classId: number): AnnualPlanRow[] {
  return unitsOfClass(planner, classId).map((unit) => ({
    unit,
    period: unit.period,
    title: unit.title,
    skills: unit.skills,
    hours: unit.hours,
    assessment: unit.assessment,
  }));
}

/**
 * The class a unit belongs to, or `null` — which cannot happen through the app,
 * since a unit cascades with its class, but a selector that assumes it never
 * happens is a selector that throws on a file someone edited by hand.
 */
export function unitClass(planner: Planner, unit: Unit): SchoolClass | null {
  return planner.classes.find((c) => c.id === unit.class_id) ?? null;
}

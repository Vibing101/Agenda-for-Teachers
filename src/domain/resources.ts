/**
 * Σχολικά βιβλία και υλικά, and Υλικά και πηγές — the two reference lists.
 *
 * These are the two surfaces in this module that hang off no class and no week.
 * A textbook belongs to a *subject*, and the same book serves every class that
 * is taught it; a resource belongs to a category. Both are closer to M1's
 * holiday list than to a lesson plan — a flat list the teacher maintains — so
 * neither carries a date, and nothing here moves when the school year's start
 * date is corrected.
 *
 * **On the six resource categories.** They are the source page's own six
 * boxes — `ΙΣΤΟΤΟΠΟΙ ΚΑΙ ΠΛΑΤΦΟΡΜΕΣ`, `ΕΦΑΡΜΟΓΕΣ`, `ΒΙΒΛΙΑ ΚΑΙ ΚΕΙΜΕΝΑ`,
 * `ΒΙΝΤΕΟ ΚΑΙ ΗΧΟΣ`, `ΒΟΗΘΗΜΑΤΑ ΣΤΗΝ ΤΑΞΗ`, `ΑΛΛΕΣ ΠΗΓΕΣ` — which are about
 * what a resource *is*. The rebuild spec names a different six, own / school /
 * shared / borrowed / digital / other, which are about who it *belongs to*, and
 * calls them "the six source categories"; the source page contradicts that, and
 * its own index card reads "Ιστότοποι, εφαρμογές, βιβλία και ταινίες". The page
 * wins on a question of what is on the page. **Raised for the product owner
 * rather than settled quietly — see the release note.**
 *
 * **A textbook's `Κατάσταση` and `Τιμή` are free text**, for the same reason an
 * exam's kind is: the source page is a blank form that enumerates nothing, and
 * a teacher writes "δωρεάν" in a price box as readily as a number. This app
 * does not invent a vocabulary the source does not have — M4's rule on absence
 * kinds. The resource categories *are* a vocabulary because the source page
 * prints all six of them as captions.
 */
import type { ResourceCategory } from "../i18n/vocabularies";
import type { Planner } from "./types";

export interface Textbook {
  id: number;
  position: number;
  /** `Μάθημα` — free text, because a book belongs to a subject, not a class. */
  subject: string;
  title: string;
  /** `Εκδόσεις`. */
  publisher: string;
  isbn: string;
  /** `Επίπεδο`. */
  level: string;
  price: string;
  /** `Κατάσταση`. */
  status: string;
  /** The page's `ΠΑΡΑΤΗΡΗΣΕΙΣ` box, stored per line. */
  remarks: string;
}

export interface Resource {
  id: number;
  category: ResourceCategory;
  position: number;
  title: string;
  /** Where it is — a link, a shelf, a cupboard. */
  detail: string;
  notes: string;
}

export function emptyTextbook(): Textbook {
  return {
    id: 0,
    position: 0,
    subject: "",
    title: "",
    publisher: "",
    isbn: "",
    level: "",
    price: "",
    status: "",
    remarks: "",
  };
}

export function emptyResource(category: ResourceCategory): Resource {
  return { id: 0, category, position: 0, title: "", detail: "", notes: "" };
}

/** Every textbook, in the order the teacher put them in. */
export function allTextbooks(planner: Planner): Textbook[] {
  return [...planner.textbooks].sort((a, b) => a.position - b.position || a.id - b.id);
}

/** The distinct subjects the list mentions, for the screen's own filter. */
export function textbookSubjects(planner: Planner): string[] {
  const seen = new Set<string>();
  for (const book of allTextbooks(planner)) {
    const subject = book.subject.trim();
    if (subject) seen.add(subject);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "el"));
}

/** One category's entries, in the order the teacher put them in. */
export function resourcesIn(planner: Planner, category: ResourceCategory): Resource[] {
  return planner.resources
    .filter((r) => r.category === category)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

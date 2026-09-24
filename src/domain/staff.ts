/**
 * Επαφές στο σχολείο — the staff directory.
 *
 * The source page is `Ονοματεπώνυμο | Θέση / Τομέας | Τηλέφωνο | Email` under
 * the subtitle "Γρήγορη αναζήτηση: διεύθυνση, γραμματεία, συνάδελφοι", and the
 * spec asks for it to be searchable. So this module is a list and a search.
 *
 * **`role` is one field**, because the source heads `Θέση / Τομέας` as one
 * column and the spec's data model writes "role/area" as one phrase.
 *
 * **Nothing reads from this list yet, and nothing here reads anything else.**
 * A guardian with the same name as a colleague is a different person in a
 * different table; the search looks at staff contacts only. Whether the
 * substitute folder's contacts, a meeting's attendees or a cover's teacher
 * should point in here is the product owner's open question — M8 converts
 * no existing free-text field into a link.
 */
import { matchesSearch } from "./search";
import type { Planner } from "./types";

export interface StaffContact {
  id: number;
  position: number;
  full_name: string;
  /** `Θέση / Τομέας`. */
  role: string;
  phone: string;
  email: string;
}

export function emptyStaffContact(): StaffContact {
  return { id: 0, position: 0, full_name: "", role: "", phone: "", email: "" };
}

/** Every contact, in the order the teacher added them. */
export function allStaffContacts(planner: Planner): StaffContact[] {
  return [...planner.staff_contacts].sort((a, b) => a.position - b.position || a.id - b.id);
}

/**
 * The contacts a search shows — **the one definition of "what is on screen"**.
 *
 * Accent- and case-folded by the same rule as the message bank, over all four
 * columns: a teacher looks up "γραμματεία" by role as often as a colleague by
 * name, and a number by its last digits.
 */
export function searchStaff(planner: Planner, query: string): StaffContact[] {
  return allStaffContacts(planner).filter((c) =>
    matchesSearch(query, c.full_name, c.role, c.phone, c.email),
  );
}

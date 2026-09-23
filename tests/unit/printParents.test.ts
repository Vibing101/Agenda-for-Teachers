/**
 * The two printed M5 registers: the communication log and the appointment week.
 *
 * This is `printRegisters.test.ts`'s sibling, and it holds the same rule for
 * M5's pair that M4.5 held for M4's: **the two printed documents are
 * insensitive to each other's rows.** Checked by building one document, filling
 * the *other* register up, and asserting the document compares equal — not by
 * counting anything, because a count would pass against code that recomputed
 * the same number from the wrong table.
 *
 * Every one of these was confirmed to fail against deliberately broken code
 * before it was trusted; the mutations are listed in the release note.
 */
import { describe, expect, it } from "vitest";
import { NO_CONTACT_FILTER } from "../../src/domain/parents";
import type { ParentAppointment, ParentContact } from "../../src/domain/types";
import {
  appointmentWeekDocument,
  appointmentWeekHtml,
  contactLogDocument,
  contactLogHtml,
} from "../../src/print/parentSheets";
import { translatorFor } from "../../src/i18n";
import {
  A1,
  ANNA,
  CONTESTED_DAY,
  ELENI,
  parentsFixture,
  TODAY,
  WEEK_MONDAY,
} from "../helpers/parentsFixture";

const t = translatorFor("el");

/** Thirty more bookings, for guardians both known and unknown to the log. */
function pileOfAppointments(): ParentAppointment[] {
  return Array.from({ length: 30 }, (_, i) => ({
    id: 900 + i,
    date: CONTESTED_DAY,
    clock_time: `${String(8 + (i % 10)).padStart(2, "0")}:0${i % 2}`,
    student_id: i % 3 === 0 ? ELENI : null,
    guardian: i % 2 === 0 ? ANNA : `Άγνωστος ${i}`,
    mode: "in_person" as const,
    place: "Αίθουσα 1",
    status: i % 2 === 0 ? ("cancelled" as const) : ("confirmed" as const),
    topic: `Θέμα ${i}`,
    outcome: `Έκβαση ${i}`,
  }));
}

function pileOfContacts(): ParentContact[] {
  return Array.from({ length: 30 }, (_, i) => ({
    id: 800 + i,
    student_id: ELENI,
    date: CONTESTED_DAY,
    guardian: i % 2 === 0 ? ANNA : `Άγνωστος ${i}`,
    format: "phone" as const,
    reason: `Λόγος ${i}`,
    agreements: `Συμφωνία ${i}`,
    outcome: `Έκβαση ${i}`,
    next_step: `Επόμενο ${i}`,
    remarks: `Σημείωση ${i}`,
  }));
}

describe("the printed communication log", () => {
  it("carries the source page's own columns", () => {
    const doc = contactLogDocument(t, parentsFixture(), NO_CONTACT_FILTER, TODAY);
    expect(doc.table.head.map((c) => c.text)).toEqual([
      "Ημερομηνία",
      "Μαθητής",
      "Ποιος",
      "Μορφή",
      "Αιτία",
      "Συμφωνίες",
      // The eighth is the spec's own "outcome", which the source page lacks —
      // a deliberate departure, recorded in the release note.
      "Έκβαση",
      "Επόμενα",
    ]);
  });

  it("prints a stored code as its label, never as the code", () => {
    const doc = contactLogDocument(t, parentsFixture(), NO_CONTACT_FILTER, TODAY);
    const formats = doc.table.rows.map((r) => r[3].text);
    expect(formats).toContain("Τηλέφωνο");
    expect(formats).not.toContain("phone");
  });

  it("formats its dates itself, independent of the OS locale", () => {
    const doc = contactLogDocument(t, parentsFixture(), NO_CONTACT_FILTER, TODAY);
    expect(doc.table.rows.map((r) => r[0].text)).toContain("05.11.2026");
    expect(doc.table.rows.map((r) => r[0].text)).not.toContain("2026-11-05");
  });

  it("lists each line's own remarks in the page's box, attributed and verbatim", () => {
    const doc = contactLogDocument(t, parentsFixture(), NO_CONTACT_FILTER, TODAY);
    const box = doc.boxes![0];
    expect(box.caption).toBe("ΠΑΡΑΤΗΡΗΣΕΙΣ");
    expect(box.lines).toHaveLength(1);
    expect(box.lines[0]).toContain("Η μητέρα δουλεύει βάρδιες");
    expect(box.lines[0]).toContain("Ελένη Παπαδοπούλου");
    // The line with no remark is skipped rather than listed blank.
    expect(box.lines.join(" ")).not.toContain("Γιώργος Γεωργίου");
  });

  it("prints what the filter shows, and names the filter on the paper", () => {
    const html = contactLogHtml(t, parentsFixture(), { studentId: ELENI, classId: A1 }, TODAY);
    expect(html).toContain("Συχνές καθυστερήσεις το πρωί");
    expect(html).not.toContain("Εργασία που δεν παραδόθηκε");
    expect(html).toContain("Ελένη Παπαδοπούλου");
    expect(html).toContain("Α1");
  });
});

describe("the printed appointment week", () => {
  it("is Monday to Friday, with a row per clock time the week uses", () => {
    const doc = appointmentWeekDocument(t, parentsFixture(), WEEK_MONDAY, TODAY);
    expect(doc.table.head.map((c) => c.text)).toEqual([
      "Ώρα",
      "Δευτέρα 02.11.2026",
      "Τρίτη 03.11.2026",
      "Τετάρτη 04.11.2026",
      "Πέμπτη 05.11.2026",
      "Παρασκευή 06.11.2026",
    ]);
    expect(doc.table.rows.map((r) => r[0].text)).toEqual(["09:15", "13:30"]);
  });

  it("stacks a cell's parts, and labels its coded ones", () => {
    const doc = appointmentWeekDocument(t, parentsFixture(), WEEK_MONDAY, TODAY);
    // 13:30 on Thursday 05.11 — the contested booking.
    const thursday = doc.table.rows[1][4].text;
    expect(thursday).toContain(ANNA);
    expect(thursday).toContain("Ελένη Παπαδοπούλου");
    expect(thursday).toContain("Πρόοδος στα Μαθηματικά");
    expect(thursday).toContain("Με φυσική παρουσία");
    expect(thursday).toContain("Επιβεβαιώθηκε");
    expect(thursday).not.toContain("in_person");
  });

  it("leaves a slot with no booking empty", () => {
    const doc = appointmentWeekDocument(t, parentsFixture(), WEEK_MONDAY, TODAY);
    // Monday has nothing at either time.
    expect(doc.table.rows[0][1].text).toBe("");
    expect(doc.table.rows[1][1].text).toBe("");
  });

  it("prints only the week it was asked for", () => {
    const html = appointmentWeekHtml(t, parentsFixture(), WEEK_MONDAY, TODAY);
    expect(html).toContain("Πρόοδος στα Μαθηματικά");
    // 12.11 and 17.11 are other weeks.
    expect(html).not.toContain("Συνέχεια");
    expect(html).not.toContain("Εκτός παραθύρου");
  });
});

/**
 * **M5's second acceptance criterion, on paper.**
 *
 * Neither sheet derives anything from the other's table. Checked as
 * insensitivity of the *whole document*, which is the strongest form available
 * and the one M4.5 established.
 */
describe("the two printed registers are independent of each other", () => {
  it("prints the same log whether the appointment table is empty or full", () => {
    const withNone = parentsFixture();
    withNone.parent_appointments = [];
    const expected = contactLogDocument(t, withNone, NO_CONTACT_FILTER, TODAY);

    const withMany = parentsFixture();
    withMany.parent_appointments = [...withMany.parent_appointments, ...pileOfAppointments()];
    expect(contactLogDocument(t, withMany, NO_CONTACT_FILTER, TODAY)).toEqual(expected);

    // And the rendered HTML, not only the document it was built from.
    expect(contactLogHtml(t, withMany, NO_CONTACT_FILTER, TODAY)).toEqual(
      contactLogHtml(t, withNone, NO_CONTACT_FILTER, TODAY),
    );
  });

  it("prints the same week whether the log is empty or full", () => {
    const withNone = parentsFixture();
    withNone.parent_contacts = [];
    const expected = appointmentWeekDocument(t, withNone, WEEK_MONDAY, TODAY);

    const withMany = parentsFixture();
    withMany.parent_contacts = [...withMany.parent_contacts, ...pileOfContacts()];
    expect(appointmentWeekDocument(t, withMany, WEEK_MONDAY, TODAY)).toEqual(expected);

    expect(appointmentWeekHtml(t, withMany, WEEK_MONDAY, TODAY)).toEqual(
      appointmentWeekHtml(t, withNone, WEEK_MONDAY, TODAY),
    );
  });

  /**
   * The pair the fixture was built around, on paper, both ways at once: the
   * log records a phone call with Άννα on 05.11 and the week books her a
   * meeting at 13:30 on 05.11. Both print, neither mentions the other.
   */
  it("prints both halves of the contested pair, each on its own sheet", () => {
    const planner = parentsFixture();
    const log = contactLogHtml(t, planner, NO_CONTACT_FILTER, TODAY);
    const week = appointmentWeekHtml(t, planner, WEEK_MONDAY, TODAY);

    // The log has the call and its agreements.
    expect(log).toContain("Θα φεύγουν δέκα λεπτά νωρίτερα");
    expect(log).toContain("Τηλέφωνο");
    // The week has the booking and its place.
    expect(week).toContain("Αίθουσα 203");
    expect(week).toContain("Επιβεβαιώθηκε");

    // And neither sheet carries the other's text.
    expect(log).not.toContain("Αίθουσα 203");
    expect(week).not.toContain("Θα φεύγουν δέκα λεπτά νωρίτερα");
  });

  /** Neither builder imports the other's selector — held by construction. */
  it("says on the paper that the two are independent", () => {
    const planner = parentsFixture();
    for (const html of [
      contactLogHtml(t, planner, NO_CONTACT_FILTER, TODAY),
      appointmentWeekHtml(t, planner, WEEK_MONDAY, TODAY),
    ]) {
      expect(html).toContain("ανεξάρτητα μεταξύ τους");
    }
  });
});

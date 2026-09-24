/**
 * The substitute folder: what it reads live, what it stores, and the file it
 * prints.
 *
 * The fixture is `formsFixture.ts`, built with the awkward cases in on purpose
 * — a student seated in two classes at different desks, an empty class, plans
 * in adjacent weeks, and a folder text in each of its three states.
 */
import { describe, expect, it } from "vitest";
import {
  folderSeating,
  folderText,
  folderWeekMonday,
  substituteFolder,
  type SubstituteFolder,
} from "../../src/domain/substitute";
import { translatorFor } from "../../src/i18n";
import { folderDocuments, folderHtml } from "../../src/print/substituteSheets";
import {
  A1,
  A_SATURDAY,
  A_WEDNESDAY,
  B2,
  ELENI,
  G3,
  KOSTAS,
  MARIA,
  NEXT_MONDAY,
  NIKOS,
  THIS_MONDAY,
  formsPlanner,
} from "../helpers/formsFixture";

const t = translatorFor("el");

function folder(planner = formsPlanner(), classId = A1, today = A_WEDNESDAY): SubstituteFolder {
  return substituteFolder(planner, classId, today)!;
}

describe("the folder reads live data", () => {
  /**
   * M7's second acceptance criterion as a property of the selector: it is a
   * function of the planner it is handed, so the planner a seat change
   * produced is the folder that seat change produced. Nothing is regenerated
   * because nothing was stored.
   */
  it("shows a seat moved in the class's seating the next time it is asked, with nothing in between", () => {
    const planner = formsPlanner();
    expect(folder(planner).seating.names[0][0]).toBe("Ελένη Παπαδοπούλου");

    // The Τάξεις screen's edit, exactly as the seating command stores it.
    planner.seats = planner.seats.map((s) =>
      s.class_id === A1 && s.student_id === ELENI ? { ...s, student_id: NIKOS } : s,
    );
    expect(folder(planner).seating.names[0][0]).toBe("Νίκος Αντωνίου");
  });

  it("reads the class's own seats and no other class's", () => {
    // Κώστας sits in the front row in Α1 and in the third row in Β2.
    expect(folder(formsPlanner(), A1).seating.names[0][1]).toBe("Κώστας Χατζηκωνσταντίνου");
    expect(folder(formsPlanner(), A1).seating.names[2][3]).toBe("");
    expect(folder(formsPlanner(), B2).seating.names[2][3]).toBe("Κώστας Χατζηκωνσταντίνου");
    expect(folder(formsPlanner(), B2).seating.names[0][1]).toBe("");
  });

  it("follows the class's own room size and notes, from the class card", () => {
    const planner = formsPlanner();
    planner.classes = planner.classes.map((c) =>
      c.id === A1 ? { ...c, seating_rows: 2, seating_cols: 3, seating_notes: "Νέα διάταξη" } : c,
    );
    const seating = folderSeating(planner, planner.classes.find((c) => c.id === A1)!);
    expect(seating.names).toHaveLength(2);
    expect(seating.names[0]).toHaveLength(3);
    expect(seating.notes).toBe("Νέα διάταξη");
  });

  it("counts the roster and names the class's person in charge, from the class", () => {
    const f = folder();
    expect(f.rosterSize).toBe(4);
    expect(f.schoolClass.responsible).toBe("Κ. Γεωργίου");
  });

  it("lists every student a substitute should know about, verbatim, and no one else", () => {
    const f = folder();
    expect(f.attention.map((a) => a.studentId)).toEqual([ELENI, MARIA]);
    expect(f.attention[0].notes).toEqual([
      { kind: "sen", code: "accommodations" },
      { kind: "support", text: "Κάθεται μπροστά" },
      { kind: "allergies", text: "Φιστίκια" },
    ]);
    expect(f.attention[1].notes).toEqual([
      { kind: "medication", text: "Εισπνοές πριν τη γυμναστική" },
    ]);
    // Κώστας and Νίκος have nothing on their cards — they are not listed.
    expect(f.attention.some((a) => a.studentId === KOSTAS || a.studentId === NIKOS)).toBe(false);
  });

  it("shows only this class's hours in its week, in the room the timetable says", () => {
    const week = folder().week;
    expect(week.weekdays).toEqual([1, 2, 3, 4, 5]);
    const filled = week.rows.flatMap((r, i) =>
      r.cells.flatMap((c, d) => (c ? [`${i}:${week.weekdays[d]}:${c.subject}:${c.room}`] : [])),
    );
    // Monday 1η in its own room; Wednesday 2η in the lab. Β2's Tuesday and
    // the Thursday duty are not this class's and are not shown.
    expect(filled).toEqual(["0:1:Μαθηματικά:Αίθουσα 12", "1:3:Μαθηματικά:Εργαστήριο Η/Υ"]);
  });

  it("shows this week's plan — not last week's, not the first one it finds", () => {
    const week = folder().week;
    expect(week.monday).toBe(THIS_MONDAY);
    expect(week.plan.notes).toBe("Κεφάλαιο 4 — εξισώσεις\nΑσκήσεις 1–6 σελ. 45");
    expect(week.plan.assessment).toBe("Ολιγόλεπτο την Τετάρτη");
  });

  it("an empty class still has a folder, of blanks", () => {
    const f = folder(formsPlanner(), G3);
    expect(f.rosterSize).toBe(0);
    expect(f.attention).toEqual([]);
    expect(f.week.rows.every((r) => r.cells.every((c) => c === null))).toBe(true);
    expect(f.week.plan.notes).toBe("");
    expect(f.seating.names.flat().every((n) => n === "")).toBe(true);
  });

  it("has no folder for a class that does not exist", () => {
    expect(substituteFolder(formsPlanner(), 999, A_WEDNESDAY)).toBeNull();
    expect(folderDocuments(t, formsPlanner(), 999, A_WEDNESDAY)).toEqual([]);
  });
});

describe("which week is the current one", () => {
  it("is this week on a school day", () => {
    expect(folderWeekMonday(A_WEDNESDAY)).toBe(THIS_MONDAY);
    expect(folderWeekMonday(THIS_MONDAY)).toBe(THIS_MONDAY);
    expect(folderWeekMonday("2026-11-06")).toBe(THIS_MONDAY);
  });

  /**
   * The folder is for the morning the teacher does not come in; on a weekend
   * the next morning anyone opens it is Monday's.
   */
  it("is the coming week on a Saturday or a Sunday", () => {
    expect(folderWeekMonday(A_SATURDAY)).toBe(NEXT_MONDAY);
    expect(folderWeekMonday("2026-11-08")).toBe(NEXT_MONDAY);
    // And the day is an argument: the same planner gives a different week.
    expect(folder(formsPlanner(), A1, A_SATURDAY).week.plan.notes).toBe("");
  });

  it("adds a Saturday column only for a class that meets on a Saturday", () => {
    const planner = formsPlanner();
    planner.timetable_cells.push({
      period_id: 11,
      weekday: 6,
      class_id: A1,
      subject: "",
      room: "",
      duty: "",
      notes: "",
    });
    expect(folder(planner, A1).week.weekdays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(folder(planner, B2).week.weekdays).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("the folder's own words", () => {
  it("shows the suggested text in a box she has not touched", () => {
    const text = folderText(formsPlanner(), A1, "problem", t);
    expect(text.state).toBe("default");
    expect(text.value).toBe(t("folder.default.problem"));
  });

  it("shows her text in a box she wrote in", () => {
    expect(folderText(formsPlanner(), A1, "rules", t)).toEqual({
      value: "Μπαίνουμε με τη σειρά του καταλόγου.",
      state: "edited",
    });
  });

  /**
   * The pair a naive store conflates. A cleared box is an *empty row*; an
   * untouched one is *no row*. If the two were the same, the suggestion would
   * come back into a box she deliberately emptied.
   */
  it("keeps a box she cleared empty, rather than putting the suggestion back", () => {
    expect(folderText(formsPlanner(), A1, "materials", t)).toEqual({ value: "", state: "cleared" });
    // …while the same box on a class she has not touched still suggests.
    expect(folderText(formsPlanner(), B2, "materials", t).state).toBe("default");
  });

  it("follows the same rule for the texts every class shares", () => {
    const planner = formsPlanner();
    expect(folderText(planner, null, "proc.toilet", t).value).toBe("Μόνο στο διάλειμμα.");
    expect(folderText(planner, null, "proc.devices", t)).toEqual({ value: "", state: "cleared" });
    expect(folderText(planner, null, "proc.end", t).state).toBe("default");
    // A contact has no suggestion: untouched is simply empty.
    expect(folderText(planner, null, "contact.office", t).value).toBe("");
  });

  it("a class's texts are its own and not another class's", () => {
    expect(folderText(formsPlanner(), B2, "rules", t).state).toBe("default");
  });
});

describe("the printed folder", () => {
  it("is a cover and five pages, in the source's order", () => {
    expect(folderDocuments(t, formsPlanner(), A1, A_WEDNESDAY).map((d) => d.title)).toEqual([
      "Φάκελος αναπλήρωσης",
      "Πληροφορίες τμήματος",
      "Πλάνο εβδομάδας",
      "Πλάνο αίθουσας",
      "Πλάνο μιας μέρας",
      "Επαφές και διαδικασίες",
    ]);
  });

  /**
   * M7's third acceptance criterion at the document level: **one** file
   * carrying all six sheets. The page count of a real rendered file is the
   * release note's evidence, on both operating systems.
   */
  it("is one document with six sheets in it, not six documents", () => {
    const html = folderHtml(t, formsPlanner(), A1, A_WEDNESDAY);
    expect(html.match(/data-sheet /g)).toHaveLength(6);
    expect(html.match(/<style>/g)).toHaveLength(1);
  });

  it("prints the live seating, the week and the texts as they are now", () => {
    const planner = formsPlanner();
    const html = () => folderHtml(t, planner, A1, A_WEDNESDAY);
    expect(html()).toContain("Κεφάλαιο 4 — εξισώσεις");
    expect(html()).not.toContain("Κεφάλαιο 3");
    expect(html()).toContain("Μπαίνουμε με τη σειρά του καταλόγου.");
    // The cleared box prints empty; the suggestion does not creep back.
    expect(html()).not.toContain(t("folder.default.materials").split("\n")[0]);
    // The untouched box prints its suggestion.
    expect(html()).toContain(t("folder.default.problem").split("\n")[0]);

    planner.seats = planner.seats.filter((s) => !(s.class_id === A1 && s.student_id === MARIA));
    expect(html()).not.toContain("Μαρία Ιωάννου</div>");
  });

  it("names the class's person in charge among the contacts, from the class card", () => {
    const [, , , , , contacts] = folderDocuments(t, formsPlanner(), A1, A_WEDNESDAY);
    const pairs = contacts.blocks!.find((b) => b.kind === "pairs")!;
    if (pairs.kind !== "pairs") throw new Error("unreachable");
    const people = Object.fromEntries(pairs.columns[0].rows.map((r) => [r.label, r.value]));
    expect(people["Υπεύθυνος τμήματος"]).toBe("Κ. Γεωργίου");
    expect(people["Διευθυντής"]).toBe("Α. Νικολάου · 22 123456");
  });

  it("prints an empty class's folder as six pages of blanks without falling over", () => {
    expect(folderDocuments(t, formsPlanner(), G3, A_WEDNESDAY)).toHaveLength(6);
  });
});

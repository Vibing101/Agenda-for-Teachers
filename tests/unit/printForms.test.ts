/**
 * The eleven print forms: their definitions, and the pages they print.
 *
 * **A form prints from its own values and nothing else.** `formDocument` is
 * never handed the planner, so there is no path by which a blank room plan
 * could pick up a real class's seats; `FormsScreen.test.tsx` checks the same
 * through the real screen, next to a planner full of them.
 */
import { describe, expect, it } from "vitest";
import {
  PRINT_FORMS,
  cardCountKey,
  cellKey,
  deskKey,
  emptyForm,
  formDefinition,
  formsOfKind,
  rowCountKey,
  tableRows,
  type FormPart,
} from "../../src/domain/printForms";
import { el, translatorFor, type StringId } from "../../src/i18n";
import { PRINT_FORM_KINDS } from "../../src/i18n/vocabularies";
import { formDocument, formHtml } from "../../src/print/formSheets";

const t = translatorFor("el");
const TODAY = "2026-11-04";

/** Every string id a form uses, so each can be checked against the bundle. */
function stringIds(parts: FormPart[]): string[] {
  const ids: string[] = [];
  for (const p of parts) {
    if (p.kind === "fields" || p.kind === "signatures")
      p.fields.forEach((f) => ids.push(f.captionId, ...(f.legendId ? [f.legendId] : [])));
    if (p.kind === "areas") p.areas.forEach((a) => ids.push(a.captionId));
    if (p.kind === "table") p.columns.forEach((c) => c.captionId && ids.push(c.captionId));
    if (p.kind === "checklist")
      p.columns.forEach((c) => {
        ids.push(c.captionId);
        c.items.forEach((i) => ids.push(`form.periodChecklist.item.${c.code}.${i}`));
      });
    if (p.kind === "cards") {
      ids.push(p.labelId, ...(p.titleId ? [p.titleId] : []));
      ids.push(...stringIds(p.parts));
    }
  }
  return ids;
}

/** Every key a form can store a value under, for its default size. */
function keys(parts: FormPart[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (p.kind === "fields" || p.kind === "signatures")
      p.fields.forEach((f) => !f.legendId && out.push(f.key));
    if (p.kind === "areas") p.areas.forEach((a) => out.push(a.key));
    if (p.kind === "table")
      for (let r = 1; r <= p.rows; r++) p.columns.forEach((c) => out.push(cellKey(p.key, r, c.key)));
    if (p.kind === "desks")
      for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) out.push(deskKey(r, c));
    if (p.kind === "checklist") p.columns.forEach((c) => c.items.forEach((i) => out.push(`${c.code}.${i}`)));
    if (p.kind === "cards")
      for (let n = 1; n <= p.count; n++) keys(p.parts).forEach((k) => out.push(`${p.key}.${n}.${k}`));
  }
  return out;
}

describe("the eleven forms", () => {
  it("are the source's eleven, in its page order", () => {
    expect(PRINT_FORMS.map((f) => f.kind)).toEqual([...PRINT_FORM_KINDS]);
    expect(PRINT_FORMS.map((f) => t(`vocab.printForm.${f.kind}` as StringId))).toEqual([
      "Απουσίες του μήνα",
      "Επικοινωνία με γονείς",
      "Πλάνο αναπλήρωσης",
      "Πρακτικό συνεδρίασης",
      "Προτεραιότητες της εβδομάδας",
      "Πλάνο αίθουσας",
      "Κωδικοί και πρόσβαση",
      "Λίστα ελέγχου της περιόδου",
      "Σημείωμα προς γονείς",
      "Δανεισμοί υλικού και βοηθημάτων",
      "Στόχοι και επαγγελματική ανάπτυξη",
    ]);
  });

  /**
   * The source prints a subtitle on **every** page, including the three the
   * M7 brief listed as having none — the parent log, the cover lesson plan and
   * the goals page. The source wins.
   */
  it("carry the subtitle every source page prints, including the three the brief missed", () => {
    expect(t(formDefinition("parentLog").subtitleId)).toBe(
      "Καταγραφή συζητήσεων και μηνυμάτων — ημερομηνία, αιτία, συμφωνίες",
    );
    expect(t(formDefinition("coverLesson").subtitleId)).toBe(
      "Ό,τι πρέπει να ξέρει ο αναπληρωτής για αυτή την ώρα",
    );
    expect(t(formDefinition("goals").subtitleId)).toBe(
      "Εξέλιξη, επιμορφώσεις, δικοί σας στόχοι για τη χρονιά — και τι βγήκε από αυτούς",
    );
    expect(t(formDefinition("parentNote").subtitleId)).toBe(
      "Δύο σημειώματα ανά σελίδα · κόψτε κατά μήκος της γραμμής",
    );
  });

  it("use only captions that are in the bundle", () => {
    for (const form of PRINT_FORMS) {
      for (const id of [form.subtitleId, ...stringIds(form.parts)]) {
        expect(el, `${form.kind}: ${id}`).toHaveProperty([id]);
      }
    }
  });

  it("never give two inputs of one form the same stored key", () => {
    for (const form of PRINT_FORMS) {
      const all = keys(form.parts);
      expect(new Set(all).size, form.kind).toBe(all.length);
    }
  });

  it("list a kind's saved copies most recently changed first", () => {
    const a = { ...emptyForm("goals", "2026-10-01"), id: 1, updated: "2026-10-01" };
    const b = { ...emptyForm("goals", "2026-10-01"), id: 2, updated: "2026-11-01" };
    const other = { ...emptyForm("loans", "2026-12-01"), id: 3, updated: "2026-12-01" };
    expect(formsOfKind([a, b, other], "goals").map((f) => f.id)).toEqual([2, 1]);
  });
});

describe("a printed form", () => {
  it("prints blank when nothing is filled in — the source's own use", () => {
    for (const form of PRINT_FORMS) {
      const doc = formDocument(t, form, {}, TODAY);
      expect(doc.title).toBe(t(`vocab.printForm.${form.kind}` as StringId));
      // A blank is the same function with no values, not a second template.
      expect(formHtml(t, form, {}, TODAY)).toContain(doc.title);
    }
  });

  it("prints what was typed exactly as typed, with dates in the app's own format", () => {
    const minutes = formDefinition("minutes");
    const html = formHtml(
      t,
      minutes,
      {
        kind: "Σύλλογος Διδασκόντων",
        date: "2026-11-09",
        time: "14:30",
        // `[` is a character she may type; it is not a placeholder here.
        agenda: "1. Πρόοδος [Α1]\n2. Εκδρομή",
      },
      TODAY,
    );
    expect(html).toContain("Σύλλογος Διδασκόντων");
    expect(html).toContain("09.11.2026");
    expect(html).not.toContain("2026-11-09");
    expect(html).toContain("14:30");
    expect(html).toContain("1. Πρόοδος [Α1]\n2. Εκδρομή");
  });

  it("carries a ruled register's rows, and more when the teacher added some", () => {
    const loans = formDefinition("loans");
    const part = loans.parts.find((p) => p.kind === "table")!;
    if (part.kind !== "table") throw new Error("unreachable");

    expect(formDocument(t, loans, {}, TODAY).table!.rows).toHaveLength(part.rows);
    const longer = { [rowCountKey("reg")]: String(part.rows + 5), [cellKey("reg", part.rows + 5, "to")]: "Νίκος" };
    const doc = formDocument(t, loans, longer, TODAY);
    expect(tableRows(part, longer)).toBe(part.rows + 5);
    expect(doc.table!.rows).toHaveLength(part.rows + 5);
    expect(doc.table!.rows.at(-1)!.map((c) => c.text)).toContain("Νίκος");
  });

  it("numbers the attendance card's rows and carries its key of symbols, which are part of the form", () => {
    const doc = formDocument(t, formDefinition("attendance"), {}, TODAY);
    expect(doc.table!.head.map((c) => c.text).slice(0, 3)).toEqual(["Αρ.", "Ονοματεπώνυμο", "1"]);
    expect(doc.table!.head.at(-1)!.text).toBe("31");
    expect(doc.table!.rows[0][0].text).toBe("01");
    expect(doc.table!.rows.at(-1)![0].text).toBe("30");
    // The ΤΜΗΜΑ · ΜΗΝΑΣ · ΣΥΜΒΟΛΑ row sits in the header, above the table, as
    // on the source page — and so repeats if the card runs to a second sheet.
    const head = doc.head!.find((b) => b.kind === "fields")!;
    if (head.kind !== "fields") throw new Error("unreachable");
    expect(head.fields.map((f) => f.label)).toEqual(["ΤΜΗΜΑ", "ΜΗΝΑΣ", "ΣΥΜΒΟΛΑ"]);
    expect(head.fields[2].value).toContain("δικαιολογημένη");
  });

  /**
   * The parent note is the genuine 2-up page: the source says so itself. Two
   * framed notes, each cut out along a dashed line.
   */
  it("prints the parent note two to a page, each framed to be cut out", () => {
    const doc = formDocument(
      t,
      formDefinition("parentNote"),
      { "note.1.student": "Ελένη", "note.2.student": "Νίκος" },
      TODAY,
    );
    const cards = doc.blocks!.filter((b) => b.kind === "card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      if (card.kind !== "card") throw new Error("unreachable");
      expect(card.cut).toBe(true);
      expect(card.title).toBe("Σημείωμα προς γονείς");
    }
    const html = formHtml(t, formDefinition("parentNote"), {}, TODAY);
    expect(html.match(/class="block card cut"/g)).toHaveLength(2);
  });

  it("prints four goals, and a fifth once the teacher has added one", () => {
    const goals = formDefinition("goals");
    expect(formDocument(t, goals, {}, TODAY).blocks!.filter((b) => b.kind === "card")).toHaveLength(4);
    const five = formDocument(t, goals, { [cardCountKey("goal")]: "5" }, TODAY);
    expect(five.blocks!.filter((b) => b.kind === "card")).toHaveLength(5);
  });

  it("draws a tick for exactly the checklist items that are ticked", () => {
    const doc = formDocument(
      t,
      formDefinition("periodChecklist"),
      { "start.rosters": "1", "end.backup": "1" },
      TODAY,
    );
    const list = doc.blocks!.find((b) => b.kind === "checklist")!;
    if (list.kind !== "checklist") throw new Error("unreachable");
    const ticked = list.columns.flatMap((c) => c.items.filter((i) => i.checked).map((i) => i.text));
    expect(ticked).toEqual([
      "Οι λίστες μαθητών ενημερώθηκαν",
      "Το αντίγραφο ασφαλείας των αρχείων έγινε",
    ]);
    expect(list.columns.map((c) => c.items.length)).toEqual([8, 8]);
    // A drawn circle, never a glyph that a Greek face might not carry.
    expect(formHtml(t, formDefinition("periodChecklist"), {}, TODAY)).not.toMatch(/[✓✔☑]/);
  });

  it("prints a room plan's desks from its own values, at the size she chose", () => {
    const plan = formDefinition("roomPlan");
    const doc = formDocument(
      t,
      plan,
      { "desks.rows": "2", "desks.cols": "3", [deskKey(2, 3)]: "Μαρία" },
      TODAY,
    );
    const desks = doc.blocks!.find((b) => b.kind === "desks")!;
    if (desks.kind !== "desks") throw new Error("unreachable");
    expect(desks.names).toEqual([
      ["", "", ""],
      ["", "", "Μαρία"],
    ]);
    expect(desks.board).toBe("ΠΙΝΑΚΑΣ");
  });
});

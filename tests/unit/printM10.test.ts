/**
 * M10's three printed sheets: a meeting's minutes, the six annual goals, and
 * the grade sheet bundled with the conduct sheet.
 *
 * Each is held the way M4.5 held its registers: **the paper carries what the
 * screen's own selector gives, verbatim** — nothing counted, summarised or
 * inferred — and a record that is not on the screen is not on the paper. Each
 * is built in both languages, and no `[BRACKETS]` survive into any of them.
 */
import { describe, expect, it } from "vitest";
import { agreementsOfMeeting, allMeetings } from "../../src/domain/meetings";
import { annualGoalsInOrder } from "../../src/domain/schoolYear";
import type { AnnualGoal, Planner } from "../../src/domain/types";
import { translatorFor } from "../../src/i18n";
import { GOAL_AREAS } from "../../src/i18n/vocabularies";
import { pageGeometry } from "../../src/print/document";
import {
  conductSheetDocument,
  gradeAndConductHtml,
  gradeSheetDocument,
} from "../../src/print/gradeSheets";
import { goalsSheetDocument, goalsSheetHtml } from "../../src/print/goalsSheet";
import { minutesDocument, minutesHtml } from "../../src/print/meetingSheet";
import { CLASS_ID, gradedPlanner } from "../helpers/gradebookFixture";
import { emptyPlanner } from "../helpers/fakeBackend";
import { htmlText } from "../helpers/languageChecks";
import {
  A1,
  MEETING_FAR,
  MEETING_RECENT,
  MEETING_SOON,
  parentsFixture,
  TODAY,
} from "../helpers/parentsFixture";

const el = translatorFor("el");
const en = translatorFor("en");
const BRACKETS = /\[[^\]]+\]/;

function meetingOf(planner: Planner, id: number) {
  return allMeetings(planner).find((m) => m.id === id)!;
}

describe("a meeting's minutes", () => {
  it("carries the meeting's own fields, verbatim, and its agreements in the card's order", () => {
    const planner = parentsFixture();
    const doc = minutesDocument(el, planner, meetingOf(planner, MEETING_SOON), TODAY);
    const text = htmlText(minutesHtml(el, planner, meetingOf(planner, MEETING_SOON), TODAY));

    expect(doc.title).toBe("Πρακτικό συνεδρίασης");
    for (const value of [
      "Συμβούλιο τμήματος", // the kind code `council`, as its label
      "15.11.2026",
      "13:00",
      "90 λεπτά",
      "Όλοι οι διδάσκοντες του τμήματος",
      "Πρόοδος τμήματος · δύο περιστατικά",
    ]) {
      expect(text).toContain(value);
    }
    expect(text).toContain(planner.classes.find((c) => c.id === A1)!.name);
    // The table is the agreements, in the order the card lists them.
    expect(doc.table.rows.map((r) => r.map((c) => c.text))).toEqual(
      agreementsOfMeeting(planner, MEETING_SOON).map((a) => [
        a.who,
        a.what,
        a.deadline.split("-").reverse().join("."),
      ]),
    );
    expect(doc.table.rows).toHaveLength(2);
    expect(text).not.toMatch(BRACKETS);
  });

  it("carries no other meeting's words and no other meeting's agreements", () => {
    const planner = parentsFixture();
    const text = htmlText(minutesHtml(el, planner, meetingOf(planner, MEETING_RECENT), TODAY));
    expect(text).toContain("Προηγούμενος σύλλογος");
    for (const other of ["Πολύ μακριά", "Πρόοδος τμήματος", "Μ. Νικολάου", "Ετοιμασία υλικού στήριξης"]) {
      expect(text).not.toContain(other);
    }
  });

  it("says in words that no agreements were recorded, rather than printing a bare header", () => {
    const planner = parentsFixture();
    const doc = minutesDocument(el, planner, meetingOf(planner, MEETING_FAR), TODAY);
    expect(doc.table.rows).toEqual([]);
    expect(doc.note).toBe("Δεν καταγράφηκαν συμφωνίες σε αυτή τη συνεδρίαση.");
    const withAgreements = minutesDocument(el, planner, meetingOf(planner, MEETING_SOON), TODAY);
    expect(withAgreements.note).toBeUndefined();
  });

  it("is insensitive to every other meeting's agreements", () => {
    const planner = parentsFixture();
    const before = minutesDocument(el, planner, meetingOf(planner, MEETING_RECENT), TODAY);
    // Crowd the other meetings with agreements: this meeting's sheet must not move.
    planner.meeting_agreements.push(
      ...[MEETING_SOON, MEETING_FAR].flatMap((meeting_id, i) =>
        Array.from({ length: 5 }, (_, j) => ({
          id: 900 + i * 10 + j,
          meeting_id,
          position: j,
          who: `Άλλος ${j}`,
          what: `Άλλο ${j}`,
          deadline: "2026-12-01",
        })),
      ),
    );
    expect(minutesDocument(el, planner, meetingOf(planner, MEETING_RECENT), TODAY)).toEqual(before);
  });

  it("prints a class that was deleted as blank, and keeps the minutes", () => {
    const planner = parentsFixture();
    planner.classes = planner.classes.filter((c) => c.id !== A1);
    const doc = minutesDocument(el, planner, meetingOf(planner, MEETING_SOON), TODAY);
    const fields = doc.lead![0];
    expect(fields.kind).toBe("fields");
    if (fields.kind === "fields") expect(fields.fields[4].value).toBe("");
    expect(doc.table.rows).toHaveLength(2);
  });

  it("is portrait A4, like M7's blank minutes form", () => {
    const planner = parentsFixture();
    const html = minutesHtml(el, planner, meetingOf(planner, MEETING_SOON), TODAY);
    const { width, height } = pageGeometry(false);
    expect(html).toContain(`data-page-width="${width}" data-page-height="${height}"`);
  });

  it("prints English captions around the teacher's Greek, in English", () => {
    const planner = parentsFixture();
    const text = htmlText(minutesHtml(en, planner, meetingOf(planner, MEETING_SOON), TODAY));
    for (const caption of ["Meeting minutes", "KIND OF MEETING", "PRESENT", "AGENDA", "Who", "By when"]) {
      expect(text).toContain(caption);
    }
    expect(text).toContain("Class council");
    expect(text).toContain("Πρόοδος τμήματος · δύο περιστατικά");
    expect(text).toMatch(/Printed \d{2}\.\d{2}\.\d{4}/);
    expect(text).not.toMatch(BRACKETS);
  });
});

describe("the six annual goals, printed as one table", () => {
  function filledGoals(): AnnualGoal[] {
    // Deliberately stored out of order, as a file could hold them.
    return [...emptyPlanner().annual_goals].reverse().map((g, i) => ({
      ...g,
      goal: `Στόχος ${g.area}`,
      actions: `Ενέργειες ${i}`,
      success_indicators: `Δείκτες ${i}`,
      deadline: i === 0 ? "" : "2027-06-15",
      status: "Σε εξέλιξη — όπως το γράφω εγώ",
      review: `Ανασκόπηση ${i}`,
    }));
  }

  it("has one row per area, in the order the cards are shown", () => {
    const goals = filledGoals();
    const doc = goalsSheetDocument(el, goals, { year_model: "sep_aug", start_date: "2026-09-14" }, TODAY);
    expect(doc.table.rows).toHaveLength(6);
    expect(annualGoalsInOrder(goals).map((g) => g.area)).toEqual([...GOAL_AREAS]);
    expect(doc.table.rows.map((r) => r[1].text)).toEqual(GOAL_AREAS.map((a) => `Στόχος ${a}`));
    expect(doc.table.rows[0][0].text).toBe("Διδασκαλία και περιεχόμενο");
  });

  it("prints every field exactly as written — the status is her sentence, nothing computed", () => {
    const goals = filledGoals();
    const text = htmlText(
      goalsSheetHtml(el, goals, { year_model: "sep_aug", start_date: "2026-09-14" }, TODAY),
    );
    for (const g of goals) {
      for (const value of [g.goal, g.actions, g.success_indicators, g.status, g.review]) {
        expect(text).toContain(value);
      }
    }
    expect(text).toContain("15.06.2027");
    expect(text).toContain("14.09.2026");
    expect(text).not.toMatch(BRACKETS);
  });

  it("prints blank goals as a blank table, and a missing start date as a dash", () => {
    const doc = goalsSheetDocument(el, emptyPlanner().annual_goals, { year_model: "sep_aug", start_date: "" }, TODAY);
    expect(doc.table.rows).toHaveLength(6);
    for (const row of doc.table.rows) expect(row.slice(1).every((c) => c.text === "")).toBe(true);
    expect(doc.meta[0].value).toBe("—");
  });

  it("prints its captions in English, and the area labels too", () => {
    const text = htmlText(
      goalsSheetHtml(en, filledGoals(), { year_model: "sep_aug", start_date: "2026-09-14" }, TODAY),
    );
    for (const caption of ["Goals for the year", "Area", "Signs of success", "End-of-year review"]) {
      expect(text).toContain(caption);
    }
    expect(text).toContain("Personal wellbeing");
    expect(text).not.toContain("Προσωπική ευεξία");
  });
});

describe("the grade sheet with the conduct sheet, one file", () => {
  it("is the two sheets M2 prints, unchanged, one after the other in one file", () => {
    const planner = gradedPlanner();
    const html = gradeAndConductHtml(el, planner, CLASS_ID, TODAY);
    // Two documents, each starting its own page, landscape.
    expect(html.match(/data-sheet /g)).toHaveLength(2);
    const { width } = pageGeometry(true);
    expect(html).toContain(`data-page-width="${width}"`);
    const text = htmlText(html);
    const grade = gradeSheetDocument(el, planner, CLASS_ID, TODAY);
    const conduct = conductSheetDocument(el, planner, CLASS_ID, TODAY);
    expect(text.indexOf(grade.title)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(conduct.title)).toBeGreaterThan(text.indexOf(grade.title));
    // Every cell of both sheets reaches the file: the bundle adds and drops nothing.
    for (const doc of [grade, conduct]) {
      for (const row of doc.table.rows) {
        for (const cell of row) if (cell.text) expect(text).toContain(cell.text);
      }
    }
    expect(text).not.toMatch(BRACKETS);
  });

  it("follows the language, in both sheets", () => {
    const text = htmlText(gradeAndConductHtml(en, gradedPlanner(), CLASS_ID, TODAY));
    expect(text).toContain("Class grades");
    expect(text).toContain(conductSheetDocument(en, gradedPlanner(), CLASS_ID, TODAY).title);
    expect(text).not.toContain("Βαθμοί τάξης");
  });
});

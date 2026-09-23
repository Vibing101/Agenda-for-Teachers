/**
 * The guard rails around the single string lookup.
 *
 * These are the tests that have to keep passing for M9's "add one file" promise
 * to hold: every fixed vocabulary is fully labelled, and no screen has grown a
 * Greek literal of its own. (The second one is also enforced by eslint; this
 * checks it from the other side, against the files on disk.)
 */
import { describe, expect, it } from "vitest";
// The *merged* bundle — app labels plus M5's letters and message bank — since
// that is what `StringId` and the lookup are built from.
import { el, translate, translatorFor, type StringId } from "../../src/i18n";
import {
  ABSENCE_KINDS,
  absenceKindLabel,
  ATTENDANCE_STATES,
  attendanceStateLabel,
  attendanceSymbolLabel,
  FOLLOW_UP_STATUSES,
  followUpLabel,
  GOAL_AREAS,
  goalAreaLabel,
  GOAL_PROGRESS,
  goalProgressLabel,
  HOLIDAY_SOURCES,
  holidaySourceLabel,
  IMPORTANT_DATE_KINDS,
  importantDateKindLabel,
  MONTHS,
  monthLabel,
  SEN_STATUSES,
  senStatusLabel,
  WEEKDAYS,
  weekdayLabel,
  YEAR_MODELS,
  yearModelLabel,
} from "../../src/i18n/vocabularies";

describe("the string lookup", () => {
  it("returns the Greek string for an id", () => {
    expect(translate("el", "nav.year")).toBe("Έτος");
  });

  it("fills in placeholders", () => {
    expect(translate("el", "classes.countValue", { n: 24 })).toBe("24 μαθητές");
  });

  it("leaves an unknown placeholder alone rather than blanking it", () => {
    expect(translate("el", "storage.latest", {})).toContain("{when}");
  });

  it("falls back to Greek for a locale that has not been written yet", () => {
    // This is what M9 relies on while `en.ts` is being filled in: a missing key
    // shows Greek, never a blank button or a raw id.
    expect(translate("en", "nav.classes")).toBe(el["nav.classes"]);
  });

  it("gives a translator bound to one locale", () => {
    expect(translatorFor("el")("nav.students")).toBe("Μαθητές");
  });
});

describe("the fixed reference vocabularies", () => {
  const cases: [readonly (string | number)[], (code: never) => StringId][] = [
    [YEAR_MODELS, yearModelLabel as (c: never) => StringId],
    [HOLIDAY_SOURCES, holidaySourceLabel as (c: never) => StringId],
    [IMPORTANT_DATE_KINDS, importantDateKindLabel as (c: never) => StringId],
    [SEN_STATUSES, senStatusLabel as (c: never) => StringId],
    [GOAL_AREAS, goalAreaLabel as (c: never) => StringId],
    [WEEKDAYS, weekdayLabel as (c: never) => StringId],
    [MONTHS, monthLabel as (c: never) => StringId],
    // M4's vocabularies. The attendance states are labelled twice — once by
    // name and once by the source card's one-character symbol — and both have
    // to be complete or the printed grid loses a column's meaning.
    [ATTENDANCE_STATES, attendanceStateLabel as (c: never) => StringId],
    [ATTENDANCE_STATES, attendanceSymbolLabel as (c: never) => StringId],
    [ABSENCE_KINDS, absenceKindLabel as (c: never) => StringId],
    [FOLLOW_UP_STATUSES, followUpLabel as (c: never) => StringId],
    [GOAL_PROGRESS, goalProgressLabel as (c: never) => StringId],
  ];

  it("label every code through the translation table, with nothing missing", () => {
    for (const [codes, labelId] of cases) {
      for (const code of codes) {
        const id = labelId(code as never);
        expect(el, `no Greek label for ${id}`).toHaveProperty(id);
        expect(el[id].length).toBeGreaterThan(0);
      }
    }
  });

  it("covers the SEN categories the source product's card offers", () => {
    expect(SEN_STATUSES).toEqual(["none", "reinforcement", "accommodations", "gifted"]);
  });

  it("covers the six fixed annual-goal areas", () => {
    expect(GOAL_AREAS).toHaveLength(6);
  });

  /**
   * The source print template's key is `· παρών, α απουσία, κ καθυστέρηση,
   * u δικαιολογημένη`. The spec names four states. They line up one-for-one,
   * and the symbols are labels — the database stores the code.
   */
  it("covers the four attendance states with the source card's own symbols", () => {
    expect(ATTENDANCE_STATES).toEqual(["present", "absent", "late", "excused"]);
    expect(ATTENDANCE_STATES.map((s) => el[attendanceSymbolLabel(s)])).toEqual([
      "·",
      "α",
      "κ",
      "u",
    ]);
  });

  it("keeps the absence kinds to the two the source register has columns for", () => {
    expect(ABSENCE_KINDS).toEqual(["absence", "late"]);
  });
});

/**
 * The no-inline-Greek rule is enforced by eslint (gate step 2), because only a
 * parser can tell a Greek label in a component from Greek prose in a comment.
 * This checks the rule is still configured, so deleting it fails a test rather
 * than quietly removing the guarantee.
 */
describe("the no-inline-Greek lint rule", () => {
  it("still covers src/ and still exempts the language files", async () => {
    const config = (await import("../../eslint.config.js")).default as Array<{
      files?: string[];
      ignores?: string[];
      rules?: Record<string, unknown>;
    }>;
    const block = config.find((c) => c.rules && "no-restricted-syntax" in c.rules);

    expect(block, "no block configures no-restricted-syntax").toBeDefined();
    expect(block!.files).toContain("src/**/*.{ts,tsx}");
    expect(block!.ignores).toContain("src/i18n/**");

    const [, ...selectors] = block!.rules!["no-restricted-syntax"] as [
      string,
      ...{ selector: string }[],
    ];
    // JSX text, plain string literals and template chunks — the three places a
    // Greek label could otherwise be written.
    expect(selectors.map((s) => s.selector.split("[")[0]).sort()).toEqual([
      "JSXText",
      "Literal",
      "TemplateElement",
    ]);
    for (const { selector } of selectors) {
      const pattern = new RegExp(selector.match(/\/(.+)\/\]$/)![1]);
      expect(pattern.test("Ατζέντα"), `${selector} does not match Greek`).toBe(true);
      expect(pattern.test("Agenda"), `${selector} matches Latin text`).toBe(false);
    }
  });
});

/**
 * The weighted-average formula, branch by branch.
 *
 * M2's first acceptance criterion names three cases explicitly — a row with
 * some columns still blank, a row whose weights do not sum to 100, and the
 * all-zero-weight fallback to a plain average — and the product owner's
 * pre-M2 decision names a fourth: a non-numeric column must be excluded from
 * the normalising sum, not merely from the marks. Each has its own test below,
 * with the arithmetic worked out in the comment so a failure says which number
 * moved rather than only that one did.
 */
import { describe, expect, it } from "vitest";
import {
  classResults,
  classSummary,
  contributingCells,
  defaultGrading,
  formatAverage,
  parseNumericGrade,
  parseWeight,
  suggestedGrade,
  weightTotal,
  weightTotalStatus,
  weightedAverage,
  yearSummary,
  type Cell,
  type GradeColumn,
  type GradeRow,
} from "../../src/domain/grades";
import type { GradeColumnKind } from "../../src/i18n/vocabularies";

let nextId = 1;
function column(weight: number | null, kind: GradeColumnKind = "numeric"): GradeColumn {
  return { id: nextId++, class_id: 1, position: 0, label: "", kind, weight };
}

/** `cells([[grade, weight], …])` — the shape every case below is written in. */
function cells(pairs: [string, number | null, GradeColumnKind?][]): Cell[] {
  return pairs.map(([value, weight, kind]) => ({ column: column(weight, kind), value }));
}

describe("parsing what the teacher typed", () => {
  it("reads a mark, with either decimal separator", () => {
    expect(parseNumericGrade("17")).toBe(17);
    expect(parseNumericGrade("12.5")).toBe(12.5);
    // A Greek keyboard produces the comma at least as readily as the dot.
    expect(parseNumericGrade("12,5")).toBe(12.5);
    expect(parseNumericGrade("  9 ")).toBe(9);
  });

  it("treats a blank or unparseable cell as no mark, never as zero", () => {
    expect(parseNumericGrade("")).toBeNull();
    expect(parseNumericGrade("   ")).toBeNull();
    expect(parseNumericGrade("—")).toBeNull();
    expect(parseNumericGrade("Α")).toBeNull();
    expect(parseNumericGrade("15-16")).toBeNull();
  });

  it("keeps a blank weight and an invalid weight apart", () => {
    expect(parseWeight("")).toBeNull(); // not yet decided
    expect(parseWeight("30")).toBe(30);
    expect(parseWeight("0")).toBe(0);
    expect(parseWeight("12,5")).toBe(12.5);
    // The three things the spec does block a save on, and nothing else.
    expect(parseWeight("-1")).toBeUndefined();
    expect(parseWeight("101")).toBeUndefined();
    expect(parseWeight("πολύ")).toBeUndefined();
  });
});

describe("the weighted average", () => {
  it("normalises by the weights that contributed, not by 100", () => {
    // Only 40% and 30% are in: (18×40 + 12×30) / 70 = 1080/70 = 15.428…
    const average = weightedAverage(
      cells([
        ["18", 40],
        ["12", 30],
        ["", 30],
      ]),
    );
    expect(average).toBeCloseTo(1080 / 70, 10);
    expect(formatAverage(average)).toBe("15.43");
    expect(suggestedGrade(average)).toBe(15);
  });

  it("matches the source registry's own worked example", () => {
    // The registry ships one filled row: marks 5, 4, 3, 5, 4 under weights
    // 3, 1, 2, 5, 1 — (15+4+6+25+4)/12 = 54/12 = 4.5, suggestion 5.
    // The scheme is percentages now rather than 1–5, but the arithmetic the
    // formula performs is the same, so the shipped example still pins it.
    const average = weightedAverage(
      cells([
        ["5", 3],
        ["4", 1],
        ["3", 2],
        ["5", 5],
        ["4", 1],
      ]),
    );
    expect(average).toBe(4.5);
    expect(suggestedGrade(average)).toBe(5);
  });

  it("ignores the columns still blank — a half-filled sheet averages over what is in", () => {
    // 16×50 / 50 = 16. The two unentered columns do not drag it towards zero.
    expect(
      weightedAverage(
        cells([
          ["16", 50],
          ["", 30],
          ["", 20],
        ]),
      ),
    ).toBe(16);
  });

  it("handles weights that do not sum to 100, both under and over", () => {
    // Under: 85% of the sheet is weighted. (20×50 + 10×35) / 85 = 1350/85.
    expect(
      weightedAverage(
        cells([
          ["20", 50],
          ["10", 35],
        ]),
      ),
    ).toBeCloseTo(1350 / 85, 10);
    // Over: 120%. (10×60 + 20×60) / 120 = 1800/120 = 15.
    expect(
      weightedAverage(
        cells([
          ["10", 60],
          ["20", 60],
        ]),
      ),
    ).toBe(15);
  });

  it("falls back to a plain average when every contributing weight is zero", () => {
    // The teacher zeroed the columns out rather than leaving them blank:
    // (10 + 14 + 18) / 3 = 14, not a division by zero and not a blank.
    expect(
      weightedAverage(
        cells([
          ["10", 0],
          ["14", 0],
          ["18", 0],
        ]),
      ),
    ).toBe(14);
  });

  it("does not take the zero-weight fallback while any weight is non-zero", () => {
    // 20 carries no weight at all; only the 40% column decides the result.
    expect(
      weightedAverage(
        cells([
          ["20", 0],
          ["10", 40],
        ]),
      ),
    ).toBe(10);
  });

  it("is blank, not zero, when no mark is entered", () => {
    expect(
      weightedAverage(
        cells([
          ["", 40],
          ["", 60],
        ]),
      ),
    ).toBeNull();
    expect(formatAverage(null)).toBe("—");
    expect(suggestedGrade(null)).toBeNull();
  });

  it("is blank while the marks that are in sit under undecided weights", () => {
    // A blank weight means "not decided yet", so the sheet has not said how to
    // combine these two marks. The running total sitting at 0% is the signal.
    expect(
      weightedAverage(
        cells([
          ["18", null],
          ["12", null],
        ]),
      ),
    ).toBeNull();
  });

  it("rounds the suggestion half up, as the source's ROUND(average, 0) does", () => {
    expect(suggestedGrade(14.5)).toBe(15);
    expect(suggestedGrade(14.49)).toBe(14);
    expect(suggestedGrade(0)).toBe(0);
  });
});

describe("only numeric columns count", () => {
  it("excludes a descriptive, pass/fail or comment mark from the average", () => {
    // Only the 50% numeric column has anything to say: 18.
    expect(
      weightedAverage(
        cells([
          ["18", 50, "numeric"],
          ["a", 20, "descriptive"],
          ["pass", 20, "pass_fail"],
          ["Καλή προσπάθεια", 10, "comment"],
        ]),
      ),
    ).toBe(18);
  });

  it("excludes a non-numeric column's weight from the normalising sum too", () => {
    // The half that is easy to get wrong. A 30% comment column must not
    // dilute the result: 18×70 / 70 = 18, NOT 18×70 / 100 = 12.6.
    const withComment = weightedAverage(
      cells([
        ["18", 70, "numeric"],
        ["Δούλεψε πολύ καλά", 30, "comment"],
      ]),
    );
    expect(withComment).toBe(18);
    expect(withComment).not.toBeCloseTo(12.6, 5);
  });

  it("excludes a non-numeric column even when its cell holds a number", () => {
    // A teacher can type "20" into a comment column. It is still a comment.
    expect(
      weightedAverage(
        cells([
          ["10", 50, "numeric"],
          ["20", 50, "comment"],
        ]),
      ),
    ).toBe(10);
  });

  it("reports exactly which cells fed the result", () => {
    const contributing = contributingCells(
      cells([
        ["18", 40, "numeric"],
        ["12", null, "numeric"],
        ["a", 30, "descriptive"],
        ["", 30, "numeric"],
      ]),
    );
    expect(contributing).toEqual([{ grade: 18, weight: 40 }]);
  });
});

describe("the running weight total", () => {
  it("sums the decided weights of the numeric columns", () => {
    expect(weightTotal([column(40), column(30), column(null)])).toBe(70);
  });

  it("leaves a non-numeric column out of the total, as it leaves it out of the average", () => {
    // Showing "100%" for a sheet that normalises over 70% would be the
    // opposite of what the warning is for.
    expect(weightTotal([column(70), column(30, "comment")])).toBe(70);
  });

  it("says nothing at all until a weight has been decided", () => {
    expect(weightTotalStatus([column(null), column(null)])).toBe("none");
    expect(weightTotalStatus([])).toBe("none");
  });

  it("appears and disappears as the columns are edited", () => {
    const first = column(40);
    const second = column(30);
    expect(weightTotalStatus([first, second])).toBe("under"); // 70%
    second.weight = 60;
    expect(weightTotalStatus([first, second])).toBe("exact"); // 100%
    second.weight = 70;
    expect(weightTotalStatus([first, second])).toBe("over"); // 110%
    second.weight = null;
    expect(weightTotalStatus([first, second])).toBe("under"); // back to 40%
    first.weight = null;
    expect(weightTotalStatus([first, second])).toBe("none"); // nothing decided
  });

  it("counts a zero weight as decided — it is a choice, not a blank", () => {
    expect(weightTotalStatus([column(0)])).toBe("under");
  });
});

describe("the class and year roll-ups", () => {
  /**
   * The hand-computed dataset M2's fourth acceptance criterion asks for.
   *
   * One class, threshold 10, two columns worth 60% and 40%:
   *
   * | student | col 1 (60%) | col 2 (40%) | average                    | suggestion |
   * |---------|-------------|-------------|----------------------------|------------|
   * | 1       | 18          | 16          | (1080+640)/100 = 17.2      | 17         |
   * | 2       | 8           | 11          | (480+440)/100 = 9.2        | 9          |
   * | 3       | 10          | (blank)     | 600/60 = 10                | 10         |
   * | 4       | (blank)     | (blank)     | none                       | none       |
   *
   * So: average of 17.2, 9.2 and 10 = 36.4/3 = 12.133…, highest 17.2,
   * lowest 9.2, two at or above 10 (17 and 10), one below (9), roster 4.
   */
  const first = column(60);
  const second = column(40);
  const marks: Record<number, [string, string]> = {
    1: ["18", "16"],
    2: ["8", "11"],
    3: ["10", ""],
    4: ["", ""],
  };
  const cellsFor = (studentId: number): Cell[] => [
    { column: first, value: marks[studentId][0] },
    { column: second, value: marks[studentId][1] },
  ];
  const grading = defaultGrading(1);

  it("computes each student's result", () => {
    const results = classResults([1, 2, 3, 4], cellsFor, grading);
    expect(results[0]).toEqual({ student_id: 1, average: 17.2, suggested: 17, passing: true });
    expect(results[1]).toEqual({ student_id: 2, average: 9.2, suggested: 9, passing: false });
    expect(results[2]).toEqual({ student_id: 3, average: 10, suggested: 10, passing: true });
    expect(results[3]).toEqual({
      student_id: 4,
      average: null,
      suggested: null,
      passing: null,
    });
  });

  it("matches the hand-computed class summary", () => {
    const results = classResults([1, 2, 3, 4], cellsFor, grading);
    const summary = classSummary(1, results, rows());
    expect(summary.average).toBeCloseTo(36.4 / 3, 10);
    expect(summary.highest).toBe(17.2);
    expect(summary.lowest).toBe(9.2);
    expect(summary.atOrAbove).toBe(2);
    expect(summary.below).toBe(1);
    // The ungraded student is on the roster but in neither count.
    expect(summary.rosterSize).toBe(4);
    expect(summary.atOrAbove + summary.below).toBe(3);
    expect(summary.needingIntervention).toBe(1);
  });

  it("moves a student between the counts when the threshold changes", () => {
    const strict = { ...grading, pass_threshold: 15 };
    const summary = classSummary(
      1,
      classResults([1, 2, 3, 4], cellsFor, strict),
      [],
    );
    expect(summary.atOrAbove).toBe(1); // only 17
    expect(summary.below).toBe(2); // 9 and 10
  });

  it("leaves an ungraded class out of the year-wide average rather than counting it as zero", () => {
    const graded = classSummary(
      1,
      classResults([1, 2, 3, 4], cellsFor, grading),
      [],
    );
    const empty = classSummary(2, [], []);
    expect(empty.average).toBeNull();
    const year = yearSummary([graded, empty]);
    expect(year.overall).toBeCloseTo(36.4 / 3, 10);
    expect(year.classes).toHaveLength(2);
  });

  it("averages the class averages, so a big class does not outweigh a small one", () => {
    const a: ReturnType<typeof classSummary> = { ...classSummary(1, [], []), average: 18 };
    const b: ReturnType<typeof classSummary> = { ...classSummary(2, [], []), average: 8 };
    expect(yearSummary([a, b]).overall).toBe(13);
  });

  it("has no year-wide average before anything is graded", () => {
    expect(yearSummary([]).overall).toBeNull();
    expect(yearSummary([classSummary(1, [], [])]).overall).toBeNull();
  });

  function rows(): GradeRow[] {
    return [
      { class_id: 1, student_id: 1, conduct: "exemplary", observations: "", overall_result: "" },
      {
        class_id: 1,
        student_id: 2,
        conduct: "needs_intervention",
        observations: "",
        overall_result: "",
      },
      { class_id: 1, student_id: 3, conduct: "", observations: "", overall_result: "" },
    ];
  }
});

/**
 * The gradebook screen.
 *
 * Two of M2's acceptance criteria are behaviours of this screen rather than of
 * the formula — that the running-weight warning comes and goes as columns are
 * edited, and that it never blocks a save — so they are driven here through the
 * real screen against the fake backend.
 *
 * The fixture is the one in `tests/helpers/gradebookFixture.ts`, whose numbers
 * are worked out by hand in that file's comment. Note that the creation tests
 * start from a planner that **already has columns and marks in it**: the M1
 * `Νέο τμήμα` data-loss bug survived 64 tests precisely because every creation
 * test started from an empty fixture.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

// Imported after the mock is registered, as the other screen tests do, so the
// screen's `api` module binds to the mocked bridge rather than the real one.
const { default: GradesScreen } = await import("../../src/screens/GradesScreen");
const { el } = await import("../../src/i18n/el");
const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { gradedPlanner, CLASS_ID, ELENI, FIRST_MARK } = await import("../helpers/gradebookFixture");

beforeEach(() => {
  // Braces matter: an arrow that *returns* the mock hands vitest a cleanup
  // hook, which it then calls — with no arguments — after every test.
  invoke.mockReset();
});

/** The cell editor for one column and one student, by its accessible name. */
function cell(column: string, student: string) {
  return screen.getByLabelText(`${column} · ${student}`);
}

/** The panel a heading belongs to, so a query can be scoped to one of them. */
function panel(heading: string) {
  return within(screen.getByText(heading).closest("section")!);
}

/** The row of the conduct sheet that a given field belongs to. */
function conductRow(field: HTMLElement) {
  return within(field.closest("li")!);
}

describe("the gradebook", () => {
  it("shows each student's average and suggestion, and leaves an ungraded row blank", () => {
    renderScreen(GradesScreen, gradedPlanner(), invoke);

    const eleni = screen.getByRole("row", { name: /Ελένη Παπαδοπούλου/ });
    expect(within(eleni).getByText("17.2")).toBeInTheDocument();
    expect(within(eleni).getByText("17")).toBeInTheDocument();

    const giorgos = screen.getByRole("row", { name: /Γιώργος Χαραλάμπους/ });
    expect(within(giorgos).getByText("9.2")).toBeInTheDocument();

    // Μαρία has no marks: a dash, never a zero.
    const maria = screen.getByRole("row", { name: /Μαρία Ιωάννου/ });
    expect(within(maria).queryByText("0")).not.toBeInTheDocument();
    expect(within(maria).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("recomputes the average when a mark is changed", async () => {
    const user = userEvent.setup();
    renderScreen(GradesScreen, gradedPlanner(), invoke);

    const mark = cell("Διαγώνισμα", "Ελένη Παπαδοπούλου");
    await user.clear(mark);
    await user.type(mark, "10");
    await user.tab();

    // 10×60 + 16×40 = 1240/100 = 12.4, suggestion 12.
    const eleni = await screen.findByRole("row", { name: /Ελένη Παπαδοπούλου/ });
    expect(within(eleni).getByText("12.4")).toBeInTheDocument();
    expect(within(eleni).getByText("12")).toBeInTheDocument();
  });

  it("clears a mark back to blank rather than to zero", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    const mark = cell("Διαγώνισμα", "Γιώργος Χαραλάμπους");
    await user.clear(mark);
    await user.tab();

    expect(
      backend.planner.grade_values.some(
        (v) => v.column_id === FIRST_MARK && v.student_id !== ELENI,
      ),
    ).toBe(false);
    // Only the 40% column is left, so the average is that column's mark.
    const giorgos = await screen.findByRole("row", { name: /Γιώργος Χαραλάμπους/ });
    const cells = within(giorgos).getAllByRole("cell");
    expect(cells.at(-2)).toHaveTextContent("11"); // the average
    expect(cells.at(-1)).toHaveTextContent("11"); // the suggestion
  });

  it("stores the code, not the label, for a coded column", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    await user.selectOptions(
      cell("Προφορικά", "Γιώργος Χαραλάμπους"),
      el["vocab.passFailGrade.fail"],
    );

    const stored = backend.planner.grade_values.find(
      (v) => v.value === "fail" || v.value === el["vocab.passFailGrade.fail"],
    );
    expect(stored?.value).toBe("fail");
  });
});

describe("the running weight total", () => {
  it("warns while the weights do not add up to 100, and stops when they do", async () => {
    const user = userEvent.setup();
    const planner = gradedPlanner();
    // Start the sheet short: 60% + 20% = 80%.
    planner.grade_columns[1].weight = 20;
    renderScreen(GradesScreen, planner, invoke);

    expect(screen.getAllByText(/80%/).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(el["grades.weightNeverBlocks"]);

    const weights = screen.getAllByLabelText(el["grades.weight"]);
    await user.clear(weights[1]);
    await user.type(weights[1], "40");
    await user.tab();

    // 100% exactly: the warning goes away and the total is still shown.
    expect(await screen.findByText(el["grades.weightTotal"].replace("{total}", "100"))).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("warns again when the weights go over 100", async () => {
    const user = userEvent.setup();
    renderScreen(GradesScreen, gradedPlanner(), invoke);

    expect(screen.queryByRole("status")).not.toBeInTheDocument(); // 60 + 40

    const weights = screen.getAllByLabelText(el["grades.weight"]);
    await user.clear(weights[1]);
    await user.type(weights[1], "70");
    await user.tab();

    expect(await screen.findByRole("status")).toHaveTextContent(/130/);
  });

  it("never blocks a save because of the total", async () => {
    const user = userEvent.setup();
    const planner = gradedPlanner();
    planner.grade_columns[1].weight = 90; // 150% in total
    const backend = renderScreen(GradesScreen, planner, invoke);

    expect(screen.getByRole("status")).toBeInTheDocument();

    // With the warning on screen, a mark still saves.
    const mark = cell("Διαγώνισμα", "Μαρία Ιωάννου");
    await user.type(mark, "15");
    await user.tab();

    expect(
      backend.planner.grade_values.some((v) => v.value === "15"),
    ).toBe(true);
  });

  it("leaves a non-numeric column out of the total, and offers it no weight field", () => {
    const planner = gradedPlanner();
    renderScreen(GradesScreen, planner, invoke);

    // Four columns, but only the two numeric ones can carry a weight.
    expect(screen.getAllByLabelText(el["grades.weight"])).toHaveLength(2);
    expect(
      screen.getByText(el["grades.weightTotal"].replace("{total}", "100")),
    ).toBeInTheDocument();
  });

  it("refuses one invalid weight without touching the rest of the sheet", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    const weights = screen.getAllByLabelText(el["grades.weight"]);
    await user.clear(weights[0]);
    await user.type(weights[0], "120");
    await user.tab();

    expect(await screen.findByText(el["grades.weightInvalid"])).toBeInTheDocument();
    // Nothing was written: the stored column still says 60.
    expect(backend.planner.grade_columns[0].weight).toBe(60);
  });
});

describe("the columns", () => {
  it("adds a column without disturbing the ones already there", async () => {
    // The M1 lesson: a creation flow tested only from an empty fixture is not
    // tested. This starts from a class that already has four columns and marks.
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    await user.click(screen.getByRole("button", { name: el["grades.addColumn"] }));

    expect(backend.planner.grade_columns).toHaveLength(6); // 5 before, +1
    const first = backend.planner.grade_columns.find((c) => c.id === FIRST_MARK);
    expect(first?.label).toBe("Διαγώνισμα");
    expect(first?.weight).toBe(60);
    // The marks under the existing columns are untouched.
    expect(backend.planner.grade_values.filter((v) => v.column_id === FIRST_MARK)).toHaveLength(2);
  });

  it("gives a new column no weight at all, rather than zero", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    await user.click(screen.getByRole("button", { name: el["grades.addColumn"] }));

    const added = backend.planner.grade_columns[backend.planner.grade_columns.length - 1];
    expect(added.weight).toBeNull();
    // So the running total has not moved.
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("renames a column without losing its marks", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    const labels = screen.getAllByLabelText(el["grades.columnLabel"]);
    await user.clear(labels[0]);
    await user.type(labels[0], "Τεστ Α");
    await user.tab();

    const renamed = backend.planner.grade_columns.find((c) => c.id === FIRST_MARK);
    expect(renamed?.label).toBe("Τεστ Α");
    expect(backend.planner.grade_values.filter((v) => v.column_id === FIRST_MARK)).toHaveLength(2);
  });
});

describe("the summaries", () => {
  it("matches the hand-computed class summary", () => {
    renderScreen(GradesScreen, gradedPlanner(), invoke);
    const summary = panel(el["grades.classSummary"]);
    const value = (label: string) => summary.getByText(label).nextElementSibling!.textContent;

    // (17.2 + 9.2)/2 = 13.2, highest 17.2, lowest 9.2, one at or above the
    // base of 10 and one below it, three on the roster, and one conduct
    // rating that needs support — which is not the one that needs intervention.
    expect(value(el["grades.summaryAverage"])).toBe("13.2");
    expect(value(el["grades.summaryHighest"])).toBe("17.2");
    expect(value(el["grades.summaryLowest"])).toBe("9.2");
    expect(value(el["grades.summaryAbove"])).toBe("1");
    expect(value(el["grades.summaryBelow"])).toBe("1");
    expect(value(el["grades.summaryRoster"])).toBe("3");
    expect(value(el["grades.summaryIntervention"])).toBe("0");
  });

  it("rolls every class up, and averages the class averages for the year", () => {
    renderScreen(GradesScreen, gradedPlanner(), invoke);
    const year = panel(el["grades.yearSummary"]);

    // Α1 is 13.2 and Β2 is 20, so the year reads 16.6 — the average of the two
    // class averages, not of the three students.
    expect(year.getByRole("row", { name: /Α1/ })).toHaveTextContent("13.2");
    expect(year.getByRole("row", { name: /Β2/ })).toHaveTextContent("20");
    expect(year.getByRole("row", { name: new RegExp(el["grades.overallAverage"]) })).toHaveTextContent(
      "16.6",
    );
  });

  it("lets the threshold be cleared and retyped, and never silently becomes zero", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);
    const threshold = screen.getByLabelText(el["grades.passMark"]);

    // Clearing the box must leave it empty to type into, not snap to "0" —
    // and a box left empty must not save a threshold of 0, which would mark a
    // whole class as passing.
    await user.clear(threshold);
    expect(threshold).toHaveValue("");
    await user.tab();
    expect(threshold).toHaveValue("10");

    await user.clear(threshold);
    await user.type(threshold, "12");
    await user.click(screen.getAllByRole("button", { name: el["common.save"] })[0]);
    expect(
      backend.planner.class_gradings.find((g) => g.class_id === CLASS_ID)?.pass_threshold,
    ).toBe(12);
  });

  it("moves a student between the pass and at-risk counts when the threshold changes", async () => {
    const user = userEvent.setup();
    renderScreen(GradesScreen, gradedPlanner(), invoke);

    const threshold = screen.getByLabelText(el["grades.passMark"]);
    await user.clear(threshold);
    await user.type(threshold, "18");
    await user.click(screen.getAllByRole("button", { name: el["common.save"] })[0]);

    // With the base at 18, even Ελένη's 17 is below it.
    await screen.findByText(el["grades.classSummary"]);
    const below = panel(el["grades.classSummary"]).getByText(el["grades.summaryBelow"])
      .nextElementSibling!;
    expect(below).toHaveTextContent("2");
  });
});

describe("the conduct sheet", () => {
  it("keeps the written overall result exactly as typed, and computes nothing", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    const results = screen.getAllByLabelText(el["grades.overallResult"]);
    await user.clear(results[1]);
    await user.type(results[1], "Χρειάζεται στήριξη στη συνέπεια");
    await user.click(conductRow(results[1]).getByRole("button", { name: el["common.save"] }));

    const row = backend.planner.grade_rows.find((r) => r.overall_result !== "Άριστη πρόοδος");
    expect(row?.overall_result).toBe("Χρειάζεται στήριξη στη συνέπεια");
  });

  it("stores a conduct code, and does not let conduct touch the average", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke);

    const conduct = screen.getAllByLabelText(el["grades.conduct"])[0];
    await user.selectOptions(conduct, el["vocab.conduct.needs_intervention"]);

    expect(
      backend.planner.grade_rows.find((r) => r.student_id === ELENI)?.conduct,
    ).toBe("needs_intervention");
    // Her average is exactly what it was.
    const eleni = await screen.findByRole("row", { name: /Ελένη Παπαδοπούλου/ });
    expect(within(eleni).getByText("17.2")).toBeInTheDocument();
  });
});

describe("with nothing to grade yet", () => {
  it("says so rather than showing an empty grid", () => {
    renderScreen(GradesScreen, emptyPlanner(), invoke);
    expect(screen.getByText(el["grades.noClasses"])).toBeInTheDocument();
  });
});

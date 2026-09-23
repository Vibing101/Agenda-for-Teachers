/**
 * The week-by-class progress matrix — **M6's first acceptance criterion,
 * checked through the real screens.**
 *
 * The criterion is that the matrix "correctly reflects entries made from the
 * per-class weekly plan (M3) **without duplicate data entry**", so the central
 * test here does exactly what it says: it **types a plan into the real M3
 * screen**, re-renders the real matrix from the planner that came back, finds
 * the text there — and then asserts there was no second field to fill for it to
 * appear, and that the matrix writes nothing at all.
 *
 * Both screens are mounted against one shared fake backend, so the plan really
 * does travel through `save_lesson_plan` and back, rather than being poked into
 * a fixture.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { createFakeBackend, emptyPlanner } = await import("../helpers/fakeBackend");
const { DEFAULT_LOCALE, translatorFor } = await import("../../src/i18n");
const { LocaleContext } = await import("../../src/i18n/useTranslate");
const { default: ProgressScreen } = await import("../../src/screens/ProgressScreen");
const { default: PlanScreen } = await import("../../src/screens/PlanScreen");
const {
  planningPlanner,
  A1,
  A1_WEEK8_FIRST_LINE,
  A_DAY,
  PLAN_MONDAY,
} = await import("../helpers/planningFixture");

function matrix() {
  return within(screen.getByRole("table"));
}

/** The cell where `week`'s row meets the column headed `className`. */
function cellAt(week: number, className: string): HTMLElement {
  const table = screen.getByRole("table");
  const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
  const column = headers.indexOf(className);
  const row = within(table)
    .getAllByRole("row")
    .find((r) => within(r).queryByText(`Εβδ. ${week}`) !== null)!;
  // Cell 0 is the row header, which `getAllByRole("cell")` leaves out.
  return within(row).getAllByRole("cell")[column - 1];
}

describe("the progress matrix reflects the weekly plan", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  /**
   * **The criterion itself.** A plan is typed on the M3 screen, saved, and then
   * shown in the matrix without anything else being filled in.
   */
  it("shows a plan typed on the weekly plan screen, with no second field to fill", async () => {
    const backend = createFakeBackend(planningPlanner());
    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      try {
        return Promise.resolve(backend.handle(command, args));
      } catch (e) {
        return Promise.reject(e);
      }
    });
    const user = userEvent.setup();

    // --- 1. Write a plan through the real M3 screen, for a week that has none.
    const run = async (call: () => Promise<unknown>) => {
      await call();
      return backend.planner;
    };
    const { unmount } = render(
      <LocaleContext.Provider value={{ locale: DEFAULT_LOCALE, t: translatorFor(DEFAULT_LOCALE) }}>
        <PlanScreen
          planner={backend.planner}
          run={run as never}
          today="2026-11-09"
          focus={{ classId: A1, date: "2026-11-09" }}
        />
      </LocaleContext.Provider>,
    );

    const notes = screen.getByLabelText("Πλάνο της εβδομάδας");
    await user.clear(notes);
    await user.type(notes, "Γραμμένο στο εβδομαδιαίο πλάνο");
    await user.click(screen.getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() =>
      expect(
        backend.planner.lesson_plans.some(
          (p) => p.class_id === A1 && p.week_monday === "2026-11-09",
        ),
      ).toBe(true),
    );
    const callsAfterPlan = backend.calls.length;
    unmount();
    cleanup();

    // --- 2. The matrix, rendered from what actually came back from storage.
    render(
      <LocaleContext.Provider value={{ locale: DEFAULT_LOCALE, t: translatorFor(DEFAULT_LOCALE) }}>
        <ProgressScreen planner={backend.planner} today={A_DAY} onOpenPlan={() => {}} />
      </LocaleContext.Provider>,
    );

    // Week 9 is the week of 09.11.2026. There it is, and she typed it once.
    expect(within(cellAt(9, "Α1")).getByText("Γραμμένο στο εβδομαδιαίο πλάνο")).toBeInTheDocument();

    // --- 3. And there was no second field to fill for it to appear: the matrix
    // has no inputs at all, and rendering it wrote nothing.
    const table = screen.getByRole("table");
    expect(within(table).queryAllByRole("textbox")).toEqual([]);
    expect(within(table).queryAllByRole("combobox")).toEqual([]);
    expect(within(table).queryAllByRole("checkbox")).toEqual([]);
    expect(backend.calls.length).toBe(callsAfterPlan);
  });

  it("writes nothing at all, however much it is clicked", async () => {
    const backend = renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);
    const user = userEvent.setup();

    for (const button of matrix().getAllByRole("button").slice(0, 6)) {
      await user.click(button);
    }
    expect(backend.calls.filter((c) => c.command.startsWith("save"))).toEqual([]);
    expect(backend.calls.filter((c) => c.command.startsWith("set"))).toEqual([]);
    expect(backend.calls.filter((c) => c.command.startsWith("delete"))).toEqual([]);
  });

  it("shows the teacher's own first line, and marks the week that has an assessment", () => {
    renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);

    const a1 = within(cellAt(8, "Α1"));
    expect(a1.getByText(A1_WEEK8_FIRST_LINE)).toBeInTheDocument();
    expect(a1.getByText("Αξιολόγηση")).toBeInTheDocument();

    // Β2's week-8 plan has notes but no assessment.
    const b2 = within(cellAt(8, "Β2"));
    expect(b2.getByText("Εργαστήριο: μετρήσεις")).toBeInTheDocument();
    expect(b2.queryByText("Αξιολόγηση")).not.toBeInTheDocument();
  });

  it("keeps a class with no plan as a column of blanks", () => {
    renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);

    expect(matrix().getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Εβδομάδα",
      "Α1",
      "Β2",
      "Γ3",
    ]);
    expect(within(cellAt(8, "Γ3")).getByText("—")).toBeInTheDocument();
  });

  it("opens the week's plan rather than editing it here", async () => {
    const opened: { classId: number; date: string }[] = [];
    renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: (focus: { classId: number; date: string }) => opened.push(focus),
    } as never);
    const user = userEvent.setup();

    await user.click(within(cellAt(8, "Α1")).getByRole("button"));
    expect(opened).toEqual([{ classId: A1, date: PLAN_MONDAY }]);
  });

  it("marks the week containing the day it was given", () => {
    renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);
    // A_DAY is 04.11.2026, inside week 8.
    expect(matrix().getAllByText("Τρέχουσα εβδομάδα")).toHaveLength(1);
    const row = matrix()
      .getAllByRole("row")
      .find((r) => within(r).queryByText("Τρέχουσα εβδομάδα") !== null)!;
    expect(within(row).getByText("Εβδ. 8")).toBeInTheDocument();
  });

  it("re-labels its rows when the school year's start date moves, and moves no plan", () => {
    const moved = planningPlanner();
    moved.school_year = { ...moved.school_year, start_date: "2026-09-07" };
    renderScreen(ProgressScreen, moved, invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);

    // The same plan, now under week 9 rather than week 8.
    expect(within(cellAt(9, "Α1")).getByText(A1_WEEK8_FIRST_LINE)).toBeInTheDocument();
    expect(within(cellAt(8, "Α1")).getByText("—")).toBeInTheDocument();
  });

  it("pages through the year without losing where it is", async () => {
    renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);
    const user = userEvent.setup();

    expect(screen.getByRole("heading", { name: "Εβδομάδες 1–10" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Επόμενο" }));
    expect(screen.getByRole("heading", { name: "Εβδομάδες 11–20" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Σήμερα" }));
    expect(screen.getByRole("heading", { name: "Εβδομάδες 1–10" })).toBeInTheDocument();
  });

  it("asks for a start date and for classes before drawing a grid", () => {
    const noYear = planningPlanner();
    noYear.school_year = { ...noYear.school_year, start_date: "" };
    renderScreen(ProgressScreen, noYear, invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);
    expect(screen.getByText(/Ορίστε πρώτα την ημερομηνία έναρξης/)).toBeInTheDocument();
    cleanup();

    const noClasses = emptyPlanner();
    noClasses.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
    renderScreen(ProgressScreen, noClasses, invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);
    expect(screen.getByText(/Δεν υπάρχουν ακόμη τμήματα/)).toBeInTheDocument();
  });

  it("says on the page that the grid is the weekly plan, not a second one to fill", () => {
    renderScreen(ProgressScreen, planningPlanner(), invoke, {
      today: A_DAY,
      onOpenPlan: () => {},
    } as never);
    expect(screen.getByText(/Δεν συμπληρώνεται εδώ/)).toBeInTheDocument();
  });
});

/**
 * The weekly lesson plan screen.
 *
 * **This file is where M3's first acceptance criterion is checked through the
 * UI** — "a lesson plan entered against a specific date survives a school-year
 * start-date change" — by typing a plan, moving the year underneath it, and
 * finding the same text under a different week number.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { weekPlanner, A1, PLAN_MONDAY, A_WEDNESDAY } = await import("../helpers/weekFixture");
const { default: PlanScreen } = await import("../../src/screens/PlanScreen");

function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

describe("the weekly lesson plan", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("asks for a class before offering a plan", () => {
    renderScreen(PlanScreen, emptyPlanner(), invoke, { today: A_WEDNESDAY });
    expect(screen.getByText(/Δεν υπάρχουν ακόμη τμήματα/)).toBeInTheDocument();
  });

  it("opens on the week containing today, with the week number derived", () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    // The year starts 14.09.2026, so the week of the 16th is week 1.
    expect(panel("Εβδομάδα").getByText("Εβδομάδα αρ. 1")).toBeInTheDocument();
    expect(panel("Εβδομάδα").getByText("14.09.2026 – 20.09.2026")).toBeInTheDocument();
  });

  it("steps to the adjacent week and back to today", async () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const user = userEvent.setup();
    const week = panel("Εβδομάδα");

    await user.click(week.getByRole("button", { name: "Επόμενο" }));
    expect(week.getByText("Εβδομάδα αρ. 2")).toBeInTheDocument();
    expect(week.getByText("21.09.2026 – 27.09.2026")).toBeInTheDocument();

    await user.click(week.getByRole("button", { name: "Προηγούμενο" }));
    await user.click(week.getByRole("button", { name: "Προηγούμενο" }));
    expect(week.getByText("07.09.2026 – 13.09.2026")).toBeInTheDocument();

    await user.click(week.getByRole("button", { name: "Σήμερα" }));
    expect(week.getByText("Εβδομάδα αρ. 1")).toBeInTheDocument();
  });

  it("shows the stored plan for the week being viewed", async () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, { today: PLAN_MONDAY });
    // The fixture's plan is filed against 02.11.2026, which is week 8.
    expect(panel("Εβδομάδα").getByText("Εβδομάδα αρ. 8")).toBeInTheDocument();
    expect(screen.getByLabelText("Πλάνο της εβδομάδας")).toHaveValue(
      "Κεφάλαιο 4: εξισώσεις πρώτου βαθμού",
    );
    expect(screen.getByLabelText("Αξιολόγηση της εβδομάδας")).toHaveValue(
      "Ολιγόλεπτο διαγώνισμα την Πέμπτη",
    );
  });

  it("shows a blank plan for a week never written, and says so", () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    expect(screen.getByText(/Δεν έχει γραφτεί ακόμη πλάνο/)).toBeInTheDocument();
    expect(screen.getByLabelText("Πλάνο της εβδομάδας")).toHaveValue("");
  });

  /** The key is `(class, Monday)`, so the Monday is what reaches storage. */
  it("saves a plan against the Monday of the week, not the day being viewed", async () => {
    // A Thursday. What must be written is its Monday.
    const backend = renderScreen(PlanScreen, weekPlanner(), invoke, { today: "2026-09-17" });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Πλάνο της εβδομάδας"), "Επανάληψη");
    await user.click(panel("Πλάνο της εβδομάδας").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => {
      const plan = backend.planner.lesson_plans.find((p) => p.week_monday === "2026-09-14");
      expect(plan?.notes).toBe("Επανάληψη");
      expect(plan?.class_id).toBe(A1);
    });
  });

  it("keeps each class's week separate", async () => {
    const backend = renderScreen(PlanScreen, weekPlanner(), invoke, { today: PLAN_MONDAY });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Β2/ }));
    expect(await screen.findByLabelText("Πλάνο της εβδομάδας")).toHaveValue("");

    await user.type(screen.getByLabelText("Πλάνο της εβδομάδας"), "Εργαστήριο: κυκλώματα");
    await user.click(panel("Πλάνο της εβδομάδας").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => expect(backend.planner.lesson_plans).toHaveLength(2));
    // Α1's plan for the same week is untouched.
    const a1 = backend.planner.lesson_plans.find((p) => p.class_id === A1);
    expect(a1?.notes).toBe("Κεφάλαιο 4: εξισώσεις πρώτου βαθμού");
  });

  it("does not offer a 'new plan' button: the week and class are the whole key", () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    // There is no record to create and therefore no id to select — the shape
    // that made M1's `Νέο τμήμα` lose data cannot occur here.
    expect(screen.queryByRole("button", { name: /Νέο/ })).not.toBeInTheDocument();
  });

  /**
   * **M3's first acceptance criterion, through the UI.**
   *
   * A plan is typed against the week of 02.11.2026, which the year starting
   * 14.09.2026 calls week 8. The start date then moves a week earlier — as a
   * teacher correcting it in November would — and the very same plan is still
   * there, under week 9. Nothing moved; only the label changed.
   */
  it("survives a school-year start-date change, keyed by date rather than week index", async () => {
    const backend = renderScreen(PlanScreen, weekPlanner(), invoke, { today: PLAN_MONDAY });
    const user = userEvent.setup();

    expect(panel("Εβδομάδα").getByText("Εβδομάδα αρ. 8")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Πλάνο της εβδομάδας"));
    await user.type(screen.getByLabelText("Πλάνο της εβδομάδας"), "Κεφάλαιο 4");
    await user.click(panel("Πλάνο της εβδομάδας").getByRole("button", { name: "Αποθήκευση" }));
    await waitFor(() =>
      expect(backend.planner.lesson_plans[0]).toMatchObject({
        week_monday: PLAN_MONDAY,
        notes: "Κεφάλαιο 4",
      }),
    );
    const stored = structuredClone(backend.planner.lesson_plans);

    // The teacher corrects the start of the year, from another screen — the app
    // is closed and reopened on the corrected year.
    backend.handle("save_school_year", {
      year: { year_model: "sep_aug", start_date: "2026-09-07" },
    });
    cleanup();
    renderScreen(PlanScreen, backend.planner, invoke, { today: PLAN_MONDAY });

    // The same week is now called week 9 …
    expect(panel("Εβδομάδα").getByText("Εβδομάδα αρ. 9")).toBeInTheDocument();
    expect(panel("Εβδομάδα").getByText("02.11.2026 – 08.11.2026")).toBeInTheDocument();
    // … and the plan entered against it is exactly where it was.
    expect(screen.getByLabelText("Πλάνο της εβδομάδας")).toHaveValue("Κεφάλαιο 4");
    expect(backend.planner.lesson_plans).toEqual(stored);
  });

  it("shows the class's hours for context, read from the master timetable", () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const hours = panel("Οι ώρες του τμήματος αυτή την εβδομάδα");
    // Α1 is taught Monday 1st hour and Wednesday 2nd.
    const rows = hours.getAllByRole("listitem").map((r) => r.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Δευτέρα");
    expect(rows[1]).toContain("Τετάρτη");
  });

  it("says when a class has no hour on the timetable at all", async () => {
    const planner = weekPlanner();
    planner.timetable_cells = planner.timetable_cells.filter((c) => c.class_id !== A1);
    renderScreen(PlanScreen, planner, invoke, { today: A_WEDNESDAY });
    expect(
      screen.getByText("Το τμήμα δεν έχει ώρα στο ωρολόγιο πρόγραμμα."),
    ).toBeInTheDocument();
  });

  it("opens the class and week a Today-view link asks for", async () => {
    renderScreen(PlanScreen, weekPlanner(), invoke, {
      today: A_WEDNESDAY,
      focus: { classId: 2, date: PLAN_MONDAY },
    });
    await waitFor(() =>
      expect(panel("Εβδομάδα").getByText("Εβδομάδα αρ. 8")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Β2/ })).toHaveClass("chip selected");
  });
});

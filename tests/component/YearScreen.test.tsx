import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { emptyPlanner } = await import("../helpers/fakeBackend");
const { renderScreen } = await import("../helpers/mount");
const { default: YearScreen } = await import("../../src/screens/YearScreen");
const { emptyClass, emptyStudent } = await import("../../src/domain/types");
import type { Planner } from "../../src/domain/types";

/** The panel a control belongs to, so the right "Αποθήκευση" gets clicked. */
const panel = (heading: string) => within(screen.getByText(heading).closest("section")!);

/** A year with records already entered against real dates. */
function plannerWithData(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
  planner.holidays = [
    {
      id: 1,
      name: "Διακοπές Χριστουγέννων",
      start_date: "2026-12-24",
      end_date: "2027-01-06",
      source: "ministry",
      notes: "",
    },
  ];
  planner.important_dates = [
    { id: 2, name: "Συνάντηση γονέων", date: "2026-11-05", kind: "meeting", notes: "" },
  ];
  planner.classes = [{ ...emptyClass(), id: 3, name: "Α1", subject: "Μαθηματικά" }];
  planner.students = [{ ...emptyStudent(), id: 4, full_name: "Ελένη Παπαδοπούλου" }];
  planner.enrollments = [{ class_id: 3, student_id: 4, roster_no: 1, support: false, note: "" }];
  return planner;
}

describe("the year screen", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("derives the 53 weeks and the twelve months from the start date", () => {
    renderScreen(YearScreen, plannerWithData(), invoke);

    expect(screen.getByText("53 εβδομάδες · 14.09.2026 – 13.09.2027")).toBeInTheDocument();
    expect(screen.getByText(/Σεπτέμβριος 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Αύγουστος 2027/)).toBeInTheDocument();
  });

  it("re-derives the weeks live as the start date is edited, before anything is saved", async () => {
    renderScreen(YearScreen, plannerWithData(), invoke);
    const user = userEvent.setup();

    const field = screen.getByLabelText("Πρώτη Δευτέρα της εβδομάδας 1");
    await user.clear(field);
    await user.type(field, "2026-09-07");

    expect(
      await screen.findByText("53 εβδομάδες · 07.09.2026 – 06.09.2027"),
    ).toBeInTheDocument();
  });

  it("stores the Monday of whichever day the teacher typed", async () => {
    const backend = renderScreen(YearScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();

    // A Wednesday.
    await user.type(screen.getByLabelText("Πρώτη Δευτέρα της εβδομάδας 1"), "2026-09-16");
    await user.click(panel("Σχολικό έτος").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() =>
      expect(backend.planner.school_year).toEqual({
        year_model: "sep_aug",
        start_date: "2026-09-14",
      }),
    );
  });

  /**
   * M1's first acceptance criterion, through the UI: nothing the teacher has
   * already entered moves or disappears when the year's start date changes.
   */
  it("changing the start date after data exists moves and deletes nothing", async () => {
    const before = plannerWithData();
    const backend = renderScreen(YearScreen, before, invoke);
    const user = userEvent.setup();

    const field = screen.getByLabelText("Πρώτη Δευτέρα της εβδομάδας 1");
    await user.clear(field);
    await user.type(field, "2026-09-07");
    await user.click(panel("Σχολικό έτος").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => expect(backend.planner.school_year.start_date).toBe("2026-09-07"));

    const after = backend.planner;
    expect(after.holidays).toEqual(before.holidays);
    expect(after.important_dates).toEqual(before.important_dates);
    expect(after.grading_periods).toEqual(before.grading_periods);
    expect(after.annual_goals).toEqual(before.annual_goals);
    expect(after.classes).toEqual(before.classes);
    expect(after.students).toEqual(before.students);
    expect(after.enrollments).toEqual(before.enrollments);

    // And they are still on screen, on their own dates, after the re-render
    // that the save triggers.
    expect(screen.getByText("Διακοπές Χριστουγέννων")).toBeInTheDocument();
    expect(screen.getByText("24.12.2026 – 06.01.2027")).toBeInTheDocument();
    expect(screen.getByText("Συνάντηση γονέων")).toBeInTheDocument();
    expect(screen.getByText("05.11.2026")).toBeInTheDocument();
    // The week numbering is what moved: 5 November is now week 9, not week 8.
    expect(screen.getByText("53 εβδομάδες · 07.09.2026 – 06.09.2027")).toBeInTheDocument();
  });

  it("adds a holiday and then removes it", async () => {
    const backend = renderScreen(YearScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();

    const section = panel("Διακοπές και αργίες");
    await user.type(section.getByLabelText("Ονομασία"), "Ενδιάμεσες αργίες");
    await user.click(section.getByRole("button", { name: "Προσθήκη αργίας" }));

    expect(await screen.findByText("Ενδιάμεσες αργίες")).toBeInTheDocument();
    await waitFor(() => expect(backend.planner.holidays).toHaveLength(1));

    await user.click(panel("Διακοπές και αργίες").getByRole("button", { name: "Διαγραφή" }));
    await waitFor(() => expect(backend.planner.holidays).toHaveLength(0));
  });

  it("adds an important date keyed by its actual date", async () => {
    const backend = renderScreen(YearScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();
    const section = panel("Σημαντικές ημερομηνίες");

    await user.type(section.getByLabelText("Ονομασία"), "Έκδοση βαθμών");
    await user.type(section.getByLabelText("Ημερομηνία"), "2026-12-10");
    await user.click(screen.getByRole("button", { name: "Προσθήκη ημερομηνίας" }));

    await waitFor(() =>
      expect(backend.planner.important_dates[0]).toMatchObject({
        name: "Έκδοση βαθμών",
        date: "2026-12-10",
      }),
    );
  });

  it("shows the six fixed annual-goal areas and no more", () => {
    renderScreen(YearScreen, emptyPlanner(), invoke);

    for (const area of [
      "Διδασκαλία και περιεχόμενο",
      "Επαγγελματική ανάπτυξη",
      "Σχέσεις με τους μαθητές",
      "Συνεργασία με τους συναδέλφους",
      "Επικοινωνία με τους γονείς",
      "Προσωπική ευεξία",
    ]) {
      expect(screen.getByRole("heading", { name: area })).toBeInTheDocument();
    }
    expect(screen.getAllByLabelText("Στόχος")).toHaveLength(6);
  });

  it("saves the three grading periods by their actual dates", async () => {
    const backend = renderScreen(YearScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();
    const section = panel("Περίοδοι και έλεγχοι προόδου");

    await user.type(section.getAllByLabelText("Ονομασία περιόδου")[0], "Α΄ τετράμηνο");
    await user.type(section.getAllByLabelText("Από")[0], "2026-09-14");
    await user.click(section.getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() =>
      expect(backend.planner.grading_periods[0]).toMatchObject({
        ordinal: 1,
        name: "Α΄ τετράμηνο",
        start_date: "2026-09-14",
      }),
    );
  });
});

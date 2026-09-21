/**
 * The agenda screen — day, week and month notes.
 *
 * The behaviour worth guarding is that a note lands on **one** row for its
 * period however the teacher navigated to it: a week note is written against its
 * Monday and a month note against the 1st, whichever day happened to be on
 * screen. Getting that wrong would give a teacher seven notes for one week, each
 * invisible from the others.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { weekPlanner, A_WEDNESDAY } = await import("../helpers/weekFixture");
const { default: AgendaScreen } = await import("../../src/screens/AgendaScreen");

function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

describe("the agenda", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("opens on the week containing today, numbered from the school year", () => {
    renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    expect(screen.getByText("Εβδομάδα αρ. 1")).toBeInTheDocument();
    expect(screen.getByText("14.09.2026 – 20.09.2026")).toBeInTheDocument();
  });

  it("shows the week's stored note and the days beneath it", () => {
    renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    expect(screen.getByLabelText("Σημειώσεις της εβδομάδας")).toHaveValue("Εβδομάδα γνωριμίας");
    // Δευτέρα–Κυριακή: the agenda's week includes the weekend, unlike the grid.
    const days = panel("Οι μέρες της εβδομάδας").getAllByRole("listitem");
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveTextContent("Δευτέρα");
    expect(days[6]).toHaveTextContent("Κυριακή");
    // Wednesday's own note is on its own box.
    expect(screen.getByLabelText("Σημειώσεις — 16.09.2026")).toHaveValue(
      "Συνάντηση με τη μητέρα στις 13:30",
    );
  });

  /**
   * The rule that keeps one note per period: whatever day is on screen, a week
   * note is filed against that week's Monday.
   */
  it("files a week note against the Monday, whatever day is being viewed", async () => {
    // A Thursday.
    const backend = renderScreen(AgendaScreen, weekPlanner(), invoke, { today: "2026-09-17" });
    const user = userEvent.setup();

    const box = screen.getByLabelText("Σημειώσεις της εβδομάδας");
    await user.clear(box);
    await user.type(box, "Εβδομάδα επανάληψης");
    await user.tab();

    await waitFor(() => {
      const note = backend.planner.agenda_notes.find((n) => n.scope === "week");
      expect(note).toMatchObject({ date: "2026-09-14", body: "Εβδομάδα επανάληψης" });
    });
    // And exactly one week note exists, not one per day visited.
    expect(backend.planner.agenda_notes.filter((n) => n.scope === "week")).toHaveLength(1);
  });

  it("files a month note against the first of the month", async () => {
    const backend = renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Μήνας" }));
    const box = await screen.findByLabelText("Εστίαση του μήνα");
    await user.clear(box);
    await user.type(box, "Ανάγνωση στο σπίτι");
    await user.tab();

    await waitFor(() => {
      const note = backend.planner.agenda_notes.find((n) => n.scope === "month");
      expect(note).toMatchObject({ date: "2026-09-01", body: "Ανάγνωση στο σπίτι" });
    });
  });

  it("keeps a day note separate from the week note of the same Monday", async () => {
    // 14.09.2026 is itself a Monday, so both scopes key on the same date.
    const backend = renderScreen(AgendaScreen, weekPlanner(), invoke, { today: "2026-09-14" });
    const user = userEvent.setup();

    const dayBox = screen.getByLabelText("Σημειώσεις — 14.09.2026");
    await user.type(dayBox, "Πρώτη μέρα");
    await user.tab();

    await waitFor(() => {
      const day = backend.planner.agenda_notes.find(
        (n) => n.scope === "day" && n.date === "2026-09-14",
      );
      expect(day?.body).toBe("Πρώτη μέρα");
    });
    // The week note on the same date is untouched.
    const week = backend.planner.agenda_notes.find((n) => n.scope === "week");
    expect(week?.body).toBe("Εβδομάδα γνωριμίας");
  });

  it("removes a note that is emptied rather than storing a blank one", async () => {
    const backend = renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Σημειώσεις της εβδομάδας"));
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.agenda_notes.some((n) => n.scope === "week")).toBe(false),
    );
  });

  describe("navigation", () => {
    it("steps to the adjacent week and back to today", async () => {
      renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Επόμενο" }));
      expect(screen.getByText("21.09.2026 – 27.09.2026")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Προηγούμενο" }));
      expect(screen.getByText("14.09.2026 – 20.09.2026")).toBeInTheDocument();
    });

    it("jumps back to today from wherever the teacher wandered to", async () => {
      renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
      const user = userEvent.setup();

      for (let i = 0; i < 5; i += 1) {
        await user.click(screen.getByRole("button", { name: "Επόμενο" }));
      }
      expect(screen.getByText("Εβδομάδα αρ. 6")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Σήμερα" }));
      expect(screen.getByText("Εβδομάδα αρ. 1")).toBeInTheDocument();
      expect(screen.getByText("14.09.2026 – 20.09.2026")).toBeInTheDocument();
    });

    it("steps months with the 01 / 12 counter the source page carries", async () => {
      renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Μήνας" }));
      expect(await screen.findByText("Σεπτέμβριος επισκόπηση")).toBeInTheDocument();
      expect(screen.getByText("9 / 12")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Επόμενο" }));
      expect(screen.getByText("Οκτώβριος επισκόπηση")).toBeInTheDocument();
      expect(screen.getByText("10 / 12")).toBeInTheDocument();
    });

    it("moves to a day by clicking it in the week strip", async () => {
      renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Επιλογή ημέρας 2026-09-18" }));
      await user.click(screen.getByRole("button", { name: "Ημέρα" }));

      expect(await screen.findByText("Παρασκευή 18.09.2026")).toBeInTheDocument();
    });
  });

  it("shows that day's hours from the master timetable, on the day view", async () => {
    renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Ημέρα" }));

    const hours = panel("Το πρόγραμμα της ημέρας");
    expect(await within(hours.getByRole("list")).findAllByRole("listitem")).toHaveLength(3);
  });

  it("lays the month out Monday-first without spilling into the next month", async () => {
    renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Μήνας" }));
    const grid = panel("Το ημερολόγιο του μήνα");

    expect(grid.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Δευτέρα",
      "Τρίτη",
      "Τετάρτη",
      "Πέμπτη",
      "Παρασκευή",
      "Σάββατο",
      "Κυριακή",
    ]);
    // September 2026 has 30 days and offers exactly those.
    expect(grid.getAllByRole("button", { name: /Επιλογή ημέρας/ })).toHaveLength(30);
  });

  it("marks the days that already carry a note", async () => {
    renderScreen(AgendaScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Μήνας" }));
    const grid = panel("Το ημερολόγιο του μήνα");
    // Only the 16th has a day note in the fixture.
    expect(grid.getAllByText("Έχει σημείωση")).toHaveLength(1);
  });
});

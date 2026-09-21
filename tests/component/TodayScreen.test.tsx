/**
 * The Today view, driven on a chosen date.
 *
 * **This file is where M3's second acceptance criterion is checked** — "the Today
 * view correctly shows only today's scheduled classes on a spot-checked date" —
 * and it is only checkable at all because `today` is a prop. The shell reads the
 * calendar once and passes the day down, so a test can ask for a Wednesday in
 * September without waiting for one.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { weekPlanner, A_WEDNESDAY } = await import("../helpers/weekFixture");
const { default: TodayScreen } = await import("../../src/screens/TodayScreen");

/** The panel with this heading, so an assertion cannot drift into another one. */
function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

describe("the today view", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("shows today's date and the derived week number", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    // Formatted by the app as dd.MM.yyyy, per the spec's resolved decision.
    expect(screen.getByText("Τετάρτη 16.09.2026")).toBeInTheDocument();
    // 16.09.2026 is in the week starting 14.09.2026, which is week 1.
    expect(screen.getByText("Εβδομάδα αρ. 1")).toBeInTheDocument();
  });

  /**
   * The criterion itself. The fixture teaches Α1 on Monday and Wednesday and Β2
   * twice on Wednesday, with a duty on Friday. On a Wednesday the view must show
   * the three Wednesday hours and nothing else.
   */
  it("shows only the hours scheduled today, on a spot-checked date", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const schedule = panel("Το πρόγραμμα της ημέρας");

    const hours = schedule.getAllByRole("listitem");
    expect(hours).toHaveLength(3);
    expect(hours[0]).toHaveTextContent("1η");
    expect(hours[0]).toHaveTextContent("Β2");
    expect(hours[1]).toHaveTextContent("2η");
    expect(hours[1]).toHaveTextContent("Α1");
    expect(hours[2]).toHaveTextContent("3η");
    expect(hours[2]).toHaveTextContent("Β2");

    // Friday's duty is not today's, and must not leak in.
    expect(schedule.queryByText(/Εφημερία/)).not.toBeInTheDocument();
  });

  it("shows Monday's single class on Monday, and not Wednesday's", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: "2026-09-14" });
    const schedule = panel("Το πρόγραμμα της ημέρας");

    const hours = schedule.getAllByRole("listitem");
    expect(hours).toHaveLength(1);
    expect(hours[0]).toHaveTextContent("Α1");
    expect(schedule.queryByText("Β2")).not.toBeInTheDocument();
  });

  it("shows a duty on the day it falls, with no class beside it", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: "2026-09-18" });
    const schedule = panel("Το πρόγραμμα της ημέρας");

    expect(schedule.getAllByRole("listitem")).toHaveLength(1);
    expect(schedule.getByText("Εφημερία στο προαύλιο")).toBeInTheDocument();
    expect(schedule.queryByText("Α1")).not.toBeInTheDocument();
  });

  it("says so on a Sunday rather than showing an empty list", () => {
    // 20.09.2026 is a Sunday; the source's grid is Δευτέρα–Σάββατο.
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: "2026-09-20" });
    expect(screen.getByText("Η Κυριακή δεν υπάρχει στο ωρολόγιο πρόγραμμα.")).toBeInTheDocument();
  });

  it("points at the timetable when no hours have been set up at all", () => {
    renderScreen(TodayScreen, emptyPlanner(), invoke, { today: A_WEDNESDAY });
    expect(
      screen.getByText(/Δεν έχει οριστεί ακόμη ωρολόγιο πρόγραμμα/),
    ).toBeInTheDocument();
  });

  it("resolves each hour's room, the class's own or the cell's override", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const schedule = panel("Το πρόγραμμα της ημέρας");
    // Β2's own room is Εργαστήριο; its third hour is overridden to 204.
    expect(schedule.getByText(/Εργαστήριο/)).toBeInTheDocument();
    expect(schedule.getByText(/204/)).toBeInTheDocument();
  });

  it("shows today's agenda note, and the week's alongside it", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    const notes = panel("Σημειώσεις της ημέρας");
    expect(notes.getByText("Συνάντηση με τη μητέρα στις 13:30")).toBeInTheDocument();
    expect(notes.getByText("Εβδομάδα γνωριμίας")).toBeInTheDocument();
  });

  it("says there is no note rather than showing an empty box", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: "2026-09-17" });
    expect(panel("Σημειώσεις της ημέρας").getByText("Καμία σημείωση για σήμερα.")).toBeInTheDocument();
  });

  /**
   * "The Today view must not list the same class twice." Β2 is taught twice on
   * the Wednesday, so the schedule shows two hours for it — she really is in that
   * room twice — while the links into the week's plans offer it once, because
   * there is one plan per class per week.
   */
  it("offers one link per class, even for a class taught twice today", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY, onOpenPlan: vi.fn() });
    const plans = panel("Τα πλάνα της εβδομάδας");

    const rows = plans.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Β2"),
      expect.stringContaining("Α1"),
    ]);
    expect(plans.getAllByRole("button", { name: "Άνοιγμα πλάνου" })).toHaveLength(2);
  });

  it("says which of today's classes have no plan for this week yet", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    // The fixture's only plan is for a November week, so both read as empty here.
    expect(panel("Τα πλάνα της εβδομάδας").getAllByText("Χωρίς πλάνο αυτή την εβδομάδα")).toHaveLength(2);
  });

  it("shows the week's plan text when there is one for the week being viewed", () => {
    // 04.11.2026 is the Wednesday of the week the fixture's plan is filed against.
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: "2026-11-04" });
    expect(
      panel("Τα πλάνα της εβδομάδας").getByText("Κεφάλαιο 4: εξισώσεις πρώτου βαθμού"),
    ).toBeInTheDocument();
  });

  it("asks for a class's week to be opened, with today's date to resolve it", async () => {
    const onOpenPlan = vi.fn();
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY, onOpenPlan });
    const user = userEvent.setup();

    const plans = panel("Τα πλάνα της εβδομάδας");
    await user.click(plans.getAllByRole("button", { name: "Άνοιγμα πλάνου" })[1]);

    expect(onOpenPlan).toHaveBeenCalledWith({ classId: 1, date: A_WEDNESDAY });
  });

  /**
   * The spec calls this "a convenience aggregation view, not a data-entry
   * surface". Nothing on it may write, so it is given no `run` at all — and it
   * must therefore reach storage never.
   */
  it("writes nothing: it is an aggregation view, not a data-entry surface", () => {
    renderScreen(TodayScreen, weekPlanner(), invoke, { today: A_WEDNESDAY });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    const wrote = invoke.mock.calls.filter(([command]) => String(command).startsWith("save"));
    expect(wrote).toEqual([]);
  });
});

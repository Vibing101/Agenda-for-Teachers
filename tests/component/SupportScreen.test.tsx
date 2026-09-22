/**
 * The support-plan screen and the cross-class overview.
 *
 * **This file carries M4's version of the trap that bit M1.** `Νέο πλάνο
 * στήριξης` is the one button in this milestone with the exact shape of
 * `Νέο τμήμα` and `Νέος μαθητής`: a card bound to a *selected* record, and a
 * button that creates a new one. At M1 that combination silently renamed the
 * previously selected class, and 64 component tests missed it because every
 * creation test started from an empty planner.
 *
 * So the tests below start from a planner that **already has a plan selected**,
 * and assert that the sibling plan comes back byte-for-byte unchanged. The same
 * is done for the goal button inside a plan.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { supportPlanner, ELENI, PLAN_ONE, PLAN_TWO, GOAL_ONE } = await import(
  "../helpers/supportFixture"
);
const { default: SupportScreen } = await import("../../src/screens/SupportScreen");

function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

describe("support plans", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("asks for a student before anything else when there are none", () => {
    renderScreen(SupportScreen, emptyPlanner(), invoke);
    expect(screen.getByText(/Δεν υπάρχει ακόμη μαθητής/)).toBeInTheDocument();
  });

  it("lists the selected student's plans and opens the first", async () => {
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const plans = panel("Πλάνα στήριξης");
    expect(plans.getByRole("button", { name: /Πλάνο 1/ })).toBeInTheDocument();
    expect(plans.getByRole("button", { name: /Πλάνο 2/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(plans.getByLabelText("Κατάσταση")).toHaveValue("Σε εφαρμογή"),
    );
  });

  it("shows the card's ΕΠΕ box read-only, so it is clear which field is which", () => {
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const plans = panel("Πλάνα στήριξης");
    const box = plans.getByRole("heading", { name: "Από την καρτέλα του μαθητή" }).closest("div")!;
    expect(within(box).getByText("Προσαρμογές")).toBeInTheDocument();
    expect(within(box).getByText("ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ 04/2026")).toBeInTheDocument();
    // Read-only: no input in it at all.
    expect(within(box).queryByRole("textbox")).not.toBeInTheDocument();
  });

  /**
   * **The M1 trap, from a non-empty planner.**
   *
   * Ελένη already has two plans and the first is selected. Pressing the button
   * and typing must produce a *third* plan carrying the text, and must leave
   * both existing plans exactly as they were.
   */
  it("leaves every existing plan byte-for-byte unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(SupportScreen, supportPlanner(), invoke);
    const before = structuredClone(backend.planner.support_plans);
    const goalsBefore = structuredClone(backend.planner.support_goals);

    await user.click(screen.getByRole("button", { name: "Νέο πλάνο στήριξης" }));
    await waitFor(() => expect(backend.planner.support_plans).toHaveLength(4));

    // The two she had are untouched — not renamed, not re-statused, not moved.
    for (const original of before) {
      const now = backend.planner.support_plans.find((p) => p.id === original.id);
      expect(now).toEqual(original);
    }
    // And their goals went nowhere either.
    expect(backend.planner.support_goals).toEqual(goalsBefore);

    // The new one is blank and belongs to the student on screen.
    const created = backend.planner.support_plans.find(
      (p) => !before.some((b) => b.id === p.id),
    )!;
    expect(created.student_id).toBe(ELENI);
    expect(created.status).toBe("");
  });

  /**
   * The half of the M1 bug that actually lost data: the editor stayed bound to
   * the old record, so the first thing typed overwrote it. Here the typing is
   * done for real.
   */
  it("binds the editor to the plan just created, not to the one that was selected", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(SupportScreen, supportPlanner(), invoke);

    await user.click(screen.getByRole("button", { name: "Νέο πλάνο στήριξης" }));
    await waitFor(() => expect(backend.planner.support_plans).toHaveLength(4));
    const created = backend.planner.support_plans.find(
      (p) => p.id !== PLAN_ONE && p.id !== PLAN_TWO && p.student_id === ELENI,
    )!;

    const status = screen.getByLabelText("Κατάσταση");
    await waitFor(() => expect(status).toHaveValue(""));
    await user.type(status, "Υπό κατάρτιση");
    await user.click(screen.getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() =>
      expect(
        backend.planner.support_plans.find((p) => p.id === created.id)!.status,
      ).toBe("Υπό κατάρτιση"),
    );
    // The plan that *was* selected still says what it said.
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_ONE)!.status).toBe(
      "Σε εφαρμογή",
    );
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_TWO)!.status).toBe(
      "Ολοκληρώθηκε",
    );
  });

  /** The same trap one level down: a new goal inside a plan that has goals. */
  it("leaves every existing goal unchanged when a new goal is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(SupportScreen, supportPlanner(), invoke);
    const before = structuredClone(backend.planner.support_goals);
    expect(before).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Νέος στόχος" }));
    await waitFor(() => expect(backend.planner.support_goals).toHaveLength(3));

    for (const original of before) {
      expect(backend.planner.support_goals.find((g) => g.id === original.id)).toEqual(original);
    }
    const created = backend.planner.support_goals.find((g) => !before.some((b) => b.id === g.id))!;
    expect(created.plan_id).toBe(PLAN_ONE);
    expect(created.goal).toBe("");
    expect(created.progress).toBe("");
  });

  it("writes an edited goal to that goal only", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(SupportScreen, supportPlanner(), invoke);

    const second = screen.getByRole("group", { name: "Στόχος 2" });
    await user.selectOptions(within(second).getByLabelText("Πρόοδος"), "needs_review");

    await waitFor(() =>
      expect(backend.planner.support_goals.find((g) => g.id !== GOAL_ONE)!.progress).toBe(
        "needs_review",
      ),
    );
    // The first goal kept its own rating and its own text.
    const first = backend.planner.support_goals.find((g) => g.id === GOAL_ONE)!;
    expect(first.progress).toBe("in_progress");
    expect(first.goal).toBe("Ανάγνωση κειμένου 80 λέξεων χωρίς βοήθεια");
  });

  /**
   * **M4's second acceptance criterion, driven through the real screen.**
   *
   * Every way the UI offers to change a goal — rating it, dating it, renaming
   * it, adding one, deleting one — and the plan's status is still the teacher's
   * sentence afterwards.
   */
  it("never lets a change to a goal touch the plan's teacher-written status", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(SupportScreen, supportPlanner(), invoke);
    const statusBefore = backend.planner.support_plans.find((p) => p.id === PLAN_ONE)!.status;
    expect(statusBefore).toBe("Σε εφαρμογή");

    const first = screen.getByRole("group", { name: "Στόχος 1" });
    // Rate it fully met — the rating a roll-up would be tempted to act on.
    await user.selectOptions(within(first).getByLabelText("Πρόοδος"), "met");
    await waitFor(() =>
      expect(backend.planner.support_goals.find((g) => g.id === GOAL_ONE)!.progress).toBe("met"),
    );
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_ONE)!.status).toBe(statusBefore);

    // Rate the other one met too, so every goal in the plan is met.
    const second = screen.getByRole("group", { name: "Στόχος 2" });
    await user.selectOptions(within(second).getByLabelText("Πρόοδος"), "met");
    await waitFor(() =>
      expect(backend.planner.support_goals.every((g) => g.progress === "met")).toBe(true),
    );
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_ONE)!.status).toBe(statusBefore);

    // Add one, then delete one.
    await user.click(screen.getByRole("button", { name: "Νέος στόχος" }));
    await waitFor(() => expect(backend.planner.support_goals).toHaveLength(3));
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_ONE)!.status).toBe(statusBefore);

    await user.click(
      within(screen.getByRole("group", { name: "Στόχος 1" })).getByRole("button", {
        name: "Διαγραφή στόχου",
      }),
    );
    await waitFor(() => expect(backend.planner.support_goals).toHaveLength(2));
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_ONE)!.status).toBe(statusBefore);

    // Nothing in the whole session ever asked to save a plan.
    expect(backend.calls.some((c) => c.command === "save_support_plan")).toBe(false);
  });

  it("keeps the selection off another student's plan when the student changes", async () => {
    const user = userEvent.setup();
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const plans = panel("Πλάνα στήριξης");

    await user.selectOptions(plans.getByLabelText("Μαθητής"), "22");
    await waitFor(() => expect(plans.getByLabelText("Κατάσταση")).toHaveValue("Υπό κατάρτιση"));
    // Only Νίκος's one plan is offered.
    expect(plans.queryByRole("button", { name: /Πλάνο 2/ })).not.toBeInTheDocument();
  });

  it("deletes a plan's goals with it and leaves the other plan alone", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(SupportScreen, supportPlanner(), invoke);

    await user.click(screen.getByRole("button", { name: "Διαγραφή πλάνου" }));
    await waitFor(() =>
      expect(backend.planner.support_plans.some((p) => p.id === PLAN_ONE)).toBe(false),
    );
    expect(backend.planner.support_goals).toHaveLength(0);
    expect(backend.planner.support_plans.find((p) => p.id === PLAN_TWO)!.status).toBe(
      "Ολοκληρώθηκε",
    );
  });
});

describe("the cross-class support overview", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("shows one row per student who needs one, and no row for anyone else", () => {
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const overview = panel("Στήριξη και προσαρμογές");
    const names = overview.getAllByRole("rowheader").map((h) => h.textContent);
    expect(names).toEqual(["Ελένη Παπαδοπούλου", "Μαρία Ιωάννου", "Νίκος Γεωργίου"]);
    expect(overview.queryByText("Κώστας Δημητρίου")).not.toBeInTheDocument();
  });

  it("merges the card's category with the per-class support flag and its note", () => {
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const overview = panel("Στήριξη και προσαρμογές");
    const row = within(overview.getByRole("rowheader", { name: "Ελένη Παπαδοπούλου" }).closest("tr")!);
    // Both classes she is in …
    expect(row.getByText("Α1, Β2")).toBeInTheDocument();
    // … the card-level category …
    expect(row.getByText("Προσαρμογές")).toBeInTheDocument();
    // … and only the class that ticks her support box, with that class's note.
    expect(row.getByText(/Κάθεται μπροστά/)).toBeInTheDocument();
  });

  it("shows every plan's status and next review date", () => {
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const overview = panel("Στήριξη και προσαρμογές");
    const row = within(overview.getByRole("rowheader", { name: "Ελένη Παπαδοπούλου" }).closest("tr")!);
    expect(row.getByText("Σε εφαρμογή")).toBeInTheDocument();
    expect(row.getByText("Ολοκληρώθηκε")).toBeInTheDocument();
    // Dates are formatted by the app, dd.MM.yyyy, not by the OS locale.
    expect(row.getByText("15.01.2027")).toBeInTheDocument();
  });

  /**
   * **M4's third acceptance criterion, driven through the real screen.**
   *
   * The plan is edited in the card above; the overview below is a different
   * component reading the same planner, and it must already say the new thing.
   */
  it("reflects a plan change made above it, with nothing to regenerate", async () => {
    const user = userEvent.setup();
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const overview = () => panel("Στήριξη και προσαρμογές");
    expect(overview().getByText("Σε εφαρμογή")).toBeInTheDocument();

    const status = screen.getByLabelText("Κατάσταση");
    await user.clear(status);
    await user.type(status, "Αναθεωρήθηκε");
    await user.click(screen.getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => expect(overview().getByText("Αναθεωρήθηκε")).toBeInTheDocument());
    expect(overview().queryByText("Σε εφαρμογή")).not.toBeInTheDocument();
    // Her other plan's status is still beside it.
    expect(overview().getByText("Ολοκληρώθηκε")).toBeInTheDocument();
  });

  it("brings a student in as soon as her first plan is created", async () => {
    const user = userEvent.setup();
    renderScreen(SupportScreen, supportPlanner(), invoke);
    const plans = panel("Πλάνα στήριξης");
    expect(panel("Στήριξη και προσαρμογές").queryByText("Κώστας Δημητρίου")).not.toBeInTheDocument();

    await user.selectOptions(plans.getByLabelText("Μαθητής"), "24");
    await user.click(screen.getByRole("button", { name: "Νέο πλάνο στήριξης" }));

    await waitFor(() =>
      expect(panel("Στήριξη και προσαρμογές").getByText("Κώστας Δημητρίου")).toBeInTheDocument(),
    );
  });
});

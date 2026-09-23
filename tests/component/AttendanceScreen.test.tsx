/**
 * The attendance screen: the monthly grid and the detailed absence register.
 *
 * Two things here are the milestone's own:
 *
 * * **M4's first acceptance criterion, driven through the real UI.** The
 *   teacher marks a student `present` in the grid and logs a late arrival for
 *   the same student on the same date in the register, and neither touches the
 *   other — not the stored rows, not the totals, not the list.
 * * **The "new record" trap.** `Νέα καταχώριση` is tested from a planner that
 *   already has absence events in it, with the sibling rows asserted
 *   byte-for-byte unchanged afterwards. This register avoids M1's shape by
 *   editing rows in place, but construction is a claim and the test is the
 *   check.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { supportPlanner, A1, CONTESTED_DAY, ELENI, IN_NOVEMBER } = await import(
  "../helpers/supportFixture"
);
const { default: AttendanceScreen } = await import("../../src/screens/AttendanceScreen");

function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

/** One cell of the grid, found by the accessible name the screen gives it. */
function cell(student: string, date: string) {
  return screen.getByRole("combobox", { name: `${student}, ${date}` });
}

describe("the monthly attendance grid", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("asks for a class before showing a grid", () => {
    renderScreen(AttendanceScreen, emptyPlanner(), invoke, { today: IN_NOVEMBER });
    expect(screen.getByText(/Δεν υπάρχει ακόμη τμήμα/)).toBeInTheDocument();
  });

  it("shows the source card's own symbol key", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    const grid = panel("Απουσίες του μήνα");
    // Scoped to the key itself: the same four symbols head the totals columns,
    // which is the point of them being a key.
    const legend = within(grid.getByText(/Σύμβολα/).closest("p")!);
    for (const [symbol, name] of [
      ["·", "Παρών"],
      ["α", "Απουσία"],
      ["κ", "Καθυστέρηση"],
      ["u", "Δικαιολογημένη"],
    ]) {
      const entry = legend.getByText(symbol).closest("span")!;
      expect(within(entry).getByText(name)).toBeInTheDocument();
    }
  });

  it("lays the month out as the roster against that month's own days", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    const grid = panel("Απουσίες του μήνα");

    expect(grid.getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Ελένη Παπαδοπούλου",
      "Νίκος Γεωργίου",
      "Κώστας Δημητρίου",
    ]);
    // 30 day columns for November, plus Αρ., the name, and the four totals.
    const headers = grid.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(0, 2)).toEqual(["Αρ.", "Ονοματεπώνυμο"]);
    expect(headers.slice(2, 32)).toEqual(
      Array.from({ length: 30 }, (_, i) => String(i + 1)),
    );
  });

  it("reads today's month from the prop rather than from the clock", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: "2027-02-08" });
    const grid = panel("Απουσίες του μήνα");
    expect(grid.getByText(/Φεβρουάριος 2027/)).toBeInTheDocument();
    // 2027 is not a leap year, so 28 day columns.
    const headers = grid.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(2, 30).at(-1)).toBe("28");
  });

  it("steps to the next and previous month without spilling into either", async () => {
    const user = userEvent.setup();
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    const grid = () => panel("Απουσίες του μήνα");

    await user.click(grid().getByRole("button", { name: "Επόμενο" }));
    expect(grid().getByText(/Δεκέμβριος 2026/)).toBeInTheDocument();
    await user.click(grid().getByRole("button", { name: "Προηγούμενο" }));
    await user.click(grid().getByRole("button", { name: "Προηγούμενο" }));
    expect(grid().getByText(/Οκτώβριος 2026/)).toBeInTheDocument();
  });

  it("shows each stored mark and counts the month's totals", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });

    expect(cell("Ελένη Παπαδοπούλου", "05.11.2026")).toHaveValue("present");
    expect(cell("Ελένη Παπαδοπούλου", "06.11.2026")).toHaveValue("absent");
    expect(cell("Ελένη Παπαδοπούλου", "10.11.2026")).toHaveValue("late");
    expect(cell("Ελένη Παπαδοπούλου", "12.11.2026")).toHaveValue("excused");
    // An unmarked day is blank, not "present".
    expect(cell("Ελένη Παπαδοπούλου", "04.11.2026")).toHaveValue("");

    const row = screen.getByRole("rowheader", { name: "Ελένη Παπαδοπούλου" }).closest("tr")!;
    const totals = within(row)
      .getAllByRole("cell")
      .slice(-4)
      .map((c) => c.textContent);
    // present 1, absent 2, late 1, excused 1 — hand-counted from the fixture.
    expect(totals).toEqual(["1", "2", "1", "1"]);
  });

  it("writes a marked cell against the actual date, and deletes a cleared one", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });

    await user.selectOptions(cell("Ελένη Παπαδοπούλου", "17.11.2026"), "absent");
    await waitFor(() =>
      expect(
        backend.planner.attendance_marks.some(
          (m) => m.date === "2026-11-17" && m.student_id === ELENI && m.state === "absent",
        ),
      ).toBe(true),
    );
    // Keyed by an actual date, in the class on screen. No month, no index.
    const written = backend.planner.attendance_marks.find((m) => m.date === "2026-11-17")!;
    expect(written).toEqual({
      class_id: A1,
      student_id: ELENI,
      date: "2026-11-17",
      state: "absent",
    });

    await user.selectOptions(cell("Ελένη Παπαδοπούλου", "17.11.2026"), "");
    await waitFor(() =>
      expect(backend.planner.attendance_marks.some((m) => m.date === "2026-11-17")).toBe(false),
    );
  });

  it("keeps one class's marks out of another's grid", async () => {
    const user = userEvent.setup();
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    const grid = () => panel("Απουσίες του μήνα");

    await user.selectOptions(grid().getByLabelText("Τμήμα"), "2");
    await waitFor(() =>
      expect(grid().getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
        "Ελένη Παπαδοπούλου",
        "Μαρία Ιωάννου",
      ]),
    );
    // Her Α1 marks do not follow her into Β2's grid.
    expect(cell("Ελένη Παπαδοπούλου", "05.11.2026")).toHaveValue("");
  });
});

describe("the detailed absence register", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("lists one class's lines with every field the spec names", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    const register = panel("Απουσίες και καθυστερήσεις");
    expect(register.getByText("3 καταχωρίσεις")).toBeInTheDocument();

    const line = within(register.getByRole("group", { name: "Καταχώριση 2" }));
    expect(line.getByLabelText("Ημερομηνία")).toHaveValue("2026-11-05");
    expect(line.getByLabelText("Είδος")).toHaveValue("late");
    expect(line.getByLabelText("Ώρα")).toHaveValue("08:35");
    expect(line.getByLabelText("Διδακτική ώρα")).toHaveValue("1η");
    expect(line.getByLabelText("Αιτία / Σημείωση")).toHaveValue("Καθυστέρηση λεωφορείου");
    expect(line.getByLabelText("Δικαιολογημένη")).toBeChecked();
    expect(line.getByLabelText("Ενημέρωση γονέων")).toHaveValue("informed");
    expect(line.getByLabelText("Προσοχή · συχνές απουσίες")).toHaveValue(
      "Τρίτη φορά αυτόν τον μήνα",
    );
  });

  it("is not scoped to the month the grid is showing", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    const register = panel("Απουσίες και καθυστερήσεις");
    // The October line is listed although the grid is on November.
    const first = within(register.getByRole("group", { name: "Καταχώριση 1" }));
    expect(first.getByLabelText("Ημερομηνία")).toHaveValue("2026-10-20");
  });

  /**
   * **The "new record" trap, from a planner that already holds records.**
   *
   * Three lines exist and one of them is fully filled in. Adding a fourth must
   * leave all three exactly as they were.
   */
  it("leaves every existing line byte-for-byte unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });
    const before = structuredClone(backend.planner.absence_events);
    expect(before).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Νέα καταχώριση" }));
    await waitFor(() => expect(backend.planner.absence_events).toHaveLength(4));

    for (const original of before) {
      expect(backend.planner.absence_events.find((e) => e.id === original.id)).toEqual(original);
    }
    // The new line is blank and kept, rather than deleted for being empty.
    const created = backend.planner.absence_events.find((e) => !before.some((b) => b.id === e.id))!;
    expect(created.class_id).toBe(A1);
    expect(created.date).toBe("");
    expect(created.reason).toBe("");
  });

  it("writes an edited line to that line only", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });
    const before = structuredClone(backend.planner.absence_events);

    const second = within(screen.getByRole("group", { name: "Καταχώριση 2" }));
    const reason = second.getByLabelText("Αιτία / Σημείωση");
    await user.clear(reason);
    await user.type(reason, "Ιατρικό ραντεβού");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.absence_events.find((e) => e.id === 61)!.reason).toBe(
        "Ιατρικό ραντεβού",
      ),
    );
    // The other two lines are untouched.
    for (const id of [62, 63]) {
      expect(backend.planner.absence_events.find((e) => e.id === id)).toEqual(
        before.find((e) => e.id === id),
      );
    }
    // And the edited line kept every other field it had.
    const edited = backend.planner.absence_events.find((e) => e.id === 61)!;
    expect(edited.clock_time).toBe("08:35");
    expect(edited.justified).toBe(true);
    expect(edited.follow_up).toBe("informed");
  });

  it("deletes one line and leaves the rest", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });

    const second = within(screen.getByRole("group", { name: "Καταχώριση 2" }));
    await user.click(second.getByRole("button", { name: "Διαγραφή καταχώρισης" }));

    await waitFor(() => expect(backend.planner.absence_events).toHaveLength(2));
    expect(backend.planner.absence_events.map((e) => e.id).sort()).toEqual([62, 63]);
  });
});

/**
 * **M4's first acceptance criterion, driven through the real screens.**
 *
 * The fixture already disagrees with itself on 05.11 — `present` in the grid,
 * a late arrival in the log. These drive both halves and check neither moves.
 */
describe("the grid and the register do not touch each other", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("show different, non-derived data for the same student and date", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });

    expect(cell("Ελένη Παπαδοπούλου", "05.11.2026")).toHaveValue("present");
    const line = within(screen.getByRole("group", { name: "Καταχώριση 2" }));
    expect(line.getByLabelText("Ημερομηνία")).toHaveValue(CONTESTED_DAY);
    expect(line.getByLabelText("Είδος")).toHaveValue("late");
  });

  it("does not write an event when a cell is marked", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });
    const eventsBefore = structuredClone(backend.planner.absence_events);

    // Change the contested day from `present` to `absent` — the one edit a
    // helpful "also log this" feature would hook.
    await user.selectOptions(cell("Ελένη Παπαδοπούλου", "05.11.2026"), "absent");
    await waitFor(() =>
      expect(
        backend.planner.attendance_marks.find((m) => m.date === CONTESTED_DAY)!.state,
      ).toBe("absent"),
    );

    expect(backend.planner.absence_events).toEqual(eventsBefore);
    expect(backend.calls.some((c) => c.command === "save_absence_event")).toBe(false);
  });

  it("does not write a mark when an event is edited", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });
    const marksBefore = structuredClone(backend.planner.attendance_marks);

    const line = within(screen.getByRole("group", { name: "Καταχώριση 2" }));
    await user.selectOptions(line.getByLabelText("Είδος"), "absence");
    await waitFor(() =>
      expect(backend.planner.absence_events.find((e) => e.id === 61)!.kind).toBe("absence"),
    );

    expect(backend.planner.attendance_marks).toEqual(marksBefore);
    expect(backend.calls.some((c) => c.command === "save_attendance_mark")).toBe(false);
  });

  it("does not move the grid's totals when events are added or removed", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AttendanceScreen, supportPlanner(), invoke, {
      today: IN_NOVEMBER,
    });
    const row = () => screen.getByRole("rowheader", { name: "Ελένη Παπαδοπούλου" }).closest("tr")!;
    const totals = () =>
      within(row())
        .getAllByRole("cell")
        .slice(-4)
        .map((c) => c.textContent);
    expect(totals()).toEqual(["1", "2", "1", "1"]);

    await user.click(screen.getByRole("button", { name: "Νέα καταχώριση" }));
    await waitFor(() => expect(backend.planner.absence_events).toHaveLength(4));
    expect(totals()).toEqual(["1", "2", "1", "1"]);

    const first = within(screen.getByRole("group", { name: "Καταχώριση 1" }));
    await user.click(first.getByRole("button", { name: "Διαγραφή καταχώρισης" }));
    await waitFor(() => expect(backend.planner.absence_events).toHaveLength(3));
    expect(totals()).toEqual(["1", "2", "1", "1"]);
  });

  it("offers no affordance that writes both at once", () => {
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });
    // A guard against a later agent adding the "helpful" sync the spec rules
    // out. The screen says the two are independent instead.
    expect(screen.getByText(/ανεξάρτητα μεταξύ τους/)).toBeInTheDocument();
  });
});

describe("the two printed attendance sheets", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  /**
   * Both panels export, and neither sheet may carry a figure from the other —
   * M4.5's fourth acceptance criterion, driven through the real screen.
   *
   * The pair the fixture is built around is the check: Ελένη is `present` in
   * the card on 05.11 and carries a logged late arrival on 05.11 in the
   * register. Each sheet prints its own record and says nothing about the
   * other's.
   */
  it("exports the month card for the class and month on show", async () => {
    const user = userEvent.setup();
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });

    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF καρτέλας μήνα" }));

    await waitFor(() =>
      expect(invoke.mock.calls.some(([command]) => command === "export_pdf")).toBe(true),
    );
    const { html, fileName } = invoke.mock.calls.find(
      ([command]) => command === "export_pdf",
    )![1] as Record<string, unknown>;

    expect(fileName).toBe("Απουσίες του μήνα — Α1 — Νοέμβριος 2026 — 16.11.2026");
    expect(html).toContain("Ελένη Παπαδοπούλου");
    // Nothing from the register below it reaches the card.
    expect(html).not.toContain("Καθυστέρηση λεωφορείου");
    expect(html).not.toContain("Τρίτη φορά αυτόν τον μήνα");
  });

  it("exports the register for the class on show, month-independent", async () => {
    const user = userEvent.setup();
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });

    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF μητρώου" }));

    await waitFor(() =>
      expect(invoke.mock.calls.some(([command]) => command === "export_pdf")).toBe(true),
    );
    const { html, fileName } = invoke.mock.calls.find(
      ([command]) => command === "export_pdf",
    )![1] as Record<string, unknown>;

    expect(fileName).toBe("Απουσίες και καθυστερήσεις — Α1 — 16.11.2026");
    expect(html).toContain("Καθυστέρηση λεωφορείου");
    // The register is not scoped to the month the card above is showing.
    expect(html).toContain("20.10.2026");
    // The event's own per-event notes land in the source page's two boxes.
    expect(html).toContain("ΠΡΟΣΟΧΗ · ΣΥΧΝΕΣ ΑΠΟΥΣΙΕΣ");
    expect(html).toContain("Τρίτη φορά αυτόν τον μήνα");
  });

  it("keeps each sheet's version of the contested day", async () => {
    const user = userEvent.setup();
    renderScreen(AttendanceScreen, supportPlanner(), invoke, { today: IN_NOVEMBER });

    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF καρτέλας μήνα" }));
    await waitFor(() =>
      expect(invoke.mock.calls.some(([command]) => command === "export_pdf")).toBe(true),
    );
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF μητρώου" }));
    await waitFor(() =>
      expect(invoke.mock.calls.filter(([command]) => command === "export_pdf")).toHaveLength(2),
    );

    const [card, register] = invoke.mock.calls
      .filter(([command]) => command === "export_pdf")
      .map(([, args]) => (args as Record<string, unknown>).html as string);

    // The card prints her as present on 05.11; the register prints the late
    // arrival on 05.11. Both, at once, from one screen.
    expect(card).not.toContain("08:35");
    expect(register).toContain("08:35");
    expect(register).toContain("05.11.2026");
  });
});

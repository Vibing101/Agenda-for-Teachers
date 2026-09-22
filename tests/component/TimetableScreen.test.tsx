/**
 * The master timetable screen.
 *
 * Two things here are worth more than the rest:
 *
 * * **The "new record" trap test.** M1's `Νέο τμήμα` and `Νέος μαθητής` each
 *   silently overwrote the previously selected record, and 64 component tests
 *   missed it because every creation test started from an *empty* planner. So
 *   `Προσθήκη ώρας` is tested from a planner that already has an hour **with
 *   lessons placed in it**, which is the case that can actually lose work.
 * * **The register change.** A cover with no class at all, which M1's per-class
 *   timetable could not have held, is the concrete reason this screen exists.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { weekPlanner, A1, FIRST_HOUR } = await import("../helpers/weekFixture");
const { default: TimetableScreen } = await import("../../src/screens/TimetableScreen");

function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

/** The grid cell for one weekday of one hour, found by its accessible name. */
function cell(day: string, hour: string) {
  return screen.getByRole("button", { name: `${day}, ${hour}` });
}

describe("the master timetable", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("asks for the first hour before showing a grid", () => {
    renderScreen(TimetableScreen, emptyPlanner(), invoke);
    expect(screen.getByText(/Δεν έχει οριστεί ακόμη ώρα/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Η εβδομάδα μου" })).not.toBeInTheDocument();
  });

  it("lays the week out as an Ώρα column against Δευτέρα–Σάββατο", () => {
    renderScreen(TimetableScreen, weekPlanner(), invoke);
    const grid = panel("Η εβδομάδα μου");

    const headers = grid.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "Ώρα",
      "Δευτέρα",
      "Τρίτη",
      "Τετάρτη",
      "Πέμπτη",
      "Παρασκευή",
      "Σάββατο",
    ]);
    // Six days, not seven: the source's grid has no Sunday.
    expect(grid.queryByText("Κυριακή")).not.toBeInTheDocument();
    // The hours run down the side, in clock order.
    expect(grid.getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "1η08:30 – 09:15",
      "2η09:20 – 10:05",
      "3η10:15 – 11:00",
    ]);
  });

  it("shows each filled cell's class, subject and room, and free hours as free", () => {
    renderScreen(TimetableScreen, weekPlanner(), invoke);
    expect(cell("Δευτέρα", "1η")).toHaveTextContent("Α1");
    expect(cell("Δευτέρα", "1η")).toHaveTextContent("Μαθηματικά");
    expect(cell("Δευτέρα", "1η")).toHaveTextContent("203");
    expect(cell("Τρίτη", "1η")).toHaveTextContent("Ελεύθερη ώρα");
    expect(cell("Παρασκευή", "2η")).toHaveTextContent("Εφημερία στο προαύλιο");
  });

  it("adds an hour", async () => {
    const backend = renderScreen(TimetableScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Προσθήκη ώρας" }));
    await waitFor(() => expect(backend.planner.timetable_periods).toHaveLength(1));

    await user.type(await screen.findByLabelText("Ονομασία ώρας"), "1η");
    await user.tab();
    await waitFor(() => expect(backend.planner.timetable_periods[0].name).toBe("1η"));
  });

  /**
   * **The trap test.** From a planner that already has three hours with lessons
   * placed in them, pressing `Προσθήκη ώρας` must add a fourth and touch nothing
   * else. M1's equivalent buttons failed exactly this, and only this, because
   * every creation test started from an empty planner.
   */
  it("adds an hour without disturbing the hours already on the grid", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();
    const before = structuredClone(backend.planner.timetable_periods);
    const cellsBefore = structuredClone(backend.planner.timetable_cells);

    await user.click(screen.getByRole("button", { name: "Προσθήκη ώρας" }));

    await waitFor(() => expect(backend.planner.timetable_periods).toHaveLength(4));
    // The three existing hours are byte-for-byte what they were: no name, time or
    // id was reused, overwritten or renumbered.
    expect(backend.planner.timetable_periods.slice(0, 3)).toEqual(before);
    // And the new one is blank rather than a copy of anything.
    expect(backend.planner.timetable_periods[3]).toMatchObject({
      name: "",
      start_time: "",
      end_time: "",
    });
    // Every lesson already placed is still placed, on the same hour as before.
    expect(backend.planner.timetable_cells).toEqual(cellsBefore);
  });

  /**
   * The other half of the same risk: editing one hour must write to that hour.
   * A shared draft would send the second hour's name to the first.
   */
  it("edits the hour that was edited, and only it", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    const names = screen.getAllByLabelText("Ονομασία ώρας");
    await user.clear(names[1]);
    await user.type(names[1], "2η πρωί");
    await user.tab();

    await waitFor(() => {
      const hours = backend.planner.timetable_periods;
      expect(hours.find((h) => h.id === 11)!.name).toBe("2η πρωί");
      expect(hours.find((h) => h.id === 10)!.name).toBe("1η");
      expect(hours.find((h) => h.id === 12)!.name).toBe("3η");
    });
  });

  /**
   * Each commit is a write to the data file and a fingerprint re-check, so the
   * clock times commit on blur rather than on every partial value typed.
   */
  it("commits an hour's clock time once, when the field loses focus", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    const from = screen.getAllByLabelText("Από")[0];
    await user.clear(from);
    await user.type(from, "08:45");
    // Nothing written yet: the field still has focus.
    expect(backend.calls.filter((c) => c.command === "save_timetable_period")).toHaveLength(0);

    await user.tab();
    await waitFor(() =>
      expect(backend.planner.timetable_periods[0].start_time).toBe("08:45"),
    );
    expect(backend.calls.filter((c) => c.command === "save_timetable_period")).toHaveLength(1);
  });

  it("keeps the lessons in an hour when the hour is renamed", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();
    const cellsBefore = structuredClone(backend.planner.timetable_cells);

    const names = screen.getAllByLabelText("Ονομασία ώρας");
    await user.clear(names[0]);
    await user.type(names[0], "Πρώτη");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.timetable_periods[0].name).toBe("Πρώτη"),
    );
    expect(backend.planner.timetable_cells).toEqual(cellsBefore);
  });

  it("deletes an hour together with what was placed in it, and nothing more", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: "Διαγραφή ώρας" })[0]);

    await waitFor(() => expect(backend.planner.timetable_periods).toHaveLength(2));
    // The first hour held Α1 on Monday and Β2 on Wednesday; both cells go.
    expect(backend.planner.timetable_cells.every((c) => c.period_id !== FIRST_HOUR)).toBe(true);
    expect(backend.planner.timetable_cells).toHaveLength(3);
    // The classes themselves are untouched.
    expect(backend.planner.classes).toHaveLength(2);
  });

  it("links a cell to a class, which then fills its subject and room", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(cell("Τρίτη", "1η"));
    await user.selectOptions(await screen.findByLabelText("Τμήμα"), "Α1");

    await waitFor(() => {
      const written = backend.planner.timetable_cells.find(
        (c) => c.period_id === FIRST_HOUR && c.weekday === 2,
      );
      expect(written?.class_id).toBe(A1);
    });
    // Shown from the class, not copied into the cell.
    expect(cell("Τρίτη", "1η")).toHaveTextContent("Μαθηματικά");
    const stored = backend.planner.timetable_cells.find(
      (c) => c.period_id === FIRST_HOUR && c.weekday === 2,
    );
    expect(stored?.subject).toBe("");
    expect(stored?.room).toBe("");
  });

  /**
   * The case that decided the design: a cover or duty has no class, so it could
   * not live in M1's per-class timetable at all.
   */
  it("records a cover or duty in an hour with no class", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(cell("Πέμπτη", "3η"));
    await user.type(
      await screen.findByLabelText("Αναπληρώσεις και άλλα καθήκοντα"),
      "Αναπλήρωση για Μ. Νικολάου",
    );
    await user.tab();

    await waitFor(() => {
      const written = backend.planner.timetable_cells.find(
        (c) => c.period_id === 12 && c.weekday === 4,
      );
      expect(written).toMatchObject({ class_id: null, duty: "Αναπλήρωση για Μ. Νικολάου" });
    });
  });

  it("lets one cell override the room without touching the class", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(cell("Δευτέρα", "1η"));
    await user.type(await screen.findByLabelText("Αίθουσα"), "Αίθουσα τεχνολογίας");
    await user.tab();

    await waitFor(() => {
      const written = backend.planner.timetable_cells.find(
        (c) => c.period_id === FIRST_HOUR && c.weekday === 1,
      );
      expect(written?.room).toBe("Αίθουσα τεχνολογίας");
      expect(written?.class_id).toBe(A1);
    });
    // The class's own room is unchanged — this is one hour's exception.
    expect(backend.planner.classes.find((c) => c.id === A1)!.room).toBe("203");
  });

  /** An emptied cell is removed, so "free hour" is an absent row everywhere. */
  it("clears a cell back to free rather than storing a blank one", async () => {
    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(cell("Δευτέρα", "1η"));
    await user.click(await screen.findByRole("button", { name: "Καθαρισμός κελιού" }));

    await waitFor(() =>
      expect(
        backend.planner.timetable_cells.some(
          (c) => c.period_id === FIRST_HOUR && c.weekday === 1,
        ),
      ).toBe(false),
    );
    expect(cell("Δευτέρα", "1η")).toHaveTextContent("Ελεύθερη ώρα");
    // The hour itself stays: it is still in the teacher's week.
    expect(backend.planner.timetable_periods).toHaveLength(3);
  });

});

/**
 * M3's two carry-over items, landed in M4 because the product owner's decision
 * arrived after M3 merged.
 *
 * The ruling: the timetable needs **no PDF export at all** — plain text in the
 * app, to copy and paste, is enough.
 */
/** jsdom exposes `navigator.clipboard` as a getter, so it is defined, not set. */
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("copying the timetable as text", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("no longer claims PDF export is coming", () => {
    renderScreen(TimetableScreen, weekPlanner(), invoke);
    // M3's note said export "δεν έχει υλοποιηθεί ακόμη", which is now
    // misleading: it is not coming. The string is gone with it.
    expect(screen.queryByText(/δεν έχει υλοποιηθεί ακόμη/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PDF/)).not.toBeInTheDocument();
  });

  it("offers the copy button only once there is a grid to copy", () => {
    renderScreen(TimetableScreen, emptyPlanner(), invoke);
    expect(screen.queryByRole("button", { name: "Αντιγραφή ως κείμενο" })).not.toBeInTheDocument();
  });

  it("writes the plain-text grid to the clipboard and says it did", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    renderScreen(TimetableScreen, weekPlanner(), invoke);
    await user.click(screen.getByRole("button", { name: "Αντιγραφή ως κείμενο" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("Δευτέρα");
    expect(text).toContain("Α1 · Μαθηματικά · 203");
    expect(text).toContain("Εφημερία στο προαύλιο");
    expect(await screen.findByText(/αντιγράφηκε ως απλό κείμενο/)).toBeInTheDocument();
  });

  it("says so plainly when the webview refuses the clipboard", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));

    renderScreen(TimetableScreen, weekPlanner(), invoke);
    await user.click(screen.getByRole("button", { name: "Αντιγραφή ως κείμενο" }));

    expect(await screen.findByText(/δεν ήταν δυνατή/)).toBeInTheDocument();
  });

  it("copies without writing anything to storage", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockResolvedValue(undefined));

    const backend = renderScreen(TimetableScreen, weekPlanner(), invoke);
    await user.click(screen.getByRole("button", { name: "Αντιγραφή ως κείμενο" }));

    await waitFor(() => expect(screen.getByText(/αντιγράφηκε/)).toBeInTheDocument());
    expect(backend.calls).toHaveLength(0);
  });
});

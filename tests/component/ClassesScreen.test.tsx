import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { emptyPlanner } = await import("../helpers/fakeBackend");
const { renderScreen } = await import("../helpers/mount");
const { default: ClassesScreen } = await import("../../src/screens/ClassesScreen");
const { emptyClass, emptyStudent } = await import("../../src/domain/types");
import type { Planner } from "../../src/domain/types";

const panel = (heading: string) => within(screen.getByText(heading).closest("section")!);

/** Two classes and one student who attends both. */
function twoClasses(): Planner {
  const planner = emptyPlanner();
  planner.classes = [
    { ...emptyClass(), id: 1, name: "Α1", subject: "Μαθηματικά" },
    { ...emptyClass(), id: 2, name: "Β2", subject: "Φυσική" },
  ];
  planner.students = [
    { ...emptyStudent(), id: 10, full_name: "Ελένη Παπαδοπούλου" },
    { ...emptyStudent(), id: 11, full_name: "Ανδρέας Χριστοδούλου" },
  ];
  return planner;
}

describe("the classes screen", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("says so plainly when there is no class yet", () => {
    renderScreen(ClassesScreen, emptyPlanner(), invoke);
    expect(screen.getByText("Δεν έχει καταχωριστεί ακόμη τμήμα.")).toBeInTheDocument();
  });

  it("creates a class and saves its details", async () => {
    const backend = renderScreen(ClassesScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέο τμήμα" }));
    await screen.findByLabelText("Όνομα τμήματος");

    await user.type(screen.getByLabelText("Όνομα τμήματος"), "Α1");
    await user.type(screen.getByLabelText("Μάθημα"), "Μαθηματικά");
    await user.click(panel("Όνομα τμήματος").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => {
      const saved = backend.planner.classes[0];
      expect(saved.name).toBe("Α1");
      expect(saved.subject).toBe("Μαθηματικά");
    });
  });

  /**
   * M3 moved the teacher's week into one master register, so the card shows the
   * class's hours read-only and points at the Πρόγραμμα screen. This is the half
   * of the old "creates a class and saves its timetable slot" test that still
   * belongs here; the editing half lives in `TimetableScreen.test.tsx`.
   */
  it("shows the class's hours read-only, derived from the master timetable", async () => {
    const planner = emptyPlanner();
    planner.classes = [
      {
        id: 1,
        name: "Α1",
        subject: "Μαθηματικά",
        room: "203",
        responsible: "",
        notes: "",
        position: 0,
        seating_rows: 5,
        seating_cols: 6,
        seating_notes: "",
      },
    ];
    planner.timetable_periods = [
      { id: 10, position: 0, name: "3η", start_time: "10:15", end_time: "11:00" },
    ];
    planner.timetable_cells = [
      {
        period_id: 10,
        weekday: 2,
        class_id: 1,
        subject: "",
        room: "",
        duty: "",
        notes: "",
      },
    ];
    renderScreen(ClassesScreen, planner, invoke);

    const hours = panel("Όνομα τμήματος");
    expect(hours.getByText("Τρίτη")).toBeInTheDocument();
    expect(hours.getByText(/3η/)).toBeInTheDocument();
    expect(hours.getByText(/10:15 – 11:00/)).toBeInTheDocument();
    // The class's own room, looked up rather than copied into the cell.
    expect(hours.getByText(/203/)).toBeInTheDocument();
    // And no editor: the hours are not editable from the card any more.
    expect(screen.queryByRole("button", { name: "Προσθήκη ώρας" })).not.toBeInTheDocument();
  });

  /**
   * Found on the packaged Windows build at the M1 gate (2026-09-20): pressing
   * "Νέο τμήμα" created the class but left the editor bound to the previously
   * selected one, so typing a name and saving renamed *that* class and left the
   * new one empty — silent data loss in the most ordinary action in the module.
   *
   * The older creation test above starts from an empty planner, where the
   * "keep a sensible selection" effect happens to select the new class anyway,
   * which is why it never caught this. This one starts with a class already on
   * file, which is the case that breaks.
   */
  it("creates a second class without renaming the one already selected", async () => {
    const planner = emptyPlanner();
    planner.classes = [{ ...emptyClass(), id: 1, name: "Α1", subject: "Μαθηματικά" }];
    const backend = renderScreen(ClassesScreen, planner, invoke);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέο τμήμα" }));
    // The editor must now be on the new, empty class — not on Α1.
    await waitFor(() => expect(screen.getByLabelText("Όνομα τμήματος")).toHaveValue(""));

    await user.type(screen.getByLabelText("Όνομα τμήματος"), "Β2");
    await user.type(screen.getByLabelText("Μάθημα"), "Φυσική");
    await user.click(panel("Όνομα τμήματος").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => {
      const a1 = backend.planner.classes.find((c) => c.id === 1);
      expect(a1?.name).toBe("Α1");
      expect(a1?.subject).toBe("Μαθηματικά");
      const b2 = backend.planner.classes.find((c) => c.id !== 1);
      expect(b2?.name).toBe("Β2");
      expect(b2?.subject).toBe("Φυσική");
    });
    expect(backend.planner.classes).toHaveLength(2);
  });

  /**
   * M1's second acceptance criterion: one student, two classes, correct in
   * both rosters — with per-class support flags that do not leak across.
   */
  it("puts one student on two rosters, and shows her correctly in each", async () => {
    const backend = renderScreen(ClassesScreen, twoClasses(), invoke);
    const user = userEvent.setup();

    // Α1 is selected first. Add her there and flag her for support.
    await user.selectOptions(
      screen.getByLabelText("Προσθήκη μαθητή στο τμήμα"),
      "Ελένη Παπαδοπούλου",
    );
    await user.click(panel("Λίστα τμήματος").getByRole("button", { name: "Προσθήκη" }));
    await screen.findByRole("cell", { name: /Ελένη Παπαδοπούλου/ });
    await user.click(panel("Λίστα τμήματος").getByLabelText("Στήριξη"));
    await waitFor(() => expect(backend.planner.enrollments[0].support).toBe(true));

    // Now the same student in Β2, without the support flag.
    await user.click(screen.getByRole("button", { name: /Β2/ }));
    await user.selectOptions(
      await screen.findByLabelText("Προσθήκη μαθητή στο τμήμα"),
      "Ελένη Παπαδοπούλου",
    );
    await user.click(panel("Λίστα τμήματος").getByRole("button", { name: "Προσθήκη" }));

    await waitFor(() => expect(backend.planner.enrollments).toHaveLength(2));
    const [inA1, inB2] = backend.planner.enrollments;
    expect(inA1).toMatchObject({ class_id: 1, student_id: 10, support: true });
    expect(inB2).toMatchObject({ class_id: 2, student_id: 10, support: false });

    // Β2's roster shows her, and tells the teacher she is also in Α1.
    const roster = panel("Λίστα τμήματος");
    expect(await roster.findByText(/Ελένη Παπαδοπούλου/)).toBeInTheDocument();
    expect(roster.getByText("Επίσης: Α1")).toBeInTheDocument();
    expect(roster.getByLabelText("Στήριξη")).not.toBeChecked();

    // Back in Α1 she is still flagged.
    await user.click(screen.getByRole("button", { name: /Α1/ }));
    await waitFor(() =>
      expect(panel("Λίστα τμήματος").getByLabelText("Στήριξη")).toBeChecked(),
    );
    expect(panel("Λίστα τμήματος").getByText("Επίσης: Β2")).toBeInTheDocument();
  });

  /**
   * The planner is replaced wholesale after every mutation, so a form that
   * re-synced on prop identity would wipe itself whenever anything else on the
   * screen was saved.
   */
  it("keeps a half-typed class name when something else on the screen is saved", async () => {
    const planner = twoClasses();
    planner.enrollments = [
      { class_id: 1, student_id: 10, roster_no: 1, support: false, note: "" },
    ];
    renderScreen(ClassesScreen, planner, invoke);
    const user = userEvent.setup();

    const name = panel("Στοιχεία τμήματος").getByLabelText("Όνομα τμήματος");
    await user.clear(name);
    await user.type(name, "Α1 — πρωινό");

    // An unrelated save: flag the student for support.
    await user.click(panel("Λίστα τμήματος").getByLabelText("Στήριξη"));
    await waitFor(() =>
      expect(panel("Λίστα τμήματος").getByLabelText("Στήριξη")).toBeChecked(),
    );

    expect(panel("Στοιχεία τμήματος").getByLabelText("Όνομα τμήματος")).toHaveValue("Α1 — πρωινό");
  });

  it("saves a roster note once, when the field loses focus", async () => {
    const planner = twoClasses();
    planner.enrollments = [
      { class_id: 1, student_id: 10, roster_no: 1, support: false, note: "" },
    ];
    const backend = renderScreen(ClassesScreen, planner, invoke);
    const user = userEvent.setup();

    const note = panel("Λίστα τμήματος").getByLabelText("Σύντομη σημείωση");
    await user.type(note, "Μπροστινό θρανίο");
    // Still nothing written: a save per keystroke would mean a write to the
    // data file, and a fingerprint re-check, for every letter.
    expect(backend.calls.filter((c) => c.command === "set_enrollment")).toHaveLength(0);

    await user.tab();
    await waitFor(() => expect(backend.planner.enrollments[0].note).toBe("Μπροστινό θρανίο"));
    expect(backend.calls.filter((c) => c.command === "set_enrollment")).toHaveLength(1);
  });

  it("removing a student from one class leaves her on the other", async () => {
    const planner = twoClasses();
    planner.enrollments = [
      { class_id: 1, student_id: 10, roster_no: 1, support: true, note: "" },
      { class_id: 2, student_id: 10, roster_no: 1, support: false, note: "" },
    ];
    const backend = renderScreen(ClassesScreen, planner, invoke);
    const user = userEvent.setup();

    await user.click(
      panel("Λίστα τμήματος").getByRole("button", { name: "Αφαίρεση από το τμήμα" }),
    );

    await waitFor(() => expect(backend.planner.enrollments).toHaveLength(1));
    expect(backend.planner.enrollments[0].class_id).toBe(2);
    expect(backend.planner.students).toHaveLength(2);
  });

  it("seats a student in the room plan and keeps one seat per student", async () => {
    const planner = twoClasses();
    planner.enrollments = [
      { class_id: 1, student_id: 10, roster_no: 1, support: false, note: "" },
    ];
    const backend = renderScreen(ClassesScreen, planner, invoke);
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByLabelText("Θέση σειρά 1, στήλη 1"),
      "Ελένη Παπαδοπούλου",
    );
    await waitFor(() =>
      expect(backend.planner.seats).toEqual([
        { class_id: 1, row: 0, col: 0, student_id: 10 },
      ]),
    );

    // Moving her to another desk vacates the first one rather than cloning her.
    await user.selectOptions(
      screen.getByLabelText("Θέση σειρά 2, στήλη 3"),
      "Ελένη Παπαδοπούλου",
    );
    await waitFor(() =>
      expect(backend.planner.seats).toEqual([
        { class_id: 1, row: 1, col: 2, student_id: 10 },
      ]),
    );
  });

  it("only offers the class's own students a seat", () => {
    const planner = twoClasses();
    planner.enrollments = [
      { class_id: 1, student_id: 10, roster_no: 1, support: false, note: "" },
    ];
    renderScreen(ClassesScreen, planner, invoke);

    const seat = screen.getByLabelText("Θέση σειρά 1, στήλη 1");
    expect(within(seat).getByRole("option", { name: "Ελένη Παπαδοπούλου" })).toBeInTheDocument();
    expect(
      within(seat).queryByRole("option", { name: "Ανδρέας Χριστοδούλου" }),
    ).not.toBeInTheDocument();
  });

  it("deletes a class without deleting its students", async () => {
    const planner = twoClasses();
    planner.enrollments = [
      { class_id: 1, student_id: 10, roster_no: 1, support: false, note: "" },
    ];
    const backend = renderScreen(ClassesScreen, planner, invoke);
    const user = userEvent.setup();

    await user.click(panel("Όνομα τμήματος").getByRole("button", { name: "Διαγραφή" }));

    await waitFor(() => expect(backend.planner.classes).toHaveLength(1));
    expect(backend.planner.enrollments).toHaveLength(0);
    expect(backend.planner.students).toHaveLength(2);
  });
});

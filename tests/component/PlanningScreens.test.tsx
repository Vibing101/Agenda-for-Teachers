/**
 * M6's five list surfaces and its annual plan, driven through the real screens.
 *
 * **Every "new record" button here is tested from a planner that already holds
 * a record of that kind**, and each of those tests also asserts the siblings
 * come back byte-for-byte unchanged. That is the rule the `Νέο τμήμα`
 * data-loss bug bought at M1: a create-then-edit flow tested only from an empty
 * fixture is not tested. M6 adds six such buttons — units, exams, reflections,
 * trips, textbooks and resources — which is more than any previous milestone.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { default: AnnualPlanScreen } = await import("../../src/screens/AnnualPlanScreen");
const { default: ExamsScreen } = await import("../../src/screens/ExamsScreen");
const { default: ReflectionsScreen } = await import("../../src/screens/ReflectionsScreen");
const { default: TripsScreen } = await import("../../src/screens/TripsScreen");
const { default: LibraryScreen } = await import("../../src/screens/LibraryScreen");
const {
  planningPlanner,
  A_DAY,
  ELENI,
  KOSTAS,
  MARIA,
  NEAR_EXAM,
  TRIP,
  UNIT_ONE,
  UNIT_TWO,
} = await import("../helpers/planningFixture");

function panel(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

describe("the annual plan and its units", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("shows the class's own subject and its derived hours per week", () => {
    renderScreen(AnnualPlanScreen, planningPlanner(), invoke);
    const overview = panel("Ετήσια επισκόπηση");
    expect(overview.getByText("Μαθηματικά")).toBeInTheDocument();
    expect(overview.getByText("Από το ωρολόγιο πρόγραμμα")).toBeInTheDocument();
  });

  /**
   * The annual plan is a view of the unit cards below it, so a unit's title
   * appears in both without being typed twice.
   */
  it("lists each unit as a row of the annual plan and as its own card", () => {
    renderScreen(AnnualPlanScreen, planningPlanner(), invoke);

    const overview = panel("Ετήσια επισκόπηση");
    expect(overview.getByText("Εξισώσεις πρώτου βαθμού")).toBeInTheDocument();
    expect(overview.getByText("Α΄ τρίμηνο")).toBeInTheDocument();
    expect(overview.getByText("Αλγεβρικός χειρισμός · έλεγχος λύσης")).toBeInTheDocument();

    const card = within(screen.getByRole("region", { name: "Ενότητα αρ. 1" }));
    expect(card.getByLabelText("Τίτλος ενότητας")).toHaveValue("Εξισώσεις πρώτου βαθμού");
    expect(card.getByLabelText("Ανακεφαλαίωση ενότητας")).toHaveValue(
      "Πήγε καλά· χρειάζεται μία ώρα παραπάνω",
    );
  });

  /** The create-then-edit rule, from a planner that already holds two units. */
  it("leaves every existing unit byte-for-byte unchanged when a new one is added", async () => {
    const backend = renderScreen(AnnualPlanScreen, planningPlanner(), invoke);
    const before = structuredClone(backend.planner.units);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα ενότητα" }));
    await waitFor(() => expect(backend.planner.units).toHaveLength(before.length + 1));

    for (const unit of before) {
      expect(backend.planner.units.find((u) => u.id === unit.id)).toEqual(unit);
    }
    const created = backend.planner.units.find((u) => !before.some((b) => b.id === u.id))!;
    expect(created.title).toBe("");
    expect(created.class_id).toBe(before[0].class_id);
  });

  it("writes an edited unit to that unit only", async () => {
    const backend = renderScreen(AnnualPlanScreen, planningPlanner(), invoke);
    const second = structuredClone(backend.planner.units.find((u) => u.id === UNIT_TWO)!);
    const user = userEvent.setup();

    const card = within(screen.getByRole("region", { name: "Ενότητα αρ. 1" }));
    const title = card.getByLabelText("Τίτλος ενότητας");
    await user.clear(title);
    await user.type(title, "Νέος τίτλος");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.units.find((u) => u.id === UNIT_ONE)!.title).toBe("Νέος τίτλος"),
    );
    expect(backend.planner.units.find((u) => u.id === UNIT_TWO)).toEqual(second);
  });

  it("removes one unit and leaves the other", async () => {
    const backend = renderScreen(AnnualPlanScreen, planningPlanner(), invoke);
    const user = userEvent.setup();

    const card = within(screen.getByRole("region", { name: "Ενότητα αρ. 1" }));
    await user.click(card.getByRole("button", { name: "Διαγραφή ενότητας" }));

    await waitFor(() => expect(backend.planner.units.some((u) => u.id === UNIT_ONE)).toBe(false));
    expect(backend.planner.units.some((u) => u.id === UNIT_TWO)).toBe(true);
  });
});

describe("the exam tracker", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("lists a year's exams with every column the source page has", () => {
    renderScreen(ExamsScreen, planningPlanner(), invoke, { today: A_DAY });
    const row = within(screen.getByRole("group", { name: "Εξέταση 1" }));

    expect(row.getByLabelText("Ημερομηνία")).toHaveValue("2026-11-12");
    expect(row.getByLabelText("Είδος εξέτασης")).toHaveValue("Ολιγόλεπτο διαγώνισμα");
    expect(row.getByLabelText("Τι εξετάζεται")).toHaveValue("Κεφάλαιο 4, ενότητες 4.1–4.3");
    expect(row.getByLabelText("Βαρύτητα")).toHaveValue("20%");
    expect(row.getByLabelText("Συνεργασία και συμβουλευτική")).toHaveValue(
      "Κοινό θέμα με τη Μ. Νικολάου",
    );
    // Μάθημα is looked up on the class, not stored on the exam.
    expect(row.getByText("Μαθηματικά")).toBeInTheDocument();
  });

  it("says on the page that an exam's weight is not the gradebook's", () => {
    renderScreen(ExamsScreen, planningPlanner(), invoke, { today: A_DAY });
    expect(screen.getAllByText(/ορίζονται στο βαθμολόγιο/)[0]).toBeInTheDocument();
  });

  it("shows only what is coming in the upcoming panel, from the day it was given", () => {
    renderScreen(ExamsScreen, planningPlanner(), invoke, { today: A_DAY });
    const upcoming = panel("Επερχόμενες εξετάσεις");
    expect(upcoming.getByText("12.11.2026")).toBeInTheDocument();
    // The February exam is in the register above, and not in this panel.
    expect(upcoming.queryByText("10.02.2027")).not.toBeInTheDocument();
  });

  /** The create-then-edit rule, from a planner that already holds two exams. */
  it("leaves every existing exam byte-for-byte unchanged when a new one is added", async () => {
    const backend = renderScreen(ExamsScreen, planningPlanner(), invoke, { today: A_DAY });
    const before = structuredClone(backend.planner.exams);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα εξέταση" }));
    await waitFor(() => expect(backend.planner.exams).toHaveLength(before.length + 1));

    for (const exam of before) {
      expect(backend.planner.exams.find((e) => e.id === exam.id)).toEqual(exam);
    }
  });

  it("writes an edited exam to that exam only, and never a grade", async () => {
    const backend = renderScreen(ExamsScreen, planningPlanner(), invoke, { today: A_DAY });
    const others = structuredClone(backend.planner.exams.filter((e) => e.id !== NEAR_EXAM));
    const user = userEvent.setup();

    const row = within(screen.getByRole("group", { name: "Εξέταση 1" }));
    const weight = row.getByLabelText("Βαρύτητα");
    await user.clear(weight);
    await user.type(weight, "25%");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.exams.find((e) => e.id === NEAR_EXAM)!.weight).toBe("25%"),
    );
    for (const exam of others) {
      expect(backend.planner.exams.find((e) => e.id === exam.id)).toEqual(exam);
    }
    // Nothing on this screen can reach the gradebook.
    expect(backend.calls.some((c) => c.command.includes("grade"))).toBe(false);
  });
});

describe("the lesson reflection log", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("reads newest first, with the class it names", () => {
    renderScreen(ReflectionsScreen, planningPlanner(), invoke);
    const first = within(screen.getByRole("group", { name: "Σημείωση 1" }));
    expect(first.getByLabelText("Ημερομηνία")).toHaveValue("2026-11-05");
    expect(screen.getByDisplayValue(/Το παιχνίδι ρόλων δούλεψε/)).toBeInTheDocument();
  });

  /** The create-then-edit rule, from a planner that already holds two entries. */
  it("leaves every existing entry byte-for-byte unchanged when a new one is added", async () => {
    const backend = renderScreen(ReflectionsScreen, planningPlanner(), invoke);
    const before = structuredClone(backend.planner.lesson_reflections);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα σημείωση" }));
    await waitFor(() =>
      expect(backend.planner.lesson_reflections).toHaveLength(before.length + 1),
    );

    for (const entry of before) {
      expect(backend.planner.lesson_reflections.find((r) => r.id === entry.id)).toEqual(entry);
    }
  });

  it("never writes a lesson plan, so the progress matrix cannot pick this up", async () => {
    const backend = renderScreen(ReflectionsScreen, planningPlanner(), invoke);
    const plans = structuredClone(backend.planner.lesson_plans);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα σημείωση" }));
    await waitFor(() => expect(backend.planner.lesson_reflections).toHaveLength(3));

    expect(backend.calls.some((c) => c.command === "save_lesson_plan")).toBe(false);
    expect(backend.planner.lesson_plans).toEqual(plans);
  });
});

describe("trips and their consents", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("counts the consents rather than offering a box to type the number in", () => {
    renderScreen(TripsScreen, planningPlanner(), invoke);
    const card = within(screen.getByRole("region", { name: "Εκδρομή 1" }));

    // One given of three, one refused, one not recorded.
    expect(card.getByText("1 από 3")).toBeInTheDocument();
    expect(card.getByText("1 αρνήσεις")).toBeInTheDocument();
    expect(card.getByText("1 εκκρεμούν")).toBeInTheDocument();
    expect(card.getByText(/δεν συμπληρώνεται χειροκίνητα/)).toBeInTheDocument();
    expect(card.queryByLabelText("Συγκαταθέσεις")).not.toBeInTheDocument();
  });

  it("lists the whole class roster, including a student with nothing recorded", () => {
    renderScreen(TripsScreen, planningPlanner(), invoke);
    const card = within(screen.getByRole("region", { name: "Εκδρομή 1" }));

    expect(card.getByText("Ελένη Παπαδοπούλου")).toBeInTheDocument();
    expect(card.getByText("Κώστας Χατζηκωνσταντίνου")).toBeInTheDocument();
    expect(card.getByText("Μαρία Γεωργίου")).toBeInTheDocument();
  });

  it("records a consent against the pair, and the count follows", async () => {
    const backend = renderScreen(TripsScreen, planningPlanner(), invoke);
    const user = userEvent.setup();
    const card = within(screen.getByRole("region", { name: "Εκδρομή 1" }));

    const selects = card.getAllByLabelText("Συγκατάθεση");
    // The third student is the one with nothing recorded.
    await user.selectOptions(selects[2], "given");

    await waitFor(() =>
      expect(
        backend.planner.trip_consents.find(
          (c) => c.trip_id === TRIP && c.student_id === MARIA,
        )?.state,
      ).toBe("given"),
    );
    // The other two are untouched.
    expect(
      backend.planner.trip_consents.find((c) => c.student_id === ELENI)!.state,
    ).toBe("given");
    expect(
      backend.planner.trip_consents.find((c) => c.student_id === KOSTAS)!.state,
    ).toBe("refused");
  });

  /**
   * **A blank consent is not a third code.** Clearing the state alone leaves the
   * row only because the teacher's own note is still on it — and she counts as
   * pending again. Clearing the note as well removes the row entirely, which is
   * the blank the paper form has. Both branches, because only testing the
   * second would pass against code that never kept a note.
   */
  it("counts a cleared consent as pending, and removes the row once its note goes too", async () => {
    const backend = renderScreen(TripsScreen, planningPlanner(), invoke);
    const user = userEvent.setup();
    const card = within(screen.getByRole("region", { name: "Εκδρομή 1" }));

    await user.selectOptions(card.getAllByLabelText("Συγκατάθεση")[0], "");

    await waitFor(() =>
      expect(
        backend.planner.trip_consents.find((c) => c.student_id === ELENI)!.state,
      ).toBe(""),
    );
    // She is pending again, and her note is still hers.
    expect(card.getByText("0 από 3")).toBeInTheDocument();
    expect(card.getByText("2 εκκρεμούν")).toBeInTheDocument();
    expect(
      backend.planner.trip_consents.find((c) => c.student_id === ELENI)!.note,
    ).toBe("Παραδόθηκε 28.11");

    // Now the note goes too: nothing is recorded, so there is no row.
    const note = card.getAllByLabelText("Σημείωση")[0];
    await user.clear(note);
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.trip_consents.some((c) => c.student_id === ELENI)).toBe(false),
    );
    expect(backend.planner.trip_consents).toHaveLength(1);
  });

  it("points at M5's letter rather than building a second one", () => {
    renderScreen(TripsScreen, planningPlanner(), invoke);
    expect(screen.getByText(/Γονείς & Ομάδα → Επιστολές/)).toBeInTheDocument();
  });

  /** The create-then-edit rule, from a planner that already holds a trip. */
  it("leaves the existing trip and its consents unchanged when a new one is added", async () => {
    const backend = renderScreen(TripsScreen, planningPlanner(), invoke);
    const before = structuredClone(backend.planner.trips);
    const consents = structuredClone(backend.planner.trip_consents);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα εκδρομή" }));
    await waitFor(() => expect(backend.planner.trips).toHaveLength(before.length + 1));

    for (const trip of before) {
      expect(backend.planner.trips.find((t) => t.id === trip.id)).toEqual(trip);
    }
    expect(backend.planner.trip_consents).toEqual(consents);
  });
});

describe("the two reference lists", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("lists a textbook with every column the source page has", () => {
    renderScreen(LibraryScreen, planningPlanner(), invoke);
    const row = within(screen.getByRole("group", { name: "Βιβλίο 1" }));

    expect(row.getByLabelText("Μάθημα")).toHaveValue("Μαθηματικά");
    expect(row.getByLabelText("Τίτλος")).toHaveValue("Μαθηματικά Β΄ Γυμνασίου");
    expect(row.getByLabelText("Εκδόσεις")).toHaveValue("ΥΑΠ");
    expect(row.getByLabelText("ISBN")).toHaveValue("978-9963-0-0000-1");
    expect(row.getByLabelText("Επίπεδο")).toHaveValue("Β΄ Γυμνασίου");
    expect(row.getByLabelText("Τιμή")).toHaveValue("δωρεάν");
    expect(row.getByLabelText("Κατάσταση")).toHaveValue("Σε χρήση");
    expect(row.getByLabelText("Παρατηρήσεις")).toHaveValue("Δύο αντίτυπα λείπουν");
  });

  it("shows the source page's own six resource categories", () => {
    renderScreen(LibraryScreen, planningPlanner(), invoke);
    const resources = panel("Υλικά και πηγές");

    for (const caption of [
      "Ιστότοποι και πλατφόρμες",
      "Εφαρμογές",
      "Βιβλία και κείμενα",
      "Βίντεο και ήχος",
      "Βοηθήματα στην τάξη",
      "Άλλες πηγές",
    ]) {
      expect(resources.getByRole("heading", { name: caption })).toBeInTheDocument();
    }
  });

  /** The create-then-edit rule, from a planner that already holds a book. */
  it("leaves every existing textbook byte-for-byte unchanged when a new one is added", async () => {
    const backend = renderScreen(LibraryScreen, planningPlanner(), invoke);
    const before = structuredClone(backend.planner.textbooks);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέο βιβλίο" }));
    await waitFor(() => expect(backend.planner.textbooks).toHaveLength(before.length + 1));

    for (const book of before) {
      expect(backend.planner.textbooks.find((b) => b.id === book.id)).toEqual(book);
    }
  });

  /** And the same for a resource, which is created per category. */
  it("adds a resource to the category it was asked for, leaving the others alone", async () => {
    const backend = renderScreen(LibraryScreen, planningPlanner(), invoke);
    const before = structuredClone(backend.planner.resources);
    const user = userEvent.setup();

    const apps = within(screen.getByRole("heading", { name: "Εφαρμογές" }).closest("section")!);
    await user.click(apps.getByRole("button", { name: "Προσθήκη" }));

    await waitFor(() => expect(backend.planner.resources).toHaveLength(before.length + 1));
    for (const resource of before) {
      expect(backend.planner.resources.find((r) => r.id === resource.id)).toEqual(resource);
    }
    const created = backend.planner.resources.find((r) => !before.some((b) => b.id === r.id))!;
    expect(created.category).toBe("apps");
  });

  it("writes an edited book to that book only", async () => {
    const backend = renderScreen(LibraryScreen, planningPlanner(), invoke);
    backend.planner.textbooks.push({
      ...structuredClone(backend.planner.textbooks[0]),
      id: 602,
      position: 1,
      title: "Φυσική Β΄ Γυμνασίου",
    });
    cleanup();
    const again = renderScreen(LibraryScreen, structuredClone(backend.planner), invoke);
    const second = structuredClone(again.planner.textbooks[1]);
    const user = userEvent.setup();

    const row = within(screen.getByRole("group", { name: "Βιβλίο 1" }));
    const status = row.getByLabelText("Κατάσταση");
    await user.clear(status);
    await user.type(status, "Παραγγέλθηκε");
    await user.tab();

    await waitFor(() => expect(again.planner.textbooks[0].status).toBe("Παραγγέλθηκε"));
    expect(again.planner.textbooks[1]).toEqual(second);
  });
});

/**
 * The substitute folder, driven through the real screens.
 *
 * **M7's second acceptance criterion is tested as liveness, not as a
 * snapshot**: a seat is moved on the real Τάξεις screen, the folder is opened,
 * and it already shows the move — and the only thing that reached the backend
 * in between is the seat save itself. No rebuild call, no save of the folder,
 * no refresh. It is the mirror image of how M6 tested its matrix for
 * *insensitivity* to duplication.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { createFakeBackend } = await import("../helpers/fakeBackend");
const { renderScreen } = await import("../helpers/mount");
const { default: App } = await import("../../src/App");
const { default: SubstituteScreen } = await import("../../src/screens/SubstituteScreen");
const { formsPlanner, A_WEDNESDAY, A1 } = await import("../helpers/formsFixture");
import type { Planner } from "../../src/domain/types";

function mountApp(planner: Planner = formsPlanner()) {
  const backend = createFakeBackend(planner);
  invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    try {
      return Promise.resolve(backend.handle(command, args));
    } catch (e) {
      return Promise.reject(e);
    }
  });
  render(<App today={A_WEDNESDAY} />);
  return backend;
}

function mountFolder(planner: Planner = formsPlanner()) {
  return renderScreen(SubstituteScreen, planner, invoke, { today: A_WEDNESDAY });
}

const desk = (row: number, col: number) =>
  within(screen.getByRole("list", { name: "Πλάνο αίθουσας" })).getByRole("listitem", {
    name: `Θρανίο: σειρά ${row}, θέση ${col}`,
  });

describe("the substitute folder reads the class's seating live", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("shows a seat changed in Τάξεις without anything being regenerated", async () => {
    const backend = mountApp();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    const classes = () => screen.getByRole("button", { name: "Τάξεις" });
    const subTab = (name: string) =>
      within(screen.getAllByRole("navigation")[1]).getByRole("button", { name });

    // The folder, as it is: Ελένη at the first desk.
    await user.click(classes());
    await user.click(subTab("Φάκελος αναπλήρωσης"));
    expect(await screen.findByRole("heading", { name: "Φάκελος αναπλήρωσης" })).toBeInTheDocument();
    expect(desk(1, 1)).toHaveTextContent("Ελένη Παπαδοπούλου");

    // The edit, made where seating is edited: the class card on Τμήματα.
    await user.click(subTab("Τμήματα"));
    await screen.findByRole("heading", { name: "Πλάνο αίθουσας" });
    const mark = backend.calls.length;
    await user.selectOptions(screen.getByLabelText("Θέση σειρά 1, στήλη 1"), "Νίκος Αντωνίου");
    await waitFor(() =>
      expect(backend.planner.seats.find((s) => s.class_id === A1 && s.row === 0 && s.col === 0)
        ?.student_id).toBe(104),
    );

    // Back to the folder. It already says so.
    await user.click(subTab("Φάκελος αναπλήρωσης"));
    expect(await screen.findByRole("heading", { name: "Φάκελος αναπλήρωσης" })).toBeInTheDocument();
    expect(desk(1, 1)).toHaveTextContent("Νίκος Αντωνίου");
    expect(desk(1, 1)).not.toHaveTextContent("Ελένη");

    // **Nothing was regenerated.** Between the edit and the folder showing it,
    // the backend saw the seat being saved and the shell's usual status check
    // after a save — and nothing else: no folder command, no reload, no rebuild.
    expect(backend.calls.slice(mark).map((c) => c.command)).toEqual(["save_seating", "status"]);

    // And the file it prints is the live one too — no save first, no refresh.
    await user.click(screen.getByRole("button", { name: "Εξαγωγή φακέλου σε PDF" }));
    await waitFor(() =>
      expect(backend.calls.some((c) => c.command === "export_pdf")).toBe(true),
    );
    const html = String(backend.calls.find((c) => c.command === "export_pdf")!.args.html);
    expect(html).toMatch(/<div class="desk"[^>]*>Νίκος Αντωνίου<\/div>/);
    expect(html).not.toMatch(/<div class="desk"[^>]*>Ελένη Παπαδοπούλου<\/div>/);
  });
});

describe("the folder screen", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("shows the class's own details, looked up and read-only", () => {
    mountFolder();
    const info = within(
      screen.getByRole("heading", { name: "Πληροφορίες τμήματος" }).closest("section")!,
    );
    expect(info.getByText("Κ. Γεωργίου", { selector: "dd" })).toBeInTheDocument();
    expect(info.getByText("4", { selector: "dd" })).toBeInTheDocument();
    // The class's person in charge is also its contact, looked up again rather
    // than typed twice.
    const contacts = within(
      screen.getByRole("heading", { name: "Επαφές και διαδικασίες" }).closest("section")!,
    );
    expect(contacts.getByText("Κ. Γεωργίου", { selector: "dd" })).toBeInTheDocument();
    // This week's plan, from the weekly plan — not last week's.
    expect(screen.getByText(/Κεφάλαιο 4 — εξισώσεις/)).toBeInTheDocument();
    expect(screen.queryByText(/Κεφάλαιο 3/)).not.toBeInTheDocument();
    // Who needs attention, from the students' cards.
    const attention = screen.getByRole("list", { name: "ΜΑΘΗΤΕΣ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΠΡΟΣΟΧΗ" });
    expect(within(attention).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Ελένη Παπαδοπούλου — Προσαρμογές · Στήριξη στο τμήμα: Κάθεται μπροστά · Αλλεργίες: Φιστίκια",
      "Μαρία Ιωάννου — Φάρμακα: Εισπνοές πριν τη γυμναστική",
    ]);
  });

  it("offers no way to write a plan, a seat or a roster from the folder", async () => {
    const backend = mountFolder();
    // The week and the seating are shown, never edited, here.
    expect(within(screen.getByRole("list", { name: "Πλάνο αίθουσας" })).queryByRole("combobox")).toBeNull();
    expect(within(screen.getByRole("table", { name: "Πλάνο εβδομάδας" })).queryByRole("textbox")).toBeNull();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("ΣΤΟΧΟΣ ΤΗΣ ΜΕΡΑΣ"), " — και ένα παιχνίδι");
    await user.tab();
    await waitFor(() =>
      expect(backend.calls.some((c) => c.command === "set_substitute_text")).toBe(true),
    );
    for (const command of ["save_seating", "save_lesson_plan", "set_enrollment", "save_class"]) {
      expect(backend.calls.some((c) => c.command === command)).toBe(false);
    }
  });

  /**
   * Prefilled once, then the teacher's. The suggestion shows until she writes
   * her own; what she writes stays — **including nothing at all**, which must
   * not bring the suggestion back — and only *Επαναφορά* does.
   */
  it("keeps the teacher's text, even an empty one, until she asks for the suggestion back", async () => {
    const backend = mountFolder();
    const user = userEvent.setup();
    const box = () => screen.getByLabelText("ΤΙ ΝΑ ΚΑΝΕΤΕ ΣΕ ΠΕΡΙΠΤΩΣΗ ΠΡΟΒΛΗΜΑΤΟΣ");

    // Untouched: the suggestion, and no row behind it.
    expect((box() as HTMLTextAreaElement).value).toMatch(/^Για οποιοδήποτε σοβαρό θέμα/);
    expect(backend.planner.substitute_texts.some((s) => s.field === "problem")).toBe(false);

    // Cleared: stored as an empty row, and still empty afterwards.
    await user.clear(box());
    await user.tab();
    await waitFor(() =>
      expect(
        backend.planner.substitute_texts.find((s) => s.class_id === A1 && s.field === "problem"),
      ).toEqual({ class_id: A1, field: "problem", value: "" }),
    );
    expect(box()).toHaveValue("");

    // …and still empty after the app is closed and opened again.
    const stored = structuredClone(backend.planner);
    cleanup();
    invoke.mockReset();
    const again = mountFolder(stored);
    const user2 = userEvent.setup();
    expect(box()).toHaveValue("");

    // Written: her words.
    await user2.type(box(), "Καλέστε τη Διεύθυνση στο 101.");
    await user2.tab();
    await waitFor(() =>
      expect(
        again.planner.substitute_texts.find((s) => s.class_id === A1 && s.field === "problem")?.value,
      ).toBe("Καλέστε τη Διεύθυνση στο 101."),
    );

    // Reset: the row is gone, and the suggestion is back.
    const group = box().closest(".folder-text") as HTMLElement;
    await user2.click(within(group).getByRole("button", { name: "Επαναφορά προτεινόμενου" }));
    await waitFor(() =>
      expect(again.planner.substitute_texts.some((s) => s.field === "problem")).toBe(false),
    );
    expect((box() as HTMLTextAreaElement).value).toMatch(/^Για οποιοδήποτε σοβαρό θέμα/);
  });

  it("types the school's contacts once, for every class's folder", async () => {
    const backend = mountFolder();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Γραμματεία"), "22 654321");
    await user.tab();
    await waitFor(() =>
      expect(backend.planner.substitute_school_texts.find((s) => s.field === "contact.office")?.value).toBe(
        "22 654321",
      ),
    );

    await user.click(
      within(screen.getByRole("list", { name: "Τμήμα" })).getByRole("button", { name: /Β2/ }),
    );
    expect(screen.getByLabelText("Γραμματεία")).toHaveValue("22 654321");
  });

  /**
   * M7's third acceptance criterion from the screen: one button, one call,
   * one file with the cover and all five pages in it — never five exports.
   * The page count of the real file is measured on both operating systems.
   */
  it("exports the whole folder as one landscape file with six sheets in it", async () => {
    const backend = mountFolder();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Εξαγωγή φακέλου σε PDF" }));
    await waitFor(() =>
      expect(backend.calls.filter((c) => c.command === "export_pdf")).toHaveLength(1),
    );
    const call = backend.calls.find((c) => c.command === "export_pdf")!;
    expect(call.args.landscape).toBe(true);
    expect(call.args.fileName).toBe("Φάκελος αναπλήρωσης — Α1 — 04.11.2026");
    const html = String(call.args.html);
    expect(html.match(/data-sheet /g)).toHaveLength(6);
    for (const title of [
      "Πληροφορίες τμήματος",
      "Πλάνο εβδομάδας",
      "Πλάνο αίθουσας",
      "Πλάνο μιας μέρας",
      "Επαφές και διαδικασίες",
    ]) {
      expect(html).toContain(`<h1>${title}</h1>`);
    }
  });

  it("asks for a class when there is none", () => {
    const planner = formsPlanner();
    planner.classes = [];
    mountFolder(planner);
    expect(screen.getByText(/Ο φάκελος φτιάχνεται για κάθε τμήμα χωριστά/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Εξαγωγή φακέλου σε PDF" })).toBeNull();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { createFakeBackend, emptyPlanner } = await import("../helpers/fakeBackend");
const { default: App } = await import("../../src/App");

type Backend = ReturnType<typeof createFakeBackend>;

function mount(planner = emptyPlanner()): Backend {
  const backend = createFakeBackend(planner);
  invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    try {
      return Promise.resolve(backend.handle(command, args));
    } catch (e) {
      return Promise.reject(e);
    }
  });
  render(<App />);
  return backend;
}

describe("the app shell", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("opens on the year section and moves between the sections", async () => {
    mount();
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Τάξεις" }));
    expect(await screen.findByRole("heading", { name: "Τα τμήματά μου" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Μαθητές" }));
    expect(await screen.findByRole("heading", { name: "Ευρετήριο μαθητών" })).toBeInTheDocument();
  });

  it("shows where the data lives, including the schema version", async () => {
    mount();
    expect(await screen.findByText("/Drive/Ατζέντα/data/planner.sqlite")).toBeInTheDocument();
    // M7's forward migration: `user_version = 8`. This line is also the
    // cheapest check that a manual pass is looking at the build under test —
    // see the bundle-identifier hazard in `docs/MILESTONE_PROMPT.md`.
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("reaches the four M3 sections", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    for (const [tab, heading] of [
      ["Πρόγραμμα", "Ωρολόγιο πρόγραμμα"],
      ["Πλάνο", "Εβδομαδιαίο πλάνο"],
      ["Ατζέντα", "Ατζέντα"],
      ["Σημερινό", "Σημερινό μάθημα"],
    ]) {
      await user.click(screen.getByRole("button", { name: tab }));
      expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  /**
   * The shell is the single place the calendar is read, and it takes an override
   * so every screen below it can be driven to a chosen day. This is what makes
   * M3's "on a spot-checked date" criterion testable rather than a matter of
   * waiting for the right weekday.
   */
  it("reads the calendar once, at the shell, and passes the day down", async () => {
    const backend = createFakeBackend(emptyPlanner());
    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      try {
        return Promise.resolve(backend.handle(command, args));
      } catch (e) {
        return Promise.reject(e);
      }
    });
    // A Wednesday in the middle of the school year.
    render(<App today="2026-09-16" />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Σημερινό" }));
    expect(await screen.findByText("Τετάρτη 16.09.2026")).toBeInTheDocument();
  });

  /**
   * M0's headline safety requirement, now standing in front of real data: a
   * save against a file the cloud sync replaced is refused, and the only way
   * forward is an explicit reload.
   */
  it("blocks editing and offers a reload when the file changed on disk", async () => {
    const backend = mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    backend.markDiskChanged();
    await user.type(screen.getByLabelText("Πρώτη Δευτέρα της εβδομάδας 1"), "2026-09-14");
    await user.click(screen.getAllByRole("button", { name: "Αποθήκευση" })[0]);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Το αρχείο δεδομένων άλλαξε στον δίσκο");
    // There is deliberately no "save anyway": every control in the section is
    // disabled until the teacher reloads.
    await waitFor(() =>
      expect(screen.getByLabelText("Πρώτη Δευτέρα της εβδομάδας 1")).toBeDisabled(),
    );
    expect(screen.getAllByRole("button", { name: "Αποθήκευση" })[0]).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Επαναφόρτωση από τον δίσκο" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Πρώτη Δευτέρα της εβδομάδας 1")).toBeEnabled();
  });

  it("blocks immediately when the status already reports the file changed", async () => {
    const backend = createFakeBackend(emptyPlanner());
    backend.markDiskChanged();
    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      try {
        return Promise.resolve(backend.handle(command, args));
      } catch (e) {
        return Promise.reject(e);
      }
    });
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Το αρχείο δεδομένων άλλαξε στον δίσκο",
    );
  });

  it("reports a written snapshot", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Δημιουργία αντιγράφου τώρα" }));
    expect(await screen.findByText(/planner-2026-09-19-0730\.sqlite/)).toBeInTheDocument();
  });

  /**
   * **The top row, pinned — so a later agent does not quietly add to it.**
   *
   * It was eight from M0 to M4.5. M4 added four surfaces and no tabs, because
   * the spec files those under two sections the app already had and the source
   * product reaches each from its module's own index page; they are sub-tabs
   * inside those sections and this test is what keeps them there.
   *
   * **M5 makes it nine, deliberately.** Its module — the spec's "5. Γονείς &
   * Ομάδα" — is the first since M0 with no existing section to belong to:
   * nothing in the app was about parents or about staff meetings. The source
   * product carries ΓΟΝΕΙΣ and ΟΜΑΔΑ as two separate top-level items, which
   * would have made ten; M5 takes **one** tab, named after the spec's module
   * rather than after either half, with all five of its surfaces filed under it
   * as sub-pages. So the number moved by one, once, for a module that had
   * nowhere else to go — not because the rule was relaxed.
   */
  /**
   * (M6, kept for the record.) **Still nine after M6**, and this is the deliberate check the M5 note asked
   * the next agent to make. M6 adds seven surfaces and no tab: the spec files
   * every one of them under module 3, which the app already had as `Πλάνο`, so
   * they went in as sub-pages — M4's shape. The number moved from eight to nine
   * at M5, because that module had no section to belong to; nothing about M6
   * moves it again.
   */
  /**
   * **Ten after M7 — moved by one, deliberately, and only by one.** M7's two
   * halves are opposite kinds of thing and are filed apart on purpose:
   *
   * * the **substitute folder** is generated per class from the class's own
   *   data, so it is a sub-page of `Τάξεις` — M4's and M6's shape, no new tab;
   * * the **eleven print forms** belong to no class, student or record, so no
   *   existing section is honest about holding them — M5's situation — and
   *   they take **one** new section, `Πρότυπα`, the source's own word.
   *
   * Putting both under one new tab would have cost the same one place and put
   * a live view of a class's seating beside a blank room plan with nothing
   * behind it, which is the confusion M7 is built to avoid.
   */
  /**
   * **Eleven after M8 — moved by one, deliberately, and only by one.** M8's
   * four surfaces come from two spec modules and are filed apart:
   *
   * * the **staff directory** and the **covers/leave registers** are module 1,
   *   and the source's own ΕΤΟΣ index lists them — so they are sub-pages of
   *   `Έτος`, which gets its first sub-row (M6's move on `Πλάνο`), no new tab;
   * * **development** and **wellbeing** are module 7, which had no section —
   *   M5's situation — so they take **one** new section, `Ανάπτυξη & Ευεξία`,
   *   where the source puts ΕΥΕΞΙΑ and ΑΝΑΠΤΥΞΗ: just before ΣΗΜΕΡΙΝΟ.
   *
   * Filing development goals under `Έτος` instead would have cost no tab and
   * put them beside the annual area called "Επαγγελματική ανάπτυξη" — the
   * very pair M8's first criterion says must stay visibly separate.
   */
  it("keeps the top row to eleven sections after M8", async () => {
    mount();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    const top = screen.getAllByRole("navigation")[0];
    expect(within(top).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Έτος",
      "Τάξεις",
      "Μαθητές",
      "Βαθμοί",
      "Πρόγραμμα",
      "Πλάνο",
      "Ατζέντα",
      "Γονείς & Ομάδα",
      "Πρότυπα",
      "Ανάπτυξη & Ευεξία",
      "Σημερινό",
    ]);
  });

  /**
   * The folder is filed with the class it is generated from; the forms, which
   * belong to nothing, have their own section. Τάξεις still opens on the class
   * list, unmoved.
   */
  it("files the substitute folder under Τάξεις and the print forms on their own", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Τάξεις" }));
    expect(await screen.findByRole("heading", { name: "Τα τμήματά μου" })).toBeInTheDocument();
    const sub = screen.getAllByRole("navigation")[1];
    expect(within(sub).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Τμήματα",
      "Φάκελος αναπλήρωσης",
    ]);
    await user.click(within(sub).getByRole("button", { name: "Φάκελος αναπλήρωσης" }));
    expect(
      await screen.findByRole("heading", { name: "Φάκελος αναπλήρωσης" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Πρότυπα" }));
    expect(
      await screen.findByRole("heading", { name: "Πρότυπα για εκτύπωση" }),
    ).toBeInTheDocument();
    // A section with no sub-pages: the forms are one screen.
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  /**
   * M5's five surfaces are sub-pages of the one new section, which is M4's
   * shape and the reason the top row grew by one rather than by five.
   */
  it("files all five M5 surfaces under the one new section", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Γονείς & Ομάδα" }));
    // It opens on the communication log, the first sub-page.
    expect(
      await screen.findByRole("heading", { name: "Επικοινωνία με τους γονείς" }),
    ).toBeInTheDocument();

    const sub = screen.getAllByRole("navigation")[1];
    expect(within(sub).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Επικοινωνία",
      "Συναντήσεις",
      "Συνεδριάσεις",
      "Επιστολές",
      "Μηνύματα",
    ]);

    await user.click(within(sub).getByRole("button", { name: "Επιστολές" }));
    expect(
      await screen.findByRole("heading", { name: "Έτοιμες επιστολές προς γονείς" }),
    ).toBeInTheDocument();

    await user.click(within(sub).getByRole("button", { name: "Μηνύματα" }));
    expect(await screen.findByRole("heading", { name: "Τράπεζα μηνυμάτων" })).toBeInTheDocument();
  });

  /**
   * M6's seven surfaces are sub-pages of `Πλάνο`, which had none before: M3
   * built only the weekly plan. The source product reaches all of them from its
   * own ΠΛΑΝΟ index page, so this row is that index.
   */
  it("files all seven M6 surfaces under Πλάνο, which keeps its weekly plan first", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Πλάνο" }));
    // It opens on the weekly plan — M3's screen, unmoved.
    expect(await screen.findByRole("heading", { name: "Εβδομαδιαίο πλάνο" })).toBeInTheDocument();

    const sub = screen.getAllByRole("navigation")[1];
    expect(within(sub).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Εβδομάδα",
      "Ετήσιο πλάνο",
      "Πρόοδος τμημάτων",
      "Εξετάσεις",
      "Αναστοχασμός",
      "Εκδρομές",
      "Βιβλία & υλικά",
    ]);

    for (const [tab, heading] of [
      ["Ετήσιο πλάνο", "Ετήσιο πλάνο"],
      ["Πρόοδος τμημάτων", "Ανάπτυξη ανά τμήμα"],
      ["Εξετάσεις", "Προγραμματισμένες εξετάσεις"],
      ["Αναστοχασμός", "Αναστοχασμός μαθημάτων"],
      ["Εκδρομές", "Εκδρομές και επισκέψεις"],
      ["Βιβλία & υλικά", "Σχολικά βιβλία και υλικά"],
    ]) {
      await user.click(within(sub).getByRole("button", { name: tab }));
      expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("files attendance under Βαθμοί, as the spec and the source product do", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Βαθμοί" }));
    // It opens on the gradebook, not on the new sub-page.
    expect(await screen.findByRole("heading", { name: "Μητρώο βαθμών" })).toBeInTheDocument();

    const sub = screen.getAllByRole("navigation")[1];
    expect(within(sub).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Βαθμολόγιο",
      "Απουσίες",
    ]);

    await user.click(within(sub).getByRole("button", { name: "Απουσίες" }));
    expect(await screen.findByRole("heading", { name: "Απουσίες του μήνα" })).toBeInTheDocument();
    // The register panel needs a class to exist; this planner has none, so it
    // asks for one. What that panel does with a class is AttendanceScreen's
    // own test file — this one is about where the surface is filed.
    expect(screen.getByText(/Δεν υπάρχει ακόμη τμήμα/)).toBeInTheDocument();
  });

  it("files the incident log and support plans under Μαθητές", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Μαθητές" }));
    expect(await screen.findByRole("heading", { name: "Ευρετήριο μαθητών" })).toBeInTheDocument();

    const sub = () => screen.getAllByRole("navigation")[1];
    expect(within(sub()).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Καρτέλες",
      "Περιστατικά",
      "Στήριξη",
    ]);

    await user.click(within(sub()).getByRole("button", { name: "Περιστατικά" }));
    expect(
      await screen.findByRole("heading", { name: "Διαγωγή και περιστατικά" }),
    ).toBeInTheDocument();

    await user.click(within(sub()).getByRole("button", { name: "Στήριξη" }));
    expect(await screen.findByRole("heading", { name: "Πλάνα στήριξης" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Στήριξη και προσαρμογές" }),
    ).toBeInTheDocument();
  });

  it("returns a section to its first sub-page when it is left and re-entered", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Μαθητές" }));
    await user.click(
      within(screen.getAllByRole("navigation")[1]).getByRole("button", { name: "Στήριξη" }),
    );
    await screen.findByRole("heading", { name: "Πλάνα στήριξης" });

    // Έτος has had sub-pages since M8, so it too opens on its first — the
    // school year — rather than on whichever one was left open.
    await user.click(screen.getByRole("button", { name: "Έτος" }));
    await user.click(
      within(screen.getAllByRole("navigation")[1]).getByRole("button", {
        name: "Αναπληρώσεις & άδειες",
      }),
    );
    await screen.findByRole("heading", { name: "Οι άδειές μου" });
    await user.click(screen.getByRole("button", { name: "Πρότυπα" }));
    // A section with no sub-pages shows no second row at all.
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Έτος" }));
    expect(await screen.findByRole("heading", { name: "Στόχοι για τη χρονιά" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Μαθητές" }));
    expect(await screen.findByRole("heading", { name: "Ευρετήριο μαθητών" })).toBeInTheDocument();
  });

  it("passes today down to the attendance grid rather than letting it read the clock", async () => {
    const backend = createFakeBackend(emptyPlanner());
    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      try {
        return Promise.resolve(backend.handle(command, args));
      } catch (e) {
        return Promise.reject(e);
      }
    });
    backend.planner.classes = [
      {
        id: 1,
        name: "Α1",
        subject: "",
        room: "",
        responsible: "",
        notes: "",
        position: 0,
        seating_rows: 5,
        seating_cols: 6,
        seating_notes: "",
      },
    ];
    render(<App today="2027-03-04" />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await user.click(screen.getByRole("button", { name: "Βαθμοί" }));
    await user.click(
      within(screen.getAllByRole("navigation")[1]).getByRole("button", { name: "Απουσίες" }),
    );
    expect(await screen.findByText(/Μάρτιος 2027/)).toBeInTheDocument();
  });
});

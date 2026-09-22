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
    // M3's forward migration: `user_version = 4`.
    expect(screen.getByText("5")).toBeInTheDocument();
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
   * **M4 adds four surfaces and no top-level tabs.** The spec files them under
   * two sections the app already has, and the source product reaches each from
   * its module's own index page, so they are sub-tabs inside those sections.
   * This pins the arrangement so a later agent does not quietly add four more
   * things to the top row.
   */
  it("keeps eight top-level sections after M4", async () => {
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
      "Σημερινό",
    ]);
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

    await user.click(screen.getByRole("button", { name: "Έτος" }));
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    // A section with no sub-pages shows no second row at all.
    expect(screen.getAllByRole("navigation")).toHaveLength(1);

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

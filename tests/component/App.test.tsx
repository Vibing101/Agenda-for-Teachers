import { render, screen, waitFor } from "@testing-library/react";
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

  it("opens on the year section and moves between the three M1 sections", async () => {
    mount();
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Τάξεις" }));
    expect(await screen.findByRole("heading", { name: "Τα τμήματά μου" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Μαθητές" }));
    expect(await screen.findByRole("heading", { name: "Ευρετήριο μαθητών" })).toBeInTheDocument();
  });

  it("shows where the data lives, including the M1 schema version", async () => {
    mount();
    expect(await screen.findByText("/Drive/Ατζέντα/data/planner.sqlite")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
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
});

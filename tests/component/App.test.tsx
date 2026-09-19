import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

/**
 * The Tauri command bridge is mocked at the `invoke` boundary, so these tests
 * cover the frontend's behaviour — above all the block-and-reload path, which
 * is M0's headline safety requirement.
 */
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const baseStatus = {
  app_folder: "/Drive/Agenda",
  db_path: "/Drive/Agenda/data/planner.sqlite",
  db_exists: true,
  schema_version: 1,
  backup_count: 2,
  last_backup: "2026-09-19T07:30:00+03:00",
  disk_changed: false,
};

function mockBackend(overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {
    status: () => baseStatus,
    load: () => ({ note: "existing note" }),
    reload: () => ({ note: "the other device's note" }),
    save: () => undefined,
    make_backup: () => "/Drive/Agenda/data/backups/planner-2026-09-19-0730.sqlite",
    ...overrides,
  };
  invoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
    const handler = handlers[cmd];
    if (!handler) return Promise.reject(new Error(`unexpected command ${cmd}`));
    try {
      return Promise.resolve(handler(args));
    } catch (e) {
      return Promise.reject(e);
    }
  });
}

describe("App", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("loads the saved note and shows where the data lives", async () => {
    mockBackend();
    render(<App />);

    expect(await screen.findByDisplayValue("existing note")).toBeInTheDocument();
    expect(await screen.findByText("/Drive/Agenda/data/planner.sqlite")).toBeInTheDocument();
  });

  it("saves what was typed", async () => {
    mockBackend();
    const user = userEvent.setup();
    render(<App />);

    const box = await screen.findByLabelText("Persistence check");
    await user.clear(box);
    await user.type(box, "Α1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("save", { note: "Α1" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("blocks saving and offers a reload when the file changed on disk", async () => {
    mockBackend({
      save: () => {
        throw { code: "disk_changed", message: "the data file changed on disk" };
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByDisplayValue("existing note");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The data file changed on disk");
    // The save button is disabled: there is deliberately no "save anyway".
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reload from disk" }));
    expect(await screen.findByDisplayValue("the other device's note")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("blocks immediately when the status reports the file already changed", async () => {
    mockBackend({ status: () => ({ ...baseStatus, disk_changed: true }) });
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("The data file changed on disk");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
  });

  it("reports a written snapshot", async () => {
    mockBackend();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByDisplayValue("existing note");
    await user.click(screen.getByRole("button", { name: "Back up now" }));

    expect(await screen.findByText(/planner-2026-09-19-0730\.sqlite/)).toBeInTheDocument();
  });
});

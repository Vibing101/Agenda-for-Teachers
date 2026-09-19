import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { api, isAppError } = await import("../../src/api");

describe("isAppError", () => {
  it("recognises the Rust error shape", () => {
    expect(isAppError({ code: "disk_changed", message: "changed" })).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAppError(new Error("boom"))).toBe(false);
    expect(isAppError("boom")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("api", () => {
  it("passes the note through to the save command", async () => {
    invoke.mockResolvedValue(undefined);
    await api.save("Α1 — σημείωση");
    expect(invoke).toHaveBeenCalledWith("save", { note: "Α1 — σημείωση" });
  });
});

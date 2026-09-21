import { describe, expect, it, vi } from "vitest";
import { emptyStudent } from "../../src/domain/types";

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
  it("passes a student card through to the save command", async () => {
    invoke.mockResolvedValue(undefined);
    const student = { ...emptyStudent(), full_name: "Ελένη Παπαδοπούλου" };
    await api.saveStudent(student);
    expect(invoke).toHaveBeenCalledWith("save_student", { student });
  });

  it("names the class argument `class`, as the Rust command expects", async () => {
    invoke.mockResolvedValue(undefined);
    await api.saveClass({
      id: 3,
      name: "Α1",
      subject: "",
      room: "",
      responsible: "",
      notes: "",
      position: 0,
      seating_rows: 5,
      seating_cols: 6,
      seating_notes: "",
    });
    expect(invoke).toHaveBeenCalledWith("save_class", { class: expect.objectContaining({ id: 3 }) });
  });

  it("sends enrollment removals as camelCase arguments, which Tauri maps to snake_case", async () => {
    invoke.mockResolvedValue(undefined);
    await api.removeEnrollment(1, 2);
    expect(invoke).toHaveBeenCalledWith("remove_enrollment", { classId: 1, studentId: 2 });
  });
});

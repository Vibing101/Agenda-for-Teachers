/**
 * The behaviour/incident log.
 *
 * Two things carry weight here:
 *
 * * **"Follows the student" is the whole point of this register**, so it is
 *   checked from both sides: the same entry is reachable from either class the
 *   student is in, and an entry naming no class at all is still hers.
 * * **The "new record" trap**, from a planner that already holds three
 *   incidents, with the siblings asserted byte-for-byte unchanged.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { supportPlanner, A1, ELENI, MARIA } = await import("../helpers/supportFixture");
const { default: BehaviourScreen } = await import("../../src/screens/BehaviourScreen");

describe("the incident log", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("asks for a student before offering to record anything", () => {
    renderScreen(BehaviourScreen, emptyPlanner(), invoke);
    expect(screen.getByText(/Δεν υπάρχει ακόμη μαθητής/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Νέο περιστατικό" })).toBeDisabled();
  });

  it("lists every entry newest first, with the source register's own fields", () => {
    renderScreen(BehaviourScreen, supportPlanner(), invoke);
    expect(screen.getByText("3 περιστατικά")).toBeInTheDocument();

    const first = within(screen.getByRole("group", { name: "Περιστατικό 1" }));
    expect(first.getByLabelText("Ημερομηνία")).toHaveValue("2026-11-06");
    expect(first.getByLabelText("Μαθητής")).toHaveValue(String(ELENI));
    expect(first.getByLabelText("Τάξη")).toHaveValue(String(A1));
    expect(first.getByLabelText("Τι συνέβη")).toHaveValue("Διαφωνία στο διάλειμμα");
    expect(first.getByLabelText("Ενέργεια που έγινε")).toHaveValue("Συζήτηση με τους δύο μαθητές");
    expect(first.getByLabelText("Γονείς ενημερώθηκαν")).toBeChecked();
  });

  it("keeps the class optional, as the source's Τάξη column is", () => {
    renderScreen(BehaviourScreen, supportPlanner(), invoke);
    // The 30.09 entry names no class.
    const third = within(screen.getByRole("group", { name: "Περιστατικό 3" }));
    expect(third.getByLabelText("Ημερομηνία")).toHaveValue("2026-09-30");
    expect(third.getByLabelText("Τάξη")).toHaveValue("0");
  });

  it("follows the student: filtering by either of her classes finds her entries", async () => {
    const user = userEvent.setup();
    renderScreen(BehaviourScreen, supportPlanner(), invoke);

    // Ελένη is in Α1 and Β2. Her Α1-recorded entry and her class-less entry are
    // hers from both, so filtering by Β2 finds them even though neither names Β2.
    await user.selectOptions(screen.getByLabelText("Φίλτρο τμήματος"), "2");
    await waitFor(() => expect(screen.getByText("3 περιστατικά")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Φίλτρο τμήματος"), "1");
    // Α1's roster is Ελένη, Νίκος and Κώστας — so Μαρία's entry drops out.
    await waitFor(() => expect(screen.getByText("2 περιστατικά")).toBeInTheDocument());
  });

  it("filters by student without changing what is stored", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(BehaviourScreen, supportPlanner(), invoke);
    const before = structuredClone(backend.planner.incidents);

    await user.selectOptions(screen.getByLabelText("Φίλτρο μαθητή"), String(MARIA));
    await waitFor(() => expect(screen.getByText("1 περιστατικά")).toBeInTheDocument());
    expect(screen.getByRole("group", { name: "Περιστατικό 1" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Περιστατικό 2" })).not.toBeInTheDocument();

    // A filter is a view, not an edit.
    expect(backend.planner.incidents).toEqual(before);
    expect(backend.calls.some((c) => c.command === "save_incident")).toBe(false);
  });

  it("says so when a filter matches nothing, rather than looking empty", async () => {
    const user = userEvent.setup();
    renderScreen(BehaviourScreen, supportPlanner(), invoke);
    // Κώστας has no incidents at all.
    await user.selectOptions(screen.getByLabelText("Φίλτρο μαθητή"), "24");
    await waitFor(() =>
      expect(screen.getByText(/Κανένα περιστατικό δεν ταιριάζει/)).toBeInTheDocument(),
    );
  });

  /** **The "new record" trap, from a planner that already holds records.** */
  it("leaves every existing entry byte-for-byte unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(BehaviourScreen, supportPlanner(), invoke);
    const before = structuredClone(backend.planner.incidents);
    expect(before).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Νέο περιστατικό" }));
    await waitFor(() => expect(backend.planner.incidents).toHaveLength(4));

    for (const original of before) {
      expect(backend.planner.incidents.find((i) => i.id === original.id)).toEqual(original);
    }
    const created = backend.planner.incidents.find((i) => !before.some((b) => b.id === i.id))!;
    expect(created.what_happened).toBe("");
    expect(created.action_taken).toBe("");
    expect(created.parents_informed).toBe(false);
  });

  it("writes an edited entry to that entry only", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(BehaviourScreen, supportPlanner(), invoke);
    const before = structuredClone(backend.planner.incidents);

    const first = within(screen.getByRole("group", { name: "Περιστατικό 1" }));
    const action = first.getByLabelText("Ενέργεια που έγινε");
    await user.clear(action);
    await user.type(action, "Ενημέρωση υπεύθυνου τμήματος");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.incidents.find((i) => i.id === 71)!.action_taken).toBe(
        "Ενημέρωση υπεύθυνου τμήματος",
      ),
    );
    for (const id of [72, 73]) {
      expect(backend.planner.incidents.find((i) => i.id === id)).toEqual(
        before.find((i) => i.id === id),
      );
    }
    // The edited entry kept everything else it had.
    const edited = backend.planner.incidents.find((i) => i.id === 71)!;
    expect(edited.what_happened).toBe("Διαφωνία στο διάλειμμα");
    expect(edited.parents_informed).toBe(true);
    expect(edited.date).toBe("2026-11-06");
  });

  it("ticks the parents-informed flag on the entry it belongs to", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(BehaviourScreen, supportPlanner(), invoke);

    const second = within(screen.getByRole("group", { name: "Περιστατικό 2" }));
    await user.click(second.getByLabelText("Γονείς ενημερώθηκαν"));

    await waitFor(() =>
      expect(backend.planner.incidents.find((i) => i.id === 73)!.parents_informed).toBe(true),
    );
    expect(backend.planner.incidents.find((i) => i.id === 72)!.parents_informed).toBe(false);
  });

  it("deletes one entry and leaves the rest", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(BehaviourScreen, supportPlanner(), invoke);

    const first = within(screen.getByRole("group", { name: "Περιστατικό 1" }));
    await user.click(first.getByRole("button", { name: "Διαγραφή περιστατικού" }));

    await waitFor(() => expect(backend.planner.incidents).toHaveLength(2));
    expect(backend.planner.incidents.map((i) => i.id).sort()).toEqual([72, 73]);
  });
});

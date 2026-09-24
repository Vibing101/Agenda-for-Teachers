/**
 * The eleven print forms, driven through the real screen.
 *
 * **M7's first acceptance criterion, for every one of the eleven**: a form is
 * created, filled, saved under a custom name, **reopened** — the screen torn
 * down and mounted again from what the backend stored, as a relaunch would —
 * and re-edited.
 *
 * **Every "new form" test starts from a planner that already holds saved
 * forms**, and asserts they come back byte-for-byte. That is the rule M1's
 * `Νέο τμήμα` data-loss bug bought, and a named, saved, reopenable record is
 * the create-then-edit shape at its most exposed.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { default: FormsScreen } = await import("../../src/screens/FormsScreen");
const { formsPlanner, ROOM_FORM, NOTE_FORM, GOALS_FORM } = await import("../helpers/formsFixture");
import type { Planner } from "../../src/domain/types";
import type { PrintFormKind } from "../../src/i18n/vocabularies";

const TODAY = "2026-11-04";

function mountForms(planner: Planner = formsPlanner()) {
  return renderScreen(FormsScreen, planner, invoke, { today: TODAY });
}

/**
 * For each form: how to reach one representative input, what to type into
 * it, and the key it must be stored under. Every kind of part is covered at
 * least once across the eleven — a register cell, a box, a desk, a tick, a
 * field inside a repeated card.
 */
const CASES: {
  kind: PrintFormKind;
  title: string;
  label: string;
  group?: string;
  key: string;
  tick?: boolean;
}[] = [
  { kind: "attendance", title: "Απουσίες του μήνα", label: "Ονοματεπώνυμο, γραμμή 1", key: "reg.1.name" },
  { kind: "parentLog", title: "Επικοινωνία με γονείς", label: "Μαθητής, γραμμή 1", key: "reg.1.student" },
  { kind: "coverLesson", title: "Πλάνο αναπλήρωσης", label: "ΕΡΓΑΣΙΑ ΤΗΣ ΩΡΑΣ", key: "work" },
  { kind: "minutes", title: "Πρακτικό συνεδρίασης", label: "ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΞΗ", key: "agenda" },
  { kind: "priorities", title: "Προτεραιότητες της εβδομάδας", label: "ΠΡΟΤΕΡΑΙΟΤΗΤΕΣ", key: "priorities" },
  { kind: "roomPlan", title: "Πλάνο αίθουσας", label: "Θρανίο: σειρά 1, θέση 1", key: "desk.1.1" },
  {
    kind: "credentials",
    title: "Κωδικοί και πρόσβαση",
    label: "Πλατφόρμα / υπηρεσία, γραμμή 1",
    key: "reg.1.platform",
  },
  {
    kind: "periodChecklist",
    title: "Λίστα ελέγχου της περιόδου",
    label: "Οι λίστες μαθητών ενημερώθηκαν",
    key: "start.rosters",
    tick: true,
  },
  {
    kind: "parentNote",
    title: "Σημείωμα προς γονείς",
    label: "ΠΕΡΙΕΧΟΜΕΝΟ",
    group: "Σημείωμα 1",
    key: "note.1.body",
  },
  { kind: "loans", title: "Δανεισμοί υλικού και βοηθημάτων", label: "Δόθηκε σε, γραμμή 1", key: "reg.1.to" },
  {
    kind: "goals",
    title: "Στόχοι και επαγγελματική ανάπτυξη",
    label: "ΣΤΟΧΟΣ",
    group: "Στόχος 1",
    key: "goal.1.goal",
  },
];

function pickForm(user: ReturnType<typeof userEvent.setup>, title: string) {
  return user.click(within(screen.getByRole("list", { name: "Πρότυπο" })).getByRole("button", { name: title }));
}

function input(c: (typeof CASES)[number]) {
  const scope = c.group ? within(screen.getByRole("group", { name: c.group })) : screen;
  return c.tick ? scope.getByRole("checkbox", { name: c.label }) : scope.getByLabelText(c.label);
}

describe("every one of the eleven print forms", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it.each(CASES)(
    "$title can be filled, saved under a custom name, reopened and re-edited",
    async (c) => {
      let backend = mountForms();
      const before = structuredClone(backend.planner.print_forms);
      let user = userEvent.setup();

      // Filled…
      await pickForm(user, c.title);
      await user.click(screen.getByRole("button", { name: "Νέο έντυπο" }));
      await waitFor(() => expect(backend.planner.print_forms).toHaveLength(before.length + 1));
      const created = backend.planner.print_forms.find((f) => !before.some((b) => b.id === f.id))!;
      expect(created.kind).toBe(c.kind);

      // …saved under a custom name…
      const name = screen.getByLabelText("Όνομα εντύπου");
      await user.type(name, `Δικό μου ${c.title}`);
      await user.tab();
      if (c.tick) {
        await user.click(input(c));
      } else {
        await user.type(input(c), "Πρώτη εκδοχή");
        await user.tab();
      }
      await waitFor(() => {
        const saved = backend.planner.print_forms.find((f) => f.id === created.id)!;
        expect(saved.name).toBe(`Δικό μου ${c.title}`);
        expect(saved.values[c.key]).toBe(c.tick ? "1" : "Πρώτη εκδοχή");
      });

      // The forms that were already there are exactly as they were.
      for (const form of before) {
        expect(backend.planner.print_forms.find((f) => f.id === form.id)).toEqual(form);
      }

      // …reopened: the screen is torn down and mounted again from what was
      // stored, as a relaunch would, and the form is picked by its name…
      const stored = structuredClone(backend.planner);
      cleanup();
      invoke.mockReset();
      backend = mountForms(stored);
      user = userEvent.setup();
      await pickForm(user, c.title);
      await user.click(
        within(screen.getByRole("list", { name: "Αποθηκευμένα έντυπα" })).getByRole("button", {
          name: new RegExp(`Δικό μου ${c.title}`),
        }),
      );
      expect(screen.getByLabelText("Όνομα εντύπου")).toHaveValue(`Δικό μου ${c.title}`);
      if (c.tick) expect(input(c)).toBeChecked();
      else expect(input(c)).toHaveValue("Πρώτη εκδοχή");

      // …and re-edited.
      if (c.tick) {
        await user.click(input(c));
      } else {
        await user.clear(input(c));
        await user.type(input(c), "Δεύτερη εκδοχή");
        await user.tab();
      }
      await waitFor(() => {
        const saved = backend.planner.print_forms.find((f) => f.id === created.id)!;
        if (c.tick) expect(saved.values[c.key]).toBeUndefined();
        else expect(saved.values[c.key]).toBe("Δεύτερη εκδοχή");
        expect(saved.name).toBe(`Δικό μου ${c.title}`);
        expect(saved.updated).toBe(TODAY);
      });
      for (const form of before) {
        expect(backend.planner.print_forms.find((f) => f.id === form.id)).toEqual(form);
      }
    },
    // The 31-day attendance card is thirty rows of thirty-two inputs, mounted
    // twice here; jsdom takes a few seconds over it when the whole suite runs
    // at once. A real webview does not.
    20_000,
  );
});

describe("the forms screen", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  /**
   * The create-then-edit rule where it bites hardest: a saved room plan is
   * already open when "Νέο έντυπο" is pressed. Everything typed next must go
   * to the new form, and the old one must not change by a byte.
   */
  it("moves to the new form it made, so typing never lands in the one that was open", async () => {
    const backend = mountForms();
    const user = userEvent.setup();
    await pickForm(user, "Πλάνο αίθουσας");
    // The saved one is picked explicitly — the teacher has it open, which is
    // the state M1's `Νέο τμήμα` bug needed — and shows its own desk.
    await user.click(
      within(screen.getByRole("list", { name: "Αποθηκευμένα έντυπα" })).getByRole("button", {
        name: /Αίθουσα 12 — πρόχειρο/,
      }),
    );
    expect(screen.getByLabelText("Θρανίο: σειρά 1, θέση 1")).toHaveValue("Νίκος");
    const old = structuredClone(backend.planner.print_forms.find((f) => f.id === ROOM_FORM)!);

    await user.click(screen.getByRole("button", { name: "Νέο έντυπο" }));
    await waitFor(() => expect(screen.getByLabelText("Θρανίο: σειρά 1, θέση 1")).toHaveValue(""));
    await user.type(screen.getByLabelText("Όνομα εντύπου"), "Αίθουσα 14");
    await user.tab();
    await user.type(screen.getByLabelText("Θρανίο: σειρά 1, θέση 1"), "Μαρία");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.print_forms.find((f) => f.name === "Αίθουσα 14")?.values["desk.1.1"]).toBe(
        "Μαρία",
      ),
    );
    expect(backend.planner.print_forms.find((f) => f.id === ROOM_FORM)).toEqual(old);
  });

  it("keeps two saved copies of one form apart as the teacher moves between them", async () => {
    const planner = formsPlanner();
    planner.print_forms.push({
      id: 900,
      kind: "roomPlan",
      name: "Αίθουσα 3",
      created: "2026-10-01",
      updated: "2026-10-01",
      values: { "desk.1.1": "Γιώργος" },
    });
    mountForms(planner);
    const user = userEvent.setup();
    await pickForm(user, "Πλάνο αίθουσας");
    const saved = () => within(screen.getByRole("list", { name: "Αποθηκευμένα έντυπα" }));

    await user.click(saved().getByRole("button", { name: /Αίθουσα 3/ }));
    expect(screen.getByLabelText("Θρανίο: σειρά 1, θέση 1")).toHaveValue("Γιώργος");
    await user.click(saved().getByRole("button", { name: /Αίθουσα 12 — πρόχειρο/ }));
    expect(screen.getByLabelText("Θρανίο: σειρά 1, θέση 1")).toHaveValue("Νίκος");
  });

  /**
   * **A print form is a loose page.** The planner around it holds three real
   * classes with real seats — and neither the blank nor the filled room plan
   * prints a single one of those names. Its desks are its own.
   */
  it("never prints a real class's seats on the loose room plan", async () => {
    const backend = mountForms();
    const user = userEvent.setup();
    await pickForm(user, "Πλάνο αίθουσας");

    await user.click(screen.getByRole("button", { name: "Κενό PDF" }));
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF" }));
    const exports = backend.calls.filter((c) => c.command === "export_pdf");
    expect(exports).toHaveLength(2);
    const [blank, filled] = exports.map((c) => String(c.args.html));

    for (const html of [blank, filled]) {
      expect(html).toContain("Πλάνο αίθουσας");
      expect(html).not.toContain("Ελένη Παπαδοπούλου");
      expect(html).not.toContain("Κώστας Χατζηκωνσταντίνου");
      expect(html).not.toContain("Μαρία Ιωάννου");
    }
    // The filled one prints its own desk; the blank one nothing typed at all.
    expect(filled).toContain("Νίκος");
    expect(blank).not.toContain("Νίκος");
    expect(exports.map((c) => c.args.landscape)).toEqual([false, false]);
    expect(exports[1].args.fileName).toBe("Πλάνο αίθουσας — Αίθουσα 12 — πρόχειρο — 04.11.2026");
  });

  it("deletes one saved form and leaves every other alone", async () => {
    const backend = mountForms();
    const user = userEvent.setup();
    const others = structuredClone(
      backend.planner.print_forms.filter((f) => f.id !== NOTE_FORM),
    );
    await pickForm(user, "Σημείωμα προς γονείς");
    await user.click(screen.getByRole("button", { name: "Διαγραφή εντύπου" }));

    await waitFor(() =>
      expect(backend.planner.print_forms.some((f) => f.id === NOTE_FORM)).toBe(false),
    );
    expect(backend.planner.print_forms).toEqual(others);
    expect(screen.getByText("Δεν έχετε αποθηκεύσει ακόμη έντυπο αυτού του είδους.")).toBeInTheDocument();
  });

  it("adds a fifth goal to a saved goals form without touching the first four", async () => {
    const backend = mountForms();
    const user = userEvent.setup();
    await pickForm(user, "Στόχοι και επαγγελματική ανάπτυξη");
    expect(screen.getAllByRole("group", { name: /^Στόχος \d$/ })).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Προσθήκη" }));
    await waitFor(() => expect(screen.getAllByRole("group", { name: /^Στόχος \d$/ })).toHaveLength(5));
    const form = backend.planner.print_forms.find((f) => f.id === GOALS_FORM)!;
    expect(form.values["goal.1.goal"]).toBe("Περισσότερη διαφοροποίηση");
    expect(form.values["goal.count"]).toBe("5");
  });

  it("warns, on the credentials form, that what is typed there is stored unencrypted", async () => {
    mountForms();
    const user = userEvent.setup();
    await pickForm(user, "Κωδικοί και πρόσβαση");
    expect(screen.getByText(/αποθηκεύεται χωρίς κρυπτογράφηση/)).toBeInTheDocument();
  });

  it("says on the page that a form reads nothing from the rest of the app", () => {
    mountForms();
    expect(screen.getByText(/δεν διαβάζουν τίποτα από τα τμήματα/)).toBeInTheDocument();
  });

  it("never reaches a command that writes a class, a seat or a student", async () => {
    const backend = mountForms();
    const user = userEvent.setup();
    await pickForm(user, "Πλάνο αίθουσας");
    await user.type(screen.getByLabelText("Θρανίο: σειρά 2, θέση 2"), "Ελένη");
    await user.tab();
    await waitFor(() =>
      expect(backend.calls.some((c) => c.command === "set_print_form_value")).toBe(true),
    );
    const written = new Set(backend.calls.map((c) => c.command));
    for (const command of ["save_seating", "save_class", "save_student", "set_enrollment"]) {
      expect(written.has(command)).toBe(false);
    }
  });
});

/**
 * M8's four screens, driven through the real components against the fake
 * backend: the staff directory, the covers and leave registers, development
 * and wellbeing — and the Year screen, which holds the six annual goals M8's
 * first criterion keeps apart from the development goals.
 *
 * **Every "new record" button here is tested from a planner that already holds
 * records of that kind**, and asserts the siblings come back byte-for-byte —
 * M1's `Νέο τμήμα` lesson. The rows are edited in place, so no button has a
 * selection to get wrong; the tests type into the *new* row, found by its
 * label, and check that nothing else moved.
 *
 * Both acceptance criteria are checked at the screen layer as insensitivity:
 * a panel renders identically with the other surface empty and full.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { default: StaffScreen } = await import("../../src/screens/StaffScreen");
const { default: CoversScreen } = await import("../../src/screens/CoversScreen");
const { default: DevelopmentScreen } = await import("../../src/screens/DevelopmentScreen");
const { default: WellbeingScreen } = await import("../../src/screens/WellbeingScreen");
const { default: YearScreen } = await import("../../src/screens/YearScreen");
const {
  growthPlanner,
  ANNA_STAFF,
  COVER_SAME_DAY,
  LEAVE_SAME_DAY,
  TODAY,
  TRAINING_COMMA,
  WELLBEING_WEEK9,
} = await import("../helpers/growthFixture");
import type { Planner } from "../../src/domain/types";

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

function section(heading: string): HTMLElement {
  return screen.getByRole("heading", { name: heading }).closest("section")!;
}

function panel(heading: string) {
  return within(section(heading));
}

function group(name: string) {
  return within(screen.getByRole("group", { name }));
}

/**
 * A panel's markup with React's generated ids removed — they come from a
 * counter that keeps running between renders, and are not content.
 */
function markupOf(heading: string): string {
  return section(heading).innerHTML.replace(/ (id|for)="[^"]*"/g, "");
}

/** Renders a screen, reads one panel's markup, and tears it down again. */
function renderedPanel<P extends { planner: Planner }>(
  Screen: Parameters<typeof renderScreen<P>>[0],
  planner: Planner,
  heading: string,
  extra?: Parameters<typeof renderScreen<P>>[3],
): string {
  renderScreen(Screen, planner, invoke, extra);
  const markup = markupOf(heading);
  cleanup();
  return markup;
}

function mutations(backend: { calls: { command: string }[] }): string[] {
  return backend.calls.map((c) => c.command).filter((c) => c !== "status");
}

// ------------------------------------------------------------ staff ---

describe("Επαφές στο σχολείο", () => {
  it("searches without accents or case, and names how many it is showing", async () => {
    renderScreen(StaffScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Αναζήτηση" }), "ΓΡΑΜΜΑΤΕΙΑ");
    expect(screen.getByText("1 από 3 επαφές")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(group("Επαφή 2").getByLabelText("Θέση / Τομέας")).toHaveValue("Γραμματεία");
  });

  it("finds the colleague who shares a guardian's name once, and never the guardian", async () => {
    renderScreen(StaffScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Αναζήτηση" }), "παπαδοπουλου");
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(group("Επαφή 1").getByLabelText("Τηλέφωνο")).toHaveValue("22 123456");
    // Ελένη's mother's number is on the student card, not in the directory.
    expect(screen.queryByDisplayValue("99 111111")).toBeNull();
  });

  it("adds a contact from a full, filtered list, and what is typed lands in the new one", async () => {
    const backend = renderScreen(StaffScreen, growthPlanner(), invoke);
    const before = structuredClone(backend.planner.staff_contacts);
    const user = userEvent.setup();
    // A search is active and matches an existing contact — the case where a
    // blank new row would be hidden and typing would go somewhere else.
    await user.type(screen.getByRole("searchbox", { name: "Αναζήτηση" }), "γεωργιου");
    await user.click(screen.getByRole("button", { name: "Νέα επαφή" }));
    await waitFor(() => expect(backend.planner.staff_contacts).toHaveLength(4));
    expect(screen.getByRole("searchbox", { name: "Αναζήτηση" })).toHaveValue("");

    const name = group("Επαφή 4").getByLabelText("Ονοματεπώνυμο");
    await user.type(name, "Νέα Συνάδελφος");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.staff_contacts.find((c) => c.full_name === "Νέα Συνάδελφος")).toBeTruthy(),
    );
    for (const contact of before) {
      expect(backend.planner.staff_contacts.find((c) => c.id === contact.id)).toEqual(contact);
    }
  });

  it("writes an edited contact to that contact only", async () => {
    const backend = renderScreen(StaffScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    const role = group("Επαφή 1").getByLabelText("Θέση / Τομέας");
    await user.clear(role);
    await user.type(role, "Διευθύντρια");
    await user.tab();
    await waitFor(() =>
      expect(backend.planner.staff_contacts.find((c) => c.id === ANNA_STAFF)!.role).toBe(
        "Διευθύντρια",
      ),
    );
    expect(backend.planner.staff_contacts.filter((c) => c.role === "Διευθύντρια")).toHaveLength(1);
    expect(mutations(backend)).toEqual(["save_staff_contact"]);
  });
});

// ---------------------------------------------------- covers & leave ---

describe("Αναπληρώσεις και άδειες", () => {
  it("shows a cover and a leave on the same date as two entries in two registers", () => {
    renderScreen(CoversScreen, growthPlanner(), invoke);
    expect(panel("Αναπληρώσεις που καλύψατε").getByText("2 αναπληρώσεις")).toBeInTheDocument();
    expect(panel("Οι άδειές μου").getByText("2 άδειες")).toBeInTheDocument();
    expect(panel("Αναπληρώσεις που καλύψατε").getAllByDisplayValue("2026-11-12")).toHaveLength(1);
    expect(panel("Οι άδειές μου").getAllByDisplayValue("2026-11-12")).toHaveLength(1);
  });

  /**
   * **M8's second acceptance criterion, at the screen layer.** Each register
   * renders identically with the other table empty and full.
   */
  it("renders each register the same whether the other is empty or full", () => {
    const full = growthPlanner();
    const noLeave = growthPlanner();
    noLeave.leave_records = [];
    const noCovers = growthPlanner();
    noCovers.cover_records = [];

    expect(renderedPanel(CoversScreen, full, "Αναπληρώσεις που καλύψατε")).toBe(
      renderedPanel(CoversScreen, noLeave, "Αναπληρώσεις που καλύψατε"),
    );
    expect(renderedPanel(CoversScreen, full, "Οι άδειές μου")).toBe(
      renderedPanel(CoversScreen, noCovers, "Οι άδειές μου"),
    );
  });

  it("adds a cover from a full register; the leave register and the other covers do not move", async () => {
    const backend = renderScreen(CoversScreen, growthPlanner(), invoke);
    const covers = structuredClone(backend.planner.cover_records);
    const leaves = structuredClone(backend.planner.leave_records);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα αναπλήρωση" }));
    await waitFor(() => expect(backend.planner.cover_records).toHaveLength(3));
    // A new line is undated, so it is the first — where M6's registers put it.
    const cls = group("Αναπλήρωση 1").getByLabelText("Τάξη");
    expect(cls).toHaveValue("");
    await user.type(cls, "Δ1");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.cover_records.find((c) => c.class_name === "Δ1")).toBeTruthy(),
    );
    for (const cover of covers) {
      expect(backend.planner.cover_records.find((c) => c.id === cover.id)).toEqual(cover);
    }
    expect(backend.planner.leave_records).toEqual(leaves);
    expect(new Set(mutations(backend))).toEqual(new Set(["save_cover_record"]));
  });

  it("adds a leave from a full register; the covers register and the other leave do not move", async () => {
    const backend = renderScreen(CoversScreen, growthPlanner(), invoke);
    const covers = structuredClone(backend.planner.cover_records);
    const leaves = structuredClone(backend.planner.leave_records);
    const folder = structuredClone(backend.planner.substitute_school_texts);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα άδεια" }));
    await waitFor(() => expect(backend.planner.leave_records).toHaveLength(3));
    const date = group("Άδεια 1").getByLabelText("Ημερομηνία");
    await user.type(date, "2026-11-12");
    await user.tab();
    const reason = group("Άδεια 2").getByLabelText("Άδεια / αιτία");
    // The new leave is now dated 12.11 and sorts beside the other one on that
    // day; it is the later-created of the two, so it is second.
    expect(reason).toHaveValue("");
    await user.type(reason, "Προσωπική άδεια");
    await user.tab();

    await waitFor(() =>
      expect(
        backend.planner.leave_records.find((l) => l.reason === "Προσωπική άδεια")!.date,
      ).toBe("2026-11-12"),
    );
    for (const leave of leaves) {
      expect(backend.planner.leave_records.find((l) => l.id === leave.id)).toEqual(leave);
    }
    // A leave writes no cover and touches no substitute folder.
    expect(backend.planner.cover_records).toEqual(covers);
    expect(backend.planner.substitute_school_texts).toEqual(folder);
    expect(new Set(mutations(backend))).toEqual(new Set(["save_leave_record"]));
  });

  it("deletes one of the same-date pair and leaves the other", async () => {
    const backend = renderScreen(CoversScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    await user.click(group("Αναπλήρωση 1").getByRole("button", { name: "Διαγραφή" }));
    await waitFor(() =>
      expect(backend.planner.cover_records.some((c) => c.id === COVER_SAME_DAY)).toBe(false),
    );
    expect(backend.planner.leave_records.some((l) => l.id === LEAVE_SAME_DAY)).toBe(true);
  });
});

// ------------------------------------------------------- development ---

describe("Ανάπτυξη και καριέρα", () => {
  it("lays out the hand-computed budget summary", () => {
    renderScreen(DevelopmentScreen, growthPlanner(), invoke);
    const summary = panel("Προϋπολογισμός και σύνοψη");
    expect(summary.getByText("14.09.2026 – 19.09.2027")).toBeInTheDocument();
    expect(summary.getByText("12.50 € από 2 επιμορφώσεις με έξοδο")).toBeInTheDocument();
    expect(summary.getByText("6.5 ώρες")).toBeInTheDocument();
    expect(summary.getByText("87.50 €")).toBeInTheDocument();
    expect(summary.getByText("1 χωρίς έξοδο · 1 εκτός σχολικής χρονιάς")).toBeInTheDocument();
    // Costs are written back with a dot, whatever was typed.
    expect(group("Επιμόρφωση 2").getByLabelText("Έξοδο (€)")).toHaveValue("12.50");
  });

  it("adds a training line from a full log and stores a comma-typed cost as a number", async () => {
    const backend = renderScreen(DevelopmentScreen, growthPlanner(), invoke);
    const before = structuredClone(backend.planner.training_entries);
    const annual = structuredClone(backend.planner.annual_goals);
    const goals = structuredClone(backend.planner.development_goals);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέα επιμόρφωση" }));
    await waitFor(() => expect(backend.planner.training_entries).toHaveLength(5));
    const cost = group("Επιμόρφωση 1").getByLabelText("Έξοδο (€)");
    expect(cost).toHaveValue("");
    await user.type(cost, "25,50");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.training_entries.find((e) => e.cost === 25.5)).toBeTruthy(),
    );
    const created = backend.planner.training_entries.find((e) => e.cost === 25.5)!;
    expect(created.hours).toBeNull();
    expect(group("Επιμόρφωση 1").getByLabelText("Έξοδο (€)")).toHaveValue("25.50");
    for (const entry of before) {
      expect(backend.planner.training_entries.find((e) => e.id === entry.id)).toEqual(entry);
    }
    expect(backend.planner.annual_goals).toEqual(annual);
    expect(backend.planner.development_goals).toEqual(goals);
  });

  it("refuses a cost that is not a number, and saves nothing", async () => {
    const backend = renderScreen(DevelopmentScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    const cost = group("Επιμόρφωση 2").getByLabelText("Έξοδο (€)");
    await user.clear(cost);
    await user.type(cost, "δωρεάν");
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent("«δωρεάν» δεν είναι αριθμός");
    expect(cost).toHaveValue("δωρεάν");
    expect(mutations(backend)).toEqual([]);
    expect(backend.planner.training_entries.find((e) => e.id === TRAINING_COMMA)!.cost).toBe(12.5);
  });

  it("stores a cleared cost as not entered, never as zero", async () => {
    const backend = renderScreen(DevelopmentScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    const cost = group("Επιμόρφωση 2").getByLabelText("Έξοδο (€)");
    await user.clear(cost);
    await user.tab();
    await waitFor(() =>
      expect(backend.planner.training_entries.find((e) => e.id === TRAINING_COMMA)!.cost).toBeNull(),
    );
    expect(panel("Προϋπολογισμός και σύνοψη").getByText("0.00 € από 1 επιμόρφωση με έξοδο")).toBeInTheDocument();
  });

  it("saves the budget typed with a comma", async () => {
    const backend = renderScreen(DevelopmentScreen, growthPlanner(), invoke);
    const user = userEvent.setup();
    const amount = screen.getByLabelText("Προϋπολογισμός της χρονιάς (€)");
    await user.clear(amount);
    await user.type(amount, "150,5");
    await user.tab();
    await waitFor(() => expect(backend.planner.development_budget.amount).toBe(150.5));
    expect(backend.planner.development_budget.notes).toBe("Καλύπτει το σχολείο το μισό");
    expect(await screen.findByText("138.00 €")).toBeInTheDocument();
  });

  it("adds a development goal from a full list; annual goals and the saved form do not move", async () => {
    const backend = renderScreen(DevelopmentScreen, growthPlanner(), invoke);
    const before = structuredClone(backend.planner.development_goals);
    const annual = structuredClone(backend.planner.annual_goals);
    const forms = structuredClone(backend.planner.print_forms);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέος στόχος" }));
    await waitFor(() => expect(backend.planner.development_goals).toHaveLength(3));
    // New goals go on the end; nothing is prefilled from anywhere.
    const goal = group("Στόχος ανάπτυξης 3").getByLabelText("Στόχος");
    expect(goal).toHaveValue("");
    await user.type(goal, "Ερευνητικό πρόγραμμα");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.development_goals.find((g) => g.goal === "Ερευνητικό πρόγραμμα")).toBeTruthy(),
    );
    for (const g of before) {
      expect(backend.planner.development_goals.find((x) => x.id === g.id)).toEqual(g);
    }
    expect(backend.planner.annual_goals).toEqual(annual);
    expect(backend.planner.print_forms).toEqual(forms);
    expect(new Set(mutations(backend))).toEqual(new Set(["save_development_goal"]));
  });

  /**
   * **M8's first criterion, at the screen layer.** The development page shows
   * no annual goal, and renders the same with the six filled or blank, with or
   * without M7's goals form.
   */
  it("shows no annual goal and is insensitive to them and to the goals form", () => {
    const full = growthPlanner();
    renderScreen(DevelopmentScreen, full, invoke);
    expect(screen.queryByText(/Ετήσιος στόχος/)).toBeNull();
    expect(screen.queryByDisplayValue(/Ετήσιος στόχος/)).toBeNull();
    expect(screen.queryByDisplayValue("Μεταπτυχιακό στην εκπαίδευση")).toBeNull();
    cleanup();

    const blank = growthPlanner();
    blank.annual_goals = blank.annual_goals.map((g) => ({ ...g, goal: "", status: "" }));
    blank.print_forms = [];
    expect(renderedPanel(DevelopmentScreen, full, "Στόχοι ανάπτυξης")).toBe(
      renderedPanel(DevelopmentScreen, blank, "Στόχοι ανάπτυξης"),
    );
  });
});

describe("the six annual goals, on Έτος", () => {
  it("show no development goal and are insensitive to them", () => {
    const full = growthPlanner();
    renderScreen(YearScreen, full, invoke);
    expect(screen.queryByDisplayValue("Πιστοποίηση ΤΠΕ Β")).toBeNull();
    expect(screen.getByText(/Οι ανοιχτοί στόχοι ανάπτυξης είναι χωριστοί/)).toBeInTheDocument();
    cleanup();

    const none = growthPlanner();
    none.development_goals = [];
    expect(renderedPanel(YearScreen, full, "Στόχοι για τη χρονιά")).toBe(
      renderedPanel(YearScreen, none, "Στόχοι για τη χρονιά"),
    );
  });

  it("saving the development area writes no development goal", async () => {
    const backend = renderScreen(YearScreen, growthPlanner(), invoke);
    const before = structuredClone(backend.planner.development_goals);
    const user = userEvent.setup();
    const card = within(
      screen.getByRole("heading", { name: "Επαγγελματική ανάπτυξη" }).closest(".card") as HTMLElement,
    );
    await user.type(card.getByLabelText("Στόχος"), " — και δεύτερος");
    await user.click(card.getByRole("button", { name: "Αποθήκευση" }));
    await waitFor(() => expect(mutations(backend)).toContain("save_annual_goal"));
    expect(backend.planner.development_goals).toEqual(before);
  });
});

// ---------------------------------------------------------- wellbeing ---

describe("Ευεξία εκπαιδευτικού", () => {
  it("is free text only: no rating control of any kind", () => {
    renderScreen(WellbeingScreen, growthPlanner(), invoke, { today: TODAY });
    for (const role of ["combobox", "slider", "spinbutton", "radio", "checkbox"]) {
      expect(screen.queryAllByRole(role)).toHaveLength(0);
    }
    for (const word of ["Ενέργεια", "Φόρτος", "Διάθεση", "Ύπνος", "Ισορροπία"]) {
      expect(screen.queryByLabelText(word)).toBeNull();
    }
  });

  it("shows each entry's week, derived from the start date", () => {
    renderScreen(WellbeingScreen, growthPlanner(), invoke, { today: TODAY });
    expect(group("Καταχώριση 1").getByText("Εβδομάδα 9")).toBeInTheDocument();
    expect(group("Καταχώριση 2").getByText("Εβδομάδα 8")).toBeInTheDocument();
  });

  it("adds an entry dated the shell's today, from a full journal, and types into it", async () => {
    const backend = renderScreen(WellbeingScreen, growthPlanner(), invoke, { today: TODAY });
    const before = structuredClone(backend.planner.wellbeing_entries);
    const note = structuredClone(backend.planner.wellbeing_note);
    const user = userEvent.setup();

    // An existing entry is already dated today — the collision the tie-break
    // must get right, or typing would land in the old one.
    expect(before.find((e) => e.id === WELLBEING_WEEK9)!.date).toBe(TODAY);
    await user.click(screen.getByRole("button", { name: "Νέα καταχώριση" }));
    await waitFor(() => expect(backend.planner.wellbeing_entries).toHaveLength(3));
    const created = backend.planner.wellbeing_entries.find((e) => !before.some((b) => b.id === e.id))!;
    expect(created.date).toBe(TODAY);

    const text = group("Καταχώριση 1").getByLabelText("Τι βοήθησε · τι να αλλάξω");
    expect(text).toHaveValue("");
    await user.type(text, "Λιγότερες διορθώσεις το βράδυ");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.wellbeing_entries.find((e) => e.id === created.id)!.notes).toBe(
        "Λιγότερες διορθώσεις το βράδυ",
      ),
    );
    for (const entry of before) {
      expect(backend.planner.wellbeing_entries.find((e) => e.id === entry.id)).toEqual(entry);
    }
    expect(backend.planner.wellbeing_note).toEqual(note);
  });

  it("saves one standing box without touching the other", async () => {
    const backend = renderScreen(WellbeingScreen, growthPlanner(), invoke, { today: TODAY });
    const user = userEvent.setup();
    const box = screen.getByLabelText("Τι με κρατάει σε φόρμα");
    await user.type(box, " και γιόγκα");
    await user.tab();
    await waitFor(() =>
      expect(backend.planner.wellbeing_note.sustains).toBe("Κολύμπι την Τετάρτη και γιόγκα"),
    );
    expect(backend.planner.wellbeing_note.boundaries).toBe("Όχι email μετά τις 8");
  });
});

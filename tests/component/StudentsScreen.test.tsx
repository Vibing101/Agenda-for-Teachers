import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { emptyPlanner } = await import("../helpers/fakeBackend");
const { renderScreen } = await import("../helpers/mount");
const { default: StudentsScreen } = await import("../../src/screens/StudentsScreen");
const { emptyClass, emptyStudent } = await import("../../src/domain/types");
import type { Planner, Student } from "../../src/domain/types";

const panel = (heading: string) => within(screen.getByText(heading).closest("section")!);

/** Every field on the card filled in — the round-trip fixture. */
const FILLED: Student = {
  id: 10,
  full_name: "Ελένη Παπαδοπούλου",
  register_number: "12345",
  birth_date: "2014-03-07",
  home_language: "Ελληνικά",
  address: "Λεωφ. Αρχ. Μακαρίου Γ΄ 12, Λευκωσία",
  midyear_enrollment: true,
  guardian1_name: "Άννα Παπαδοπούλου",
  guardian1_phone: "+357 99 123456",
  guardian1_email: "anna@example.com",
  guardian2_name: "Γιώργος Παπαδόπουλος",
  guardian2_phone: "+357 99 654321",
  guardian2_email: "giorgos@example.com",
  allergies: "Ξηροί καρποί",
  conditions: "Άσθμα — εισπνεόμενο στη σχολική τσάντα",
  medication: "Σαλβουταμόλη",
  emergency_phone: "+357 22 800800",
  sen_status: "accommodations",
  sen_plan: "ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ 04/2026",
  sen_accommodations: "Επιπλέον χρόνος στις γραπτές εργασίες",
  notes: "Δουλεύει καλύτερα σε μικρή ομάδα",
  meeting_notes: "18/09: συνάντηση με τη μητέρα",
};

function withStudents(): Planner {
  const planner = emptyPlanner();
  planner.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
  planner.classes = [
    { ...emptyClass(), id: 1, name: "Α1", subject: "Μαθηματικά" },
    { ...emptyClass(), id: 2, name: "Β2", subject: "Φυσική" },
  ];
  planner.students = [
    FILLED,
    { ...emptyStudent(), id: 11, full_name: "Ανδρέας Χριστοδούλου", register_number: "220", birth_date: "2014-11-21" },
  ];
  planner.enrollments = [{ class_id: 1, student_id: 10, roster_no: 1, support: false, note: "" }];
  return planner;
}

describe("the student card", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  /**
   * M1's third acceptance criterion: every field on the card — guardians,
   * health and emergency, SEN — comes back exactly as it went in.
   */
  it("shows every stored field, and saves every field back unchanged", async () => {
    const backend = renderScreen(StudentsScreen, withStudents(), invoke);
    const user = userEvent.setup();
    const card = panel("Καρτέλα μαθητή");

    // Details
    expect(card.getByLabelText("Όνομα και επώνυμο")).toHaveValue(FILLED.full_name);
    expect(card.getByLabelText("Αριθμός μητρώου")).toHaveValue(FILLED.register_number);
    expect(card.getByLabelText("Ημερομηνία γέννησης")).toHaveValue(FILLED.birth_date);
    expect(card.getByLabelText("Γλώσσα στο σπίτι")).toHaveValue(FILLED.home_language);
    expect(card.getByLabelText("Διεύθυνση")).toHaveValue(FILLED.address);
    expect(card.getByLabelText("Εγγραφή μέσα στη χρονιά")).toBeChecked();

    // Guardians
    const g1 = within(card.getByText("Γονέας / κηδεμόνας 1").closest("div")!);
    expect(g1.getByLabelText("Ονοματεπώνυμο")).toHaveValue(FILLED.guardian1_name);
    expect(g1.getByLabelText("Τηλέφωνο")).toHaveValue(FILLED.guardian1_phone);
    expect(g1.getByLabelText("Email")).toHaveValue(FILLED.guardian1_email);
    const g2 = within(card.getByText("Γονέας / κηδεμόνας 2").closest("div")!);
    expect(g2.getByLabelText("Ονοματεπώνυμο")).toHaveValue(FILLED.guardian2_name);
    expect(g2.getByLabelText("Τηλέφωνο")).toHaveValue(FILLED.guardian2_phone);
    expect(g2.getByLabelText("Email")).toHaveValue(FILLED.guardian2_email);

    // Health and emergency
    expect(card.getByLabelText("Αλλεργίες")).toHaveValue(FILLED.allergies);
    expect(card.getByLabelText("Παθήσεις και φροντίδα")).toHaveValue(FILLED.conditions);
    expect(card.getByLabelText("Φάρμακα")).toHaveValue(FILLED.medication);
    expect(card.getByLabelText("Τηλέφωνο ανάγκης")).toHaveValue(FILLED.emergency_phone);

    // SEN
    expect(card.getByLabelText("Κατάσταση")).toHaveValue("accommodations");
    expect(card.getByLabelText("Πλάνο (ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ…)")).toHaveValue(FILLED.sen_plan);
    expect(card.getByLabelText("Προσαρμογές και στήριξη")).toHaveValue(
      FILLED.sen_accommodations,
    );

    // Notes
    expect(card.getByLabelText("Σημειώσεις και παρατηρήσεις")).toHaveValue(FILLED.notes);
    expect(card.getByLabelText("Σημειώσεις συναντήσεων")).toHaveValue(FILLED.meeting_notes);

    // Saving without editing must hand back exactly what was loaded.
    await user.click(card.getByRole("button", { name: "Αποθήκευση" }));
    await waitFor(() => expect(backend.planner.students).toContainEqual(FILLED));
  });

  it("round-trips an edit to a health field and a SEN category", async () => {
    const backend = renderScreen(StudentsScreen, withStudents(), invoke);
    const user = userEvent.setup();
    const card = panel("Καρτέλα μαθητή");

    await user.clear(card.getByLabelText("Αλλεργίες"));
    await user.type(card.getByLabelText("Αλλεργίες"), "Γάλα και ξηροί καρποί");
    await user.selectOptions(card.getByLabelText("Κατάσταση"), "Ενισχυτική διδασκαλία");
    await user.click(card.getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => {
      const saved = backend.planner.students.find((s) => s.id === 10)!;
      expect(saved.allergies).toBe("Γάλα και ξηροί καρποί");
      // The stable code is what is stored, never the Greek label.
      expect(saved.sen_status).toBe("reinforcement");
      // Nothing else on the card moved.
      expect(saved.guardian2_email).toBe(FILLED.guardian2_email);
      expect(saved.meeting_notes).toBe(FILLED.meeting_notes);
    });
  });

  it("keeps a half-typed edit when something else on the card is saved", async () => {
    renderScreen(StudentsScreen, withStudents(), invoke);
    const user = userEvent.setup();
    const card = panel("Καρτέλα μαθητή");

    await user.clear(card.getByLabelText("Αλλεργίες"));
    await user.type(card.getByLabelText("Αλλεργίες"), "Γάλα");

    // An unrelated save on the same screen: add her to a second class.
    await user.selectOptions(card.getByLabelText("Προσθήκη σε τμήμα"), "Β2");
    await user.click(card.getByRole("button", { name: "Προσθήκη" }));
    await waitFor(() => expect(card.getAllByText("Β2").length).toBeGreaterThan(0));

    expect(card.getByLabelText("Αλλεργίες")).toHaveValue("Γάλα");
  });

  it("adds a student to a second class from her own card", async () => {
    const backend = renderScreen(StudentsScreen, withStudents(), invoke);
    const user = userEvent.setup();
    const card = panel("Καρτέλα μαθητή");

    expect(card.getByText("Α1")).toBeInTheDocument();
    await user.selectOptions(card.getByLabelText("Προσθήκη σε τμήμα"), "Β2");
    await user.click(card.getByRole("button", { name: "Προσθήκη" }));

    await waitFor(() => expect(backend.planner.enrollments).toHaveLength(2));
    expect(backend.planner.enrollments.map((e) => e.class_id).sort()).toEqual([1, 2]);
  });
});

describe("the student index", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("filters by name, by class and by register number", async () => {
    renderScreen(StudentsScreen, withStudents(), invoke);
    const user = userEvent.setup();
    const index = panel("Ευρετήριο μαθητών");
    const search = index.getByLabelText("Αναζήτηση");

    await user.type(search, "Ανδρέας");
    expect(await index.findByText("Ανδρέας Χριστοδούλου")).toBeInTheDocument();
    expect(index.queryByText("Ελένη Παπαδοπούλου")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Α1");
    expect(await index.findByText("Ελένη Παπαδοπούλου")).toBeInTheDocument();
    expect(index.queryByText("Ανδρέας Χριστοδούλου")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "220");
    expect(await index.findByText("Ανδρέας Χριστοδούλου")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "δεν υπάρχει");
    expect(await index.findByText("Κανένα αποτέλεσμα.")).toBeInTheDocument();
  });

  it("sorts by register number when asked", async () => {
    renderScreen(StudentsScreen, withStudents(), invoke);
    const user = userEvent.setup();
    const index = panel("Ευρετήριο μαθητών");

    await user.selectOptions(index.getByLabelText("Ταξινόμηση"), "Αριθμός μητρώου");

    const names = index
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((text) => text.includes("Χριστοδούλου") || text.includes("Παπαδοπούλου"));
    expect(names[0]).toContain("Ανδρέας Χριστοδούλου"); // 220 before 12345
  });

  it("creates a blank card the teacher can then fill in", async () => {
    const backend = renderScreen(StudentsScreen, emptyPlanner(), invoke);
    const user = userEvent.setup();

    expect(screen.getByText("Δεν έχει καταχωριστεί ακόμη μαθητής.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Νέος μαθητής" }));

    await waitFor(() => expect(backend.planner.students).toHaveLength(1));
    expect(await screen.findByLabelText("Όνομα και επώνυμο")).toHaveValue("");
  });

  /**
   * The same defect the class screen had, found at the M1 Windows gate
   * (2026-09-20). The test above starts from an empty index, where the
   * "keep a sensible selection" effect selects the new card anyway; with a
   * student already on file the card stayed bound to *her*, so typing a name
   * would have overwritten her whole record — guardians, health and SEN
   * included.
   */
  it("creates a second card without overwriting the student already selected", async () => {
    const planner = emptyPlanner();
    planner.students = [{ ...FILLED }];
    const backend = renderScreen(StudentsScreen, planner, invoke);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Νέος μαθητής" }));
    // The card must now be the new, empty one — not Ελένη's.
    await waitFor(() => expect(screen.getByLabelText("Όνομα και επώνυμο")).toHaveValue(""));

    await user.type(screen.getByLabelText("Όνομα και επώνυμο"), "Ανδρέας Χριστοδούλου");
    await user.click(panel("Στοιχεία μαθητή").getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => {
      const eleni = backend.planner.students.find((s) => s.id === FILLED.id);
      expect(eleni?.full_name).toBe("Ελένη Παπαδοπούλου");
      expect(eleni?.allergies).toBe("Ξηροί καρποί");
      expect(eleni?.guardian1_name).toBe("Άννα Παπαδοπούλου");
      const andreas = backend.planner.students.find((s) => s.id !== FILLED.id);
      expect(andreas?.full_name).toBe("Ανδρέας Χριστοδούλου");
    });
    expect(backend.planner.students).toHaveLength(2);
  });
});

describe("the birthday calendar", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("derives itself from the birth dates on the cards", () => {
    renderScreen(StudentsScreen, withStudents(), invoke);
    const birthdays = panel("Γενέθλια");

    const march = within(birthdays.getByText("Μάρτιος").closest("div")!);
    expect(march.getByText(/Ελένη Παπαδοπούλου/)).toBeInTheDocument();
    expect(march.getByText("07.03")).toBeInTheDocument();

    const november = within(birthdays.getByText("Νοέμβριος").closest("div")!);
    expect(november.getByText(/Ανδρέας Χριστοδούλου/)).toBeInTheDocument();
  });

  it("starts at the month the school year starts in", () => {
    renderScreen(StudentsScreen, withStudents(), invoke);
    const months = panel("Γενέθλια")
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(months[0]).toBe("Σεπτέμβριος");
    expect(months).toHaveLength(12);
  });

  it("says so when no birth date has been entered", () => {
    const planner = emptyPlanner();
    planner.students = [{ ...emptyStudent(), id: 1, full_name: "Χωρίς γενέθλια" }];
    renderScreen(StudentsScreen, planner, invoke);
    expect(screen.getByText("Καμία ημερομηνία γέννησης ακόμη.")).toBeInTheDocument();
  });
});

/**
 * The M5 screens, driven as the app drives them.
 *
 * Three things carry weight here:
 *
 * * **The "new record" trap.** M5 adds four creation buttons — a contact, an
 *   appointment, a meeting and an agreement — and every one is tested from a
 *   planner that *already holds a record of that kind*, with the siblings
 *   asserted byte-for-byte unchanged. An empty fixture is the one case where
 *   the defect that cost M1 a data-loss bug cannot show.
 * * **The booking and the record stay apart at the UI layer too.** Writing on
 *   one screen must not reach the other's table, and that is asserted against
 *   what actually went through the backend, not against what the screen drew.
 * * **What is exported is what is on screen**, read back off the HTML that
 *   really reached `export_pdf`.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { parentsFixture, A1, ELENI, ANNA, TODAY, MEETING_SOON } = await import(
  "../helpers/parentsFixture"
);
const { default: ContactsScreen } = await import("../../src/screens/ContactsScreen");
const { default: AppointmentsScreen } = await import("../../src/screens/AppointmentsScreen");
const { default: MeetingsScreen } = await import("../../src/screens/MeetingsScreen");

beforeEach(() => {
  invoke.mockReset();
});

describe("the parent communication log", () => {
  it("asks for a student before offering to record anything", () => {
    renderScreen(ContactsScreen, emptyPlanner(), invoke, { today: TODAY });
    expect(screen.getByText(/Δεν υπάρχει ακόμη μαθητής/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Νέα επικοινωνία" })).toBeDisabled();
  });

  it("lists every line newest first, with the source register's own fields", () => {
    renderScreen(ContactsScreen, parentsFixture(), invoke, { today: TODAY });
    expect(screen.getByText("2 επικοινωνίες")).toBeInTheDocument();

    const first = within(screen.getByRole("group", { name: "Επικοινωνία 1" }));
    expect(first.getByLabelText("Ημερομηνία")).toHaveValue("2026-11-05");
    expect(first.getByLabelText("Μαθητής")).toHaveValue(String(ELENI));
    expect(first.getByLabelText("Ποιος")).toHaveValue(ANNA);
    expect(first.getByLabelText("Μορφή")).toHaveValue("phone");
    // The spec asks for the reason and the agreements to stay apart from the
    // overall remarks, so all three are their own field.
    expect(first.getByLabelText("Αιτία")).toHaveValue("Συχνές καθυστερήσεις το πρωί");
    expect(first.getByLabelText("Συμφωνίες")).toHaveValue("Θα φεύγουν δέκα λεπτά νωρίτερα");
    expect(first.getByLabelText("Παρατηρήσεις")).toHaveValue("Η μητέρα δουλεύει βάρδιες");
  });

  it("filters by the class roster without changing what is stored", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(ContactsScreen, parentsFixture(), invoke, { today: TODAY });
    const before = structuredClone(backend.planner.parent_contacts);

    await user.selectOptions(screen.getByLabelText("Φίλτρο τμήματος"), String(A1));
    await waitFor(() => expect(screen.getByText("2 επικοινωνίες")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Φίλτρο μαθητή"), String(ELENI));
    await waitFor(() => expect(screen.getByText("1 επικοινωνία")).toBeInTheDocument());

    // A filter is a view, not an edit.
    expect(backend.planner.parent_contacts).toEqual(before);
    expect(backend.calls.some((c) => c.command === "save_parent_contact")).toBe(false);
  });

  /** **The "new record" trap, from a planner that already holds records.** */
  it("leaves every existing line byte-for-byte unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(ContactsScreen, parentsFixture(), invoke, { today: TODAY });
    const before = structuredClone(backend.planner.parent_contacts);
    expect(before).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Νέα επικοινωνία" }));
    await waitFor(() => expect(backend.planner.parent_contacts).toHaveLength(3));

    for (const original of before) {
      expect(backend.planner.parent_contacts.find((c) => c.id === original.id)).toEqual(original);
    }
    const created = backend.planner.parent_contacts.find(
      (c) => !before.some((b) => b.id === c.id),
    )!;
    expect(created.reason).toBe("");
    expect(created.agreements).toBe("");
    expect(created.remarks).toBe("");
  });

  it("writes an edited line to that line only", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(ContactsScreen, parentsFixture(), invoke, { today: TODAY });
    const before = structuredClone(backend.planner.parent_contacts);

    const first = within(screen.getByRole("group", { name: "Επικοινωνία 1" }));
    const outcome = first.getByLabelText("Έκβαση");
    await user.clear(outcome);
    await user.type(outcome, "Συμφωνήσαμε νέα ώρα");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.parent_contacts.find((c) => c.id === 101)!.outcome).toBe(
        "Συμφωνήσαμε νέα ώρα",
      ),
    );
    expect(backend.planner.parent_contacts.find((c) => c.id === 102)).toEqual(
      before.find((c) => c.id === 102),
    );
    // The edited line kept everything else it had.
    const edited = backend.planner.parent_contacts.find((c) => c.id === 101)!;
    expect(edited.reason).toBe("Συχνές καθυστερήσεις το πρωί");
    expect(edited.guardian).toBe(ANNA);
  });

  /**
   * **M5's second acceptance criterion, at the UI layer.** Nothing this screen
   * does reaches the appointment table — there is no command for it to call.
   */
  it("never writes to the appointment table, whatever is done to it", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(ContactsScreen, parentsFixture(), invoke, { today: TODAY });
    const bookingsBefore = structuredClone(backend.planner.parent_appointments);

    await user.click(screen.getByRole("button", { name: "Νέα επικοινωνία" }));
    const first = within(screen.getByRole("group", { name: "Επικοινωνία 1" }));
    const reason = first.getByLabelText("Αιτία");
    await user.clear(reason);
    await user.type(reason, "Άλλος λόγος");
    await user.tab();
    await waitFor(() => expect(backend.planner.parent_contacts).toHaveLength(3));

    expect(backend.planner.parent_appointments).toEqual(bookingsBefore);
    expect(
      backend.calls.some((c) => c.command.includes("appointment")),
      "the log screen called an appointment command",
    ).toBe(false);
  });

  it("exports exactly the lines the filter is showing, and names the filter", async () => {
    const user = userEvent.setup();
    renderScreen(ContactsScreen, parentsFixture(), invoke, { today: TODAY });

    await user.selectOptions(screen.getByLabelText("Φίλτρο μαθητή"), String(ELENI));
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF μητρώου" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("export_pdf", expect.objectContaining({})),
    );
    const call = invoke.mock.calls.find(([command]) => command === "export_pdf")!;
    const { html, landscape } = call[1] as Record<string, unknown>;

    expect(html).toContain("Συχνές καθυστερήσεις το πρωί");
    // Νίκος's line, which the filter hides, is not on the sheet.
    expect(html).not.toContain("Εργασία που δεν παραδόθηκε");
    // Her stored remark is listed in the page's own ΠΑΡΑΤΗΡΗΣΕΙΣ box.
    expect(html).toContain("Η μητέρα δουλεύει βάρδιες");
    expect(landscape).toBe(true);
  });
});

describe("the parent-appointment grid", () => {
  it("shows the week the shell's day falls in, and moves week by week", async () => {
    const user = userEvent.setup();
    // TODAY is Monday 09.11, so the grid opens on that week — which holds the
    // cancelled booking on 11.11 and the live one on 12.11.
    renderScreen(AppointmentsScreen, parentsFixture(), invoke, { today: TODAY });
    expect(screen.getByText("Εβδομάδα 09.11.2026")).toBeInTheDocument();
    expect(screen.getByText("2 συναντήσεις")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Προηγούμενη εβδομάδα" }));
    await waitFor(() => expect(screen.getByText("3 συναντήσεις")).toBeInTheDocument());
    expect(screen.getByText("Εβδομάδα 02.11.2026")).toBeInTheDocument();

    // And back again, so "this week" is reachable without counting clicks.
    await user.click(screen.getByRole("button", { name: "Τρέχουσα εβδομάδα" }));
    await waitFor(() => expect(screen.getByText("Εβδομάδα 09.11.2026")).toBeInTheDocument());
  });

  it("puts two bookings at the same time on two different days in one row", async () => {
    const user = userEvent.setup();
    renderScreen(AppointmentsScreen, parentsFixture(), invoke, { today: TODAY });
    await user.click(screen.getByRole("button", { name: "Προηγούμενη εβδομάδα" }));

    await waitFor(() => expect(screen.getByRole("rowheader", { name: "13:30" })).toBeInTheDocument());
    const row = screen.getByRole("rowheader", { name: "13:30" }).closest("tr")!;
    expect(within(row).getByText(/Άννα Παπαδοπούλου/)).toBeInTheDocument();
    expect(within(row).getByText(/Μαρία Ιωάννου/)).toBeInTheDocument();
  });

  /** **The "new record" trap**, for the second of M5's four creation buttons. */
  it("leaves every existing booking unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AppointmentsScreen, parentsFixture(), invoke, { today: TODAY });
    const before = structuredClone(backend.planner.parent_appointments);
    expect(before).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "Νέα συνάντηση" }));
    await waitFor(() => expect(backend.planner.parent_appointments).toHaveLength(7));

    for (const original of before) {
      expect(backend.planner.parent_appointments.find((a) => a.id === original.id)).toEqual(
        original,
      );
    }
    const created = backend.planner.parent_appointments.find(
      (a) => !before.some((b) => b.id === a.id),
    )!;
    // It lands on the week on show, which is the one the teacher is looking at.
    expect(created.date).toBe("2026-11-09");
    expect(created.status).toBe("proposed");
  });

  /** The mirror of the log's test: this screen cannot reach the log's table. */
  it("never writes to the communication log, whatever is done to it", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(AppointmentsScreen, parentsFixture(), invoke, { today: TODAY });
    const contactsBefore = structuredClone(backend.planner.parent_contacts);

    await user.click(screen.getByRole("button", { name: "Νέα συνάντηση" }));
    await waitFor(() => expect(backend.planner.parent_appointments).toHaveLength(7));

    expect(backend.planner.parent_contacts).toEqual(contactsBefore);
    expect(
      backend.calls.some((c) => c.command.includes("parent_contact")),
      "the grid screen called a contact command",
    ).toBe(false);
  });

  /**
   * **M5's third acceptance criterion, on the screen that carries the panel.**
   * The window itself is checked in `parents.test.ts`; this checks the wiring.
   */
  it("surfaces appointments and meetings due in the next seven days", async () => {
    renderScreen(AppointmentsScreen, parentsFixture(), invoke, { today: TODAY });
    const panel = within(screen.getByRole("heading", { name: "Επερχόμενες συναντήσεις" }).closest("section")!);

    // The meeting six days ahead, and the live booking three days ahead.
    expect(panel.getByText("Πρόοδος τμήματος · δύο περιστατικά")).toBeInTheDocument();
    expect(panel.getByText("Συνέχεια")).toBeInTheDocument();
    // The recent meeting, marked as already held.
    expect(panel.getByText("Προηγούμενος σύλλογος")).toBeInTheDocument();
    expect(panel.getByText("Έγινε")).toBeInTheDocument();
    // The cancelled booking inside the window is not something coming up.
    expect(panel.queryByText("Ακυρώθηκε")).not.toBeInTheDocument();
    // And the meeting beyond the horizon is out.
    expect(panel.queryByText("Πολύ μακριά")).not.toBeInTheDocument();
  });

  it("opens a meeting's minutes straight from the panel", async () => {
    const user = userEvent.setup();
    const opened: number[] = [];
    renderScreen(AppointmentsScreen, parentsFixture(), invoke, {
      today: TODAY,
      onOpenMeeting: (id: number) => opened.push(id),
    });

    // The button belonging to the council meeting, found by its agenda rather
    // than by its position in the list — the panel is in date order, and the
    // recent meeting comes first.
    const row = screen.getByText("Πρόοδος τμήματος · δύο περιστατικά").closest("div")!;
    await user.click(within(row).getByRole("button", { name: "Άνοιγμα πρακτικών" }));
    expect(opened).toEqual([MEETING_SOON]);
  });

  it("exports the week on show", async () => {
    const user = userEvent.setup();
    renderScreen(AppointmentsScreen, parentsFixture(), invoke, { today: TODAY });
    await user.click(screen.getByRole("button", { name: "Προηγούμενη εβδομάδα" }));
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF εβδομάδας" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("export_pdf", expect.objectContaining({})),
    );
    const call = invoke.mock.calls.find(([command]) => command === "export_pdf")!;
    const { html, fileName } = call[1] as Record<string, unknown>;

    expect(html).toContain(ANNA);
    expect(html).toContain("Πρόοδος στα Μαθηματικά");
    // A booking in another week is not on this sheet.
    expect(html).not.toContain("Εκτός παραθύρου");
    expect(fileName).toBe("Συναντήσεις γονέων — εβδομάδα 02.11.2026");
  });
});

describe("staff and council meetings", () => {
  it("lists every meeting with its agreements", () => {
    renderScreen(MeetingsScreen, parentsFixture(), invoke, {});
    const card = within(screen.getByRole("group", { name: "Συνεδρίαση 1" }));
    // Newest first: 20.11 is the most recent.
    expect(card.getByLabelText("Ημερομηνία")).toHaveValue("2026-11-20");

    const council = within(screen.getByRole("group", { name: "Συνεδρίαση 2" }));
    expect(council.getByLabelText("Είδος")).toHaveValue("council");
    expect(council.getByLabelText("Διάρκεια")).toHaveValue("90 λεπτά");
    expect(council.getByLabelText("Τμήμα")).toHaveValue(String(A1));
    expect(
      council.getByRole("group", { name: "Συμφωνία 1" }),
    ).toBeInTheDocument();
    expect(
      within(council.getByRole("group", { name: "Συμφωνία 2" })).getByLabelText("Προθεσμία"),
    ).toHaveValue("2026-11-18");
  });

  /** **The "new record" trap**, for the third of M5's four creation buttons. */
  it("leaves every existing meeting unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(MeetingsScreen, parentsFixture(), invoke, {});
    const before = structuredClone(backend.planner.staff_meetings);
    expect(before).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Νέα συνεδρίαση" }));
    await waitFor(() => expect(backend.planner.staff_meetings).toHaveLength(4));

    for (const original of before) {
      expect(backend.planner.staff_meetings.find((m) => m.id === original.id)).toEqual(original);
    }
    // And its siblings' agreements are untouched too.
    expect(backend.planner.meeting_agreements).toHaveLength(2);
  });

  /** **The "new record" trap**, for the fourth — a child record this time. */
  it("leaves every existing agreement unchanged when a new one is added", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(MeetingsScreen, parentsFixture(), invoke, {});
    const before = structuredClone(backend.planner.meeting_agreements);
    expect(before).toHaveLength(2);

    const council = within(screen.getByRole("group", { name: "Συνεδρίαση 2" }));
    await user.click(council.getByRole("button", { name: "Νέα συμφωνία" }));
    await waitFor(() => expect(backend.planner.meeting_agreements).toHaveLength(3));

    for (const original of before) {
      expect(backend.planner.meeting_agreements.find((a) => a.id === original.id)).toEqual(
        original,
      );
    }
    // It belongs to the meeting whose button was pressed, and goes on the end.
    const created = backend.planner.meeting_agreements.find(
      (a) => !before.some((b) => b.id === a.id),
    )!;
    expect(created.meeting_id).toBe(MEETING_SOON);
    expect(created.position).toBe(2);
  });

  it("writes an edited agreement to that agreement only", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(MeetingsScreen, parentsFixture(), invoke, {});
    const before = structuredClone(backend.planner.meeting_agreements);

    const council = within(screen.getByRole("group", { name: "Συνεδρίαση 2" }));
    const first = within(council.getByRole("group", { name: "Συμφωνία 1" }));
    const who = first.getByLabelText("Ποιος");
    await user.clear(who);
    await user.type(who, "Α. Δημητρίου");
    await user.tab();

    await waitFor(() =>
      expect(backend.planner.meeting_agreements.find((a) => a.id === 301)!.who).toBe(
        "Α. Δημητρίου",
      ),
    );
    expect(backend.planner.meeting_agreements.find((a) => a.id === 302)).toEqual(
      before.find((a) => a.id === 302),
    );
  });

  it("deletes a meeting and its agreements, and leaves the rest", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(MeetingsScreen, parentsFixture(), invoke, {});

    const council = within(screen.getByRole("group", { name: "Συνεδρίαση 2" }));
    await user.click(council.getByRole("button", { name: "Διαγραφή συνεδρίασης" }));

    await waitFor(() => expect(backend.planner.staff_meetings).toHaveLength(2));
    // Its two agreements went with it, as the schema's cascade does.
    expect(backend.planner.meeting_agreements).toHaveLength(0);
  });
});

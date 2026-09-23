/**
 * The letters screen and the message bank, driven as the app drives them.
 *
 * **M5's first acceptance criterion reaches its end here.** `printLetters.test`
 * proves the document builders leave no placeholder; these prove the *button*
 * hands that document to the export path — the HTML asserted on is the HTML
 * that actually reached `export_pdf`, not a document built alongside it.
 *
 * The copy-to-clipboard follows M4's timetable precedent, including its failure
 * message, so both paths are driven: one where the clipboard accepts and one
 * where it refuses.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderStandalone } = await import("../helpers/mount");
const { default: LettersScreen } = await import("../../src/screens/LettersScreen");
const { default: MessagesScreen } = await import("../../src/screens/MessagesScreen");

const TODAY = "2026-11-09";
/** The syntax the source uses, and the thing that must never reach a PDF. */
const ANY_PLACEHOLDER = /\[[^[\]]+\]/;

/**
 * These two screens take **only the day**. Their content is the language
 * bundle's, not the planner's — which is why M5 stores nothing for a letter.
 */
function renderLetters() {
  return renderStandalone(LettersScreen, { today: TODAY }, invoke);
}
function renderMessages() {
  return renderStandalone(MessagesScreen, { today: TODAY }, invoke);
}

/** jsdom exposes `navigator.clipboard` as a getter, so it is defined, not set
 * — the same helper M4's timetable test needed for the same reason. */
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

function exportedCall() {
  const call = invoke.mock.calls.find(([command]) => command === "export_pdf");
  return call?.[1] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  invoke.mockReset();
});

describe("the seven parent letters", () => {
  it("offers all seven, opening on the welcome letter", () => {
    renderLetters();
    const picker = screen.getByLabelText("Επιστολή");
    expect(within(picker).getAllByRole("option")).toHaveLength(7);
    expect(picker).toHaveValue("welcome");
    expect(screen.getByLabelText("ΤΜΗΜΑ")).toBeInTheDocument();
    expect(screen.getByLabelText("ΣΧΟΛΙΚΟ ΕΤΟΣ")).toBeInTheDocument();
  });

  it("shows each letter's own fields when it is picked", async () => {
    const user = userEvent.setup();
    renderLetters();

    await user.selectOptions(screen.getByLabelText("Επιστολή"), "atRisk");
    // The at-risk letter's own header, from the source page.
    expect(await screen.findByLabelText("ΜΑΘΗΤΗΣ")).toBeInTheDocument();
    expect(screen.getByLabelText("ΗΜΕΡΟΜΗΝΙΑ ΕΚΔΟΣΗΣ ΒΑΘΜΩΝ")).toBeInTheDocument();
    expect(screen.getByLabelText("ΛΟΓΟΙ")).toBeInTheDocument();
    expect(screen.getByLabelText("ΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ ΒΕΛΤΙΩΣΗΣ")).toBeInTheDocument();
  });

  it("keeps what was typed into one letter while another is being written", async () => {
    const user = userEvent.setup();
    renderLetters();

    await user.type(screen.getByLabelText("ΤΜΗΜΑ"), "Α1");
    await user.selectOptions(screen.getByLabelText("Επιστολή"), "consent");
    await user.type(await screen.findByLabelText("ΕΠΙΣΚΕΨΗ / ΠΡΟΟΡΙΣΜΟΣ"), "Μουσείο");

    await user.selectOptions(screen.getByLabelText("Επιστολή"), "welcome");
    // Still there — a draft per letter, so switching is not losing.
    expect(await screen.findByLabelText("ΤΜΗΜΑ")).toHaveValue("Α1");

    await user.selectOptions(screen.getByLabelText("Επιστολή"), "consent");
    expect(await screen.findByLabelText("ΕΠΙΣΚΕΨΗ / ΠΡΟΟΡΙΣΜΟΣ")).toHaveValue("Μουσείο");
  });

  /**
   * **The criterion, through the real button.** A half-filled letter is the
   * case that matters: it is the one where an unfilled token could escape.
   */
  it("exports a half-filled letter with no placeholder left on it", async () => {
    const user = userEvent.setup();
    renderLetters();

    await user.selectOptions(screen.getByLabelText("Επιστολή"), "invitation");
    await user.type(await screen.findByLabelText("ΤΜΗΜΑ"), "Α1");
    // Deliberately leaving the slip's own fields empty.
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF επιστολής" }));

    await waitFor(() => expect(exportedCall()).toBeDefined());
    const { html, fileName, landscape } = exportedCall()!;

    expect(String(html)).toContain("Α1");
    expect(String(html)).toContain("ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ");
    expect(String(html).match(ANY_PLACEHOLDER)).toBeNull();
    // Letters are portrait — the first use of that flag in the project.
    expect(landscape).toBe(false);
    expect(fileName).toBe("Πρόσκληση — 09.11.2026");
  });

  it("exports a fully filled letter with everything the teacher typed on it", async () => {
    const user = userEvent.setup();
    renderLetters();

    await user.type(screen.getByLabelText("ΤΜΗΜΑ"), "Α1");
    await user.type(screen.getByLabelText("ΣΧΟΛΙΚΟ ΕΤΟΣ"), "2026-2027");
    await user.type(screen.getByLabelText("ΚΕΙΜΕΝΟ ΕΠΙΣΤΟΛΗΣ"), "Καλωσορίσατε στη νέα χρονιά.");
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF επιστολής" }));

    await waitFor(() => expect(exportedCall()).toBeDefined());
    const { html } = exportedCall()!;
    expect(String(html)).toContain("Καλωσορίσατε στη νέα χρονιά.");
    expect(String(html)).toContain("2026-2027");
    expect(String(html)).toContain("Αγαπητοί γονείς,");
    expect(String(html).match(ANY_PLACEHOLDER)).toBeNull();
  });

  it("exports a certificate with the name and the reason on it", async () => {
    const user = userEvent.setup();
    renderLetters();

    await user.selectOptions(screen.getByLabelText("Επιστολή"), "praise");
    await user.type(await screen.findByLabelText("Ονοματεπώνυμο"), "Ελένη Παπαδοπούλου");
    await user.type(screen.getByLabelText("Αιτιολογία"), "τη συνέπειά της");
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF επιστολής" }));

    await waitFor(() => expect(exportedCall()).toBeDefined());
    const { html, fileName } = exportedCall()!;
    expect(String(html)).toContain("Ελένη Παπαδοπούλου");
    expect(String(html)).toContain("τη συνέπειά της");
    expect(String(html)).toContain('class="certificate"');
    expect(fileName).toBe("Έπαινος — 09.11.2026");
  });

  it("clears one letter without touching another", async () => {
    const user = userEvent.setup();
    renderLetters();

    await user.type(screen.getByLabelText("ΤΜΗΜΑ"), "Α1");
    await user.selectOptions(screen.getByLabelText("Επιστολή"), "consent");
    await user.type(await screen.findByLabelText("ΕΠΙΣΚΕΨΗ / ΠΡΟΟΡΙΣΜΟΣ"), "Μουσείο");
    await user.click(screen.getByRole("button", { name: "Καθαρισμός" }));

    expect(screen.getByLabelText("ΕΠΙΣΚΕΨΗ / ΠΡΟΟΡΙΣΜΟΣ")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("Επιστολή"), "welcome");
    expect(await screen.findByLabelText("ΤΜΗΜΑ")).toHaveValue("Α1");
  });
});

describe("the 150-message bank", () => {
  it("opens on the whole bank", () => {
    renderMessages();
    expect(screen.getByText("150 μηνύματα")).toBeInTheDocument();
  });

  it("narrows by category", async () => {
    const user = userEvent.setup();
    renderMessages();
    await user.selectOptions(screen.getByLabelText("Κατηγορία"), "c04");
    await waitFor(() => expect(screen.getByText("10 μηνύματα")).toBeInTheDocument());
  });

  it("searches without the accent key, which is how a teacher types", async () => {
    const user = userEvent.setup();
    renderMessages();

    await user.type(screen.getByLabelText("Αναζήτηση"), "απουσιες");
    await waitFor(() => {
      const count = screen.getByText(/μηνύματα$/).textContent!;
      expect(Number(count.split(" ")[0])).toBeLessThan(150);
    });
    // The accented word is what is actually in the bank.
    expect(screen.getAllByRole("button", { name: "Επιλογή" }).length).toBeGreaterThan(0);
  });

  it("says so when nothing matches, rather than looking empty", async () => {
    const user = userEvent.setup();
    renderMessages();
    await user.type(screen.getByLabelText("Αναζήτηση"), "zzzzzz");
    await waitFor(() =>
      expect(screen.getByText(/Κανένα μήνυμα δεν ταιριάζει/)).toBeInTheDocument(),
    );
  });

  it("offers a field per placeholder once a message is picked", async () => {
    const user = userEvent.setup();
    renderMessages();

    await user.click(screen.getAllByRole("button", { name: "Επιλογή" })[0]);
    // The first message names the teacher, her subject, her class and her email.
    expect(await screen.findByLabelText("ΟΝΟΜΑΤΕΠΩΝΥΜΟ")).toBeInTheDocument();
    expect(screen.getByLabelText("ΜΑΘΗΜΑ")).toBeInTheDocument();
    expect(screen.getByLabelText("EMAIL")).toBeInTheDocument();
  });

  it("exports a filled message with no placeholder left on it", async () => {
    const user = userEvent.setup();
    renderMessages();

    await user.click(screen.getAllByRole("button", { name: "Επιλογή" })[0]);
    await user.type(await screen.findByLabelText("ΟΝΟΜΑΤΕΠΩΝΥΜΟ"), "Μ. Νικολάου");
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF μηνύματος" }));

    await waitFor(() => expect(exportedCall()).toBeDefined());
    const { html, landscape } = exportedCall()!;
    expect(String(html)).toContain("Μ. Νικολάου");
    expect(String(html).match(ANY_PLACEHOLDER)).toBeNull();
    expect(landscape).toBe(false);
  });

  it("exports an unfilled message with no placeholder left on it either", async () => {
    const user = userEvent.setup();
    renderMessages();

    await user.click(screen.getAllByRole("button", { name: "Επιλογή" })[0]);
    await user.click(await screen.findByRole("button", { name: "Εξαγωγή PDF μηνύματος" }));

    await waitFor(() => expect(exportedCall()).toBeDefined());
    expect(String(exportedCall()!.html).match(ANY_PLACEHOLDER)).toBeNull();
  });

  /** M4's timetable precedent, both paths. */
  it("copies the filled text to the clipboard", async () => {
    // setup() installs a clipboard stub of its own, so ours goes on after it.
    const user = userEvent.setup();
    const writeText = stubClipboard(vi.fn().mockResolvedValue(undefined));
    renderMessages();

    await user.click(screen.getAllByRole("button", { name: "Επιλογή" })[0]);
    await user.type(await screen.findByLabelText("ΟΝΟΜΑΤΕΠΩΝΥΜΟ"), "Μ. Νικολάου");
    await user.click(screen.getByRole("button", { name: "Αντιγραφή ως κείμενο" }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Μ. Νικολάου");
    expect(copied.match(ANY_PLACEHOLDER)).toBeNull();
    // It is plain text, not the printed document.
    expect(copied).not.toContain("<");
    expect(await screen.findByRole("status")).toHaveTextContent("Το μήνυμα αντιγράφηκε.");
  });

  it("says so when the clipboard refuses, rather than failing silently", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    renderMessages();

    await user.click(screen.getAllByRole("button", { name: "Επιλογή" })[0]);
    await user.click(await screen.findByRole("button", { name: "Αντιγραφή ως κείμενο" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Η αντιγραφή δεν ήταν δυνατή/);
  });
});

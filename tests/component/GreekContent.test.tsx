/**
 * **The app as it ships (M10): an English interface, Greek content.**
 *
 * The English letters, message bank and forms' fixed text are an unreviewed
 * machine-translated draft (M9). The product owner's call at M10 is that they
 * are not shown until someone who reads both languages has reviewed them, so in
 * the English interface:
 *
 * - every label, button and caption is English, exactly as M9 made it;
 * - the letters, the messages, the checklist's items and the folder's
 *   suggested boxes are Greek — with a sentence on each of those screens
 *   saying why;
 * - **a letter or a message prints wholly in Greek**, footer and file name
 *   included, because it is a document for a parent and not a screen;
 * - a form or the folder prints English captions around the Greek content,
 *   because its captions are the app's labels.
 *
 * `Bilingual.test.tsx` is the other half of "tested both ways": it switches the
 * English content on and holds M9's criterion — every draft on every screen and
 * in every document.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Planner } from "../../src/domain/types";
import { htmlText } from "../helpers/languageChecks";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { createFakeBackend } = await import("../helpers/fakeBackend");
const { default: App } = await import("../../src/App");
const { gradedPlanner } = await import("../helpers/gradebookFixture");
const { formsPlanner, A_WEDNESDAY } = await import("../helpers/formsFixture");
const { ENGLISH_CONTENT_REVIEWED } = await import("../../src/i18n/contentReview");

type Backend = ReturnType<typeof createFakeBackend>;

const NOTE =
  "The letters, the messages and the fixed text of the templates and the substitute folder stay in Greek until a person has checked their English translation.";

function mount(planner: Planner, today = "2026-11-09"): Backend {
  const backend = createFakeBackend(planner);
  invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    try {
      return Promise.resolve(backend.handle(command, args));
    } catch (e) {
      return Promise.reject(e);
    }
  });
  render(<App today={today} />);
  return backend;
}

const inEnglish = (planner: Planner): Planner => ({ ...planner, preferences: { locale: "en" } });
const topTab = (name: string) =>
  within(screen.getAllByRole("navigation")[0]).getByRole("button", { name });
const subTab = (name: string) =>
  within(screen.getAllByRole("navigation")[1]).getByRole("button", { name });

function exports(backend: Backend) {
  return backend.calls
    .filter((c) => c.command === "export_pdf")
    .map((c) => ({ html: String(c.args.html), fileName: String(c.args.fileName) }));
}

async function exportWith(user: ReturnType<typeof userEvent.setup>, backend: Backend, label: string) {
  const before = exports(backend).length;
  await user.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(exports(backend).length).toBe(before + 1));
  return exports(backend)[before];
}

/** Words that only the English bundle prints on a document. */
const ENGLISH_DOCUMENT_WORDS = ["Printed", "Teacher Planner", "CUT OFF AND RETURN", "Message —"];

beforeEach(() => {
  invoke.mockReset();
});

describe("the English interface, as shipped, with Greek content", () => {
  it("ships with the English content held back", () => {
    // The one line that turns the drafts on. If it is flipped, this file's
    // expectations are the wrong ones and `Bilingual.test.tsx` is the suite.
    expect(ENGLISH_CONTENT_REVIEWED).toBe(false);
  });

  it("shows a letter in Greek in an English screen, and prints it wholly in Greek", async () => {
    const backend = mount(inEnglish(gradedPlanner()));
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Parents & Staff"));
    await user.click(subTab("Letters"));

    // The screen is English, and says why its letters are not.
    expect(screen.getByRole("heading", { name: "Ready-made letters to parents" })).toBeInTheDocument();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    // The letters themselves are the Greek ones.
    const pick = screen.getByLabelText("Letter") as HTMLSelectElement;
    expect([...pick.options].map((o) => o.textContent)).toContain("Πρόσκληση");
    await user.selectOptions(pick, "invitation");
    await user.type(screen.getByLabelText("ΤΟΠΟΣ / ΑΙΘΟΥΣΑ"), "Αίθουσα 12");
    await user.type(screen.getByLabelText("ΜΑΘΗΤΗΣ"), "Ελένη Παπαδοπούλου");

    const { html, fileName } = await exportWith(user, backend, "Export letter as PDF");
    const text = htmlText(html);
    expect(fileName).toBe("Πρόσκληση — 09.11.2026");
    expect(text).toContain("σε συνάντηση / συνεντεύξεις");
    expect(text).toContain("ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ");
    expect(text).toContain("Ελένη Παπαδοπούλου");
    // The footer is Greek too: one document, one language.
    expect(text).toContain("Ημερολόγιο Εκπαιδευτικού · Εκτυπώθηκε 09.11.2026");
    for (const word of ENGLISH_DOCUMENT_WORDS) expect(text).not.toContain(word);
    expect(text).not.toMatch(/\[[^\]]+\]/);
  });

  it("searches, fills and prints a message in Greek from an English screen", async () => {
    const backend = mount(inEnglish(gradedPlanner()));
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Parents & Staff"));
    await user.click(subTab("Messages"));
    expect(screen.getByText(NOTE)).toBeInTheDocument();

    // A Greek phrase finds the Greek bank; the count is the English label's.
    await user.type(screen.getByLabelText("Search"), "καλωσόρισμα στην αρχή");
    expect(screen.getByText("1 message")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Choose" })[0]);
    expect(
      await screen.findByRole("heading", { name: "Καλωσόρισμα στην αρχή της χρονιάς" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("ΟΝΟΜΑΤΕΠΩΝΥΜΟ"), "Μαρία Νικολάου");

    const { html, fileName } = await exportWith(user, backend, "Export message as PDF");
    const text = htmlText(html);
    expect(fileName).toBe("Μήνυμα — Καλωσόρισμα στην αρχή της χρονιάς — 09.11.2026");
    expect(text).toContain("Αγαπητοί γονείς, ονομάζομαι Μαρία Νικολάου");
    expect(text).toContain("Ημερολόγιο Εκπαιδευτικού · Εκτυπώθηκε 09.11.2026");
    for (const word of ENGLISH_DOCUMENT_WORDS) expect(text).not.toContain(word);
    expect(text).not.toMatch(/\[[^\]]+\]/);
  });

  it("prints a form's English captions around its Greek checklist", async () => {
    const backend = mount(inEnglish(formsPlanner()), A_WEDNESDAY);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Templates"));
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Checklist for the period" }));
    const blank = await exportWith(user, backend, "Blank PDF");
    const text = htmlText(blank.html);
    expect(blank.fileName).toBe("Checklist for the period — blank");
    expect(text).toContain("START OF THE PERIOD");
    expect(text).toContain("Οι λίστες μαθητών ενημερώθηκαν");
    expect(text).not.toContain("Class lists have been updated");
  });

  it("shows and prints the folder's untouched boxes in Greek under English captions", async () => {
    const backend = mount(inEnglish(formsPlanner()), A_WEDNESDAY);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Classes"));
    await user.click(subTab("Substitute folder"));
    await screen.findByRole("heading", { name: "Substitute folder" });
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("WHAT TO DO IF SOMETHING GOES WRONG") as HTMLTextAreaElement).value,
    ).toMatch(/^Για οποιοδήποτε σοβαρό θέμα/);

    const { html } = await exportWith(user, backend, "Export folder as PDF");
    const text = htmlText(html);
    expect(text).toContain("Contacts and procedures");
    expect(text).toContain("Για οποιοδήποτε σοβαρό θέμα, ενημερώστε αμέσως τη Διεύθυνση.");
    expect(text).not.toContain("For anything serious");
  });

  it("says nothing about it in the Greek interface, where there is nothing held back", async () => {
    mount(gradedPlanner());
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    await user.click(topTab("Γονείς & Ομάδα"));
    await user.click(subTab("Επιστολές"));
    expect(screen.queryByText(/μένουν στα ελληνικά/)).not.toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});

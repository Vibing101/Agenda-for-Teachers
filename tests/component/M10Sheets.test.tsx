/**
 * M10's three new exports, pressed on the real screens and read back off the
 * HTML that actually reached `export_pdf` — M4.5's rule that a sheet carries
 * what the screen shows, checked where the button is.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeBackend } from "../helpers/fakeBackend";
import { htmlText } from "../helpers/languageChecks";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { renderScreen } = await import("../helpers/mount");
const { emptyPlanner } = await import("../helpers/fakeBackend");
const { parentsFixture, TODAY, MEETING_SOON } = await import("../helpers/parentsFixture");
const { gradedPlanner, CLASS_ID } = await import("../helpers/gradebookFixture");
const { default: MeetingsScreen } = await import("../../src/screens/MeetingsScreen");
const { default: YearScreen } = await import("../../src/screens/YearScreen");
const { default: GradesScreen } = await import("../../src/screens/GradesScreen");

function exports(backend: FakeBackend) {
  return backend.calls
    .filter((c) => c.command === "export_pdf")
    .map((c) => ({
      html: String(c.args.html),
      fileName: String(c.args.fileName),
      landscape: Boolean(c.args.landscape),
    }));
}

async function press(
  user: ReturnType<typeof userEvent.setup>,
  backend: FakeBackend,
  button: HTMLElement,
) {
  const before = exports(backend).length;
  await user.click(button);
  await waitFor(() => expect(exports(backend).length).toBe(before + 1));
  return exports(backend)[before];
}

beforeEach(() => {
  invoke.mockReset();
});

describe("a meeting's minutes, from its card", () => {
  it("exports the card it is on — its fields and its agreements, and no other meeting's", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(MeetingsScreen, parentsFixture(), invoke, { today: TODAY });
    // Newest first: the 20.11 meeting is card 1, the 15.11 council card 2.
    const card = within(screen.getByRole("group", { name: "Συνεδρίαση 2" }));
    const { html, fileName, landscape } = await press(
      user,
      backend,
      card.getByRole("button", { name: "Εξαγωγή PDF πρακτικού" }),
    );
    const text = htmlText(html);
    expect(landscape).toBe(false);
    expect(fileName).toBe("Πρακτικό — Συμβούλιο τμήματος — 15.11.2026");
    expect(text).toContain("Πρόοδος τμήματος · δύο περιστατικά");
    expect(text).toContain("Επικοινωνία με τους γονείς δύο μαθητών");
    expect(text).toContain("18.11.2026");
    expect(text).not.toContain("Πολύ μακριά");
    expect(text).not.toContain("Προηγούμενος σύλλογος");
    // Exporting is not a write.
    expect(backend.calls.some((c) => c.command.startsWith("save_"))).toBe(false);
  });

  it("prints what the card holds now: an agenda edited on the card is on the next export", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(MeetingsScreen, parentsFixture(), invoke, { today: TODAY });
    const card = within(screen.getByRole("group", { name: "Συνεδρίαση 2" }));
    const agenda = card.getByLabelText("Ημερήσια διάταξη");
    await user.clear(agenda);
    await user.type(agenda, "Νέα ημερήσια διάταξη");
    await user.tab();
    await waitFor(() =>
      expect(backend.planner.staff_meetings.find((m) => m.id === MEETING_SOON)!.agenda).toBe(
        "Νέα ημερήσια διάταξη",
      ),
    );
    const { html } = await press(
      user,
      backend,
      within(screen.getByRole("group", { name: "Συνεδρίαση 2" })).getByRole("button", {
        name: "Εξαγωγή PDF πρακτικού",
      }),
    );
    expect(htmlText(html)).toContain("Νέα ημερήσια διάταξη");
    expect(htmlText(html)).not.toContain("Πρόοδος τμήματος · δύο περιστατικά");
  });
});

describe("the six annual goals, from the year screen", () => {
  it("prints the cards as they are on screen, in their order", async () => {
    const user = userEvent.setup();
    const planner = emptyPlanner();
    planner.school_year = { year_model: "sep_aug", start_date: "2026-09-14" };
    // Stored out of order; the cards, and so the sheet, follow the source's order.
    planner.annual_goals = [...planner.annual_goals].reverse();
    const backend = renderScreen(YearScreen, planner, invoke, { today: TODAY });

    const goals = within(screen.getByText("Στόχοι για τη χρονιά").closest("section")!);
    const firstGoal = goals.getAllByLabelText("Στόχος")[0];
    await user.type(firstGoal, "Περισσότερη ομαδική δουλειά");

    const { html, fileName, landscape } = await press(
      user,
      backend,
      goals.getByRole("button", { name: "Εξαγωγή PDF στόχων" }),
    );
    const text = htmlText(html);
    expect(landscape).toBe(true);
    expect(fileName).toBe("Στόχοι για τη χρονιά — 09.11.2026");
    // What the teacher is looking at, typed and not yet saved (M4.5's rule).
    expect(text).toContain("Περισσότερη ομαδική δουλειά");
    expect(text).toContain("14.09.2026");
    // The first card and the first row are both "teaching and content".
    expect(goals.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(
      "Διδασκαλία και περιεχόμενο",
    );
    const rows = html.split("<tr>").slice(2); // past the header row
    expect(rows[0]).toContain("Διδασκαλία και περιεχόμενο");
    expect(rows[0]).toContain("Περισσότερη ομαδική δουλειά");
  });
});

describe("the grade sheet with the conduct sheet", () => {
  it("exports both as one file from the gradebook, and the conduct sheet alone from its own button", async () => {
    const user = userEvent.setup();
    const backend = renderScreen(GradesScreen, gradedPlanner(), invoke, { today: TODAY });
    void CLASS_ID;
    const bundle = await press(
      user,
      backend,
      screen.getByRole("button", { name: "Εξαγωγή PDF βαθμών και συμπεριφοράς" }),
    );
    expect(bundle.landscape).toBe(true);
    expect(bundle.fileName).toMatch(/^Βαθμοί και συμπεριφορά — /);
    expect(bundle.html.match(/data-sheet /g)).toHaveLength(2);
    const bundleText = htmlText(bundle.html);
    expect(bundleText).toContain("Βαθμοί τάξης");
    expect(bundleText).toContain("Συμπεριφορά και στάση του μαθητή");

    const alone = await press(
      user,
      backend,
      screen.getByRole("button", { name: "Εξαγωγή PDF συμπεριφοράς" }),
    );
    expect(alone.html.match(/data-sheet /g)).toHaveLength(1);
    expect(htmlText(alone.html)).not.toContain("Βαθμοί τάξης");
  });
});

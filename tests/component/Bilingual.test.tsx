/**
 * **M9's first acceptance criterion, driven through the real shell.**
 *
 * "Every UI string, all 7 letters, and all 150 messages have both a Greek and
 * an English version; switching the language toggle changes all of them, with
 * no string left showing a placeholder or the wrong language."
 *
 * `i18nParity.test.ts` holds the bundles string by string. These tests hold the
 * *switch*: that pressing the toggle reaches every screen and every printed
 * document, that nothing the teacher typed changes with it, that what she had
 * filled in survives it, and that the language comes from the data file and
 * never from the OS.
 *
 * A suite that queried the app only by its Greek labels would keep passing if
 * the toggle did nothing at all. So every test here **switches and then
 * asserts the English is there and the Greek is gone** — and the sweep at the
 * end looks for any Greek letter left on any screen, in either the text or the
 * attributes, once the teacher's own words are set aside.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Planner } from "../../src/domain/types";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { createFakeBackend, emptyPlanner } = await import("../helpers/fakeBackend");
const { default: App } = await import("../../src/App");
const { gradedPlanner } = await import("../helpers/gradebookFixture");
const { supportPlanner } = await import("../helpers/supportFixture");
const { parentsFixture, TODAY: PARENTS_TODAY } = await import("../helpers/parentsFixture");
const { planningPlanner } = await import("../helpers/planningFixture");
const { formsPlanner, A_WEDNESDAY, A1: FORMS_A1 } = await import("../helpers/formsFixture");
const { growthPlanner, TODAY: GROWTH_TODAY } = await import("../helpers/growthFixture");
const { weekPlanner } = await import("../helpers/weekFixture");

type Backend = ReturnType<typeof createFakeBackend>;

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const GREEK_RUN = /[Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿\s.,·]*/g;

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

function inEnglish(planner: Planner): Planner {
  return { ...planner, preferences: { locale: "en" } };
}

const topTab = (name: string) =>
  within(screen.getAllByRole("navigation")[0]).getByRole("button", { name });
const subTab = (name: string) =>
  within(screen.getAllByRole("navigation")[1]).getByRole("button", { name });
const toggle = () => screen.getByRole("group", { name: /^(Γλώσσα|Language)$/ });

async function switchTo(user: ReturnType<typeof userEvent.setup>, name: "English" | "Ελληνικά") {
  await user.click(within(toggle()).getByRole("button", { name }));
}

/** Every string the teacher (or the fixture, for her) put in the file. */
function teacherStrings(planner: Planner): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.trim()) out.add(v.trim());
      for (const line of v.split("\n")) if (line.trim()) out.add(line.trim());
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(planner);
  // The fake backend's folder path is the teacher's folder name, not a label.
  out.add("/Drive/Ατζέντα/data/planner.sqlite");
  out.add("/Drive/Ατζέντα");
  // The toggle names Greek in Greek, on purpose.
  out.add("Ελληνικά");
  return [...out].sort((a, b) => b.length - a.length);
}

/** Every Greek run left in a piece of text once the teacher's words are removed. */
function greekLeftIn(text: string, allowed: string[]): string[] {
  let rest = text;
  for (const a of allowed) rest = rest.split(a).join(" ");
  return [...rest.matchAll(GREEK_RUN)].map((m) => m[0].trim()).filter(Boolean);
}

/** The whole visible page as text: text nodes, form values, and the attributes a reader hears. */
function pageText(): string {
  const parts = [document.body.textContent ?? ""];
  for (const el of document.body.querySelectorAll("*")) {
    for (const attr of ["aria-label", "placeholder", "title", "alt"]) {
      const v = el.getAttribute(attr);
      if (v) parts.push(v);
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) parts.push(el.value);
  }
  return parts.join("\n");
}

/** The visible text of an exported document's HTML. */
function htmlText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function exports(backend: Backend) {
  return backend.calls
    .filter((c) => c.command === "export_pdf")
    .map((c) => ({
      html: String(c.args.html),
      fileName: String(c.args.fileName),
      landscape: Boolean(c.args.landscape),
    }));
}

async function exportWith(user: ReturnType<typeof userEvent.setup>, backend: Backend, label: string) {
  const before = exports(backend).length;
  await user.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(exports(backend).length).toBe(before + 1));
  return exports(backend)[before];
}

beforeEach(() => {
  invoke.mockReset();
});

// ------------------------------------------------------------ the shell ---

describe("the language toggle", () => {
  it("switches the whole shell to English and back, and stores the choice in the file", async () => {
    const backend = mount(gradedPlanner());
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();
    expect(topTab("Τάξεις")).toBeInTheDocument();

    await switchTo(user, "English");

    // Written to the file, through the one mutation path.
    await waitFor(() => expect(backend.planner.preferences.locale).toBe("en"));
    expect(backend.calls.filter((c) => c.command === "save_locale")).toHaveLength(1);

    // The English is there…
    expect(await screen.findByRole("heading", { name: "School year" })).toBeInTheDocument();
    for (const name of ["Year", "Classes", "Students", "Grades", "Timetable", "Planning"]) {
      expect(topTab(name)).toBeInTheDocument();
    }
    expect(screen.getByText("Where your data is kept")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Teacher's Agenda");
    // The title bar is asked to follow, through Tauri's window API.
    await waitFor(() =>
      expect(
        invoke.mock.calls.some(
          ([cmd, args]) => cmd === "set_window_title" && JSON.stringify(args).includes("Teacher's Agenda"),
        ),
      ).toBe(true),
    );
    // …and the Greek is gone.
    for (const name of ["Τάξεις", "Μαθητές", "Βαθμοί", "Σχολικό έτος", "Πού αποθηκεύονται τα δεδομένα"]) {
      expect(screen.queryByText(name)).toBeNull();
    }

    await switchTo(user, "Ελληνικά");
    await waitFor(() => expect(backend.planner.preferences.locale).toBe("el"));
    expect(await screen.findByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();
    expect(screen.queryByText("School year")).toBeNull();
    expect(document.documentElement.lang).toBe("el");
  });

  it("never translates what the teacher typed", async () => {
    const planner = gradedPlanner();
    const className = planner.classes[0].name;
    const student = planner.students[0].full_name;
    mount(planner);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    await switchTo(user, "English");
    await user.click(await screen.findByRole("button", { name: "Students" }));
    expect(await screen.findByRole("heading", { name: "Student index" })).toBeInTheDocument();
    // Her Greek names, exactly as typed, in an English interface.
    expect(GREEK.test(student)).toBe(true);
    expect(screen.getAllByText(student, { exact: false }).length).toBeGreaterThan(0);
    await user.click(topTab("Classes"));
    expect(screen.getAllByText(className, { exact: false }).length).toBeGreaterThan(0);
  });

  it("opens in the language the file says, whatever the operating system says", async () => {
    const spy = vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");
    const spyAll = vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["en-GB", "en"]);
    try {
      mount(gradedPlanner());
      // The file says Greek (every file before M9 does) and the OS says English.
      expect(await screen.findByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();
      expect(screen.queryByText("School year")).toBeNull();
    } finally {
      spy.mockRestore();
      spyAll.mockRestore();
    }
  });

  it("opens in English when the file says English, on a Greek operating system", async () => {
    const spy = vi.spyOn(window.navigator, "language", "get").mockReturnValue("el-GR");
    const spyAll = vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["el-GR", "el"]);
    try {
      mount(inEnglish(gradedPlanner()));
      expect(await screen.findByRole("heading", { name: "School year" })).toBeInTheDocument();
      expect(screen.queryByText("Σχολικό έτος")).toBeNull();
    } finally {
      spy.mockRestore();
      spyAll.mockRestore();
    }
  });

  it("falls back to Greek for a language the app does not have", async () => {
    mount({ ...gradedPlanner(), preferences: { locale: "fr" } });
    expect(await screen.findByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();
  });

  /**
   * The M0 guard, which every write goes through, covers this write too. A
   * language switch against a file another device changed is refused and the
   * block comes up — and the toggle is disabled until the reload.
   */
  it("is a write like any other: refused and disabled while the file is blocked", async () => {
    const backend = mount(gradedPlanner());
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });

    backend.markDiskChanged();
    await switchTo(user, "English");
    expect(await screen.findByRole("alert")).toHaveTextContent("Το αρχείο δεδομένων άλλαξε στον δίσκο");
    expect(backend.planner.preferences.locale).toBe("el");
    expect(within(toggle()).getByRole("button", { name: "English" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Σχολικό έτος" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Επαναφόρτωση από τον δίσκο" }));
    await waitFor(() =>
      expect(within(toggle()).getByRole("button", { name: "English" })).toBeEnabled(),
    );
  });

  it("words a failure from the Rust side in the interface language", async () => {
    const backend = mount(inEnglish(gradedPlanner()));
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    // An export the Rust side refuses with its own (English, technical) message.
    const handle = backend.handle;
    backend.handle = (command, args) => {
      if (command === "export_pdf") throw { code: "pdf", message: "the print window timed out" };
      return handle(command, args);
    };
    await user.click(topTab("Grades"));
    await user.click(screen.getByRole("button", { name: "Export grades as PDF" }));
    expect(
      await screen.findByText("The PDF could not be created: the print window timed out"),
    ).toBeInTheDocument();

    await switchTo(user, "Ελληνικά");
    await user.click(screen.getByRole("button", { name: "Εξαγωγή PDF βαθμών" }));
    expect(
      await screen.findByText("Δεν ήταν δυνατή η δημιουργία του PDF: the print window timed out"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------- printed documents ---

describe("printed output follows the language at the moment of generation", () => {
  it("a table sheet: the grade sheet", async () => {
    const planner = gradedPlanner();
    const backend = mount(planner);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    await user.click(topTab("Βαθμοί"));
    const greek = await exportWith(user, backend, "Εξαγωγή PDF βαθμών");
    expect(htmlText(greek.html)).toContain("Βαθμοί τάξης");

    await switchTo(user, "English");
    const english = await exportWith(user, backend, "Export grades as PDF");
    const text = htmlText(english.html);
    expect(text).toContain("Class grades");
    expect(text).toContain("PASS MARK");
    expect(text).not.toContain("Βαθμοί τάξης");
    expect(english.fileName).toMatch(/^Grades — /);
    // Dates stay dd.MM.yyyy and numbers keep a dot, in English too.
    expect(text).toMatch(/Printed \d{2}\.\d{2}\.\d{4}/);
    expect(text).not.toMatch(/\d,\d/);
    expect(greekLeftIn(text, teacherStrings(planner))).toEqual([]);
  });

  it("a letter, with a reply slip filled in Greek, keeps its values in English", async () => {
    const planner = gradedPlanner();
    const backend = mount(planner);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    await user.click(topTab("Γονείς & Ομάδα"));
    await user.click(subTab("Επιστολές"));
    await user.selectOptions(screen.getByLabelText("Επιστολή"), "invitation");
    await user.type(screen.getByLabelText("ΤΟΠΟΣ / ΑΙΘΟΥΣΑ"), "Αίθουσα 12");
    await user.type(screen.getByLabelText("ΜΑΘΗΤΗΣ"), "Ελένη Παπαδοπούλου");

    await switchTo(user, "English");
    // The slip's token is now spelled in English, and still holds her value.
    expect(await screen.findByLabelText("STUDENT")).toHaveValue("Ελένη Παπαδοπούλου");
    expect(screen.getByLabelText("PLACE / ROOM")).toHaveValue("Αίθουσα 12");

    const { html, fileName, landscape } = await exportWith(user, backend, "Export letter as PDF");
    const text = htmlText(html);
    expect(landscape).toBe(false);
    expect(fileName).toBe("Invitation — 09.11.2026");
    expect(text).toContain("to a meeting / interviews");
    expect(text).toContain("CUT OFF AND RETURN");
    expect(text).toContain("parent / guardian of the student Ελένη Παπαδοπούλου");
    expect(text).toContain("Αίθουσα 12");
    expect(text).not.toMatch(/\[[^\]]+\]/);
    expect(greekLeftIn(text, [...teacherStrings(planner), "Ελένη Παπαδοπούλου", "Αίθουσα 12"])).toEqual([]);
  });

  /**
   * **The message bank's own defect, fixed at M9.** Before M9 a filled value
   * was kept against the token's Greek spelling — `values["ΜΑΘΗΜΑ"]` — so the
   * English message, whose slot reads `[SUBJECT]`, would have come out with
   * every value gone and a ruled blank in its place. Filled in Greek, switched,
   * exported: every value is there and no bracket is left.
   */
  it("a message filled in Greek exports in English with every value, and copies the same", async () => {
    const planner = gradedPlanner();
    const backend = mount(planner);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    await user.click(topTab("Γονείς & Ομάδα"));
    await user.click(subTab("Μηνύματα"));
    await user.type(screen.getByLabelText("Αναζήτηση"), "καλωσόρισμα στην αρχή");
    await user.click(screen.getAllByRole("button", { name: "Επιλογή" })[0]);
    const values: Record<string, string> = {
      "ΟΝΟΜΑΤΕΠΩΝΥΜΟ": "Μαρία Νικολάου",
      "ΜΑΘΗΜΑ": "Μαθηματικά",
      "ΤΜΗΜΑ": "Α1",
      EMAIL: "maria@example.org",
    };
    for (const [token, value] of Object.entries(values)) {
      await user.type(screen.getByLabelText(token), value);
    }

    await switchTo(user, "English");
    // The message stays open although the Greek search matches nothing in English…
    expect(await screen.findByRole("heading", { name: "Welcome at the start of the year" })).toBeInTheDocument();
    // …and every field holds what she typed, under its English caption.
    expect(screen.getByLabelText("FULL NAME")).toHaveValue("Μαρία Νικολάου");
    expect(screen.getByLabelText("SUBJECT")).toHaveValue("Μαθηματικά");
    expect(screen.getByLabelText("CLASS")).toHaveValue("Α1");
    expect(screen.getByLabelText("EMAIL")).toHaveValue("maria@example.org");

    const { html, fileName } = await exportWith(user, backend, "Export message as PDF");
    const text = htmlText(html);
    expect(fileName).toBe("Message — Welcome at the start of the year — 09.11.2026");
    expect(text).toContain(
      "Dear parents, my name is Μαρία Νικολάου and this year I teach Μαθηματικά to class Α1.",
    );
    expect(text).toContain("You can reach me at maria@example.org. Kind regards, Μαρία Νικολάου.");
    expect(text).not.toMatch(/\[[^\]]+\]/);
    expect(text).not.toContain("__________");
    expect(greekLeftIn(text, [...teacherStrings(planner), ...Object.values(values)])).toEqual([]);
  });

  it("a blank form, and a saved one, print their captions in English", async () => {
    const planner = formsPlanner();
    const backend = mount(inEnglish(planner), A_WEDNESDAY);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Templates"));
    await user.click(screen.getByRole("button", { name: "Checklist for the period" }));
    const blank = await exportWith(user, backend, "Blank PDF");
    const text = htmlText(blank.html);
    expect(blank.fileName).toBe("Checklist for the period — blank");
    expect(text).toContain("START OF THE PERIOD");
    expect(text).toContain("Class lists have been updated");
    expect(text).toContain("The files have been backed up");
    expect(greekLeftIn(text, teacherStrings(planner))).toEqual([]);
  });

  /**
   * The folder bundle, and M7's promise about its suggested text: **an
   * untouched box follows the language; one she wrote in keeps her words; one
   * she cleared stays empty.** Nothing was copied into the file, so there is
   * nothing to go stale.
   */
  it("the substitute folder bundle: untouched boxes switch, written and cleared ones do not", async () => {
    const planner = formsPlanner();
    const backend = mount(planner, A_WEDNESDAY);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Σχολικό έτος" });
    await user.click(topTab("Τάξεις"));
    await user.click(subTab("Φάκελος αναπλήρωσης"));
    await screen.findByRole("heading", { name: "Φάκελος αναπλήρωσης" });
    const before = structuredClone(backend.planner.substitute_texts);

    // Written: "rules" is hers. Cleared: "materials" is an empty row.
    // Untouched: "problem" has no row, so it shows the suggestion.
    expect(screen.getByLabelText("ΚΑΝΟΝΕΣ ΚΑΙ ΣΥΝΗΘΕΙΕΣ ΤΗΣ ΤΑΞΗΣ")).toHaveValue(
      "Μπαίνουμε με τη σειρά του καταλόγου.",
    );
    expect(screen.getByLabelText("ΥΛΙΚΑ ΚΑΙ ΒΟΗΘΗΜΑΤΑ — ΠΟΥ ΒΡΙΣΚΟΝΤΑΙ")).toHaveValue("");
    expect(
      (screen.getByLabelText("ΤΙ ΝΑ ΚΑΝΕΤΕ ΣΕ ΠΕΡΙΠΤΩΣΗ ΠΡΟΒΛΗΜΑΤΟΣ") as HTMLTextAreaElement).value,
    ).toMatch(/^Για οποιοδήποτε σοβαρό θέμα/);

    await switchTo(user, "English");
    await screen.findByRole("heading", { name: "Substitute folder" });
    expect(screen.getByLabelText("CLASS RULES AND ROUTINES")).toHaveValue(
      "Μπαίνουμε με τη σειρά του καταλόγου.",
    );
    expect(screen.getByLabelText("MATERIALS AND AIDS — WHERE THEY ARE")).toHaveValue("");
    expect(
      (screen.getByLabelText("WHAT TO DO IF SOMETHING GOES WRONG") as HTMLTextAreaElement).value,
    ).toMatch(/^For anything serious, tell the head teacher's office/);
    // The switch wrote nothing into the folder's texts.
    expect(backend.planner.substitute_texts).toEqual(before);

    const { html, fileName, landscape } = await exportWith(user, backend, "Export folder as PDF");
    const text = htmlText(html);
    expect(landscape).toBe(true);
    expect(fileName).toMatch(/^Substitute folder — Α1 — 04\.11\.2026$/);
    // Six sheets, one per page of the source's folder.
    expect(html.match(/data-sheet /g)).toHaveLength(6);
    for (const title of ["About the class", "The week's plan", "Seating plan", "A one-day plan", "Contacts and procedures"]) {
      expect(text).toContain(title);
    }
    expect(text).toContain("Μπαίνουμε με τη σειρά του καταλόγου.");
    expect(text).toContain("For anything serious, tell the head teacher's office straight away.");
    expect(text).not.toContain("Για οποιοδήποτε σοβαρό θέμα");
    expect(text).not.toContain("Βιβλία και τετράδια");
    expect(greekLeftIn(text, teacherStrings(planner))).toEqual([]);
    void FORMS_A1;
  });
});

// ------------------------------------------------------------- the sweep ---

/**
 * **Every screen, in English, with a real planner behind it — and no Greek
 * letter left on any of them** once the teacher's own words are set aside.
 *
 * Seven fixtures, because each milestone's fixture fills its own screens; each
 * is opened in English and every section and sub-page is visited. The check is
 * on the text, the form values (a folder box shows its suggestion as its
 * value) and the attributes a screen reader reads (`aria-label`,
 * `placeholder`, `title`).
 */
describe("every screen in English", () => {
  const fixtures: [string, () => Planner, string][] = [
    ["the gradebook fixture", gradedPlanner, "2026-11-09"],
    ["the support fixture", supportPlanner, "2026-11-09"],
    ["the parents fixture", parentsFixture, PARENTS_TODAY],
    ["the planning fixture", planningPlanner, "2026-11-04"],
    ["the forms fixture", formsPlanner, A_WEDNESDAY],
    ["the growth fixture", growthPlanner, GROWTH_TODAY],
    ["the week fixture", weekPlanner, "2026-11-04"],
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const [name, build, today] of fixtures) {
    it(`shows no Greek but the teacher's own words — ${name}`, async () => {
      const planner = build();
      mount(inEnglish(planner), today);
      await screen.findByRole("heading", { name: "School year" });
      const allowed = teacherStrings(planner);
      const found: string[] = [];
      const check = (where: string) => {
        for (const run of greekLeftIn(pageText(), allowed)) found.push(`${where}: “${run}”`);
      };

      const tops = within(screen.getAllByRole("navigation")[0])
        .getAllByRole("button")
        .map((b) => b.textContent ?? "");
      expect(tops).toHaveLength(11);
      for (const top of tops) {
        await act(async () => {
          topTab(top).click();
        });
        const navs = screen.getAllByRole("navigation");
        const subs =
          navs.length > 1 ? within(navs[1]).getAllByRole("button").map((b) => b.textContent ?? "") : [""];
        for (const sub of subs) {
          if (sub) {
            await act(async () => {
              subTab(sub).click();
            });
          }
          check(`${top}${sub ? ` → ${sub}` : ""}`);
        }
      }
      expect(found, found.join("\n")).toEqual([]);
    });
  }

  it("shows every letter and every message category with no Greek left", async () => {
    const planner = emptyPlanner();
    mount(inEnglish(planner));
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Parents & Staff"));
    await user.click(subTab("Letters"));
    const allowed = teacherStrings(planner);
    const letterSelect = screen.getByLabelText("Letter") as HTMLSelectElement;
    for (const option of [...letterSelect.options]) {
      await user.selectOptions(letterSelect, option.value);
      expect(greekLeftIn(pageText(), allowed), option.value).toEqual([]);
    }
    await user.click(subTab("Messages"));
    // All 150 listed, titles and categories in English.
    expect(screen.getByText("150 messages")).toBeInTheDocument();
    expect(greekLeftIn(pageText(), allowed)).toEqual([]);
  });

  it("finds an English message by an English phrase from its body, ignoring case", async () => {
    mount(inEnglish(emptyPlanner()));
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "School year" });
    await user.click(topTab("Parents & Staff"));
    await user.click(subTab("Messages"));
    await user.type(screen.getByLabelText("Search"), "OPEN A CHANNEL");
    // The category hint is not searched; the body of c01.m02 is.
    await user.clear(screen.getByLabelText("Search"));
    await user.type(screen.getByLabelText("Search"), "CHANNEL OF COMMUNICATION");
    expect(screen.getByText("1 messages")).toBeInTheDocument();
    expect(screen.getByText("A short introduction")).toBeInTheDocument();
  });
});

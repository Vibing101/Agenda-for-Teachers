/**
 * **M5's first acceptance criterion**, and the transcription behind it.
 *
 * "All 7 letters and a sample across all 15 message-bank categories generate a
 * correctly-formatted, Greek-rendering PDF with every placeholder filled and
 * none left as `[BRACKETS]`."
 *
 * The half a test can settle is the placeholders. The document builders are
 * pure functions, so the whole generated HTML can be scanned — and it is
 * **scanned, not spot-checked**: a regex for the placeholder syntax is run over
 * the entire document and asserted to find nothing. That catches a token in a
 * caption, in a slip, in a signature line or in a body, including one a future
 * edit adds.
 *
 * The other half — that the PDF renders and that the Greek in it is Greek — a
 * test cannot settle. It needs a real build, and it is evidenced through the
 * print self-test hook at the gate; see the release note.
 */
import { describe, expect, it } from "vitest";
import {
  LETTERS,
  letterKeys,
  letterPlaceholders,
  AWARD_NAME_KEY,
  AWARD_REASON_KEY,
} from "../../src/domain/letters";
import {
  allMessageCodes,
  bankMessage,
  categoryOf,
  foldForSearch,
  messageCodes,
  MESSAGE_CATEGORIES,
  MESSAGES_PER_CATEGORY,
  searchMessages,
} from "../../src/domain/messages";
import { BLANK_RULE, fillPlaceholders, placeholdersIn } from "../../src/domain/placeholders";
import { letterHtml, messageAsText, messageHtml } from "../../src/print/letterSheets";
import { translatorFor } from "../../src/i18n";

const t = translatorFor("el");
const TODAY = "2026-11-09";

/** The syntax the source package uses, and therefore the thing to hunt for. */
const ANY_PLACEHOLDER = /\[[^[\]]+\]/g;

describe("the placeholder rule", () => {
  it("finds every distinct token once, in reading order", () => {
    expect(placeholdersIn("Α [ΕΝΑ] Β [ΔΥΟ] Γ [ΕΝΑ]")).toEqual(["ΕΝΑ", "ΔΥΟ"]);
  });

  it("fills what it is given and rules a line where it is given nothing", () => {
    expect(fillPlaceholders("Α [ΕΝΑ] Β", { "ΕΝΑ": "τιμή" })).toBe("Α τιμή Β");
    expect(fillPlaceholders("Α [ΕΝΑ] Β", {})).toBe(`Α ${BLANK_RULE} Β`);
    // Whitespace is not a value: a field of spaces still prints as a rule.
    expect(fillPlaceholders("Α [ΕΝΑ] Β", { "ΕΝΑ": "   " })).toBe(`Α ${BLANK_RULE} Β`);
  });

  it("leaves no token behind whatever it is given", () => {
    const text = "[ΕΝΑ] και [ΔΥΟ] και [ΤΡΙΑ]";
    const cases: Record<string, string>[] = [
      {},
      { "ΕΝΑ": "α" },
      { "ΕΝΑ": "α", "ΔΥΟ": "β", "ΤΡΙΑ": "γ" },
    ];
    for (const values of cases) {
      expect(placeholdersIn(fillPlaceholders(text, values))).toEqual([]);
    }
  });
});

describe("the seven letters", () => {
  it("are the seven the source package has, in its own page order", () => {
    expect(LETTERS).toHaveLength(7);
    expect(LETTERS.map((l) => l.code)).toEqual([
      "welcome",
      "newsletter",
      "invitation",
      "atRisk",
      "consent",
      "praise",
      "award",
    ]);
  });

  /**
   * The scan. Every letter, unfilled and filled, with the whole document read
   * for anything in brackets.
   */
  it("generate a document with no placeholder left in it — unfilled", () => {
    for (const letter of LETTERS) {
      const html = letterHtml(t, letter, {}, TODAY);
      expect(html.match(ANY_PLACEHOLDER), `${letter.code} left a placeholder`).toBeNull();
    }
  });

  it("generate a document with no placeholder left in it — filled", () => {
    for (const letter of LETTERS) {
      // Every key the letter asks for, plus every token its own text asks for.
      const values: Record<string, string> = {};
      for (const key of letterKeys(letter)) values[key] = `τιμή ${key}`;
      for (const token of letterPlaceholders(t, letter)) values[token] = `τιμή ${token}`;
      values[AWARD_NAME_KEY] = "Ελένη Παπαδοπούλου";
      values[AWARD_REASON_KEY] = "τη συνέπεια και την προσπάθειά της";

      const html = letterHtml(t, letter, values, TODAY);
      expect(html.match(ANY_PLACEHOLDER), `${letter.code} left a placeholder`).toBeNull();
    }
  });

  it("carry the teacher's own words through to the page exactly as typed", () => {
    const welcome = LETTERS[0];
    const html = letterHtml(t, welcome, { body: "Καλωσορίσατε στη νέα χρονιά." }, TODAY);
    expect(html).toContain("Καλωσορίσατε στη νέα χρονιά.");
  });

  /**
   * A teacher is entitled to type a square bracket. Her own text is not
   * placeholder-substituted, so it comes out as she wrote it — and the scan
   * above would be wrong to complain about it, which is why the two filled
   * tests use text without brackets.
   */
  it("do not substitute inside the teacher's own writing", () => {
    const welcome = LETTERS[0];
    const html = letterHtml(t, welcome, { body: "Δείτε τη σημείωση [1] παρακάτω." }, TODAY);
    expect(html).toContain("[1]");
  });

  it("format a date field rather than printing the input's own ISO value", () => {
    const html = letterHtml(t, LETTERS[0], { date: "2026-11-09" }, TODAY);
    expect(html).toContain("09.11.2026");
    expect(html).not.toContain("2026-11-09");
  });

  it("print portrait, unlike every register this app prints", () => {
    // A4 portrait is 595.28 wide; landscape would be 841.89.
    expect(letterHtml(t, LETTERS[0], {}, TODAY)).toContain('data-page-width="595.28"');
  });

  /**
   * The source's two award pages are **one certificate each on a full A4
   * portrait sheet** — rendered and looked at, because the M5 brief said they
   * were two up and they are not.
   */
  it("mark the two certificates as certificates and nothing else", () => {
    expect(LETTERS.filter((l) => l.certificate).map((l) => l.code)).toEqual(["praise", "award"]);
    expect(letterHtml(t, LETTERS[5], {}, TODAY)).toContain('class="certificate"');
    expect(letterHtml(t, LETTERS[0], {}, TODAY)).not.toContain('class="certificate"');
  });

  it("put a reply slip on the two letters the source gives one", () => {
    const withSlip = LETTERS.filter((l) => l.blocks.some((b) => b.kind === "slip"));
    expect(withSlip.map((l) => l.code)).toEqual(["invitation", "consent"]);
    expect(letterHtml(t, LETTERS[2], {}, TODAY)).toContain("ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ");
  });

  it("have no table at all, which is what the contract was extended for", () => {
    for (const letter of LETTERS) {
      expect(letterHtml(t, letter, {}, TODAY)).not.toContain("<table>");
    }
  });
});

describe("the 150-message bank", () => {
  it("is 15 categories of 10, as the source's index page says", () => {
    expect(MESSAGE_CATEGORIES).toHaveLength(15);
    expect(MESSAGES_PER_CATEGORY).toBe(10);
    expect(allMessageCodes()).toHaveLength(150);
  });

  it("has a title and a body for every one of the 150", () => {
    for (const code of allMessageCodes()) {
      const message = bankMessage(t, code);
      // A missing key would fall back to the id itself, so this catches a gap
      // in the transcription rather than only a crash.
      expect(message.title, code).not.toContain("msg.");
      expect(message.body, code).not.toContain("msg.");
      expect(message.body.length, code).toBeGreaterThan(40);
    }
  });

  it("labels every category", () => {
    for (const category of MESSAGE_CATEGORIES) {
      expect(t(`msgcat.${category}.title`)).not.toContain("msgcat.");
      expect(t(`msgcat.${category}.hint`)).not.toContain("msgcat.");
    }
  });

  /**
   * **The sample the acceptance criterion asks for: one message from each of
   * the fifteen categories**, generated and scanned.
   */
  it("generate a document with no placeholder left in it, across all 15 categories", () => {
    for (const category of MESSAGE_CATEGORIES) {
      for (const code of messageCodes(category)) {
        const message = bankMessage(t, code);
        // Unfilled first: the hard case, since every token must become a rule.
        expect(messageHtml(t, message, {}, TODAY).match(ANY_PLACEHOLDER), code).toBeNull();

        const values = Object.fromEntries(message.placeholders.map((p) => [p, `τιμή ${p}`]));
        expect(messageHtml(t, message, values, TODAY).match(ANY_PLACEHOLDER), code).toBeNull();
      }
    }
  });

  it("copies exactly what it prints", () => {
    const message = bankMessage(t, "c01.m01");
    const values = { "ΟΝΟΜΑΤΕΠΩΝΥΜΟ": "Μ. Νικολάου", "ΜΑΘΗΜΑ": "Μαθηματικά" };
    const text = messageAsText(message, values);
    expect(text).toContain("Μ. Νικολάου");
    // The printed document carries the same filled sentence.
    expect(messageHtml(t, message, values, TODAY)).toContain("Μ. Νικολάου");
    expect(placeholdersIn(text)).toEqual([]);
  });

  it("keeps the source's own placeholder tokens rather than inventing any", () => {
    // The first message names the teacher, her subject, her class and her email
    // — exactly as the source's editable edition does.
    expect(bankMessage(t, "c01.m01").placeholders).toEqual([
      "ΟΝΟΜΑΤΕΠΩΝΥΜΟ",
      "ΜΑΘΗΜΑ",
      "ΤΜΗΜΑ",
      "EMAIL",
    ]);
  });
});

describe("searching the bank", () => {
  it("folds accents and case, and final sigma with them", () => {
    expect(foldForSearch("Απουσίες")).toBe(foldForSearch("απουσιες"));
    // Final sigma against medial sigma: the case that `toLowerCase` alone
    // leaves broken.
    expect(foldForSearch("μαθητής")).toBe(foldForSearch("ΜΑΘΗΤΗΣ"));
  });

  it("matches a phrase from a body, not only a title", () => {
    const found = searchMessages(t, "δίαυλο", "");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((m) => foldForSearch(m.body).includes(foldForSearch("διαυλο")))).toBe(true);
  });

  it("narrows to one category and finds all ten of it", () => {
    const found = searchMessages(t, "", "c04");
    expect(found).toHaveLength(10);
    expect(found.every((m) => categoryOf(m.code) === "c04")).toBe(true);
  });

  it("returns the whole bank for an empty query", () => {
    expect(searchMessages(t, "", "")).toHaveLength(150);
    expect(searchMessages(t, "   ", "")).toHaveLength(150);
  });

  it("returns nothing for a query that matches nothing, rather than everything", () => {
    expect(searchMessages(t, "zzzzzzz", "")).toEqual([]);
  });
});

/**
 * **Greek and English say the same things** — M9's first acceptance criterion,
 * held string by string.
 *
 * The lookup still falls back to Greek for a missing key (a safety net M1 built
 * so a half-finished translation never shows a blank button). That net is
 * exactly why these tests exist: with it in place, a missing English string
 * would *pass* every screen test and show Greek in an English interface. So
 * these tests read the bundle files directly, not through the lookup, and fail
 * on the missing key by name.
 *
 * The compiler checks the key sets too (each English file `satisfies` its Greek
 * twin's keys). This file checks them again at test time, because a type can be
 * cast away and a test cannot, and it checks what a type cannot: that no
 * English string is empty, that every `{param}` matches, that every letter and
 * message asks for the **same placeholders by code** in both languages, and
 * that no Greek is left inside an English string.
 */
import { describe, expect, it } from "vitest";
import { el as elUi } from "../../src/i18n/el";
import { en as enUi } from "../../src/i18n/en";
import { formsEl } from "../../src/i18n/formsEl";
import { formsEn } from "../../src/i18n/formsEn";
import { lettersEl } from "../../src/i18n/lettersEl";
import { lettersEn } from "../../src/i18n/lettersEn";
import { messagesEl } from "../../src/i18n/messagesEl";
import { messagesEn } from "../../src/i18n/messagesEn";
import { translatorFor } from "../../src/i18n";
import {
  PLACEHOLDER_CODES,
  placeholderKeyOf,
  placeholderLabelId,
  placeholdersIn,
} from "../../src/domain/placeholders";

type Bundle = Record<string, string>;

/** The four pairs, named for the failure messages. */
const PAIRS: [string, Bundle, Bundle][] = [
  ["el.ts / en.ts", elUi, enUi],
  ["lettersEl.ts / lettersEn.ts", lettersEl, lettersEn],
  ["messagesEl.ts / messagesEn.ts", messagesEl, messagesEn],
  ["formsEl.ts / formsEn.ts", formsEl, formsEn],
];

const params = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** Greek and Coptic, and Greek Extended — any Greek letter, accented or not. */
const GREEK = /[Ͱ-Ͽἀ-῿]/;

/**
 * The only English strings allowed to contain Greek: the toggle names each
 * language **in that language**, so the teacher can find her way back to hers.
 */
const GREEK_ON_PURPOSE = new Set(["lang.el"]);

describe("the English bundle against the Greek", () => {
  for (const [name, greek, english] of PAIRS) {
    describe(name, () => {
      it("has every Greek key, with a non-empty English string", () => {
        const missing = Object.keys(greek).filter(
          (k) => typeof english[k] !== "string" || english[k].trim() === "",
        );
        expect(missing, `English is missing or empty for: ${missing.join(", ")}`).toEqual([]);
      });

      it("has no key the Greek does not have", () => {
        const orphans = Object.keys(english).filter((k) => !(k in greek));
        expect(orphans, `English-only keys: ${orphans.join(", ")}`).toEqual([]);
      });

      it("uses exactly the same {params} as the Greek, string by string", () => {
        const wrong = Object.keys(greek).filter(
          (k) => k in english && params(greek[k]) !== params(english[k]),
        );
        expect(wrong, `{param} mismatch in: ${wrong.join(", ")}`).toEqual([]);
      });

      it("has no Greek left inside an English string", () => {
        const greekLeft = Object.keys(english).filter(
          (k) => !GREEK_ON_PURPOSE.has(k) && GREEK.test(english[k]),
        );
        expect(greekLeft, `Greek inside English: ${greekLeft.join(", ")}`).toEqual([]);
      });
    });
  }
});

describe("the placeholders the letters and messages ask for", () => {
  const tEl = translatorFor("el");
  const tEn = translatorFor("en");
  const keyOfEl = placeholderKeyOf(tEl);
  const keyOfEn = placeholderKeyOf(tEn);

  /** Every content string that can carry a `[TOKEN]`, by key. */
  const content: [string, string, string][] = [
    ...Object.keys(lettersEl).map(
      (k) => [k, (lettersEl as Bundle)[k], (lettersEn as Bundle)[k]] as [string, string, string],
    ),
    ...Object.keys(messagesEl)
      .filter((k) => !k.startsWith("ph."))
      .map(
        (k) =>
          [k, (messagesEl as Bundle)[k], (messagesEn as Bundle)[k]] as [string, string, string],
      ),
  ];

  it("has a token text in both languages for every code, with no two codes sharing one", () => {
    for (const [lang, t] of [
      ["el", tEl],
      ["en", tEn],
    ] as const) {
      const texts = PLACEHOLDER_CODES.map((c) => t(placeholderLabelId(c)));
      for (const text of texts) {
        expect(text.trim().length, `${lang}: an empty token`).toBeGreaterThan(0);
        expect(text, `${lang}: a token with a bracket in it`).not.toMatch(/[[\]]/);
      }
      expect(new Set(texts).size, `${lang}: two codes share a token text`).toBe(texts.length);
    }
  });

  it("knows every token in every letter and message, in both languages", () => {
    const unknown: string[] = [];
    for (const [key, greek, english] of content) {
      for (const token of placeholdersIn(greek)) {
        if (!keyOfEl(token).startsWith("ph.")) unknown.push(`${key} (el): [${token}]`);
      }
      for (const token of placeholdersIn(english)) {
        if (!keyOfEn(token).startsWith("ph.")) unknown.push(`${key} (en): [${token}]`);
      }
    }
    expect(unknown, `tokens with no code: ${unknown.join(", ")}`).toEqual([]);
  });

  it("asks for the same placeholders, by code, in both languages — message by message", () => {
    const wrong: string[] = [];
    for (const [key, greek, english] of content) {
      const codesEl = [...new Set(placeholdersIn(greek).map(keyOfEl))].sort().join(",");
      const codesEn = [...new Set(placeholdersIn(english).map(keyOfEn))].sort().join(",");
      if (codesEl !== codesEn) wrong.push(`${key}: el {${codesEl}} en {${codesEn}}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("puts no [TOKEN] in any app label, in either language", () => {
    // A bracketed token in a button label would never be filled, and it would
    // print. Only the letters and the message bank carry them.
    const withTokens = Object.keys(elUi).filter(
      (k) =>
        placeholdersIn((elUi as Bundle)[k]).length > 0 ||
        placeholdersIn((enUi as Bundle)[k]).length > 0,
    );
    expect(withTokens).toEqual([]);
  });
});

describe("an exported file's name, in English", () => {
  /**
   * A file name goes through `t("…fileName", …)`, so it follows the language.
   * The Rust side replaces anything Windows or macOS refuses, but a template
   * that relied on that would print a hyphen where a word was meant. So the
   * fixed part of every English name carries none of those characters.
   */
  it("carries no character either filesystem refuses, outside its {params}", () => {
    const names = Object.keys(enUi).filter((k) => /fileName$/i.test(k));
    expect(names.length).toBeGreaterThanOrEqual(12);
    for (const k of names) {
      const fixed = (enUi as Bundle)[k].replace(/\{\w+\}/g, "");
      expect(fixed, k).not.toMatch(/[/\\:*?"<>|]/);
      expect(fixed.trim(), k).not.toMatch(/^\.|\.$/);
    }
  });
});

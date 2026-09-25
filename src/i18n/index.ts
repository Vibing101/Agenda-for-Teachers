/**
 * The single lookup every user-facing string goes through.
 *
 * The product owner's call (2026-09-19) is that the app ships Greek-only
 * through M1–M8 and gets its English pass in one go at M9. That is a decision
 * about *timing*, not about scope: the bilingual UI is still in the spec's
 * Resolved table. So nothing is authored in English now, but nothing is
 * hardcoded in Greek either — every label is a string id resolved here.
 *
 * Adding English at M9 was: write `en.ts` with the same keys, add one line to
 * `BUNDLES`, and show the toggle. It held for every screen and every document
 * builder; the two places M9 did have to change are recorded in its release
 * note (the message bank keyed a filled value by its Greek token, and the shell
 * pinned the language).
 *
 * What is deliberately *not* here: anything the teacher typed. Student names,
 * notes, class names, custom labels — those are rendered exactly as entered,
 * in whichever language she used, whatever the UI language is.
 */
import { el as elUi } from "./el";
import { lettersEl } from "./lettersEl";
import { messagesEl } from "./messagesEl";
import { formsEl } from "./formsEl";
import { en as enUi } from "./en";
import { lettersEn } from "./lettersEn";
import { messagesEn } from "./messagesEn";
import { formsEn } from "./formsEn";

/**
 * The Greek bundle, assembled from four files that hold four different kinds
 * of string: the app's own labels, the seven parent letters, the 150-message
 * bank, and M7's form and folder content (the period checklist's items and
 * the substitute folder's suggested text).
 *
 * **Splitting by kind rather than by screen is deliberate** (M5). The letters
 * and the message bank are the *product's content* — 465 strings of it, several
 * paragraphs long apiece — and putting them in `el.ts` beside "Αποθήκευση"
 * would have roughly tripled that file and mixed two unrelated things. Nothing
 * else changes: one lookup, one `StringId` type, and the eslint rule that keeps
 * Greek inside `src/i18n/` still covers all three files.
 *
 * M9 adds `en.ts`, `lettersEn.ts`, `messagesEn.ts` and `formsEn.ts` and one
 * more entry in `BUNDLES` — files added, not files edited.
 */
const el = { ...elUi, ...lettersEl, ...messagesEl, ...formsEl };

export type StringId = keyof typeof el;
export type Locale = "el" | "en";

/**
 * The English bundle (M9), assembled the same way from the four English files.
 * Each is typed against its Greek twin, so the compiler refuses a key missing
 * from either side; `tests/unit/i18nParity.test.ts` refuses it again at test
 * time, names the key, and checks every `{param}` and `[PLACEHOLDER]` besides.
 */
const en: Record<StringId, string> = { ...enUi, ...lettersEn, ...messagesEn, ...formsEn };

/** Every language the interface can be in, in the order the toggle offers them. */
export const LOCALES: readonly Locale[] = ["el", "en"];

/**
 * The language a fresh file opens in, and what anything the app does not
 * recognise falls back to. **Never the OS locale** — the spec says the
 * language is "persisted as a preference, not tied to the OS locale".
 */
export const DEFAULT_LOCALE: Locale = "el";

/** Whether a stored value names a language this app has. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Greek is the base bundle. A later bundle may be incomplete while it is being
 * written; a missing key falls back to Greek rather than to a blank or a raw
 * id, so a half-finished translation never shows an empty button.
 */
const BUNDLES: Partial<Record<Locale, Partial<Record<StringId, string>>>> = {
  el,
  en,
};

export { el, en };

/** Values substituted into a string's `{placeholder}` slots. */
export type Params = Record<string, string | number>;

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

export function translate(locale: Locale, id: StringId, params?: Params): string {
  const template = BUNDLES[locale]?.[id] ?? el[id];
  return fill(template, params);
}

export type Translate = (id: StringId, params?: Params) => string;

export function translatorFor(locale: Locale): Translate {
  return (id, params) => translate(locale, id, params);
}

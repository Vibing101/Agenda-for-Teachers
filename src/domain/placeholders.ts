/**
 * The `[ΑΓΚΥΛΕΣ]` placeholders the source package's letters and messages carry.
 *
 * The syntax is the source's own, not an invention: the message bank's editable
 * edition tells the teacher to "αλλάξτε ό,τι είναι σε [ΑΓΚΥΛΕΣ]", and its
 * own front matter advises searching for the `[` character before sending.
 * M5's first acceptance criterion is that check made automatic — no placeholder
 * may survive into a generated PDF.
 *
 * **An unfilled placeholder prints as a blank rule, not as its token.** That is
 * what the source's own paper does: its letters are forms, with a ruled gap
 * where a name or a date goes. So a letter the teacher only half-filled comes
 * out as a form she can finish by hand, rather than as a page with `[ΜΑΘΗΤΗΣ]`
 * printed on it — which is the one outcome the criterion names.
 *
 * Nothing here is translated, and nothing here is Greek: a token is a key, and
 * the text it sits in comes from the language bundle.
 *
 * **Since M9 a token has a stable code as well as its text.** Before M9 the
 * message bank kept what the teacher typed against the token's own text —
 * `values["ΜΑΘΗΜΑ"]` — which was harmless while there was one language and
 * would have lost every value she had filled in the moment she switched to
 * English, where the same slot reads `[SUBJECT]`. The spec asks for the
 * opposite: the English version of a message or a letter "with the same
 * filled-in placeholders". So each token the bundles use has a code, and its
 * text in each language is a string id, `ph.<code>`; a value is kept against
 * `ph.<code>`, which is the same in both languages. The token *text* still
 * comes from the bundle and is still what the screen shows as the field's
 * caption, in whichever language is on.
 */
import type { StringId, Translate } from "../i18n";

/** Matches one `[TOKEN]`. A token never contains a bracket of its own. */
const TOKEN = /\[([^[\]]+)\]/g;

/**
 * Every distinct placeholder in a piece of text, in the order it first appears.
 *
 * The order matters: it is the order the screen offers the fields in, so the
 * teacher fills a letter top to bottom rather than hunting.
 */
export function placeholdersIn(text: string): string[] {
  const seen: string[] = [];
  for (const [, token] of text.matchAll(TOKEN)) {
    if (!seen.includes(token)) seen.push(token);
  }
  return seen;
}

/** Every distinct placeholder across several pieces of text, in first-seen order. */
export function placeholdersInAll(texts: string[]): string[] {
  const seen: string[] = [];
  for (const token of texts.flatMap(placeholdersIn)) {
    if (!seen.includes(token)) seen.push(token);
  }
  return seen;
}

/**
 * The ruled gap an unfilled placeholder leaves behind — the source page's own
 * blank, for finishing by hand.
 *
 * Underscores rather than a box-drawing or dotted character on purpose: this
 * goes into a PDF, and the one thing the printed output must never do is ask
 * the renderer for a glyph the Greek-carrying face might not have. An
 * underscore is in every face there is.
 */
export const BLANK_RULE = "__________";

/**
 * Fills a text's placeholders from what the teacher typed.
 *
 * A token with nothing against it becomes [`BLANK_RULE`]. **No token survives**,
 * which is the whole point: `placeholdersIn(fill(text, {}))` is empty for any
 * text.
 *
 * `keyOf` says what a token's value is kept against — since M9, the
 * token's stable code from [`placeholderKeyOf`], so a value typed while the
 * interface was Greek fills the same slot in the English text.
 */
export function fillPlaceholders(
  text: string,
  values: Record<string, string>,
  keyOf: (token: string) => string = (token) => token,
): string {
  return text.replace(TOKEN, (_whole, token: string) => {
    const value = (values[keyOf(token)] ?? "").trim();
    return value || BLANK_RULE;
  });
}

/**
 * Every placeholder the letters and the message bank use, by stable code.
 *
 * The Greek and English text of each is `ph.<code>` in `messagesEl.ts` and
 * `messagesEn.ts`. `tests/unit/i18nParity.test.ts` holds three things about
 * this list: every token in every message and letter, in both languages, is
 * one of these; each message asks for the **same codes** in both languages;
 * and no two codes share a token text within one language, which would make
 * the reverse lookup below ambiguous.
 */
export const PLACEHOLDER_CODES = [
  "date",
  "subject",
  "deadline",
  "time",
  "point",
  "span",
  "topic",
  "class",
  "grade",
  "suggestion",
  "number",
  "room",
  "coursework",
  "result",
  "now",
  "before",
  "fullName",
  "solution",
  "reason",
  "email",
  "material",
  "materials",
  "what",
  "whatChanged",
  "agreements",
  "newDate",
  "document",
  "event",
  "steps",
  "change",
  "assessmentMethod",
  "whatToBring",
  "whatIsMissing",
  "agreement",
  "goal",
  "role",
  "initiative",
  "previousGoal",
  "where",
  "whom",
  "incident",
  "remarks",
  "example",
  "terms",
  "newGoal",
  "newDeadline",
  "newRoom",
  "minutes",
  "rule1",
  "rule2",
  "rule3",
  "topics",
  "topic1",
  "topic2",
  "topic3",
  "dayAndTime",
  "responsibility",
  "form",
  "units",
  "unit",
  "action",
  "alternative",
  "duration",
  "distinction",
  "procedure",
  "competition",
  "skill",
  "step1",
  "step2",
  "step3",
  "student",
  "guardian",
] as const;

export type PlaceholderCode = (typeof PLACEHOLDER_CODES)[number];

/** The string id holding a placeholder's token text in each language. */
export const placeholderLabelId = (code: PlaceholderCode): StringId =>
  `ph.${code}` as StringId;

/**
 * What a token's value is kept against: `ph.<code>` when the bundle's table
 * knows the token, or the token itself when it does not.
 *
 * The fallback keeps an unknown token working exactly as it did before M9 —
 * filled and printed, never left as `[BRACKETS]` — while the parity test makes
 * sure no shipped text has one.
 */
export function placeholderKeyOf(t: Translate): (token: string) => string {
  const byToken = new Map<string, string>();
  for (const code of PLACEHOLDER_CODES) {
    const id = placeholderLabelId(code);
    byToken.set(t(id), id);
  }
  return (token) => byToken.get(token) ?? token;
}

/** One field a text asks the teacher for: its caption, and what it is kept against. */
export interface PlaceholderField {
  /** The token as the current language writes it — the field's caption. */
  token: string;
  /** Stable across languages: `ph.<code>`. */
  key: string;
}

/** The fields a text asks for, in reading order, each with its stable key. */
export function placeholderFields(t: Translate, text: string): PlaceholderField[] {
  const keyOf = placeholderKeyOf(t);
  return placeholdersIn(text).map((token) => ({ token, key: keyOf(token) }));
}

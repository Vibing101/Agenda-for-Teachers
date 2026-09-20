/**
 * The single lookup every user-facing string goes through.
 *
 * The product owner's call (2026-09-19) is that the app ships Greek-only
 * through M1–M8 and gets its English pass in one go at M9. That is a decision
 * about *timing*, not about scope: the bilingual UI is still in the spec's
 * Resolved table. So nothing is authored in English now, but nothing is
 * hardcoded in Greek either — every label is a string id resolved here.
 *
 * Adding English at M9 is: write `en.ts` with the same keys, add one line to
 * `BUNDLES`, and show the toggle. No screen changes.
 *
 * What is deliberately *not* here: anything the teacher typed. Student names,
 * notes, class names, custom labels — those are rendered exactly as entered,
 * in whichever language she used, whatever the UI language is.
 */
import { el } from "./el";

export type StringId = keyof typeof el;
export type Locale = "el" | "en";

/** The language the app ships in today. M9 adds `"en"` alongside it. */
export const DEFAULT_LOCALE: Locale = "el";

/**
 * Greek is the base bundle. A later bundle may be incomplete while it is being
 * written; a missing key falls back to Greek rather than to a blank or a raw
 * id, so a half-finished translation never shows an empty button.
 */
const BUNDLES: Partial<Record<Locale, Partial<Record<StringId, string>>>> = {
  el,
};

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

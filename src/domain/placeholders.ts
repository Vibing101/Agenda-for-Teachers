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
 */

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
 */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN, (_whole, token: string) => {
    const value = (values[token] ?? "").trim();
    return value || BLANK_RULE;
  });
}

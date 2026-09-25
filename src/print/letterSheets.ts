/**
 * The printed parent letters and the printed message.
 *
 * **These are the first documents this app prints that are not tables.** The
 * shape they need — a row of captioned fields, prose, captioned areas, a reply
 * slip, a certificate — is `PrintBlock` in `document.ts`, added for them rather
 * than a second renderer written beside `renderPrintDocument`. Pagination is
 * still the app's, still in `paginate.ts`, and still measured rather than
 * handed to the engine.
 *
 * **Portrait, unlike every sheet before them.** The source's letters are
 * portrait A4 and the registers are landscape, so every call here passes
 * `landscape = false` — the first use of that argument in the project.
 *
 * **No placeholder survives.** Every piece of fixed text goes through
 * [`fillPlaceholders`], which replaces a `[ΑΓΚΥΛΗ]` with what the teacher typed
 * or with a ruled blank. That is M5's first acceptance criterion, and
 * `tests/unit/printLetters.test.ts` scans the whole generated HTML of all seven
 * letters and a message from each of the fifteen categories to prove it.
 */
import {
  AWARD_NAME_KEY,
  AWARD_REASON_KEY,
  letterPlaceholders,
  type LetterTemplate,
  type LetterValues,
} from "../domain/letters";
import { fillPlaceholders, placeholderKeyOf, type PlaceholderField } from "../domain/placeholders";
import { formatDate } from "../domain/dates";
import { isIsoDate } from "../domain/dates";
import type { BankMessage } from "../domain/messages";
import { renderPrintDocument, type PrintBlock, type PrintDocument } from "./document";
import { printFooter } from "./sheetParts";
import type { Translate } from "../i18n";

/**
 * A field's value as it should be printed.
 *
 * A date field holds `YYYY-MM-DD` because that is what the native date input
 * gives, and the app formats every date it prints itself — `dd.MM.yyyy`,
 * independent of the OS locale, per the spec's resolved decision. Anything that
 * is not a date prints exactly as the teacher typed it.
 */
export function printedValue(value: string): string {
  return isIsoDate(value) ? formatDate(value) : value;
}

function fieldRow(
  t: Translate,
  letter: LetterTemplate,
  values: LetterValues,
): PrintBlock | null {
  if (letter.fields.length === 0) return null;
  return {
    kind: "fields",
    fields: letter.fields.map((f) => ({
      label: t(f.captionId),
      value: printedValue(values[f.key] ?? ""),
    })),
  };
}

/**
 * One letter as a document.
 *
 * A pure function of `(t, letter, values, today)` — the same shape as every
 * sheet this project prints, so it can be asserted on without a webview.
 */
export function letterDocument(
  t: Translate,
  letter: LetterTemplate,
  values: LetterValues,
  today: string,
): PrintDocument {
  const keyOf = placeholderKeyOf(t);
  const fill = (text: string) => fillPlaceholders(text, mapDates(values), keyOf);

  const blocks: PrintBlock[] = [];
  const head = fieldRow(t, letter, values);
  if (head) blocks.push(head);

  for (const b of letter.blocks) {
    switch (b.kind) {
      case "prose":
        blocks.push({ kind: "prose", lines: [fill(t(b.textId))] });
        break;
      case "area":
        blocks.push({
          kind: "area",
          caption: t(b.captionId),
          // The teacher's own words, printed exactly as typed and never
          // translated — and never placeholder-substituted either, because
          // `[` is a character she is entitled to type.
          text: values[b.key] ?? "",
          rows: b.rows,
        });
        break;
      case "slip":
        blocks.push({
          kind: "slip",
          caption: t(b.captionId),
          text: fill(t(b.textId)),
          fields: b.fields.map((f) => ({
            label: t(f.captionId),
            value: printedValue(values[f.key] ?? ""),
          })),
        });
        break;
      case "signatures":
        blocks.push({
          kind: "signatures",
          fields: b.fields.map((f) => ({
            label: t(f.captionId),
            value: printedValue(values[f.key] ?? ""),
          })),
        });
        break;
      case "award":
        blocks.push({
          kind: "award",
          receivesCaption: t(b.receivesId),
          name: values[AWARD_NAME_KEY] ?? "",
          forCaption: t(b.forId),
          reason: values[AWARD_REASON_KEY] ?? "",
        });
        break;
    }
  }

  return {
    title: t(letter.titleId),
    subtitle: letter.subtitleId ? t(letter.subtitleId) : undefined,
    meta: [],
    blocks,
    certificate: letter.certificate,
    footer: printFooter(t, today),
  };
}

/**
 * The values a letter's `[ΑΓΚΥΛΕΣ]` are filled from, with dates formatted on
 * the way through, for the reason [`printedValue`] gives.
 *
 * A token is filled from the value the teacher typed against it, kept under the
 * token's stable key (`ph.<code>`, M9).
 *
 * **Corrected at M9.** This comment used to say a slip's `[ΗΜΕΡΟΜΗΝΙΑ]` is
 * filled from the letter's own date field "rather than asking for it twice".
 * It never was: the field is keyed `date` and the token was keyed by its Greek
 * text, so the two never met, and the invitation has always asked for the
 * meeting date twice — once at its head and once for its slip. M9 keeps that
 * behaviour exactly (`ph.date` is not `date`) and raises it with the product
 * owner rather than changing what a letter asks for as a side effect of the
 * translation.
 */
function mapDates(values: LetterValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) out[key] = printedValue(value);
  return out;
}

export function letterHtml(
  t: Translate,
  letter: LetterTemplate,
  values: LetterValues,
  today: string,
): string {
  return renderPrintDocument(letterDocument(t, letter, values, today), false);
}

/**
 * Every `[ΑΓΚΥΛΗ]` a letter will ask the teacher to fill — its fixed text's
 * tokens, minus the ones already answered by a field of the same name.
 *
 * This is what the screen offers inputs for, so filling a letter top to bottom
 * leaves nothing behind.
 */
export function unansweredPlaceholders(
  t: Translate,
  letter: LetterTemplate,
): PlaceholderField[] {
  const fieldKeys = new Set(letter.fields.map((f) => f.key));
  return letterPlaceholders(t, letter).filter((p) => !fieldKeys.has(p.key));
}

// ------------------------------------------------------- the message bank ---

/**
 * One filled message as a document.
 *
 * Deliberately plain: a message is a few sentences the teacher will hand over
 * or post, and the source bank prints them as running text. It carries the
 * category and the message's own title as its header fields so a printed sheet
 * says which of the 150 it is.
 */
export function messageDocument(
  t: Translate,
  message: BankMessage,
  values: Record<string, string>,
  today: string,
): PrintDocument {
  return {
    title: message.title,
    subtitle: t(`msgcat.${message.category}.title` as never),
    meta: [],
    blocks: [{ kind: "prose", lines: [messageAsText(t, message, values)] }],
    footer: printFooter(t, today),
  };
}

export function messageHtml(
  t: Translate,
  message: BankMessage,
  values: Record<string, string>,
  today: string,
): string {
  return renderPrintDocument(messageDocument(t, message, values, today), false);
}

/**
 * A filled message as plain text, for the clipboard.
 *
 * The spec asks for "a one-click 'copy text' option alongside PDF generation
 * for messages the teacher will paste into an email/SMS rather than print", and
 * M4 established the shape for this with the timetable's `timetableAsText()`.
 * **The same fill runs**, so what is copied and what is printed cannot differ.
 */
export function messageAsText(
  t: Translate,
  message: BankMessage,
  values: Record<string, string>,
): string {
  return fillPlaceholders(message.body, values, placeholderKeyOf(t));
}

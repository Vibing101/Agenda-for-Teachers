/**
 * The small pieces every printed register shares.
 *
 * Kept here rather than copied into each sheet so that the footer of one sheet
 * cannot drift from another's, and so the M9 English pass has one place to look
 * for each of them.
 */
import { formatDate } from "../domain/dates";
import type { Translate } from "../i18n";

/** The line at the foot of every sheet: the app's name and the print date. */
export function printFooter(t: Translate, today: string): string {
  return `${t("app.title")} · ${t("grades.printedOn", { date: formatDate(today) })}`;
}

/**
 * A tick column's text: the label when the box is ticked, nothing when it is
 * not.
 *
 * A word rather than a glyph on purpose — a check mark is not in every face
 * that carries Greek, and a PDF that falls back for one character is how tofu
 * gets onto a page that was otherwise fine.
 */
export function tickText(t: Translate, on: boolean): string {
  return on ? t("print.yes") : "";
}

/**
 * One line of a page-level box: a stored note, attributed to the record it was
 * written against.
 *
 * The note itself is the teacher's own text and is copied verbatim. Nothing is
 * counted, ranked or inferred — the box lists what is stored, in the order the
 * register lists it.
 */
export function boxLine(t: Translate, student: string, date: string, text: string): string {
  return date
    ? t("print.entry", { student, date: formatDate(date), text })
    : t("print.entryNoDate", { student, text });
}

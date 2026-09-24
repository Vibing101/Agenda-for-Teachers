/**
 * The eleven print forms as printed pages.
 *
 * **Nothing here is given the planner.** [`formDocument`] is a function of the
 * form's definition, the values typed into it, and the day — and of nothing
 * else — so a printed *Πλάνο αίθουσας* cannot pick up a real class's seats and
 * a printed *Απουσίες του μήνα* cannot pick up a real class's marks. They are
 * loose pages, as the source's are, and that is held by the signature rather
 * than by care. The pages that *do* print live data sit elsewhere:
 * `attendanceSheets.ts` for a real class's month card, `parentSheets.ts` for
 * the stored communication log, `substituteSheets.ts` for the folder.
 *
 * Every form is **portrait**, one per A4 sheet, as the source's are. A form
 * whose table has had rows added runs onto a second sheet, header repeated, by
 * the same app-owned pagination every other sheet uses.
 *
 * **A blank form is the same function with no values.** "Κενό PDF" is not a
 * second template: it is what the teacher would get from a form she had not
 * filled in, which is exactly what the source's pages are.
 */
import {
  cardCount,
  cardKey,
  cellKey,
  deskGrid,
  deskKey,
  tableRows,
  tickKey,
  type CardPart,
  type FormDefinition,
  type FormField,
  type FormPart,
} from "../domain/printForms";
import { printFormLabel } from "../i18n/vocabularies";
import type { StringId, Translate } from "../i18n";
import {
  renderPrintDocument,
  type PrintBlock,
  type PrintCell,
  type PrintDocument,
  type PrintTable,
} from "./document";
import { printedValue } from "./letterSheets";
import { printFooter } from "./sheetParts";

type Values = Record<string, string>;

/**
 * One form as a document.
 *
 * A form with a ruled table carries the captioned fields above it in its
 * header, so they repeat on a second sheet the way the columns do; any other
 * form is a column of blocks.
 */
export function formDocument(
  t: Translate,
  form: FormDefinition,
  values: Values,
  today: string,
): PrintDocument {
  const at = form.parts.findIndex((p) => p.kind === "table");
  const tablePart = at === -1 ? null : (form.parts[at] as Extract<FormPart, { kind: "table" }>);

  const head = at === -1 ? [] : form.parts.slice(0, at).flatMap((p) => partBlocks(t, p, values));
  const body = (at === -1 ? form.parts : form.parts.slice(at + 1)).flatMap((p) =>
    partBlocks(t, p, values),
  );

  return {
    title: t(printFormLabel(form.kind)),
    subtitle: t(form.subtitleId),
    meta: [],
    head: head.length ? head : undefined,
    table: tablePart ? formTable(t, tablePart, values) : undefined,
    blocks: body,
    // The 31-day card is the one table here with more columns than words.
    dense: form.kind === "attendance",
    ruled: tablePart !== null,
    footer: printFooter(t, today),
  };
}

export function formHtml(t: Translate, form: FormDefinition, values: Values, today: string): string {
  return renderPrintDocument(formDocument(t, form, values, today), false);
}

function field(t: Translate, f: FormField, value: string | undefined) {
  return {
    label: t(f.captionId),
    // A legend is part of the form, not something typed into it.
    value: f.legendId ? t(f.legendId) : printedValue(value ?? ""),
    grow: f.grow,
  };
}

function partBlocks(t: Translate, part: FormPart, values: Values): PrintBlock[] {
  switch (part.kind) {
    case "fields":
    case "areas":
    case "signatures":
      return [cardPartBlock(t, part, (key) => values[key])];
    case "table":
      // Only one table per form, and `formDocument` has already taken it.
      return [];
    case "desks": {
      const { rows, cols } = deskGrid(part, values);
      const names = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (__, c) => values[deskKey(r + 1, c + 1)] ?? ""),
      );
      // The grid takes what is left of a portrait page under the header —
      // about 140 CSS millimetres of the page's 207, less the gaps — shared
      // between the rows, and never taller than the source's own desks.
      const height = Math.min(28, Math.floor((140 - (rows - 1) * 3) / rows));
      return [{ kind: "desks", board: t("form.board"), names, height }];
    }
    case "checklist":
      return [
        {
          kind: "checklist",
          columns: part.columns.map((col) => ({
            caption: t(col.captionId),
            items: col.items.map((item) => ({
              text: t(`form.periodChecklist.item.${col.code}.${item}` as StringId),
              checked: values[tickKey(col.code, item)] === "1",
            })),
          })),
        },
      ];
    case "cards":
      return Array.from({ length: cardCount(part, values) }, (_, i) => ({
        kind: "card" as const,
        title: part.titleId ? t(part.titleId) : undefined,
        cut: part.cut,
        blocks: part.parts.map((p) =>
          cardPartBlock(t, p, (key) => values[cardKey(part.key, i + 1, key)]),
        ),
      }));
  }
}

/** A row of fields, a pair of boxes or a row of signatures, reading its values through `get`. */
function cardPartBlock(
  t: Translate,
  part: CardPart,
  get: (key: string) => string | undefined,
): PrintBlock {
  switch (part.kind) {
    case "fields":
      return { kind: "fields", tight: true, fields: part.fields.map((f) => field(t, f, get(f.key))) };
    case "areas":
      return {
        kind: "areas",
        areas: part.areas.map((a) => ({ caption: t(a.captionId), text: get(a.key) ?? "", rows: a.rows })),
      };
    case "signatures":
      return {
        kind: "signatures",
        fields: part.fields.map((f) => ({ label: t(f.captionId), value: printedValue(get(f.key) ?? "") })),
      };
  }
}

function formTable(
  t: Translate,
  part: Extract<FormPart, { kind: "table" }>,
  values: Values,
): PrintTable {
  const head: PrintCell[] = [
    ...(part.numbered ? [{ text: t("form.col.number"), width: "4.5%", nowrap: true }] : []),
    ...part.columns.map((c) => ({
      text: c.captionId ? t(c.captionId) : (c.caption ?? ""),
      width: c.width,
      // `Ημερομηνία` over a date column, and `31` over a day, are both broken
      // in two on a portrait sheet unless told not to — found on rendered pages.
      nowrap: c.kind === "date" || Boolean(c.caption),
      // A day of the month is one or two digits; centred, like the source.
      align: c.caption ? ("center" as const) : undefined,
    })),
  ];
  const rows = Array.from({ length: tableRows(part, values) }, (_, i) => {
    const row = i + 1;
    return [
      ...(part.numbered
        ? [{ text: String(row).padStart(2, "0"), muted: true, nowrap: true }]
        : []),
      ...part.columns.map((c) => ({
        text: printedValue(values[cellKey(part.key, row, c.key)] ?? ""),
        nowrap: c.kind === "date" || Boolean(c.caption),
        align: c.caption ? ("center" as const) : undefined,
      })),
    ];
  });
  return { head, rows };
}

/**
 * Πρότυπα — the eleven standalone print forms (the spec's module 8).
 *
 * Pick a form, make a new copy of it or open a saved one, fill it in, and
 * export it. Every copy is **saved under the teacher's own name**, reopened
 * from the list, and edited again — M7's first acceptance criterion — and every
 * box is saved as she leaves it rather than behind a Save button.
 *
 * **What this screen deliberately does not do: read anything else in the
 * planner.** It is given the planner only for the list of saved forms. A form
 * is a loose page, and what it prints is a function of its own values alone
 * (`print/formSheets.ts` is never handed the planner), so a blank *Πλάνο
 * αίθουσας* stays blank however many real classes sit in Τάξεις. The page that
 * does read the real seating is the substitute folder, and it is a different
 * screen in a different section on purpose.
 *
 * **"Νέο έντυπο" selects the form it made.** That is the create-then-edit
 * shape M1's `Νέο τμήμα` data-loss bug lived in, and it is handled the way M1's
 * fix does it: `run` hands back the planner it read from disk, and the button
 * selects the one form that was not there before.
 */
import { useState } from "react";
import { api } from "../api";
import { ContentLanguageNote } from "../components/ContentLanguageNote";
import { ExportButton } from "../components/ExportButton";
import {
  Button,
  CellInput,
  CheckboxField,
  DeferredTextArea,
  DeferredTextField,
  Panel,
} from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  DESK_COLS_KEY,
  DESK_ROWS_KEY,
  MAX_DESKS_SIDE,
  cardCount,
  cardCountKey,
  cardKey,
  cellKey,
  deskGrid,
  deskKey,
  emptyForm,
  formDefinition,
  formsOfKind,
  rowCountKey,
  tableRows,
  tickKey,
  type CardPart,
  type FormDefinition,
  type FormPart,
  type PrintForm,
} from "../domain/printForms";
import type { Planner } from "../domain/types";
import type { StringId } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import { PRINT_FORM_KINDS, printFormLabel, type PrintFormKind } from "../i18n/vocabularies";
import { formHtml } from "../print/formSheets";
import type { Run } from "./types";

export default function FormsScreen({
  planner,
  run,
  today,
}: {
  planner: Planner;
  run: Run;
  today: string;
}) {
  const t = useTranslate();
  const [kind, setKind] = useState<PrintFormKind>(PRINT_FORM_KINDS[0]);
  /** Which saved copy is open, per kind, so moving between kinds keeps it. */
  const [selection, setSelection] = useState<Partial<Record<PrintFormKind, number>>>({});

  const definition = formDefinition(kind);
  const saved = formsOfKind(planner.print_forms, kind);
  // The one asked for, or — when nothing has been picked, or it was deleted —
  // the most recently changed copy of this kind.
  const selected = saved.find((f) => f.id === selection[kind]) ?? saved[0] ?? null;
  const title = t(printFormLabel(kind));

  return (
    <>
      <Panel headingId="forms.heading" introId="forms.intro">
        <p className="hint">{t("forms.independent")}</p>
        <ContentLanguageNote />
        <ul className="chips" aria-label={t("forms.pick")}>
          {PRINT_FORM_KINDS.map((k) => (
            <li key={k}>
              <button
                type="button"
                className={k === kind ? "chip selected" : "chip"}
                aria-pressed={k === kind}
                onClick={() => setKind(k)}
              >
                {t(printFormLabel(k))}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        headingId={printFormLabel(kind)}
        introId={definition.subtitleId}
        actions={
          <>
            <Button
              labelId="forms.new"
              variant="primary"
              onClick={async () => {
                const before = new Set(planner.print_forms.map((f) => f.id));
                const next = await run(() => api.savePrintForm(emptyForm(kind, today)));
                const created = next?.print_forms.find((f) => !before.has(f.id));
                if (created) setSelection((s) => ({ ...s, [kind]: created.id }));
              }}
            />
            {/* The source's own use: print it empty and fill it in by hand. */}
            <ExportButton
              labelId="forms.exportBlank"
              landscape={false}
              fileName={t("forms.blankFileName", { form: title })}
              html={() => formHtml(t, definition, {}, today)}
            />
          </>
        }
      >
        {definition.hintId && <p className="note">{t(definition.hintId)}</p>}
        <h3>{t("forms.saved")}</h3>
        {saved.length === 0 ? (
          <p className="muted">{t("forms.none")}</p>
        ) : (
          <ul className="chips" aria-label={t("forms.saved")}>
            {saved.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={f.id === selected?.id ? "chip selected" : "chip"}
                  aria-pressed={f.id === selected?.id}
                  onClick={() => setSelection((s) => ({ ...s, [kind]: f.id }))}
                >
                  {/* The name is the teacher's own text, shown as typed. */}
                  <strong>{f.name.trim() || t("forms.untitled")}</strong>
                  <span className="muted">
                    {t("forms.changedOn", { date: formatDate(f.updated) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {selected ? (
        // Keyed by the form, so no half-typed value can follow the teacher
        // from one saved copy into another.
        <FormEditor key={selected.id} form={selected} definition={definition} run={run} today={today} />
      ) : (
        <p className="muted">{t("forms.pickOrCreate")}</p>
      )}
    </>
  );
}

function FormEditor({
  form,
  definition,
  run,
  today,
}: {
  form: PrintForm;
  definition: FormDefinition;
  run: Run;
  today: string;
}) {
  const t = useTranslate();
  const values = form.values;
  const set = (key: string, value: string) =>
    run(() => api.setPrintFormValue(form.id, key, value, today));
  const title = t(printFormLabel(form.kind));

  return (
    <section className="panel" aria-label={form.name.trim() || t("forms.untitled")}>
      <div className="row">
        <DeferredTextField
          labelId="forms.name"
          value={form.name}
          onCommit={(name) => run(() => api.savePrintForm({ ...form, name, updated: today }))}
        />
      </div>
      <p className="hint">{t("forms.autosave")}</p>

      <div className="form-body">
        {definition.parts.map((part, i) => (
          <PartEditor key={i} part={part} values={values} set={set} />
        ))}
      </div>

      <div className="actions">
        <ExportButton
          labelId="forms.export"
          landscape={false}
          fileName={t("forms.fileName", {
            form: title,
            name: form.name.trim() || t("forms.untitled"),
            date: formatDate(today),
          })}
          html={() => formHtml(t, definition, values, today)}
        />
        <Button
          labelId="forms.delete"
          variant="danger"
          onClick={() => run(() => api.deletePrintForm(form.id))}
        />
      </div>
    </section>
  );
}

type Set = (key: string, value: string) => unknown;

function PartEditor({
  part,
  values,
  set,
}: {
  part: FormPart;
  values: Record<string, string>;
  set: Set;
}) {
  const t = useTranslate();
  switch (part.kind) {
    case "fields":
    case "areas":
    case "signatures":
      return <CardPartEditor part={part} get={(k) => values[k] ?? ""} set={set} keyOf={(k) => k} />;

    case "table": {
      const rows = tableRows(part, values);
      const caption = (c: (typeof part.columns)[number]) =>
        c.captionId ? t(c.captionId) : (c.caption ?? "");
      return (
        <div className="form-table-wrap">
          <table className={part.numbered ? "form-table dense" : "form-table"}>
            <thead>
              <tr>
                {part.numbered && <th>{t("form.col.number")}</th>}
                {part.columns.map((c) => (
                  <th key={c.key}>{caption(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, i) => i + 1).map((row) => (
                <tr key={row}>
                  {part.numbered && <td className="muted">{String(row).padStart(2, "0")}</td>}
                  {part.columns.map((c) => {
                    const key = cellKey(part.key, row, c.key);
                    return (
                      <td key={c.key}>
                        <CellInput
                          label={t("forms.cell", { column: caption(c), n: row })}
                          type={c.kind === "date" ? "date" : "text"}
                          className={c.caption ? "day" : undefined}
                          value={values[key] ?? ""}
                          onCommit={(v) => set(key, v)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <Button labelId="forms.addRow" onClick={() => set(rowCountKey(part.key), String(rows + 1))} />
        </div>
      );
    }

    case "desks": {
      const { rows, cols } = deskGrid(part, values);
      const clamp = (v: string) => String(Math.max(1, Math.min(MAX_DESKS_SIDE, Number(v) || 1)));
      return (
        <div>
          <div className="row">
            <DeferredTextField
              labelId="forms.deskRows"
              value={String(rows)}
              onCommit={(v) => set(DESK_ROWS_KEY, clamp(v))}
            />
            <DeferredTextField
              labelId="forms.deskCols"
              value={String(cols)}
              onCommit={(v) => set(DESK_COLS_KEY, clamp(v))}
            />
          </div>
          <p className="board">{t("form.board")}</p>
          <div className="seating" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const key = deskKey(r + 1, c + 1);
                return (
                  <CellInput
                    key={key}
                    className="seat"
                    label={t("forms.desk", { row: r + 1, col: c + 1 })}
                    value={values[key] ?? ""}
                    onCommit={(v) => set(key, v)}
                  />
                );
              }),
            )}
          </div>
        </div>
      );
    }

    case "checklist":
      return (
        <div className="row checklist">
          {part.columns.map((col) => (
            <div key={col.code} className="field-group">
              <h3>{t(col.captionId)}</h3>
              {col.items.map((item) => {
                const key = tickKey(col.code, item);
                return (
                  <CheckboxField
                    key={item}
                    labelId={`form.periodChecklist.item.${col.code}.${item}` as StringId}
                    checked={values[key] === "1"}
                    onChange={(on) => set(key, on ? "1" : "")}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );

    case "cards": {
      const count = cardCount(part, values);
      return (
        <div>
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            // A labelled group per card, so "ΣΤΟΧΟΣ" on the second goal is
            // told apart from "ΣΤΟΧΟΣ" on the first — by a screen reader and
            // by a test alike.
            <section
              key={n}
              role="group"
              aria-label={t(part.labelId, { n })}
              className={part.cut ? "form-card cut" : "form-card"}
            >
              <h3>{t(part.labelId, { n })}</h3>
              {part.parts.map((p, j) => (
                <CardPartEditor
                  key={j}
                  part={p}
                  get={(k) => values[cardKey(part.key, n, k)] ?? ""}
                  set={set}
                  keyOf={(k) => cardKey(part.key, n, k)}
                />
              ))}
            </section>
          ))}
          {part.extendable && (
            <Button labelId="forms.addCard" onClick={() => set(cardCountKey(part.key), String(count + 1))} />
          )}
        </div>
      );
    }
  }
}

function CardPartEditor({
  part,
  get,
  set,
  keyOf,
}: {
  part: CardPart;
  get: (key: string) => string;
  set: Set;
  keyOf: (key: string) => string;
}) {
  const t = useTranslate();
  switch (part.kind) {
    case "fields":
    case "signatures":
      return (
        <div className="row">
          {part.fields.map((f) =>
            f.legendId ? (
              <div key={f.key} className="field">
                <span className="label">{t(f.captionId)}</span>
                <span className="muted">{t(f.legendId)}</span>
              </div>
            ) : (
              <DeferredTextField
                key={f.key}
                labelId={f.captionId}
                type={f.kind ?? "text"}
                value={get(f.key)}
                onCommit={(v) => set(keyOf(f.key), v)}
              />
            ),
          )}
        </div>
      );
    case "areas":
      return (
        <div className="row">
          {part.areas.map((a) => (
            <DeferredTextArea
              key={a.key}
              labelId={a.captionId}
              rows={Math.min(a.rows, 6)}
              value={get(a.key)}
              onCommit={(v) => set(keyOf(a.key), v)}
            />
          ))}
        </div>
      );
  }
}

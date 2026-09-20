/**
 * Βαθμοί — the gradebook, the conduct sheet and the roll-ups.
 *
 * This screen owns no arithmetic. Every average, suggestion, count and running
 * total comes from `domain/grades.ts` through `domain/gradebook.ts`, which is
 * also what the printed sheets read — so what the teacher sees here and what
 * comes out of the PDF cannot disagree.
 *
 * Two behaviours are worth knowing before reading the code:
 *
 * * **Nothing here ever blocks a save on the running weight total.** The
 *   warning under the column list appears when the weights are off from 100%
 *   and goes away when they are not; the save buttons do not consult it. Only
 *   a single invalid weight — negative, non-numeric, over 100 — is refused,
 *   and that is refused at the field, with the rest of the sheet untouched.
 * * **Cells commit when they lose focus**, not on every keystroke: each commit
 *   is a write to the data file and a fingerprint re-check, and a gradebook is
 *   typed at speed.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { api, isAppError } from "../api";
import { Button, Field, Panel, SelectField, TextArea, TextField } from "../components/Fields";
import { useStoredDraft } from "../components/useStoredDraft";
import { formatDate, todayIso } from "../domain/dates";
import {
  classRoster,
  columnsFor,
  gradingFor,
  resultsFor,
  rowFor,
  summaryFor,
  valueOf,
  yearSummaryOf,
} from "../domain/gradebook";
import {
  formatAverage,
  isNumericColumn,
  parseWeight,
  weightTotal,
  weightTotalStatus,
  type ClassGrading,
  type GradeColumn,
  type GradeRow,
} from "../domain/grades";
import type { Planner, SchoolClass, Student } from "../domain/types";
import type { StringId } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import {
  CONDUCT_LEVELS,
  DESCRIPTIVE_GRADES,
  GRADE_COLUMN_KINDS,
  PASS_FAIL_GRADES,
  conductLabel,
  descriptiveGradeLabel,
  gradeColumnKindLabel,
  passFailGradeLabel,
  type ConductLevel,
  type GradeColumnKind,
} from "../i18n/vocabularies";
import { conductSheetHtml, gradeSheetHtml } from "../print/gradeSheets";
import type { Run } from "./types";

export default function GradesScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const [selectedId, setSelectedId] = useState<number | null>(planner.classes[0]?.id ?? null);

  useEffect(() => {
    if (planner.classes.length === 0) setSelectedId(null);
    else if (!planner.classes.some((c) => c.id === selectedId)) {
      setSelectedId(planner.classes[0].id);
    }
  }, [planner.classes, selectedId]);

  const selected = planner.classes.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Panel headingId="grades.heading" introId="grades.intro">
        {planner.classes.length === 0 ? (
          <p className="muted">{t("grades.noClasses")}</p>
        ) : (
          <ul className="chips">
            {planner.classes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={c.id === selectedId ? "chip selected" : "chip"}
                  onClick={() => setSelectedId(c.id)}
                >
                  <strong>{c.name.trim() || t("common.unnamed")}</strong>
                  <span className="muted">{c.subject}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {selected && (
        <>
          <SheetSettings key={`g${selected.id}`} schoolClass={selected} planner={planner} run={run} />
          <Columns key={`c${selected.id}`} schoolClass={selected} planner={planner} run={run} />
          <Gradebook key={`b${selected.id}`} schoolClass={selected} planner={planner} run={run} />
          <ClassSummaryPanel schoolClass={selected} planner={planner} />
          <ConductSheet key={`k${selected.id}`} schoolClass={selected} planner={planner} run={run} />
        </>
      )}

      <YearSummaryPanel planner={planner} />
    </>
  );
}

// ------------------------------------------------------ the sheet header ---

function SheetSettings({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const stored = gradingFor(planner, schoolClass.id);
  const [draft, setDraft] = useStoredDraft(stored);
  const patch = (p: Partial<ClassGrading>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <Panel headingId="grades.sheetSettings">
      <div className="row">
        <TextField
          labelId="grades.period"
          value={draft.period}
          onChange={(period) => patch({ period })}
        />
        <NumberField
          labelId="grades.scaleMax"
          value={draft.scale_max}
          onCommit={(scale_max) => patch({ scale_max })}
        />
        <NumberField
          labelId="grades.passMark"
          hintId="grades.passMarkHint"
          value={draft.pass_threshold}
          onCommit={(pass_threshold) => patch({ pass_threshold })}
        />
      </div>
      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() => run(() => api.saveClassGrading(draft))}
        />
      </div>
    </Panel>
  );
}


/**
 * A number the teacher types, held as text while she is typing it.
 *
 * Converting on every keystroke is what makes a field impossible to edit: an
 * emptied box reads as `0`, snaps back to "0" on the next render, and the
 * teacher cannot clear it to type "12". So the text is local until the field
 * loses focus, and a value that is not a number leaves the stored one alone
 * rather than quietly becoming zero — a pass threshold of 0 would mark a whole
 * class as passing.
 */
function NumberField({
  labelId,
  hintId,
  value,
  onCommit,
}: {
  labelId: StringId;
  hintId?: StringId;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(formatAverage(value));
  useEffect(() => setText(formatAverage(value)), [value]);

  return (
    <Field labelId={labelId} hintId={hintId}>
      {(id) => (
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = Number(text.trim().replace(",", "."));
            if (text.trim() !== "" && Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
            else setText(formatAverage(value));
          }}
        />
      )}
    </Field>
  );
}

// ----------------------------------------------------------- the columns ---

function Columns({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const columns = columnsFor(planner, schoolClass.id);
  const total = weightTotal(columns);
  const status = weightTotalStatus(columns);

  return (
    <Panel
      headingId="grades.columns"
      introId="grades.columnsIntro"
      actions={
        <Button
          labelId="grades.addColumn"
          variant="primary"
          onClick={() =>
            run(() =>
              api.saveGradeColumn({
                id: 0,
                class_id: schoolClass.id,
                position: columns.length,
                label: t("grades.newColumnLabel", { n: columns.length + 1 }),
                kind: "numeric",
                // A new column arrives unweighted: "not decided yet" is the
                // honest starting state, and it keeps the column out of the
                // average until the teacher says what it is worth.
                weight: null,
              }),
            )
          }
        />
      }
    >
      {columns.length === 0 ? (
        <p className="muted">{t("grades.noColumns")}</p>
      ) : (
        <>
          <ul className="rows">
            {columns.map((column) => (
              <ColumnEditor key={column.id} column={column} run={run} />
            ))}
          </ul>
          <p className="note">{t("grades.weightBlank")}</p>
        </>
      )}

      <p className={status === "exact" || status === "none" ? "total" : "total warning"}>
        {t("grades.weightTotal", { total: formatAverage(total) })}
      </p>
      {(status === "under" || status === "over") && (
        <p className="warning-box" role="status">
          {status === "under"
            ? t("grades.weightUnder", { total: formatAverage(total) })
            : t("grades.weightOver", { total: formatAverage(total) })}{" "}
          {t("grades.weightNeverBlocks")}
        </p>
      )}
    </Panel>
  );
}

function ColumnEditor({ column, run }: { column: GradeColumn; run: Run }) {
  const t = useTranslate();
  const [label, setLabel] = useState(column.label);
  const [weight, setWeight] = useState(column.weight === null ? "" : formatAverage(column.weight));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setLabel(column.label), [column.label]);
  useEffect(
    () => setWeight(column.weight === null ? "" : formatAverage(column.weight)),
    [column.weight],
  );

  const save = (patch: Partial<GradeColumn>) => run(() => api.saveGradeColumn({ ...column, ...patch }));

  return (
    <li className="row">
      <Field labelId="grades.columnLabel">
        {(id) => (
          <input
            id={id}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              if (label !== column.label) void save({ label });
            }}
          />
        )}
      </Field>
      <SelectField<GradeColumnKind>
        labelId="grades.columnKind"
        value={column.kind}
        onChange={(kind) => void save({ kind })}
        options={GRADE_COLUMN_KINDS}
        optionLabelId={gradeColumnKindLabel}
      />
      {/* Only a numeric column can carry a weight: the others take no part in
          the average, so offering them one would promise something false. */}
      {isNumericColumn(column) && (
        <Field labelId="grades.weight">
          {(id) => (
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={weight}
              aria-invalid={invalid || undefined}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => {
                const parsed = parseWeight(weight);
                if (parsed === undefined) {
                  // The one thing a save is refused for. The sheet is
                  // untouched and the teacher keeps what she typed.
                  setInvalid(true);
                  return;
                }
                setInvalid(false);
                if (parsed !== column.weight) void save({ weight: parsed });
              }}
            />
          )}
        </Field>
      )}
      {invalid && <p className="warning-box">{t("grades.weightInvalid")}</p>}
      <Button
        labelId="grades.removeColumn"
        variant="danger"
        onClick={() => run(() => api.deleteGradeColumn(column.id))}
      />
    </li>
  );
}

// --------------------------------------------------------- the gradebook ---

function Gradebook({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const columns = columnsFor(planner, schoolClass.id);
  const roster = classRoster(planner, schoolClass.id);
  const results = resultsFor(planner, schoolClass.id);

  return (
    <Panel
      headingId="grades.sheet"
      actions={
        <ExportButton
          labelId="grades.exportSheet"
          fileName={(date) =>
            t("grades.sheetFileName", {
              class: schoolClass.name.trim() || t("common.unnamed"),
              date,
            })
          }
          html={(today) => gradeSheetHtml(t, planner, schoolClass.id, today)}
        />
      }
    >
      {roster.length === 0 ? (
        <p className="muted">{t("grades.emptyRoster")}</p>
      ) : (
        <div className="scroller">
          <table className="gradebook">
            <thead>
              <tr>
                <th>{t("grades.rosterNo")}</th>
                <th>{t("common.name")}</th>
                {columns.map((c) => (
                  <th key={c.id}>{c.label.trim() || t("grades.noValue")}</th>
                ))}
                <th>{t("grades.average")}</th>
                <th>{t("grades.suggestion")}</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(({ enrollment, student }) => {
                const result = results.find((r) => r.student_id === student.id);
                return (
                  <tr key={student.id}>
                    <td>{enrollment.roster_no}</td>
                    <td>{student.full_name}</td>
                    {columns.map((column) => (
                      <td key={column.id}>
                        <GradeCell
                          column={column}
                          student={student}
                          value={valueOf(planner, column.id, student.id)}
                          run={run}
                        />
                      </td>
                    ))}
                    <td className={result?.passing === false ? "at-risk" : undefined}>
                      {formatAverage(result?.average ?? null)}
                    </td>
                    <td className={result?.passing === false ? "at-risk" : undefined}>
                      {result?.suggested === null || result === undefined
                        ? t("grades.noValue")
                        : result.suggested}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/**
 * One cell. Its editor follows the column's type: a box for a mark or a
 * comment, a list for the two coded scales — where the code is what is stored
 * and the label is only what is shown.
 */
function GradeCell({
  column,
  student,
  value,
  run,
}: {
  column: GradeColumn;
  student: Student;
  value: string;
  run: Run;
}) {
  const t = useTranslate();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (next: string) =>
    run(() =>
      api.setGradeValue({
        class_id: column.class_id,
        column_id: column.id,
        student_id: student.id,
        value: next,
      }),
    );

  const label = `${column.label.trim() || t("grades.noValue")} · ${student.full_name}`;

  if (column.kind === "descriptive" || column.kind === "pass_fail") {
    const options: readonly string[] =
      column.kind === "descriptive" ? DESCRIPTIVE_GRADES : PASS_FAIL_GRADES;
    const labelFor = column.kind === "descriptive" ? descriptiveGradeLabel : passFailGradeLabel;
    return (
      <select
        aria-label={label}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          void commit(e.target.value);
        }}
      >
        <option value="">{t("grades.noValue")}</option>
        {options.map((code) => (
          <option key={code} value={code}>
            {t(labelFor(code))}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      aria-label={label}
      inputMode={column.kind === "numeric" ? "decimal" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) void commit(draft);
      }}
    />
  );
}

// ------------------------------------------------------------ the totals ---

function ClassSummaryPanel({
  schoolClass,
  planner,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
}) {
  const t = useTranslate();
  const summary = summaryFor(planner, schoolClass.id);
  const rows: [string, string][] = [
    [t("grades.summaryAverage"), formatAverage(summary.average)],
    [t("grades.summaryHighest"), formatAverage(summary.highest)],
    [t("grades.summaryLowest"), formatAverage(summary.lowest)],
    [t("grades.summaryAbove"), String(summary.atOrAbove)],
    [t("grades.summaryBelow"), String(summary.below)],
    [t("grades.summaryRoster"), String(summary.rosterSize)],
    [t("grades.summaryIntervention"), String(summary.needingIntervention)],
  ];
  // A flat `dt`/`dd` list, as the storage panel is: the stylesheet lays a
  // definition list out as a two-column grid, and wrapping each pair in a
  // `div` would collapse both columns into one cell.
  return (
    <Panel headingId="grades.classSummary">
      <dl>
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </Panel>
  );
}

function YearSummaryPanel({ planner }: { planner: Planner }) {
  const t = useTranslate();
  const summary = useMemo(() => yearSummaryOf(planner), [planner]);
  if (planner.classes.length === 0) return null;

  return (
    <Panel headingId="grades.yearSummary" introId="grades.yearSummaryIntro">
      <table className="summary">
        <thead>
          <tr>
            <th>{t("grades.summaryClass")}</th>
            <th>{t("grades.summarySubject")}</th>
            <th>{t("grades.average")}</th>
            <th>{t("grades.summaryAbove")}</th>
            <th>{t("grades.summaryBelow")}</th>
            <th>{t("grades.summaryStudents")}</th>
          </tr>
        </thead>
        <tbody>
          {summary.classes.map((row) => {
            const schoolClass = planner.classes.find((c) => c.id === row.class_id);
            return (
              <tr key={row.class_id}>
                <td>{schoolClass?.name.trim() || t("common.unnamed")}</td>
                <td>{schoolClass?.subject}</td>
                <td>{formatAverage(row.average)}</td>
                <td>{row.atOrAbove}</td>
                <td>{row.below}</td>
                <td>{row.rosterSize}</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td colSpan={2}>{t("grades.overallAverage")}</td>
            <td>{formatAverage(summary.overall)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

// ------------------------------------------------------ the conduct sheet ---

function ConductSheet({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const roster = classRoster(planner, schoolClass.id);

  return (
    <Panel
      headingId="grades.conductHeading"
      introId="grades.conductIntro"
      actions={
        <ExportButton
          labelId="grades.exportConduct"
          fileName={(date) =>
            t("grades.conductFileName", {
              class: schoolClass.name.trim() || t("common.unnamed"),
              date,
            })
          }
          html={(today) => conductSheetHtml(t, planner, schoolClass.id, today)}
        />
      }
    >
      {roster.length === 0 ? (
        <p className="muted">{t("grades.emptyRoster")}</p>
      ) : (
        <ul className="rows">
          {roster.map(({ student }) => (
            <ConductRow
              key={student.id}
              student={student}
              row={rowFor(planner, schoolClass.id, student.id)}
              run={run}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ConductRow({ student, row, run }: { student: Student; row: GradeRow; run: Run }) {
  const [draft, setDraft] = useStoredDraft(row);
  const commit = (next: GradeRow) => run(() => api.saveGradeRow(next));

  return (
    <li className="row conduct-row">
      <strong>{student.full_name}</strong>
      <SelectField<ConductLevel | "">
        labelId="grades.conduct"
        value={draft.conduct}
        onChange={(conduct) => {
          const next = { ...draft, conduct };
          setDraft(next);
          void commit(next);
        }}
        options={["", ...CONDUCT_LEVELS] as const}
        optionLabelId={(code) => (code === "" ? "grades.noValue" : conductLabel(code))}
      />
      {/* Teacher-written, never computed — the spec is explicit, and nothing
          in the app ever writes into this field. */}
      <TextField
        labelId="grades.overallResult"
        value={draft.overall_result}
        onChange={(overall_result) => setDraft({ ...draft, overall_result })}
      />
      <TextArea
        labelId="grades.observations"
        rows={2}
        value={draft.observations}
        onChange={(observations) => setDraft({ ...draft, observations })}
      />
      <Button labelId="common.save" onClick={() => void commit(draft)} />
    </li>
  );
}

// ---------------------------------------------------------- PDF exporting ---

/**
 * Builds a document and asks the Rust side to write it to `exports/`.
 *
 * Export is not a mutation, so it does not go through `run`: nothing about the
 * data file changes, and a failed export must not look like a failed save.
 */
function ExportButton({
  labelId,
  fileName,
  html,
}: {
  labelId: "grades.exportSheet" | "grades.exportConduct";
  fileName: (formattedDate: string) => string;
  html: (today: string) => string;
}) {
  const t = useTranslate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Button
        labelId={labelId}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const today = todayIso();
          try {
            const path = await api.exportPdf(fileName(formatDate(today)), html(today), true);
            setMessage(t("grades.exported", { path }));
          } catch (e) {
            setMessage(isAppError(e) ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <span className="muted">{t("grades.exporting")}</span>}
      {message && (
        <span className="message" role="status">
          {message}
        </span>
      )}
    </>
  );
}

/**
 * Φάκελος αναπλήρωσης — the substitute folder, one per class (the spec's
 * module 6), under Τάξεις because a class is all it is generated from.
 *
 * **Everything this screen shows from elsewhere is read live and is read-only
 * here**: the class's name, subject, room and person in charge, the roster
 * count, who needs attention, the week's hours and plan, and the room plan.
 * Each comes from `substituteFolder()` over the planner the shell holds, and
 * each says where it is edited. There is no "regenerate" and no "refresh",
 * because there is nothing stale to refresh — M7's second acceptance
 * criterion.
 *
 * **What is edited here is only the folder's own words**: the boxes the app
 * suggests text for, the one-day plan, and the school's contacts and
 * procedures (shared by every class's folder, so typed once). A suggested box
 * shows its suggestion until the teacher writes in it; once she has — even if
 * she empties it — what she wrote stays, and only *Επαναφορά* brings the
 * suggestion back. See `domain/substitute.ts`.
 *
 * **One export, one file.** The button writes the cover and all five pages as
 * one landscape PDF.
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import { Button, CellInput, DeferredTextArea, DeferredTextField, Panel } from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  CONTACT_ROLES,
  PROCEDURES,
  contactField,
  dayKey,
  dayRows,
  folderText,
  hasDefault,
  procedureField,
  substituteFolder,
  DAY_ROWS_KEY,
  type SubstituteFolder,
} from "../domain/substitute";
import { formatHourTimes } from "../domain/timetable";
import type { Planner } from "../domain/types";
import type { Params, StringId } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import { weekdayLabel } from "../i18n/vocabularies";
import { attentionLines, folderHtml, weekRange } from "../print/substituteSheets";
import type { Run } from "./types";

export default function SubstituteScreen({
  planner,
  run,
  today,
}: {
  planner: Planner;
  run: Run;
  today: string;
}) {
  const t = useTranslate();
  const [selectedId, setSelectedId] = useState<number | null>(planner.classes[0]?.id ?? null);

  useEffect(() => {
    if (planner.classes.length === 0) setSelectedId(null);
    else if (!planner.classes.some((c) => c.id === selectedId)) setSelectedId(planner.classes[0].id);
  }, [planner.classes, selectedId]);

  // Read on every render from the planner as it is now. This line is the
  // whole of "shared live, not copied".
  const folder = selectedId === null ? null : substituteFolder(planner, selectedId, today);

  return (
    <>
      <Panel
        headingId="folder.heading"
        introId="folder.intro"
        actions={
          folder && (
            <ExportButton
              labelId="folder.export"
              fileName={t("folder.fileName", {
                class: folder.schoolClass.name.trim() || t("common.unnamed"),
                date: formatDate(today),
              })}
              html={() => folderHtml(t, planner, folder.schoolClass.id, today)}
            />
          )
        }
      >
        <p className="hint">{t("folder.live")}</p>
        {planner.classes.length === 0 ? (
          <p className="muted">{t("folder.noClasses")}</p>
        ) : (
          <ul className="chips" aria-label={t("folder.pickClass")}>
            {planner.classes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={c.id === selectedId ? "chip selected" : "chip"}
                  aria-pressed={c.id === selectedId}
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

      {folder && (
        <Folder key={folder.schoolClass.id} folder={folder} planner={planner} run={run} />
      )}
    </>
  );
}

function Folder({ folder, planner, run }: { folder: SubstituteFolder; planner: Planner; run: Run }) {
  const t = useTranslate();
  const classId = folder.schoolClass.id;
  const { schoolClass } = folder;

  const box = (field: string, labelId: StringId, rows = 4, shared = false) => (
    <FolderText
      key={field}
      planner={planner}
      run={run}
      classId={shared ? null : classId}
      field={field}
      labelId={labelId}
      rows={rows}
    />
  );

  return (
    <>
      <Panel headingId="folder.info.title" introId="folder.info.subtitle">
        <dl className="live">
          <Live labelId="folder.info.class" value={schoolClass.name} />
          <Live labelId="folder.info.subject" value={schoolClass.subject} />
          <Live labelId="folder.info.room" value={schoolClass.room} />
          <Live labelId="folder.info.count" value={String(folder.rosterSize)} />
          <Live labelId="folder.info.responsible" value={schoolClass.responsible} />
        </dl>
        <p className="hint">{t("folder.info.fromClass")}</p>
        <div className="row">
          {box("rules", "form.area.rules")}
          <div className="field-group">
            <h3>{t("form.area.attention")}</h3>
            <p className="hint">{t("folder.attentionLive")}</p>
            {folder.attention.length === 0 ? (
              <p className="muted">{t("folder.attentionNone")}</p>
            ) : (
              <ul aria-label={t("form.area.attention")}>
                {attentionLines(t, folder.attention).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
            {box("attention", "folder.attentionExtra", 3)}
          </div>
        </div>
        <div className="row">
          {box("materials", "folder.materials")}
          {box("problem", "folder.problem")}
        </div>
      </Panel>

      <Panel headingId="folder.week.title" introId="folder.week.subtitle">
        <p>
          <strong>{t("folder.week.range")}</strong> {weekRange(t, folder)}
        </p>
        {folder.week.rows.length === 0 ? (
          <p className="muted">{t("folder.week.noPeriods")}</p>
        ) : (
          <table className="grid" aria-label={t("folder.week.title")}>
            <thead>
              <tr>
                <th>{t("folder.week.hour")}</th>
                {folder.week.weekdays.map((d) => (
                  <th key={d}>{t(weekdayLabel(d))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {folder.week.rows.map(({ period, cells }) => (
                <tr key={period.id}>
                  <th scope="row">
                    {period.name}
                    <span className="muted block">{formatHourTimes(period)}</span>
                  </th>
                  {cells.map((hour, i) => (
                    <td key={i}>
                      {hour && (
                        <>
                          {[hour.subject, hour.room].filter(Boolean).join(" · ")}
                          {hour.cell.notes && <span className="muted block">{hour.cell.notes}</span>}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="live">
          <Live labelId="folder.week.plan" value={folder.week.plan.notes} fallbackId="folder.week.noPlan" />
          <Live labelId="folder.week.assessment" value={folder.week.plan.assessment} />
        </dl>
        <p className="hint">{t("folder.week.fromPlan")}</p>
      </Panel>

      <Panel headingId="folder.seating.title" introId="folder.seating.subtitle">
        <p className="board">{t("classes.board")}</p>
        <div
          className="seating"
          role="list"
          aria-label={t("folder.seating.title")}
          style={{ gridTemplateColumns: `repeat(${schoolClass.seating_cols}, minmax(0, 1fr))` }}
        >
          {folder.seating.names.flatMap((row, r) =>
            row.map((name, c) => (
              <div
                key={`${r}-${c}`}
                role="listitem"
                className="seat"
                aria-label={t("folder.seating.seat", { row: r + 1, col: c + 1 })}
              >
                {name}
              </div>
            )),
          )}
        </div>
        <dl className="live">
          <Live labelId="folder.seating.notes" value={folder.seating.notes} />
        </dl>
        <p className="hint">{t("folder.seating.fromClasses")}</p>
      </Panel>

      <DayPlan planner={planner} run={run} classId={classId} />

      <Panel headingId="folder.contacts.title" introId="folder.contacts.subtitle">
        <p className="hint">{t("folder.contacts.shared")}</p>
        <div className="row">
          <div className="field-group">
            <h3>{t("folder.contacts.people")}</h3>
            {CONTACT_ROLES.map((role) =>
              role === "responsible" ? (
                <dl className="live" key={role}>
                  <Live labelId="folder.contact.responsible" value={schoolClass.responsible} />
                </dl>
              ) : (
                <FolderLine
                  key={role}
                  planner={planner}
                  run={run}
                  field={contactField(role)}
                  labelId={`folder.contact.${role}`}
                />
              ),
            )}
          </div>
          <div className="field-group">
            <h3>{t("folder.contacts.procedures")}</h3>
            {PROCEDURES.map((p) => box(procedureField(p), `folder.proc.${p}`, 2, true))}
          </div>
        </div>
        {box("message", "form.area.message", 4)}
      </Panel>
    </>
  );
}

/** A value looked up from elsewhere, shown read-only. */
function Live({
  labelId,
  value,
  fallbackId = "common.none",
}: {
  labelId: StringId;
  value: string;
  fallbackId?: StringId;
}) {
  const t = useTranslate();
  return (
    <>
      <dt>{t(labelId)}</dt>
      {/* Teacher-entered text, shown exactly as typed. */}
      <dd className="prewrap">{value.trim() ? value : <span className="muted">{t(fallbackId)}</span>}</dd>
    </>
  );
}

/**
 * One of the folder's own boxes: the teacher's text, or the suggestion until
 * she writes her own. Says which it is, and offers the way back.
 */
function FolderText({
  planner,
  run,
  classId,
  field,
  labelId,
  labelParams,
  rows = 4,
}: {
  planner: Planner;
  run: Run;
  classId: number | null;
  field: string;
  labelId: StringId;
  labelParams?: Params;
  rows?: number;
}) {
  const t = useTranslate();
  const { value, state } = folderText(planner, classId, field, t);
  const suggested = hasDefault(classId, field);
  return (
    <div className="field-group folder-text">
      <DeferredTextArea
        labelId={labelId}
        labelParams={labelParams}
        rows={rows}
        value={value}
        onCommit={(v) => run(() => api.setSubstituteText(classId, field, v))}
      />
      {suggested && (
        <p className="hint">
          {t(`folder.state.${state}`)}
          {state !== "default" && (
            <>
              {" "}
              <Button
                labelId="folder.reset"
                onClick={() => run(() => api.resetSubstituteText(classId, field))}
              />
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** A one-line school-wide text, for a contact's name and number. */
function FolderLine({
  planner,
  run,
  field,
  labelId,
}: {
  planner: Planner;
  run: Run;
  field: string;
  labelId: StringId;
}) {
  const t = useTranslate();
  return (
    <DeferredTextField
      labelId={labelId}
      value={folderText(planner, null, field, t).value}
      onCommit={(v) => run(() => api.setSubstituteText(null, field, v))}
    />
  );
}

/** The one-day fallback plan: what only the teacher can write. */
function DayPlan({ planner, run, classId }: { planner: Planner; run: Run; classId: number }) {
  const t = useTranslate();
  const rows = dayRows(planner, classId);
  const text = (field: string) => folderText(planner, classId, field, t).value;
  const set = (field: string, value: string) =>
    run(() => api.setSubstituteText(classId, field, value));
  const columns = [
    ["time", "folder.day.time"],
    ["activity", "folder.day.activity"],
    ["notes", "folder.day.notes"],
  ] as const;

  return (
    <Panel headingId="folder.day.title" introId="folder.day.subtitle">
      <div className="row">
        <DeferredTextField
          labelId="folder.day.date"
          type="date"
          value={text("day.date")}
          onCommit={(v) => set("day.date", v)}
        />
        <DeferredTextField
          labelId="folder.day.goal"
          value={text("day.goal")}
          onCommit={(v) => set("day.goal", v)}
        />
      </div>
      <table className="form-table">
        <thead>
          <tr>
            {columns.map(([key, labelId]) => (
              <th key={key}>{t(labelId)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => i + 1).map((n) => (
            <tr key={n}>
              {columns.map(([column, labelId]) => (
                <td key={column}>
                  <CellInput
                    label={t("folder.day.cell", { column: t(labelId), n })}
                    value={text(dayKey(n, column))}
                    onCommit={(v) => set(dayKey(n, column), v)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Button labelId="forms.addRow" onClick={() => set(DAY_ROWS_KEY, String(rows + 1))} />
    </Panel>
  );
}

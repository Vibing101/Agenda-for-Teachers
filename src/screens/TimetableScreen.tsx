/**
 * Ωρολόγιο πρόγραμμα — the teacher's master timetable.
 *
 * The source page is an `Ώρα` column against Δευτέρα–Σάββατο with the
 * instruction "Δίπλα σε κάθε ώρα γράψτε το μάθημα και το τμήμα", so that is what
 * this is: the hours are named once down the side, and each cell of the grid
 * says what the teacher is doing then.
 *
 * **This screen is the only place the teacher's week is edited.** M1's per-class
 * slot editor is gone; a class's hours are derived from the cells that link to it
 * (see `domain/timetable.ts`). That is what keeps a lesson from being typed twice
 * and keeps the Today view reading one register.
 *
 * Every field here — the hours' names and clock times, and each cell — commits
 * when it loses focus rather than on every keystroke, for the same reason the
 * gradebook's cells do: each commit is a write to the data file and a
 * fingerprint re-check.
 */
import { useState } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import {
  cellAt,
  emptyCell,
  formatHourTimes,
  periodsOf,
  resolveHour,
  type TimetableCell,
  type TimetablePeriod,
} from "../domain/timetable";
import type { Planner } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import { WEEKDAYS, weekdayLabel } from "../i18n/vocabularies";
import type { Run } from "./types";

export default function TimetableScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const periods = periodsOf(planner);
  /** Which cell is open for editing, as `periodId:weekday`. */
  const [openCell, setOpenCell] = useState<string | null>(null);

  return (
    <>
      <Panel
        headingId="timetable.heading"
        introId="timetable.intro"
        actions={
          <Button
            labelId="timetable.addHour"
            variant="primary"
            onClick={() =>
              run(() =>
                api.saveTimetablePeriod({
                  id: 0,
                  position: 0,
                  name: "",
                  start_time: "",
                  end_time: "",
                }),
              )
            }
          />
        }
      >
        <p className="intro">{t("timetable.hoursIntro")}</p>
        {periods.length === 0 ? (
          <p className="muted">{t("timetable.noHours")}</p>
        ) : (
          <ul className="rows">
            {periods.map((period) => (
              <Hour key={period.id} period={period} run={run} />
            ))}
          </ul>
        )}
        <p className="note">{t("timetable.removeHourWarning")}</p>
      </Panel>

      {periods.length > 0 && (
        <Panel headingId="timetable.grid">
          <div className="timetable-scroll">
            <table className="timetable">
              <thead>
                <tr>
                  <th>{t("timetable.hour")}</th>
                  {WEEKDAYS.map((day) => (
                    <th key={day}>{t(weekdayLabel(day))}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <th scope="row">
                      <span className="hour-name">{period.name.trim() || t("common.none")}</span>
                      <span className="muted block">{formatHourTimes(period)}</span>
                    </th>
                    {WEEKDAYS.map((day) => {
                      const key = `${period.id}:${day}`;
                      return (
                        <td key={day}>
                          <Cell
                            planner={planner}
                            period={period}
                            weekday={day}
                            open={openCell === key}
                            onOpen={() => setOpenCell(openCell === key ? null : key)}
                            run={run}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">{t("timetable.printLater")}</p>
        </Panel>
      )}
    </>
  );
}

/**
 * One named hour: its label and clock times.
 *
 * Each field commits on blur and carries the hour's own id, so editing one hour
 * cannot write over another — and nothing here touches the hour's cells, so
 * renaming "3η" leaves every lesson placed in it where it was.
 */
function Hour({ period, run }: { period: TimetablePeriod; run: Run }) {
  const save = (patch: Partial<TimetablePeriod>) =>
    run(() => api.saveTimetablePeriod({ ...period, ...patch }));

  return (
    <li className="row">
      <DeferredTextField
        labelId="timetable.hourName"
        value={period.name}
        onCommit={(name) => save({ name })}
      />
      <DeferredTextField
        labelId="common.from"
        type="time"
        value={period.start_time}
        onCommit={(start_time) => save({ start_time })}
      />
      <DeferredTextField
        labelId="common.to"
        type="time"
        value={period.end_time}
        onCommit={(end_time) => save({ end_time })}
      />
      <Button
        labelId="timetable.removeHour"
        variant="danger"
        onClick={() => run(() => api.deleteTimetablePeriod(period.id))}
      />
    </li>
  );
}

/**
 * One cell of the grid: a summary that opens into an editor.
 *
 * The summary reads through `resolveHour`, so the subject and room shown for a
 * linked class are looked up live rather than copied — renaming a class or moving
 * it to another room updates every hour it is taught in.
 */
function Cell({
  planner,
  period,
  weekday,
  open,
  onOpen,
  run,
}: {
  planner: Planner;
  period: TimetablePeriod;
  weekday: number;
  open: boolean;
  onOpen: () => void;
  run: Run;
}) {
  const t = useTranslate();
  const stored = cellAt(planner, period.id, weekday);
  const cell = stored ?? emptyCell(period.id, weekday);
  const hour = resolveHour(planner, period, cell);
  const label = t("timetable.cell", {
    day: t(weekdayLabel(weekday)),
    hour: period.name.trim() || formatHourTimes(period),
  });

  return (
    <div className={open ? "cell open" : "cell"}>
      <button
        type="button"
        className="cell-summary"
        onClick={onOpen}
        aria-expanded={open}
        aria-label={label}
      >
        {stored === null ? (
          <span className="muted">{t("timetable.cellFree")}</span>
        ) : (
          <>
            {hour.schoolClass && (
              <strong>{hour.schoolClass.name.trim() || t("common.unnamed")}</strong>
            )}
            {hour.subject && <span className="block">{hour.subject}</span>}
            {hour.room && <span className="muted block">{hour.room}</span>}
            {cell.duty && <span className="duty block">{cell.duty}</span>}
            {cell.notes && <span className="muted block">{cell.notes}</span>}
          </>
        )}
      </button>

      {open && <CellEditor planner={planner} cell={cell} labelledBy={label} run={run} />}
    </div>
  );
}

function CellEditor({
  planner,
  cell,
  labelledBy,
  run,
}: {
  planner: Planner;
  cell: TimetableCell;
  labelledBy: string;
  run: Run;
}) {
  const t = useTranslate();
  const save = (patch: Partial<TimetableCell>) =>
    run(() => api.saveTimetableCell({ ...cell, ...patch }));

  return (
    <div className="cell-editor" role="group" aria-label={labelledBy}>
      {/* A plain select rather than the translated `SelectField`: these options
          are class names, which are the teacher's own text and never translated. */}
      <label className="field">
        <span>{t("timetable.cellClass")}</span>
        <select
          value={String(cell.class_id ?? 0)}
          onChange={(e) => {
            const id = Number(e.target.value);
            save({ class_id: id === 0 ? null : id });
          }}
        >
          <option value="0">{t("timetable.cellNoClass")}</option>
          {planner.classes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name.trim() || t("common.unnamed")}
            </option>
          ))}
        </select>
      </label>

      {/* Always shown, even with a class linked: the cell's own subject wins in
          `resolveHour`, so hiding it would leave a value that cannot be cleared. */}
      <DeferredTextField
        labelId="timetable.cellSubject"
        value={cell.subject}
        onCommit={(subject) => save({ subject })}
      />
      <DeferredTextField
        labelId="timetable.cellRoom"
        value={cell.room}
        onCommit={(room) => save({ room })}
      />
      <DeferredTextField
        labelId="timetable.cellDuty"
        value={cell.duty}
        onCommit={(duty) => save({ duty })}
      />
      <DeferredTextField
        labelId="timetable.cellNotes"
        value={cell.notes}
        onCommit={(notes) => save({ notes })}
      />
      <Button
        labelId="timetable.cellClear"
        variant="danger"
        onClick={() =>
          run(() => api.saveTimetableCell(emptyCell(cell.period_id, cell.weekday)))
        }
      />
    </div>
  );
}

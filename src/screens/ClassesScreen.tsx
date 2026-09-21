/**
 * Τάξεις — the classes, each with its hours, its roster and its room plan.
 *
 * The class's **hours are read-only here**: M3 moved the teacher's week into one
 * master timetable, so a class's hours are derived from the cells that link to it
 * and are edited on the Πρόγραμμα screen. Everything else on the card is M1's.
 *
 * The roster is where M1's second acceptance criterion lives: a class's list is
 * built from `enrollment` rows, so the same student can be added to as many
 * classes as she attends and appears, correctly and independently, in each. The
 * support flag and the short note are per class, matching the source product's
 * own roster page.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "../api";
import {
  Button,
  CheckboxField,
  DeferredTextField,
  Panel,
  TextArea,
  TextField,
} from "../components/Fields";
import { useStoredDraft } from "../components/useStoredDraft";
import { formatHourTimes, hoursOfClass } from "../domain/timetable";
import { emptyClass, type Planner, type SchoolClass, type Seat } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import { weekdayLabel } from "../i18n/vocabularies";
import type { Run } from "./types";

export default function ClassesScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const [selectedId, setSelectedId] = useState<number | null>(planner.classes[0]?.id ?? null);

  // Keep a sensible selection as classes come and go.
  useEffect(() => {
    if (planner.classes.length === 0) setSelectedId(null);
    else if (!planner.classes.some((c) => c.id === selectedId)) {
      setSelectedId(planner.classes[0].id);
    }
  }, [planner.classes, selectedId]);

  const selected = planner.classes.find((c) => c.id === selectedId) ?? null;
  const rosterSize = (classId: number) =>
    planner.enrollments.filter((e) => e.class_id === classId).length;

  return (
    <>
      <Panel
        headingId="classes.heading"
        introId="classes.intro"
        actions={
          <Button
            labelId="classes.new"
            variant="primary"
            onClick={async () => {
              // Select the class we just created. Without this the editor stays
              // bound to whichever class was selected before, so typing a name
              // and saving renames *that* class and leaves the new one empty.
              const before = new Set(planner.classes.map((c) => c.id));
              const next = await run(() => api.saveClass(emptyClass()));
              const created = next?.classes.find((c) => !before.has(c.id));
              if (created) setSelectedId(created.id);
            }}
          />
        }
      >
        {planner.classes.length === 0 ? (
          <p className="muted">{t("classes.none")}</p>
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
                  <span className="muted">
                    {c.subject} · {t("classes.countValue", { n: rosterSize(c.id) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {selected && (
        <>
          <ClassDetails
            key={`d${selected.id}`}
            schoolClass={selected}
            planner={planner}
            run={run}
          />
          <Roster key={`r${selected.id}`} schoolClass={selected} planner={planner} run={run} />
          <Seating key={`s${selected.id}`} schoolClass={selected} planner={planner} run={run} />
        </>
      )}
    </>
  );
}

function ClassDetails({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const [draft, setDraft] = useStoredDraft(schoolClass);
  /**
   * The class's hours, derived from the master timetable rather than stored here.
   * M3 made that grid the single register of the teacher's week, so this list is
   * read-only and points at the Πρόγραμμα screen — which is what keeps the same
   * lesson from being typed twice.
   */
  const hours = hoursOfClass(planner, schoolClass.id);

  const patch = (p: Partial<SchoolClass>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <Panel headingId="classes.details">
      <div className="row">
        <TextField labelId="classes.name" value={draft.name} onChange={(name) => patch({ name })} />
        <TextField
          labelId="classes.subject"
          value={draft.subject}
          onChange={(subject) => patch({ subject })}
        />
        <TextField labelId="classes.room" value={draft.room} onChange={(room) => patch({ room })} />
        <TextField
          labelId="classes.responsible"
          value={draft.responsible}
          onChange={(responsible) => patch({ responsible })}
        />
      </div>
      <TextArea
        labelId="common.notes"
        value={draft.notes}
        onChange={(notes) => patch({ notes })}
      />

      <h3>{t("classes.slots")}</h3>
      <p className="intro">{t("classes.slotsIntro")}</p>
      {hours.length === 0 ? (
        <p className="muted">{t("classes.noSlots")}</p>
      ) : (
        <ul className="hours">
          {hours.map((hour) => (
            <li key={`${hour.period.id}:${hour.weekday}`}>
              <strong>{t(weekdayLabel(hour.weekday))}</strong>{" "}
              {hour.period.name.trim() || t("common.none")}
              <span className="muted"> {formatHourTimes(hour.period)}</span>
              {hour.room && <span className="muted"> · {hour.room}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() => run(() => api.saveClass(draft))}
        />
        <Button
          labelId="common.delete"
          variant="danger"
          onClick={() => run(() => api.deleteClass(schoolClass.id))}
        />
      </div>
      <p className="note">{t("classes.deleteWarning")}</p>
    </Panel>
  );
}

function Roster({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const enrolled = planner.enrollments
    .filter((e) => e.class_id === schoolClass.id)
    .map((e) => ({ enrollment: e, student: planner.students.find((s) => s.id === e.student_id) }))
    .filter((row) => row.student !== undefined);

  const available = planner.students.filter(
    (s) => !planner.enrollments.some((e) => e.class_id === schoolClass.id && e.student_id === s.id),
  );
  const [toAdd, setToAdd] = useState<number>(0);
  const addId = useId();

  /** The other classes this student is in, so double membership is visible. */
  const otherClasses = (studentId: number) =>
    planner.enrollments
      .filter((e) => e.student_id === studentId && e.class_id !== schoolClass.id)
      .map((e) => planner.classes.find((c) => c.id === e.class_id)?.name.trim())
      .filter((name): name is string => Boolean(name));

  return (
    <Panel headingId="classes.roster">
      {enrolled.length === 0 ? (
        <p className="muted">{t("classes.rosterEmpty")}</p>
      ) : (
        <table className="roster">
          <thead>
            <tr>
              <th>{t("classes.rosterNo")}</th>
              <th>{t("common.name")}</th>
              <th>{t("classes.rosterSupport")}</th>
              <th>{t("classes.rosterNote")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {enrolled.map(({ enrollment, student }) => {
              const others = otherClasses(enrollment.student_id);
              return (
                <tr key={enrollment.student_id}>
                  <td>{enrollment.roster_no}</td>
                  <td>
                    {student!.full_name.trim() || t("common.unnamed")}
                    {others.length > 0 && (
                      <span className="muted block">
                        {t("classes.alsoIn", { classes: others.join(", ") })}
                      </span>
                    )}
                  </td>
                  <td>
                    <CheckboxField
                      labelId="classes.rosterSupport"
                      checked={enrollment.support}
                      onChange={(support) =>
                        run(() => api.setEnrollment({ ...enrollment, support }))
                      }
                    />
                  </td>
                  <td>
                    <DeferredTextField
                      labelId="classes.rosterNote"
                      value={enrollment.note}
                      onCommit={(note) => run(() => api.setEnrollment({ ...enrollment, note }))}
                    />
                  </td>
                  <td>
                    <Button
                      labelId="classes.removeFromRoster"
                      variant="danger"
                      onClick={() =>
                        run(() => api.removeEnrollment(schoolClass.id, enrollment.student_id))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {available.length === 0 ? (
        planner.students.length > 0 && <p className="muted">{t("classes.allStudentsEnrolled")}</p>
      ) : (
        /* A plain select rather than the translated `SelectField`: these
           options are student names, which are the teacher's own text and are
           never translated. */
        <div className="row">
          <div className="field">
            <label htmlFor={addId}>{t("classes.addToRoster")}</label>
            <select
              id={addId}
              value={String(toAdd || available[0].id)}
              onChange={(e) => setToAdd(Number(e.target.value))}
            >
              {available.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.full_name.trim() || t("common.unnamed")}
                </option>
              ))}
            </select>
          </div>
          <Button
            labelId="common.add"
            onClick={() =>
              run(() =>
                api.setEnrollment({
                  class_id: schoolClass.id,
                  student_id: toAdd || available[0].id,
                  roster_no: 0,
                  support: false,
                  note: "",
                }),
              )
            }
          />
        </div>
      )}
    </Panel>
  );
}

function Seating({
  schoolClass,
  planner,
  run,
}: {
  schoolClass: SchoolClass;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const [plan, setPlan] = useStoredDraft({
    rows: schoolClass.seating_rows,
    cols: schoolClass.seating_cols,
    notes: schoolClass.seating_notes,
  });
  const { rows, cols, notes } = plan;
  const setRows = (v: number) => setPlan((p) => ({ ...p, rows: v }));
  const setCols = (v: number) => setPlan((p) => ({ ...p, cols: v }));
  const setNotes = (v: string) => setPlan((p) => ({ ...p, notes: v }));

  const seats = useMemo(
    () => planner.seats.filter((s) => s.class_id === schoolClass.id),
    [planner.seats, schoolClass.id],
  );
  const roster = planner.enrollments
    .filter((e) => e.class_id === schoolClass.id)
    .map((e) => planner.students.find((s) => s.id === e.student_id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  const occupant = (row: number, col: number) =>
    seats.find((s) => s.row === row && s.col === col)?.student_id ?? 0;

  const place = (row: number, col: number, studentId: number) => {
    const kept: Seat[] = seats.filter(
      // One seat per cell, and one cell per student.
      (s) => !(s.row === row && s.col === col) && s.student_id !== studentId,
    );
    if (studentId !== 0) kept.push({ class_id: schoolClass.id, row, col, student_id: studentId });
    return run(() => api.saveSeating(schoolClass.id, rows, cols, notes, kept));
  };

  return (
    <Panel headingId="classes.seating">
      <div className="row">
        <TextField
          labelId="classes.seatingRows"
          value={String(rows)}
          onChange={(v) => setRows(Math.max(1, Math.min(12, Number(v) || 1)))}
        />
        <TextField
          labelId="classes.seatingCols"
          value={String(cols)}
          onChange={(v) => setCols(Math.max(1, Math.min(12, Number(v) || 1)))}
        />
      </div>

      <p className="board">{t("classes.board")}</p>
      <div className="seating" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }).flatMap((_, row) =>
          Array.from({ length: cols }).map((__, col) => {
            const value = occupant(row, col);
            return (
              <label key={`${row}-${col}`} className="seat">
                <span className="visually-hidden">
                  {t("classes.seatAt", { row: row + 1, col: col + 1 })}
                </span>
                <select
                  value={String(value)}
                  onChange={(e) => place(row, col, Number(e.target.value))}
                >
                  <option value="0">{t("classes.seatEmpty")}</option>
                  {roster.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.full_name.trim() || t("common.unnamed")}
                    </option>
                  ))}
                </select>
              </label>
            );
          }),
        )}
      </div>

      <TextArea labelId="classes.seatingNotes" value={notes} onChange={setNotes} />
      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() => run(() => api.saveSeating(schoolClass.id, rows, cols, notes, seats))}
        />
      </div>
    </Panel>
  );
}

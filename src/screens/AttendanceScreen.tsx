/**
 * Απουσίες — the monthly attendance grid and the detailed absence register.
 *
 * Both of the spec's module-4 attendance surfaces live on one screen, and that
 * is deliberate: **they are independent registers and this is the screen where
 * the teacher can see that they are.** The spec says so twice ("a teacher may
 * use either or both; nothing derives one from the other"), and M4's first
 * acceptance criterion is that the same student on the same date can be marked
 * one way in the grid and another in the log with neither touching the other.
 *
 * So there is deliberately **no** "also mark this in the grid" button, no count
 * in one taken from rows in the other, and no shared state between the two
 * panels beyond which class is selected. The note under the grid says as much
 * to the teacher, because otherwise seeing them together invites the
 * assumption that they agree.
 *
 * The grid's columns are the days of the month, built from `domain/attendance`,
 * which builds them from M3's `monthGrid()`. A cell is `(class, student, actual
 * date)`; nothing here knows a month number or a day index.
 *
 * Every cell and every field commits straight to storage on change or on blur,
 * for the same reason the gradebook's and the timetable's do.
 */
import { useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import { Button, CheckboxField, DeferredTextField, Panel, SelectField } from "../components/Fields";
import {
  emptyEvent,
  eventsOfClass,
  markAt,
  monthDays,
  monthRows,
  monthTotals,
  type AbsenceEvent,
} from "../domain/attendance";
import { step } from "../domain/agenda";
import { dayOfMonth, formatDate, monthOf } from "../domain/dates";
import type { Planner, SchoolClass } from "../domain/types";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import {
  ABSENCE_KINDS,
  absenceKindLabel,
  ATTENDANCE_STATES,
  attendanceStateLabel,
  attendanceSymbolLabel,
  FOLLOW_UP_STATUSES,
  followUpLabel,
  monthLabel,
  type AbsenceKind,
  type AttendanceState,
} from "../i18n/vocabularies";
import { absenceRegisterHtml, monthCardHtml } from "../print/attendanceSheets";
import type { Run } from "./types";

export default function AttendanceScreen({
  planner,
  run,
  today,
}: {
  planner: Planner;
  run: Run;
  /** The day the shell read from the calendar. Never read here directly. */
  today: string;
}) {
  const t = useTranslate();
  const [classId, setClassId] = useState<number | null>(planner.classes[0]?.id ?? null);
  /** Any day inside the month on show. The grid derives the rest from it. */
  const [month, setMonth] = useState(today);

  const schoolClass = planner.classes.find((c) => c.id === classId) ?? null;

  if (planner.classes.length === 0) {
    return (
      <Panel headingId="attendance.heading" introId="attendance.intro">
        <p className="muted">{t("attendance.noClasses")}</p>
      </Panel>
    );
  }

  return (
    <>
      <MonthGrid
        planner={planner}
        run={run}
        schoolClass={schoolClass}
        month={month}
        today={today}
        onPickClass={setClassId}
        onPickMonth={setMonth}
      />
      {schoolClass && (
        <Register planner={planner} run={run} schoolClass={schoolClass} today={today} />
      )}
    </>
  );
}

/** The class picker, shared by both panels. Class names are teacher text. */
function ClassPicker({
  planner,
  selected,
  onPick,
}: {
  planner: Planner;
  selected: SchoolClass | null;
  onPick: (id: number) => void;
}) {
  const t = useTranslate();
  return (
    <label className="field">
      <span>{t("attendance.pickClass")}</span>
      <select value={String(selected?.id ?? 0)} onChange={(e) => onPick(Number(e.target.value))}>
        {planner.classes.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name.trim() || t("common.unnamed")}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The source's "Απουσίες του μήνα" card: the roster down the side, the days of
 * the month across the top, one symbol per cell.
 */
function MonthGrid({
  planner,
  run,
  schoolClass,
  month,
  today,
  onPickClass,
  onPickMonth,
}: {
  planner: Planner;
  run: Run;
  schoolClass: SchoolClass | null;
  month: string;
  today: string;
  onPickClass: (id: number) => void;
  onPickMonth: (date: string) => void;
}) {
  const t = useTranslate();
  const days = monthDays(month);
  const rows = schoolClass ? monthRows(planner, schoolClass.id, month) : [];

  return (
    <Panel
      headingId="attendance.heading"
      introId="attendance.intro"
      actions={
        // The class and the month on show, printed as the source's own card.
        // It carries no figure from the register below it, and says so.
        schoolClass && (
          <ExportButton
            labelId="attendance.export"
            fileName={t("attendance.fileName", {
              class: schoolClass.name.trim() || t("common.unnamed"),
              month: `${t(monthLabel(monthOf(month)))} ${month.slice(0, 4)}`,
              date: formatDate(today),
            })}
            html={() => monthCardHtml(t, planner, schoolClass.id, month, today)}
          />
        )
      }
    >
      <div className="row">
        <ClassPicker planner={planner} selected={schoolClass} onPick={onPickClass} />
        <div className="field">
          <span>{t("attendance.month")}</span>
          <div className="stepper">
            <button
              type="button"
              aria-label={t("common.previous")}
              onClick={() => onPickMonth(step("month", month, -1))}
            >
              ‹
            </button>
            <strong>
              {t(monthLabel(monthOf(month)))} {month.slice(0, 4)}
            </strong>
            <button
              type="button"
              aria-label={t("common.next")}
              onClick={() => onPickMonth(step("month", month, 1))}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* The source card's own symbol key, printed in its own order. */}
      <p className="intro">
        {t("attendance.symbols")}:{" "}
        {ATTENDANCE_STATES.map((state) => (
          <span key={state} className="symbol-key">
            <strong>{t(attendanceSymbolLabel(state))}</strong> {t(attendanceStateLabel(state))}
          </span>
        ))}
      </p>

      {rows.length === 0 ? (
        <p className="muted">{t("attendance.noRoster")}</p>
      ) : (
        <div className="timetable-scroll">
          <table className="attendance">
            <thead>
              <tr>
                <th>{t("attendance.rosterNo")}</th>
                <th>{t("attendance.roster")}</th>
                {days.map((day) => (
                  <th key={day} scope="col">
                    {dayOfMonth(day)}
                  </th>
                ))}
                {ATTENDANCE_STATES.map((state) => (
                  <th key={state} scope="col" className="total">
                    {t(attendanceSymbolLabel(state))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const totals = monthTotals(row);
                return (
                  <tr key={row.student.id}>
                    <td className="muted">{row.rosterNo}</td>
                    <th scope="row">{row.student.full_name.trim() || t("common.unnamed")}</th>
                    {days.map((day) => (
                      <td key={day}>
                        <Cell
                          planner={planner}
                          run={run}
                          classId={schoolClass!.id}
                          studentId={row.student.id}
                          studentName={row.student.full_name.trim() || t("common.unnamed")}
                          date={day}
                        />
                      </td>
                    ))}
                    {ATTENDANCE_STATES.map((state) => (
                      <td key={state} className="total">
                        {totals[state] || ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stated on screen because showing the two registers together is exactly
          what would otherwise imply they agree. */}
      <p className="note">{t("attendance.independent")}</p>
    </Panel>
  );
}

/**
 * One cell of the grid.
 *
 * A plain `<select>` of the four states plus a blank. The blank writes an empty
 * state, which the storage layer turns into a deleted row — an unmarked day is
 * the absence of a record, never a fifth code.
 */
function Cell({
  planner,
  run,
  classId,
  studentId,
  studentName,
  date,
}: {
  planner: Planner;
  run: Run;
  classId: number;
  studentId: number;
  studentName: string;
  date: string;
}) {
  const t = useTranslate();
  const mark = markAt(planner, classId, studentId, date);
  return (
    <select
      className="attendance-cell"
      aria-label={t("attendance.cell", {
        student: studentName,
        date: formatDate(date),
      })}
      value={mark?.state ?? ""}
      onChange={(e) =>
        run(() =>
          api.saveAttendanceMark({
            class_id: classId,
            student_id: studentId,
            date,
            // An empty value is a cleared cell; the backend deletes the row.
            state: e.target.value as AttendanceState,
          }),
        )
      }
    >
      <option value=""> </option>
      {ATTENDANCE_STATES.map((state) => (
        <option key={state} value={state}>
          {t(attendanceSymbolLabel(state))}
        </option>
      ))}
    </select>
  );
}

/**
 * The source's "Απουσίες και καθυστερήσεις" register: one line per absence or
 * late arrival, with every field the spec lists.
 *
 * **The rows are edited in place rather than through one editor bound to a
 * selected record.** That is the shape M3 found safe and the opposite of the
 * one that cost M1 a data-loss bug: each field carries its own row's id, so
 * "new line" has no selection to move and cannot point an editor at the
 * previous row. The regression test still starts from a planner that already
 * has lines in it, because construction is a claim and the test is the check.
 */
function Register({
  planner,
  run,
  schoolClass,
  today,
}: {
  planner: Planner;
  run: Run;
  schoolClass: SchoolClass;
  today: string;
}) {
  const t = useTranslate();
  const events = eventsOfClass(planner, schoolClass.id);
  const roster = planner.enrollments
    .filter((e) => e.class_id === schoolClass.id)
    .flatMap((e) => planner.students.filter((s) => s.id === e.student_id));

  return (
    <Panel
      headingId="absences.heading"
      introId="absences.intro"
      actions={
        <>
          <Button
            labelId="absences.new"
            variant="primary"
            disabled={roster.length === 0}
            onClick={() =>
              run(() => api.saveAbsenceEvent(emptyEvent(schoolClass.id, roster[0]?.id ?? 0)))
            }
          />
          {/* The register's own sheet, over the register's own rows. Nothing on
              it comes from the month card above. */}
          <ExportButton
            labelId="absences.export"
            fileName={t("absences.fileName", {
              class: schoolClass.name.trim() || t("common.unnamed"),
              date: formatDate(today),
            })}
            html={() => absenceRegisterHtml(t, planner, schoolClass.id, today)}
          />
        </>
      }
    >
      {roster.length === 0 ? (
        <p className="muted">{t("attendance.noRoster")}</p>
      ) : events.length === 0 ? (
        <p className="muted">{t("absences.none")}</p>
      ) : (
        <>
          <p className="muted">{countOf(t, "absences.count", events.length)}</p>
          <ul className="rows">
            {events.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                index={index + 1}
                planner={planner}
                run={run}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function EventRow({
  event,
  index,
  planner,
  run,
}: {
  event: AbsenceEvent;
  index: number;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this row's own id, so one line can never write another.
  const save = (patch: Partial<AbsenceEvent>) =>
    run(() => api.saveAbsenceEvent({ ...event, ...patch }));
  const roster = planner.enrollments
    .filter((e) => e.class_id === event.class_id)
    .flatMap((e) => planner.students.filter((s) => s.id === e.student_id));

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("absences.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={event.date}
          onCommit={(date) => save({ date })}
        />
        {/* Student names are the teacher's own text, so a plain select. */}
        <label className="field">
          <span>{t("absences.student")}</span>
          <select
            value={String(event.student_id)}
            onChange={(e) => save({ student_id: Number(e.target.value) })}
          >
            {roster.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.full_name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        <SelectField<AbsenceKind>
          labelId="absences.kind"
          value={event.kind}
          onChange={(kind) => save({ kind })}
          options={ABSENCE_KINDS}
          optionLabelId={absenceKindLabel}
        />
        <DeferredTextField
          labelId="absences.clockTime"
          type="time"
          value={event.clock_time}
          onCommit={(clock_time) => save({ clock_time })}
        />
        <DeferredTextField
          labelId="absences.teachingHour"
          value={event.teaching_hour}
          onCommit={(teaching_hour) => save({ teaching_hour })}
        />
        <DeferredTextField
          labelId="absences.reason"
          value={event.reason}
          onCommit={(reason) => save({ reason })}
        />
        <CheckboxField
          labelId="absences.justified"
          checked={event.justified}
          onChange={(justified) => save({ justified })}
        />
        {/* A plain select rather than `SelectField`, because "not set" is a real
          fourth value here and the translated helper has no slot for one. */}
        <label className="field">
          <span>{t("absences.followUp")}</span>
          <select
            value={event.follow_up}
            onChange={(e) => save({ follow_up: e.target.value as AbsenceEvent["follow_up"] })}
          >
            <option value="">{t("absences.followUpNone")}</option>
            {FOLLOW_UP_STATUSES.map((code) => (
              <option key={code} value={code}>
                {t(followUpLabel(code))}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="absences.frequentNote"
          value={event.frequent_note}
          onCommit={(frequent_note) => save({ frequent_note })}
        />
        <Button
          labelId="absences.remove"
          variant="danger"
          onClick={() => run(() => api.deleteAbsenceEvent(event.id))}
        />
      </div>
    </li>
  );
}

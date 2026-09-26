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
 * The grid's columns are the lessons of the month — each day split into the
 * timetable hours the class has on it — built by `domain/attendance`. A cell
 * is `(class, student, actual date, hour)`; nothing here knows a month number
 * or a day index.
 *
 * Every cell and every field commits straight to storage on change or on blur,
 * for the same reason the gradebook's and the timetable's do.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import { Button, CheckboxField, DeferredTextField, Panel, SelectField } from "../components/Fields";
import {
  emptyEvent,
  eventsOfClass,
  inSameMonth,
  markAt,
  monthColumns,
  monthRows,
  monthTotals,
  type AbsenceEvent,
  type DayColumn,
  type LessonSlot,
} from "../domain/attendance";
import { step } from "../domain/agenda";
import { dayOfMonth, formatDate, monthOf } from "../domain/dates";
import type { Planner, SchoolClass } from "../domain/types";
import { countOf, type Translate } from "../i18n";
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

/**
 * Where the Today view asks the grid to open: one class, one lesson. The grid
 * opens on that class and month and puts the cursor in that lesson's column.
 */
export interface AttendanceFocus {
  classId: number;
  date: string;
  periodId: number;
}

export default function AttendanceScreen({
  planner,
  run,
  today,
  focus,
}: {
  planner: Planner;
  run: Run;
  /** The day the shell read from the calendar. Never read here directly. */
  today: string;
  focus?: AttendanceFocus | null;
}) {
  const t = useTranslate();
  const [classId, setClassId] = useState<number | null>(
    focus?.classId ?? planner.classes[0]?.id ?? null,
  );
  /** Any day inside the month on show. The grid derives the rest from it. */
  const [month, setMonth] = useState(focus?.date ?? today);

  // A new request from the Today view moves the grid, as PlanScreen's focus does.
  useEffect(() => {
    if (focus) {
      setClassId(focus.classId);
      setMonth(focus.date);
    }
  }, [focus]);

  const schoolClass = planner.classes.find((c) => c.id === classId) ?? null;
  // Only while the grid is still on the class and month the request was for.
  const highlight =
    focus && focus.classId === classId && inSameMonth(focus.date, month) ? focus : null;

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
        highlight={highlight}
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

/** The translated reason a day is greyed out, for its tooltip. */
function offLabel(t: Translate, column: DayColumn): string {
  switch (column.off) {
    case "weekend":
      return t("attendance.offWeekend");
    case "holiday":
      return column.offName || t("attendance.offHoliday");
    case "leave":
      return t("attendance.offLeave");
    default:
      return t("attendance.noLesson");
  }
}

/** A lesson's hour as the column shows it: the timetable's own name. */
function lessonLabel(t: Translate, lesson: LessonSlot): string {
  return lesson.period?.name.trim() || t("attendance.lessonUnknown");
}

/** The same as a key, so one lesson's column can be found again. */
const lessonKey = (date: string, periodId: number) => `${date}:${periodId}`;

/**
 * The source's "Απουσίες του μήνα" card: the roster down the side, and across
 * the top every day of the month split into **its lessons** — one column per
 * timetable hour the class has that day. Absences are counted per lesson.
 *
 * Weekends, holidays and the teacher's days of leave are greyed out, so a
 * column the teacher should not be filling in looks like one. The roster
 * columns stay put when the grid scrolls sideways.
 */
function MonthGrid({
  planner,
  run,
  schoolClass,
  month,
  today,
  highlight,
  onPickClass,
  onPickMonth,
}: {
  planner: Planner;
  run: Run;
  schoolClass: SchoolClass | null;
  month: string;
  today: string;
  highlight: AttendanceFocus | null;
  onPickClass: (id: number) => void;
  onPickMonth: (date: string) => void;
}) {
  const t = useTranslate();
  const columns = schoolClass ? monthColumns(planner, schoolClass.id, month) : [];
  const rows = schoolClass ? monthRows(planner, schoolClass.id, month) : [];
  const hasHours = schoolClass
    ? planner.timetable_cells.some((c) => c.class_id === schoolClass.id)
    : false;
  const scroller = useRef<HTMLDivElement>(null);
  const focusKey = highlight ? lessonKey(highlight.date, highlight.periodId) : null;

  // Opened from the Today view: put the cursor on the first student in that
  // lesson, which also scrolls the column into view.
  useEffect(() => {
    if (!focusKey) return;
    const first = scroller.current?.querySelector<HTMLSelectElement>(
      `select[data-lesson="${focusKey}"]`,
    );
    first?.focus();
  }, [focusKey, schoolClass?.id]);

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
        <span className="symbol-key">
          <span className="off-swatch" aria-hidden="true" /> {t("attendance.offKey")}
        </span>
      </p>

      {schoolClass && !hasHours && <p className="note">{t("attendance.noHours")}</p>}

      {rows.length === 0 ? (
        <p className="muted">{t("attendance.noRoster")}</p>
      ) : (
        <div className="timetable-scroll" ref={scroller}>
          <table className="attendance">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky-no">
                  {t("attendance.rosterNo")}
                </th>
                <th rowSpan={2} className="sticky-name">
                  {t("attendance.roster")}
                </th>
                {columns.map((column) => (
                  <th
                    key={column.date}
                    scope="col"
                    colSpan={Math.max(column.lessons.length, 1)}
                    className={dayClass(column)}
                    title={column.off ? offLabel(t, column) : undefined}
                  >
                    {dayOfMonth(column.date)}
                  </th>
                ))}
                {ATTENDANCE_STATES.map((state) => (
                  <th key={state} rowSpan={2} scope="col" className="total">
                    {t(attendanceSymbolLabel(state))}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.flatMap((column) =>
                  column.lessons.length === 0
                    ? [
                        <th
                          key={column.date}
                          className={dayClass(column)}
                          aria-label={offLabel(t, column)}
                        />,
                      ]
                    : column.lessons.map((lesson, index) => (
                        <th
                          key={lessonKey(lesson.date, lesson.periodId)}
                          scope="col"
                          className={
                            dayClass(column, index) +
                            (lessonKey(lesson.date, lesson.periodId) === focusKey
                              ? " focused"
                              : "")
                          }
                          title={lesson.period ? undefined : t("attendance.lessonUnknown")}
                        >
                          {lesson.period?.name.trim() || "?"}
                        </th>
                      )),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const totals = monthTotals(row);
                const name = row.student.full_name.trim() || t("common.unnamed");
                return (
                  <tr key={row.student.id}>
                    <td className="muted sticky-no">{row.rosterNo}</td>
                    <th scope="row" className="sticky-name">
                      {name}
                    </th>
                    {columns.flatMap((column) =>
                      column.lessons.length === 0
                        ? [<td key={column.date} className={dayClass(column)} />]
                        : column.lessons.map((lesson, index) => (
                            <td
                              key={lessonKey(lesson.date, lesson.periodId)}
                              className={dayClass(column, index)}
                            >
                              <Cell
                                planner={planner}
                                run={run}
                                classId={schoolClass!.id}
                                studentId={row.student.id}
                                studentName={name}
                                lesson={lesson}
                              />
                            </td>
                          )),
                    )}
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
 * The classes a day's cells carry: greyed when the day is off, quieter when
 * the class simply has no lesson, and a left rule where each day begins so a
 * two-lesson day reads as one day.
 */
function dayClass(column: DayColumn, index = 0): string {
  const classes = ["lesson"];
  if (index === 0) classes.push("day-start");
  if (column.off) classes.push("off");
  else if (column.lessons.length === 0) classes.push("no-lesson");
  return classes.join(" ");
}

/**
 * One cell of the grid: one student in one lesson.
 *
 * A plain `<select>` of the four states plus a blank. The blank writes an empty
 * state, which the storage layer turns into a deleted row — an unmarked lesson
 * is the absence of a record, never a fifth code.
 */
function Cell({
  planner,
  run,
  classId,
  studentId,
  studentName,
  lesson,
}: {
  planner: Planner;
  run: Run;
  classId: number;
  studentId: number;
  studentName: string;
  lesson: LessonSlot;
}) {
  const t = useTranslate();
  const mark = markAt(planner, classId, studentId, lesson.date, lesson.periodId);
  return (
    <select
      className="attendance-cell"
      data-lesson={lessonKey(lesson.date, lesson.periodId)}
      aria-label={t("attendance.cell", {
        student: studentName,
        date: formatDate(lesson.date),
        lesson: lessonLabel(t, lesson),
      })}
      value={mark?.state ?? ""}
      onChange={(e) =>
        run(() =>
          api.saveAttendanceMark({
            class_id: classId,
            student_id: studentId,
            date: lesson.date,
            period_id: lesson.periodId,
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

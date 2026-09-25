/**
 * Συναντήσεις με γονείς — the weekly parent-appointment grid, with the
 * upcoming-overview panel under it.
 *
 * The source page is an `Ώρα × Δευτέρα–Παρασκευή` grid with two boxes beneath
 * it, `ΕΠΕΡΧΟΜΕΝΕΣ ΣΥΝΑΝΤΗΣΕΙΣ` and `ΣΥΜΦΩΝΙΕΣ ΚΑΙ ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ`. The first
 * of those boxes is the spec's upcoming-overview panel, which is why it lives
 * here rather than on a page of its own.
 *
 * **This is the booking. It is not the record of what happened.** The
 * communication log is a separate screen over a separate table, and nothing
 * here writes to it — the spec's own distinction, and M5's second acceptance
 * criterion.
 *
 * **The week shown is a view, not stored state.** An appointment is keyed by an
 * actual date; the grid is built from whichever Monday the teacher is looking
 * at, so moving the school year's start date moves nothing.
 *
 * **The day comes from the shell.** `today` is a prop and the week starts from
 * it; nothing here reads the calendar, which is what lets the upcoming panel's
 * seven-day window be tested on a chosen date.
 */
import { useMemo, useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import { addDays, formatDate, mondayOf } from "../domain/dates";
import { upcomingOverview, UPCOMING_DAYS } from "../domain/meetings";
import {
  appointmentStudent,
  appointmentWeek,
  cellKey,
  emptyAppointment,
  type ParentAppointment,
} from "../domain/parents";
import type { Planner } from "../domain/types";
import {
  APPOINTMENT_MODES,
  APPOINTMENT_STATUSES,
  appointmentModeLabel,
  appointmentStatusLabel,
  weekdayLabel,
} from "../i18n/vocabularies";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import { appointmentWeekHtml } from "../print/parentSheets";
import type { Run } from "./types";

export default function AppointmentsScreen({
  planner,
  run,
  today,
  onOpenMeeting,
}: {
  planner: Planner;
  run: Run;
  /** The day the shell read from the calendar. Never read here directly. */
  today: string;
  /** Opens a meeting's minutes, as the spec asks the panel to do. */
  onOpenMeeting?: (meetingId: number) => void;
}) {
  const t = useTranslate();
  /** The Monday on show. Starts from the shell's day, never from a clock read. */
  const [monday, setMonday] = useState(() => mondayOf(today));

  const week = useMemo(() => appointmentWeek(planner, monday), [planner, monday]);
  const upcoming = useMemo(() => upcomingOverview(planner, today), [planner, today]);

  return (
    <>
      <Panel
        headingId="appointments.heading"
        introId="appointments.intro"
        actions={
          <>
            <Button
              labelId="appointments.new"
              variant="primary"
              onClick={() =>
                // A new slot lands on the Monday of the week on show, at a time
                // the teacher then sets — the grid's rows are whichever times
                // her week actually uses.
                run(() => api.saveParentAppointment(emptyAppointment(monday, "")))
              }
            />
            <ExportButton
              labelId="appointments.export"
              fileName={t("appointments.fileName", { date: formatDate(monday) })}
              html={() => appointmentWeekHtml(t, planner, monday, today)}
            />
          </>
        }
      >
        <div className="row">
          <Button
            labelId="appointments.previousWeek"
            onClick={() => setMonday(addDays(monday, -7))}
          />
          <Button labelId="appointments.thisWeek" onClick={() => setMonday(mondayOf(today))} />
          <Button labelId="appointments.nextWeek" onClick={() => setMonday(addDays(monday, 7))} />
          <p className="muted">
            {t("appointments.week")} {formatDate(week.days[0])}
          </p>
        </div>

        {week.appointments.length === 0 ? (
          <p className="muted">{t("appointments.none")}</p>
        ) : (
          <>
            <p className="muted">{countOf(t, "appointments.count", week.appointments.length)}</p>
            <table className="grid">
              <thead>
                <tr>
                  <th>{t("appointments.time")}</th>
                  {week.days.map((day, i) => (
                    <th key={day}>
                      {t(weekdayLabel(i + 1))} {formatDate(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {week.times.map((time) => (
                  <tr key={time}>
                    <th scope="row">{time}</th>
                    {week.days.map((day) => {
                      const booked = week.cells.get(cellKey(day, time));
                      return (
                        <td key={day}>
                          {booked ? (
                            <span>
                              {booked.guardian.trim() || t("common.unnamed")}
                              {booked.topic.trim() ? ` · ${booked.topic}` : ""}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <ul className="rows">
          {week.appointments.map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              planner={planner}
              run={run}
            />
          ))}
        </ul>
      </Panel>

      <UpcomingPanel upcoming={upcoming} onOpenMeeting={onOpenMeeting} />
    </>
  );
}

/**
 * The upcoming-overview panel — the source page's own `ΕΠΕΡΧΟΜΕΝΕΣ
 * ΣΥΝΑΝΤΗΣΕΙΣ` box.
 *
 * It renders whatever `upcomingOverview` returned and decides nothing itself:
 * the seven-day window, the merge of appointments with meetings and the "recent"
 * rule all live in `domain/meetings.ts`, as a pure function of the day. That is
 * what makes M5's third acceptance criterion checkable on a chosen date.
 */
function UpcomingPanel({
  upcoming,
  onOpenMeeting,
}: {
  upcoming: ReturnType<typeof upcomingOverview>;
  onOpenMeeting?: (meetingId: number) => void;
}) {
  const t = useTranslate();
  return (
    <Panel headingId="upcoming.heading">
      <p className="intro">{t("upcoming.intro", { days: UPCOMING_DAYS })}</p>
      {upcoming.length === 0 ? (
        <p className="muted">{t("upcoming.none", { days: UPCOMING_DAYS })}</p>
      ) : (
        <ul className="rows">
          {upcoming.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <div className="row wrap">
                <span className="strong">{formatDate(item.date)}</span>
                {item.clockTime && <span>{item.clockTime}</span>}
                <span className="muted">
                  {item.kind === "appointment" ? t("upcoming.appointment") : t("upcoming.meeting")}
                </span>
                {item.who.trim() && <span>{item.who}</span>}
                {item.what.trim() && <span>{item.what}</span>}
                {item.past && <span className="muted">{t("upcoming.past")}</span>}
                {item.kind === "meeting" && onOpenMeeting && (
                  <Button labelId="upcoming.open" onClick={() => onOpenMeeting(item.id)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AppointmentRow({
  appointment,
  planner,
  run,
}: {
  appointment: ParentAppointment;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this booking's own id.
  const save = (patch: Partial<ParentAppointment>) =>
    run(() => api.saveParentAppointment({ ...appointment, ...patch }));
  const student = appointmentStudent(planner, appointment);

  return (
    <li>
      <div
        className="row wrap"
        role="group"
        aria-label={t("appointments.entry", {
          date: formatDate(appointment.date),
          time: appointment.clock_time,
        })}
      >
        <DeferredTextField
          labelId="appointments.date"
          type="date"
          value={appointment.date}
          onCommit={(date) => save({ date })}
        />
        <DeferredTextField
          labelId="appointments.clockTime"
          type="time"
          value={appointment.clock_time}
          onCommit={(clock_time) => save({ clock_time })}
        />
        {/* Optional: a slot may be booked with a guardian before it is settled
            which child it is about. */}
        <label className="field">
          <span>{t("appointments.student")}</span>
          <select
            value={String(student?.id ?? 0)}
            onChange={(e) => {
              const id = Number(e.target.value);
              save({ student_id: id === 0 ? null : id });
            }}
          >
            <option value="0">{t("appointments.noStudent")}</option>
            {planner.students.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.full_name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="appointments.guardian"
          value={appointment.guardian}
          onCommit={(guardian) => save({ guardian })}
        />
        <label className="field">
          <span>{t("appointments.mode")}</span>
          <select
            value={appointment.mode}
            onChange={(e) => save({ mode: e.target.value as ParentAppointment["mode"] })}
          >
            {APPOINTMENT_MODES.map((code) => (
              <option key={code} value={code}>
                {t(appointmentModeLabel(code))}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="appointments.place"
          value={appointment.place}
          onCommit={(place) => save({ place })}
        />
        <label className="field">
          <span>{t("appointments.status")}</span>
          <select
            value={appointment.status}
            onChange={(e) => save({ status: e.target.value as ParentAppointment["status"] })}
          >
            {APPOINTMENT_STATUSES.map((code) => (
              <option key={code} value={code}>
                {t(appointmentStatusLabel(code))}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="appointments.topic"
          value={appointment.topic}
          onCommit={(topic) => save({ topic })}
        />
        <DeferredTextField
          labelId="appointments.outcome"
          value={appointment.outcome}
          onCommit={(outcome) => save({ outcome })}
        />
        <Button
          labelId="appointments.remove"
          variant="danger"
          onClick={() => run(() => api.deleteParentAppointment(appointment.id))}
        />
      </div>
    </li>
  );
}

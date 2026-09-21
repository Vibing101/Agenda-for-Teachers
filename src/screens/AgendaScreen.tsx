/**
 * Ατζέντα — the day, week and month notes.
 *
 * Both halves of the source product are here: the 53 week pages, which are a
 * Δευτέρα–Κυριακή strip plus a "ΣΗΜΕΙΩΣΕΙΣ ΤΗΣ ΕΒΔΟΜΑΔΑΣ" box with ‹ ›
 * navigation, and the 12 month pages, which are a Δευτέρα–Κυριακή grid plus
 * "ΕΣΤΙΑΣΗ ΤΟΥ ΜΗΝΑ", ‹ › and an "01 / 12" counter.
 *
 * **`today` is a prop, not a call to the clock.** It arrives from the shell, which
 * is the one place in the app that reads the calendar — so "jump to today" and
 * every date this screen derives can be driven to any day in a test.
 *
 * Every note is keyed by an actual date, normalised for its scope by
 * `agendaKey`: a week note is stored against its Monday and a month note against
 * the 1st, however the teacher navigated there.
 */
import { useState } from "react";
import { api } from "../api";
import { Button, Panel, TextArea } from "../components/Fields";
import {
  AGENDA_WEEK,
  agendaKey,
  hasNote,
  monthGrid,
  noteFor,
  step,
  weekDays,
} from "../domain/agenda";
import { dayOfMonth, formatDate, monthOf, weekdayOf } from "../domain/dates";
import { weekOf } from "../domain/schoolYear";
import { hoursOn } from "../domain/timetable";
import type { Planner } from "../domain/types";
import type { Params, StringId } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import {
  AGENDA_SCOPES,
  agendaScopeLabel,
  monthLabel,
  weekdayLabel,
  type AgendaScope,
} from "../i18n/vocabularies";
import type { Run } from "./types";

export default function AgendaScreen({
  planner,
  run,
  today,
}: {
  planner: Planner;
  run: Run;
  today: string;
}) {
  const t = useTranslate();
  const [scope, setScope] = useState<AgendaScope>("week");
  const [date, setDate] = useState(today);

  return (
    <>
      <Panel headingId="agenda.heading" introId="agenda.intro">
        <div className="agenda-bar">
          <div className="tabs">
            {AGENDA_SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                className={s === scope ? "tab selected" : "tab"}
                aria-current={s === scope ? "page" : undefined}
                onClick={() => setScope(s)}
              >
                {t(agendaScopeLabel(s))}
              </button>
            ))}
          </div>
          <div className="actions">
            <Button labelId="common.previous" onClick={() => setDate(step(scope, date, -1))} />
            {/* The "jump to today" the spec asks for. It reads the prop, so a
                test can pin what "today" means. */}
            <Button
              labelId="agenda.jumpToToday"
              variant="primary"
              onClick={() => setDate(today)}
            />
            <Button labelId="common.next" onClick={() => setDate(step(scope, date, 1))} />
          </div>
        </div>

        <Heading planner={planner} scope={scope} date={date} />
      </Panel>

      {scope === "day" && (
        <DayPanel planner={planner} date={date} run={run} />
      )}
      {scope === "week" && (
        <WeekPanel planner={planner} date={date} today={today} onPickDay={setDate} run={run} />
      )}
      {scope === "month" && (
        <MonthPanel planner={planner} date={date} today={today} onPickDay={setDate} run={run} />
      )}
    </>
  );
}

/** The period's own title — the week number derived, never stored. */
function Heading({
  planner,
  scope,
  date,
}: {
  planner: Planner;
  scope: AgendaScope;
  date: string;
}) {
  const t = useTranslate();
  const startDate = planner.school_year.start_date;

  if (scope === "day") {
    return (
      <h3>
        {t("agenda.dayTitle", {
          weekday: t(weekdayLabel(weekdayOf(date))),
          date: formatDate(date),
        })}
      </h3>
    );
  }

  if (scope === "month") {
    return (
      <div className="agenda-heading">
        <h3>{t("agenda.monthTitle", { month: t(monthLabel(monthOf(date))) })}</h3>
        <span className="muted">{t("agenda.monthCounter", { n: monthOf(date) })}</span>
      </div>
    );
  }

  const days = weekDays(date);
  const week = weekOf(startDate, date);
  return (
    <div className="agenda-heading">
      <h3>
        {week === null
          ? t("agenda.noStartDate")
          : week.withinYear
            ? t("agenda.weekTitle", { n: week.week })
            : t("agenda.weekTitleOutside")}
      </h3>
      <span className="muted">
        {t("agenda.weekSpan", { from: formatDate(days[0]), to: formatDate(days[6]) })}
      </span>
    </div>
  );
}

/** One day: its note, and the hours the master timetable says she teaches. */
function DayPanel({ planner, date, run }: { planner: Planner; date: string; run: Run }) {
  const t = useTranslate();
  const hours = hoursOn(planner, weekdayOf(date));

  return (
    <>
      <Panel headingId="agenda.dayNote">
        <NoteBox planner={planner} scope="day" date={date} run={run} />
      </Panel>
      <Panel headingId="agenda.todaysHours">
        {hours.length === 0 ? (
          <p className="muted">{t("today.noSchedule")}</p>
        ) : (
          <ul className="hours">
            {hours.map((hour) => (
              <li key={`${hour.period.id}:${hour.weekday}`}>
                <strong>{hour.period.name.trim() || t("common.none")}</strong>{" "}
                {hour.schoolClass?.name.trim() || hour.subject || hour.cell.duty}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/** The Δευτέρα–Κυριακή strip, plus the week's own note. */
function WeekPanel({
  planner,
  date,
  today,
  onPickDay,
  run,
}: {
  planner: Planner;
  date: string;
  today: string;
  onPickDay: (date: string) => void;
  run: Run;
}) {
  const t = useTranslate();
  return (
    <>
      <Panel headingId="agenda.weekNote">
        <NoteBox planner={planner} scope="week" date={date} run={run} />
      </Panel>
      <Panel headingId="agenda.weekDays">
        <ul className="week-strip">
          {weekDays(date).map((day) => (
            <li key={day} className={day === today ? "day is-today" : "day"}>
              <button
                type="button"
                onClick={() => onPickDay(day)}
                aria-label={t("agenda.selectDay", { date: day })}
              >
                <strong>{t(weekdayLabel(weekdayOf(day)))}</strong>
                <span className="muted block">{formatDate(day)}</span>
                {hasNote(planner, "day", day) && (
                  <span className="marker">{t("agenda.hasNote")}</span>
                )}
              </button>
              <NoteBox
                planner={planner}
                scope="day"
                date={day}
                run={run}
                compact
                labelId="agenda.dayNoteFor"
                labelParams={{ date: formatDate(day) }}
              />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

/** The month grid, plus "ΕΣΤΙΑΣΗ ΤΟΥ ΜΗΝΑ". */
function MonthPanel({
  planner,
  date,
  today,
  onPickDay,
  run,
}: {
  planner: Planner;
  date: string;
  today: string;
  onPickDay: (date: string) => void;
  run: Run;
}) {
  const t = useTranslate();
  return (
    <>
      <Panel headingId="agenda.monthNote">
        <NoteBox planner={planner} scope="month" date={date} run={run} />
      </Panel>
      <Panel headingId="agenda.monthDays">
        <table className="month-grid">
          <thead>
            <tr>
              {AGENDA_WEEK.map((day) => (
                <th key={day}>{t(weekdayLabel(day))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(date).map((week, index) => (
              <tr key={index}>
                {week.map((day, column) =>
                  day === null ? (
                    <td key={column} className="empty" />
                  ) : (
                    <td key={column} className={day === today ? "is-today" : undefined}>
                      <button
                        type="button"
                        onClick={() => onPickDay(day)}
                        aria-label={t("agenda.selectDay", { date: day })}
                      >
                        <span className="day-number">{dayOfMonth(day)}</span>
                        {hasNote(planner, "day", day) && (
                          <span className="marker">{t("agenda.hasNote")}</span>
                        )}
                      </button>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

/**
 * One note box.
 *
 * It commits on blur, not per keystroke, and writes against `agendaKey(scope,
 * date)` so the row it lands on is the same one whatever day of the period the
 * teacher was looking at.
 */
function NoteBox({
  planner,
  scope,
  date,
  run,
  compact,
  labelId,
  labelParams,
}: {
  planner: Planner;
  scope: AgendaScope;
  date: string;
  run: Run;
  compact?: boolean;
  labelId?: StringId;
  labelParams?: Params;
}) {
  const stored = noteFor(planner, scope, date);
  const [draft, setDraft] = useState(stored.body);
  const [lastStored, setLastStored] = useState(stored.body);

  // Same rule as `useStoredDraft`: follow the stored value when it really
  // changes (our own save, or a reload from disk), and leave a half-typed note
  // alone when something unrelated was saved.
  if (stored.body !== lastStored) {
    setLastStored(stored.body);
    setDraft(stored.body);
  }

  const fallbackId: StringId =
    scope === "day" ? "agenda.dayNote" : scope === "week" ? "agenda.weekNote" : "agenda.monthNote";

  return (
    <div
      onBlur={() => {
        if (draft !== stored.body) {
          void run(() => api.saveAgendaNote({ scope, date: agendaKey(scope, date), body: draft }));
        }
      }}
    >
      <TextArea
        labelId={labelId ?? fallbackId}
        labelParams={labelParams}
        value={draft}
        onChange={setDraft}
        rows={compact ? 2 : 4}
      />
    </div>
  );
}

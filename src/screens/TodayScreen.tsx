/**
 * Σημερινό μάθημα — everything about today, gathered in one place.
 *
 * Per the spec this is "a convenience aggregation view, not a data-entry
 * surface": today's date, the hours the master timetable says she teaches today,
 * today's agenda note, and quick links into the weekly lesson plans of the
 * classes she meets today. **Nothing here writes anything.** Every field it shows
 * is entered on another screen, which is why it takes no `run`.
 *
 * **`today` is a prop.** The shell reads the calendar once and passes the day down,
 * so this screen can be rendered on any date — which is the whole reason M3's
 * second acceptance criterion ("only today's scheduled classes, on a spot-checked
 * date") is testable rather than a matter of waiting for Wednesday.
 *
 * Each class hour carries a link into the attendance grid, opened on that
 * lesson's column — a link, not an entry form, so this view still writes
 * nothing.
 *
 * It reads the **master timetable** and nothing else for the schedule. That is the
 * single register of the teacher's week, so a class cannot appear twice here for
 * having been entered in two places.
 */
import { Button, Panel } from "../components/Fields";
import { hasNote, noteFor } from "../domain/agenda";
import { dayOff } from "../domain/attendance";
import { formatDate, mondayOf, weekdayOf } from "../domain/dates";
import { hasPlan, planFor } from "../domain/plans";
import { weekOf } from "../domain/schoolYear";
import { classesToday, formatHourTimes, hoursToday } from "../domain/timetable";
import type { Planner } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import { weekdayLabel } from "../i18n/vocabularies";
import type { AttendanceFocus } from "./AttendanceScreen";
import type { PlanFocus } from "./PlanScreen";

export default function TodayScreen({
  planner,
  today,
  onOpenPlan,
  onOpenAttendance,
}: {
  planner: Planner;
  today: string;
  onOpenPlan?: (focus: PlanFocus) => void;
  onOpenAttendance?: (focus: AttendanceFocus) => void;
}) {
  const t = useTranslate();
  const weekday = weekdayOf(today);
  const hours = hoursToday(planner, today);
  const classes = classesToday(planner, today);
  const week = weekOf(planner.school_year.start_date, today);
  const monday = mondayOf(today);
  const dayNote = noteFor(planner, "day", today);
  const weekNote = noteFor(planner, "week", monday);

  return (
    <>
      <Panel headingId="today.heading" introId="today.intro">
        <div className="agenda-heading">
          <h3>
            {t("today.date", {
              weekday: t(weekdayLabel(weekday)),
              date: formatDate(today),
            })}
          </h3>
          <span className="muted">
            {week === null
              ? t("agenda.noStartDate")
              : week.withinYear
                ? t("today.week", { n: week.week })
                : t("today.weekOutside")}
          </span>
        </div>
      </Panel>

      <Panel headingId="today.schedule">
        {planner.timetable_periods.length === 0 ? (
          <p className="muted">{t("today.noHoursAtAll")}</p>
        ) : hours.length === 0 ? (
          /* Weekday 7 has no row at all: the source's grid is Δευτέρα–Σάββατο. */
          <p className="muted">{weekday === 7 ? t("today.sunday") : t("today.noSchedule")}</p>
        ) : (
          <ul className="hours">
            {hours.map((hour) => (
              <li key={`${hour.period.id}:${hour.weekday}`}>
                <strong>{hour.period.name.trim() || t("common.none")}</strong>
                <span className="muted"> {formatHourTimes(hour.period)}</span>
                <span className="block">
                  {hour.schoolClass ? (
                    <strong>{hour.schoolClass.name.trim() || t("common.unnamed")}</strong>
                  ) : null}
                  {hour.subject && <span> {hour.subject}</span>}
                  {hour.room && <span className="muted"> · {hour.room}</span>}
                </span>
                {hour.cell.duty && <span className="duty block">{hour.cell.duty}</span>}
                {hour.cell.notes && <span className="muted block">{hour.cell.notes}</span>}
                {/* Not on a holiday or a day of leave: the grid has no lesson
                    column there to open. */}
                {hour.schoolClass &&
                  onOpenAttendance &&
                  !dayOff(planner, hour.schoolClass.id, today) && (
                  <Button
                    labelId="today.openAttendance"
                    onClick={() =>
                      onOpenAttendance({
                        classId: hour.schoolClass!.id,
                        date: today,
                        periodId: hour.period.id,
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel headingId="today.note">
        {hasNote(planner, "day", today) ? (
          <p className="entered">{dayNote.body}</p>
        ) : (
          <p className="muted">{t("today.noNote")}</p>
        )}
        {weekNote.body.trim() && (
          <>
            <h3>{t("today.weekNote")}</h3>
            <p className="entered">{weekNote.body}</p>
          </>
        )}
      </Panel>

      {classes.length > 0 && (
        <Panel headingId="today.plans">
          <ul className="rows">
            {classes.map((schoolClass) => {
              const plan = planFor(planner, schoolClass.id, monday);
              return (
                <li key={schoolClass.id} className="row">
                  <div>
                    <strong>{schoolClass.name.trim() || t("common.unnamed")}</strong>
                    {hasPlan(plan) ? (
                      <span className="block">{plan.notes}</span>
                    ) : (
                      <span className="muted block">{t("today.planEmpty")}</span>
                    )}
                  </div>
                  {onOpenPlan && (
                    <Button
                      labelId="today.openPlan"
                      onClick={() => onOpenPlan({ classId: schoolClass.id, date: today })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

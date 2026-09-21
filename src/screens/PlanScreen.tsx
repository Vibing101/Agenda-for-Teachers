/**
 * Εβδομαδιαίο πλάνο — one class's plan for one week.
 *
 * The source product has no single page for this: its nearest equivalents are the
 * 53 "Εβδομάδα αρ. N" pages and the week-by-class progress matrix, which is M6's
 * and which reads exactly the rows this screen writes. So the data shape matters
 * more here than page fidelity, and the shape is the spec's: one record per
 * (class, week), carrying weekly notes and one optional assessment.
 *
 * **The week is an actual date — the Monday — not a week index.** "Εβδομάδα αρ. 8"
 * is derived from the school year's start date for the heading only. Moving that
 * start date re-labels the heading and moves no plan, which is M3's first
 * acceptance criterion and the reason there is no week column anywhere.
 *
 * There is no "new plan" button, and that is not an omission: `(class, Monday)` is
 * the whole key and the screen already knows both halves, so a plan is created by
 * being saved. Nothing hands back an id, so there is no selection to move and no
 * room for the create-then-edit defect that cost M1 a data-loss bug.
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, Panel, TextArea } from "../components/Fields";
import { formatDate, mondayOf } from "../domain/dates";
import { hasPlan, planFor, type LessonPlan } from "../domain/plans";
import { weekOf } from "../domain/schoolYear";
import { addDays } from "../domain/dates";
import { formatHourTimes, hoursOfClass } from "../domain/timetable";
import type { Planner } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import { weekdayLabel } from "../i18n/vocabularies";
import type { Run } from "./types";

/** What the Today view asks the shell to open here. */
export interface PlanFocus {
  classId: number;
  /** Any day of the wanted week; snapped to its Monday. */
  date: string;
}

export default function PlanScreen({
  planner,
  run,
  today,
  focus,
}: {
  planner: Planner;
  run: Run;
  today: string;
  focus?: PlanFocus | null;
}) {
  const t = useTranslate();
  const [selectedId, setSelectedId] = useState<number | null>(planner.classes[0]?.id ?? null);
  const [monday, setMonday] = useState(() => mondayOf(today));

  // Keep a sensible selection as classes come and go.
  useEffect(() => {
    if (planner.classes.length === 0) setSelectedId(null);
    else if (!planner.classes.some((c) => c.id === selectedId)) {
      setSelectedId(planner.classes[0].id);
    }
  }, [planner.classes, selectedId]);

  // A link from the Today view lands on a specific class and week.
  useEffect(() => {
    if (focus) {
      setSelectedId(focus.classId);
      setMonday(mondayOf(focus.date));
    }
  }, [focus]);

  const selected = planner.classes.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Panel headingId="plan.heading" introId="plan.intro">
        {planner.classes.length === 0 ? (
          <p className="muted">{t("plan.noClasses")}</p>
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
          <Panel headingId="plan.week">
            <div className="agenda-bar">
              <WeekHeading planner={planner} monday={monday} />
              <div className="actions">
                <Button
                  labelId="common.previous"
                  onClick={() => setMonday(addDays(monday, -7))}
                />
                <Button
                  labelId="agenda.jumpToToday"
                  variant="primary"
                  onClick={() => setMonday(mondayOf(today))}
                />
                <Button labelId="common.next" onClick={() => setMonday(addDays(monday, 7))} />
              </div>
            </div>
          </Panel>

          <WeekPlan
            key={`${selected.id}:${monday}`}
            planner={planner}
            classId={selected.id}
            monday={monday}
            run={run}
          />

          <Panel headingId="plan.hoursThisWeek">
            {(() => {
              const hours = hoursOfClass(planner, selected.id);
              return hours.length === 0 ? (
                <p className="muted">{t("plan.noHours")}</p>
              ) : (
                <ul className="hours">
                  {hours.map((hour) => (
                    <li key={`${hour.period.id}:${hour.weekday}`}>
                      <strong>{t(weekdayLabel(hour.weekday))}</strong>{" "}
                      {hour.period.name.trim() || formatHourTimes(hour.period)}
                      {hour.room && <span className="muted"> · {hour.room}</span>}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Panel>
        </>
      )}
    </>
  );
}

/** "Εβδομάδα αρ. 8 · 02.11.2026 – 08.11.2026", the number derived for display. */
function WeekHeading({ planner, monday }: { planner: Planner; monday: string }) {
  const t = useTranslate();
  const week = weekOf(planner.school_year.start_date, monday);
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
        {t("agenda.weekSpan", { from: formatDate(monday), to: formatDate(addDays(monday, 6)) })}
      </span>
    </div>
  );
}

function WeekPlan({
  planner,
  classId,
  monday,
  run,
}: {
  planner: Planner;
  classId: number;
  monday: string;
  run: Run;
}) {
  const t = useTranslate();
  const stored = planFor(planner, classId, monday);
  const [draft, setDraft] = useState(stored);
  const [lastStored, setLastStored] = useState(stored);

  // The `useStoredDraft` rule, inline because the key here is a pair rather than
  // a record id: follow the stored plan when it really changes, and leave a
  // half-typed one alone when something unrelated was saved.
  if (JSON.stringify(stored) !== JSON.stringify(lastStored)) {
    setLastStored(stored);
    setDraft(stored);
  }

  const patch = (p: Partial<LessonPlan>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <Panel headingId="plan.notes">
      {!hasPlan(stored) && <p className="muted">{t("plan.empty")}</p>}
      <TextArea
        labelId="plan.notes"
        value={draft.notes}
        onChange={(notes) => patch({ notes })}
        rows={6}
      />
      <TextArea
        labelId="plan.assessment"
        value={draft.assessment}
        onChange={(assessment) => patch({ assessment })}
      />
      <p className="hint">{t("plan.assessmentHint")}</p>
      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() =>
            run(() =>
              // The Monday is what is written, never the day the teacher happened
              // to be looking at.
              api.saveLessonPlan({ ...draft, class_id: classId, week_monday: monday }),
            )
          }
        />
      </div>
    </Panel>
  );
}

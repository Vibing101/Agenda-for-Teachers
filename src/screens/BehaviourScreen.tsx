/**
 * Διαγωγή και περιστατικά — the behaviour/incident log.
 *
 * The source page is a flat register "κατάλληλο για επίσημη τεκμηρίωση" with
 * columns for the date, the student, the class, what happened, the action taken
 * and whether the parents were informed. That is what this is.
 *
 * **An entry belongs to the student and follows her across every class.** The
 * spec files this under module 2 and delivers it in M4, and it says the log is
 * "dated, cross-class (follows the student)". So the register is not scoped to
 * a class: the class column is an optional note of where it happened, and the
 * filters below narrow what is shown without changing what is stored.
 *
 * **Rows are edited in place**, like the absence register's and the timetable's
 * hours, rather than through an editor bound to a selected record. Each field
 * carries its own row's id, so "new incident" has no selection to move — the
 * shape that cost M1 a data-loss bug does not occur here. The regression test
 * still starts from a planner that already holds incidents.
 */
import { useMemo, useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import { Button, CheckboxField, DeferredTextField, Panel } from "../components/Fields";
import {
  allIncidents,
  classOf,
  emptyIncident,
  filteredIncidents,
  studentOf,
  type Incident,
} from "../domain/behaviour";
import { formatDate } from "../domain/dates";
import type { Planner } from "../domain/types";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import { incidentSheetHtml } from "../print/behaviourSheet";
import type { Run } from "./types";

export default function BehaviourScreen({
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
  /** 0 means "all", so a filter never hides a row it cannot name. */
  const [studentFilter, setStudentFilter] = useState(0);
  const [classFilter, setClassFilter] = useState(0);

  const filter = useMemo(
    () => ({ studentId: studentFilter, classId: classFilter }),
    [studentFilter, classFilter],
  );
  /**
   * The rows on screen — and, through the same selector, the rows on the
   * printed sheet. One definition, so the paper cannot disagree with the
   * screen for the same filter.
   */
  const shown = useMemo(() => filteredIncidents(planner, filter), [planner, filter]);

  const all = allIncidents(planner);
  const filterClass = planner.classes.find((c) => c.id === classFilter);

  return (
    <Panel
      headingId="behaviour.heading"
      introId="behaviour.intro"
      actions={
        <>
          <Button
            labelId="behaviour.new"
            variant="primary"
            disabled={planner.students.length === 0}
            onClick={() =>
              run(() => api.saveIncident(emptyIncident(studentFilter || planner.students[0].id)))
            }
          />
          {/* Prints exactly what the filter above is showing, and names that
              filter on the sheet's own header. */}
          <ExportButton
            labelId="behaviour.export"
            fileName={t("behaviour.fileName", {
              scope: filterClass?.name.trim() || t("print.filterAll"),
              date: formatDate(today),
            })}
            html={() => incidentSheetHtml(t, planner, filter, today)}
          />
        </>
      }
    >
      {planner.students.length === 0 ? (
        <p className="muted">{t("behaviour.noStudents")}</p>
      ) : (
        <>
          {/* Names are the teacher's own text, so these are plain selects. */}
          <div className="row">
            <label className="field">
              <span>{t("behaviour.filterStudent")}</span>
              <select
                value={String(studentFilter)}
                onChange={(e) => setStudentFilter(Number(e.target.value))}
              >
                <option value="0">{t("behaviour.filterAll")}</option>
                {planner.students.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.full_name.trim() || t("common.unnamed")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("behaviour.filterClass")}</span>
              <select
                value={String(classFilter)}
                onChange={(e) => setClassFilter(Number(e.target.value))}
              >
                <option value="0">{t("behaviour.filterAll")}</option>
                {planner.classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name.trim() || t("common.unnamed")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {all.length === 0 ? (
            <p className="muted">{t("behaviour.none")}</p>
          ) : shown.length === 0 ? (
            <p className="muted">{t("behaviour.noMatches")}</p>
          ) : (
            <>
              <p className="muted">{countOf(t, "behaviour.count", shown.length)}</p>
              <ul className="rows">
                {shown.map((incident, index) => (
                  <IncidentRow
                    key={incident.id}
                    incident={incident}
                    index={index + 1}
                    planner={planner}
                    run={run}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

function IncidentRow({
  incident,
  index,
  planner,
  run,
}: {
  incident: Incident;
  index: number;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this row's own id, so one entry can never write another.
  const save = (patch: Partial<Incident>) => run(() => api.saveIncident({ ...incident, ...patch }));
  const student = studentOf(planner, incident);
  const schoolClass = classOf(planner, incident);

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("behaviour.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={incident.date}
          onCommit={(date) => save({ date })}
        />
        <label className="field">
          <span>{t("behaviour.student")}</span>
          <select
            value={String(student?.id ?? incident.student_id)}
            onChange={(e) => save({ student_id: Number(e.target.value) })}
          >
            {planner.students.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.full_name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        {/* Optional: an incident need not have happened in any one class, and
          deleting a class empties this rather than deleting the entry. */}
        <label className="field">
          <span>{t("behaviour.class")}</span>
          <select
            value={String(schoolClass?.id ?? 0)}
            onChange={(e) => {
              const id = Number(e.target.value);
              save({ class_id: id === 0 ? null : id });
            }}
          >
            <option value="0">{t("behaviour.noClass")}</option>
            {planner.classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="behaviour.whatHappened"
          value={incident.what_happened}
          onCommit={(what_happened) => save({ what_happened })}
        />
        <DeferredTextField
          labelId="behaviour.actionTaken"
          value={incident.action_taken}
          onCommit={(action_taken) => save({ action_taken })}
        />
        <CheckboxField
          labelId="behaviour.parentsInformed"
          checked={incident.parents_informed}
          onChange={(parents_informed) => save({ parents_informed })}
        />
        <Button
          labelId="behaviour.remove"
          variant="danger"
          onClick={() => run(() => api.deleteIncident(incident.id))}
        />
      </div>
    </li>
  );
}

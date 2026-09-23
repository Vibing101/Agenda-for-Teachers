/**
 * Στήριξη — support plans per student, and the cross-class support overview.
 *
 * Three things here carry the milestone's weight.
 *
 * **1. `Νέο πλάνο στήριξης` is the one place in M4 that genuinely has M1's
 * shape.** A plan is a card, so it is edited through one editor bound to a
 * *selected* record — exactly the arrangement in which `Νέο τμήμα` and
 * `Νέος μαθητής` silently overwrote the previously selected row. The fix M1
 * arrived at is applied here from the start: `run` hands back the planner it
 * read from disk, the button finds the row the backend assigned an id to, and
 * selects it. A regression test starts from a planner that already has a plan
 * selected and asserts the sibling plan comes back byte-for-byte unchanged.
 * (The other three M4 record types avoid the shape entirely by being edited in
 * place as lists — see `AttendanceScreen` and `BehaviourScreen`.)
 *
 * **2. A plan's status is the teacher's sentence and nothing else writes it.**
 * The spec calls it "written by the teacher, never computed". The goals below
 * it have their own ratings in their own table and their own command; no path
 * exists from a goal to a plan's status at any layer. The field carries a hint
 * saying so, because a teacher looking at a list of "Επιτεύχθηκε" goals would
 * reasonably wonder whether the app had decided for her.
 *
 * **3. The overview is a selector, not a stored roll-up.** It is computed from
 * the loaded planner every render, so a plan edited from anywhere shows there
 * immediately with nothing to regenerate — M4's third acceptance criterion.
 *
 * The ΕΠΕ box M1 put on the student card is *not* this. It stays on the card
 * and is shown here read-only, so it is obvious which field is which.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import {
  Button,
  DeferredTextField,
  Entered,
  Panel,
  TextArea,
  TextField,
} from "../components/Fields";
import { useStoredDraft } from "../components/useStoredDraft";
import { formatDate } from "../domain/dates";
import {
  emptyGoal,
  emptyPlan,
  goalsOfPlan,
  plansOfStudent,
  supportOverview,
  type SupportGoal,
  type SupportPlan,
} from "../domain/support";
import type { Planner, Student } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import { GOAL_PROGRESS, goalProgressLabel, senStatusLabel } from "../i18n/vocabularies";
import { supportOverviewHtml } from "../print/supportSheet";
import type { Run } from "./types";

export default function SupportScreen({
  planner,
  run,
  today,
}: {
  planner: Planner;
  run: Run;
  /** The day the shell read from the calendar. Never read here directly. */
  today: string;
}) {
  const [studentId, setStudentId] = useState<number | null>(planner.students[0]?.id ?? null);
  useEffect(() => {
    if (planner.students.length === 0) setStudentId(null);
    else if (!planner.students.some((s) => s.id === studentId)) {
      setStudentId(planner.students[0].id);
    }
  }, [planner.students, studentId]);

  const student = planner.students.find((s) => s.id === studentId) ?? null;

  return (
    <>
      <Plans planner={planner} run={run} student={student} onPickStudent={setStudentId} />
      <Overview planner={planner} today={today} />
    </>
  );
}

function Plans({
  planner,
  run,
  student,
  onPickStudent,
}: {
  planner: Planner;
  run: Run;
  student: Student | null;
  onPickStudent: (id: number) => void;
}) {
  const t = useTranslate();
  // Memoised so the effect below does not see a new array every render.
  const plans = useMemo(
    () => (student ? plansOfStudent(planner, student.id) : []),
    [planner, student],
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Keep the selection on a plan that still exists and still belongs to the
  // student on screen — switching student must not leave the card bound to
  // someone else's plan.
  useEffect(() => {
    if (plans.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!plans.some((p) => p.id === selectedId)) {
      setSelectedId(plans[0].id);
    }
  }, [plans, selectedId]);

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  if (planner.students.length === 0) {
    return (
      <Panel headingId="support.heading" introId="support.intro">
        <p className="muted">{t("support.noStudents")}</p>
      </Panel>
    );
  }

  return (
    <Panel
      headingId="support.heading"
      introId="support.intro"
      actions={
        <Button
          labelId="support.new"
          variant="primary"
          disabled={student === null}
          onClick={async () => {
            if (!student) return;
            // **The M1 fix, applied from the start.** Without these three lines
            // the card would stay bound to the previously selected plan and the
            // teacher's first keystroke would overwrite it. `run` returns the
            // planner it read back from disk, which is the only place the id
            // the backend assigned can be found.
            const before = new Set(plans.map((p) => p.id));
            const next = await run(() => api.saveSupportPlan(emptyPlan(student.id)));
            const created = next?.support_plans.find(
              (p) => p.student_id === student.id && !before.has(p.id),
            );
            if (created) setSelectedId(created.id);
          }}
        />
      }
    >
      {/* Student names are the teacher's own text, so a plain select. */}
      <label className="field">
        <span>{t("support.pickStudent")}</span>
        <select
          value={String(student?.id ?? 0)}
          onChange={(e) => onPickStudent(Number(e.target.value))}
        >
          {planner.students.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.full_name.trim() || t("common.unnamed")}
            </option>
          ))}
        </select>
      </label>

      {student && <CardBox student={student} />}

      {plans.length === 0 ? (
        <p className="muted">{t("support.none")}</p>
      ) : (
        <ul className="chips">
          {plans.map((plan, index) => (
            <li key={plan.id}>
              <button
                type="button"
                className={plan.id === selectedId ? "chip selected" : "chip"}
                onClick={() => setSelectedId(plan.id)}
              >
                <strong>{t("support.plan", { n: index + 1 })}</strong>
                <span className="muted">
                  {plan.start_date ? formatDate(plan.start_date) : t("common.none")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <PlanCard key={selected.id} plan={selected} planner={planner} run={run} />}
    </Panel>
  );
}

/**
 * The student card's own ΕΠΕ box, read-only.
 *
 * Shown so the distinction the spec leaves implicit is visible: this box is one
 * per student and lives on her card (M1), while a support plan is a separate,
 * repeatable record (M4). Nothing here writes — editing it is the card's job.
 */
function CardBox({ student }: { student: Student }) {
  const t = useTranslate();
  return (
    <div className="card">
      <h4>{t("support.cardBox")}</h4>
      <dl>
        <dt>{t("overview.senStatus")}</dt>
        <dd>{t(senStatusLabel(student.sen_status))}</dd>
        <dt>{t("students.senPlan")}</dt>
        <dd>
          <Entered value={student.sen_plan} fallbackId="common.none" />
        </dd>
        <dt>{t("students.senAccommodations")}</dt>
        <dd>
          <Entered value={student.sen_accommodations} fallbackId="common.none" />
        </dd>
      </dl>
      <p className="note">{t("support.cardBoxHint")}</p>
    </div>
  );
}

/**
 * One plan, as a card, plus its goals.
 *
 * The card is one flat draft saved in one call, like the student card, so every
 * field round-trips together. **The goals are saved separately**, through their
 * own command — which is exactly why saving them cannot disturb `status`.
 */
function PlanCard({ plan, planner, run }: { plan: SupportPlan; planner: Planner; run: Run }) {
  const t = useTranslate();
  const [draft, setDraft] = useStoredDraft(plan);
  const patch = (p: Partial<SupportPlan>) => setDraft((d) => ({ ...d, ...p }));
  const goals = goalsOfPlan(planner, plan.id);

  return (
    <div className="card">
      <h3>{t("support.planCard")}</h3>
      <div className="row">
        <TextField
          labelId="support.startDate"
          type="date"
          value={draft.start_date}
          onChange={(start_date) => patch({ start_date })}
        />
        <TextField
          labelId="support.monitoringFrequency"
          value={draft.monitoring_frequency}
          onChange={(monitoring_frequency) => patch({ monitoring_frequency })}
        />
        <TextField
          labelId="support.nextReview"
          type="date"
          value={draft.next_review}
          onChange={(next_review) => patch({ next_review })}
        />
      </div>
      <TextArea
        labelId="support.strengths"
        value={draft.strengths}
        onChange={(strengths) => patch({ strengths })}
      />
      <TextArea
        labelId="support.needs"
        value={draft.needs}
        onChange={(needs) => patch({ needs })}
      />
      <TextArea
        labelId="support.accommodations"
        value={draft.accommodations}
        onChange={(accommodations) => patch({ accommodations })}
      />
      <TextArea
        labelId="support.collaboration"
        value={draft.collaboration}
        onChange={(collaboration) => patch({ collaboration })}
      />

      {/* Free text, deliberately: the spec says this one is hers to write. */}
      <TextField
        labelId="support.status"
        hintId="support.statusHint"
        value={draft.status}
        onChange={(status) => patch({ status })}
      />

      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() => run(() => api.saveSupportPlan(draft))}
        />
        <Button
          labelId="support.remove"
          variant="danger"
          onClick={() => run(() => api.deleteSupportPlan(plan.id))}
        />
      </div>
      <p className="note">{t("support.removeWarning")}</p>

      <h4>{t("support.goals")}</h4>
      {goals.length === 0 ? (
        <p className="muted">{t("support.noGoals")}</p>
      ) : (
        <ul className="rows">
          {goals.map((goal, index) => (
            <GoalRow key={goal.id} goal={goal} index={index + 1} run={run} />
          ))}
        </ul>
      )}
      <div className="actions">
        <Button
          labelId="support.newGoal"
          onClick={() => run(() => api.saveSupportGoal(emptyGoal(plan.id)))}
        />
      </div>
    </div>
  );
}

/**
 * One goal, edited in place.
 *
 * Each field carries this goal's own id, so no goal can write another — and
 * `api.saveSupportGoal` reaches `support_goal` and nothing else, so none of
 * them can reach the plan's status.
 */
function GoalRow({ goal, index, run }: { goal: SupportGoal; index: number; run: Run }) {
  const t = useTranslate();
  const save = (patch: Partial<SupportGoal>) =>
    run(() => api.saveSupportGoal({ ...goal, ...patch }));

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("support.goalN", { n: index })}>
        <DeferredTextField
          labelId="support.goal"
          value={goal.goal}
          onCommit={(text) => save({ goal: text })}
        />
        {/* A plain select, because "not rated yet" is a real value with no code. */}
        <label className="field">
          <span>{t("support.progress")}</span>
          <select
            value={goal.progress}
            onChange={(e) => save({ progress: e.target.value as SupportGoal["progress"] })}
          >
            <option value="">{t("support.progressNone")}</option>
            {GOAL_PROGRESS.map((code) => (
              <option key={code} value={code}>
                {t(goalProgressLabel(code))}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="support.monitoredOn"
          type="date"
          value={goal.monitored_on}
          onCommit={(monitored_on) => save({ monitored_on })}
        />
        <Button
          labelId="support.removeGoal"
          variant="danger"
          onClick={() => run(() => api.deleteSupportGoal(goal.id))}
        />
      </div>
    </li>
  );
}

/**
 * The cross-class support overview — the source's "Στήριξη και προσαρμογές ·
 * ετήσια επισκόπηση".
 *
 * One row per student, merging **both** card-level flags M1 shipped —
 * `Student.sen_status` from her ΕΠΕ box and `Enrollment.support` from each
 * class's roster, with that class's own note — against every plan's status and
 * next review date. See `domain/support.ts` for why both.
 *
 * Computed live, never stored, which is what makes a change made in one class
 * appear here at once.
 */
function Overview({ planner, today }: { planner: Planner; today: string }) {
  const t = useTranslate();
  const rows = supportOverview(planner);

  return (
    <Panel
      headingId="overview.heading"
      introId="overview.intro"
      actions={
        <ExportButton
          labelId="overview.export"
          fileName={t("overview.fileName", { date: formatDate(today) })}
          html={() => supportOverviewHtml(t, planner, today)}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="muted">{t("overview.none")}</p>
      ) : (
        <>
          <p className="muted">{t("overview.count", { n: rows.length })}</p>
          <div className="timetable-scroll">
            <table className="overview">
              <thead>
                <tr>
                  <th>{t("overview.student")}</th>
                  <th>{t("overview.classes")}</th>
                  <th>{t("overview.senStatus")}</th>
                  <th>{t("overview.classSupport")}</th>
                  <th>{t("overview.accommodations")}</th>
                  <th>{t("overview.planStatus")}</th>
                  <th>{t("overview.nextReview")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student.id}>
                    <th scope="row">{row.student.full_name.trim() || t("common.unnamed")}</th>
                    <td>{row.classes.map((c) => c.name.trim()).join(", ")}</td>
                    <td>{t(senStatusLabel(row.senStatus))}</td>
                    <td>
                      {row.supportClasses.length === 0 ? (
                        <span className="muted">{t("common.none")}</span>
                      ) : (
                        <ul className="plain">
                          {row.supportClasses.map(({ schoolClass, note }) => (
                            <li key={schoolClass.id}>
                              {schoolClass.name.trim() || t("common.unnamed")}
                              {note.trim() && <span className="muted"> — {note}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <Entered value={row.accommodations} fallbackId="common.none" />
                    </td>
                    <td>
                      {row.plans.length === 0 ? (
                        <span className="muted">{t("overview.noPlans")}</span>
                      ) : (
                        <ul className="plain">
                          {row.plans.map((plan, index) => (
                            <li key={plan.id}>
                              <span className="muted">{t("support.plan", { n: index + 1 })}: </span>
                              <Entered value={plan.status} fallbackId="common.none" />
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      {row.plans.length === 0 ? (
                        <span className="muted">{t("common.none")}</span>
                      ) : (
                        <ul className="plain">
                          {row.plans.map((plan) => (
                            <li key={plan.id}>
                              {plan.next_review ? (
                                formatDate(plan.next_review)
                              ) : (
                                <span className="muted">{t("common.none")}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="note">{t("overview.merged")}</p>
    </Panel>
  );
}
